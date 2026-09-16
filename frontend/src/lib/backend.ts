/**
 * Translates DTOs from the real Miyar backend (api.ts) into this app's existing
 * `Organization` / `CatalogItem` / `TestRequest` / ... shapes, so every screen
 * that already reads from the Zustand store keeps working unchanged.
 *
 * This is the ONLY file allowed to know both "shapes" — components and store.ts
 * actions should never reach into a raw backend DTO directly.
 */
import type { Organization, CatalogItem, EntityType, TestRequest, TestItem, TestStatus, RequestStatus, TimeSlot, Delegation, DelegationStatus, Contract } from './types'
import { ApiError, callDocMethod, callMethod, getList, insertDoc, loadDemoTokens, updateDoc, type AuthInfo } from './api'

/** Backend Delegation rows store real Frappe user emails; the frontend's fixed demo
 * roster identifies users by a short id ("u-lab-emp"). This resolves email -> that id
 * so delegation-based visibility (`visibleRequests` in store.ts) keeps working unchanged. */
async function emailToUserIdMap(): Promise<Record<string, string>> {
  const tokens = await loadDemoTokens()
  const map: Record<string, string> = {}
  for (const [userId, entry] of Object.entries(tokens)) map[entry.email] = userId
  return map
}

export const BACKEND_TO_ENTITY_TYPE: Record<string, EntityType> = {
  Laboratory: 'lab',
  Contractor: 'contractor',
  'Consulting Office': 'consultant',
  'Supervisory Authority': 'supervisor',
}
export const ENTITY_TYPE_TO_BACKEND: Record<EntityType, string> = {
  lab: 'Laboratory', contractor: 'Contractor', consultant: 'Consulting Office', supervisor: 'Supervisory Authority', ops: '',
}

interface DirectoryEntity {
  name: string; entity_type: string; entity_name: string; logo: string | null; description: string | null
  average_rating: number; review_count: number; specializations?: { code: string; label_ar: string; label_en: string }[]
}

/** Entity.description is a Frappe "Text Editor" field — it stores rich-text HTML
 * (e.g. `<div class="ql-editor..."><p>...</p></div>`), not plain text. The frontend's
 * `Organization.about` is rendered as plain text, so this strips markup down to
 * readable text rather than showing raw tags. */
function stripHtml(html: string | null | undefined): string {
  if (!html) return ''
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function orgFromDirectoryEntity(e: DirectoryEntity): Organization {
  return {
    id: e.name,
    type: BACKEND_TO_ENTITY_TYPE[e.entity_type] ?? 'contractor',
    name: e.entity_name,
    cr: '—',
    city: '',
    region: '',
    logo: e.logo ?? undefined,
    about: stripHtml(e.description),
    specialties: (e.specializations ?? []).map(s => s.label_ar || s.label_en || s.code),
    phone: '',
    email: '',
    address: '',
    rating: Math.round((e.average_rating ?? 0) * 5 * 10) / 10,
    reviews: e.review_count ?? 0,
    active: true,
    kpis: [],
  }
}

/** B.R.126 — an Entity managing its own profile (name, "about" text, contact channels).
 * Only the fields with a clean 1:1 backend mapping are persisted here; city/address/
 * specialties/website have no matching Entity field yet and stay local-only for now. */
export async function updateEntityProfile(entityId: string, patch: { name?: string; about?: string; phone?: string; email?: string }): Promise<void> {
  const data: Record<string, unknown> = {}
  if (patch.name !== undefined) data.entity_name = patch.name
  if (patch.about !== undefined) data.description = patch.about
  const channels: { channel_type: string; value: string }[] = []
  if (patch.phone) channels.push({ channel_type: 'Phone', value: patch.phone })
  if (patch.email) channels.push({ channel_type: 'Email', value: patch.email })
  if (channels.length) data.contact_channels = channels
  if (Object.keys(data).length === 0) return
  await updateDoc('Entity', entityId, data)
}

/** B.R.122-131 — every visible Entity in the public directory, mapped to `Organization[]`. */
export async function fetchDirectoryOrgs(): Promise<Organization[]> {
  const result = await callMethod<{ results: DirectoryEntity[]; total: number }>(
    'miyar.miyar_core.api.directory.get_directory',
    { page_length: 500 },
    'GET',
  )
  return result.results.map(orgFromDirectoryEntity)
}

interface PublicCatalogRow {
  name: string; laboratory: string; test_type: string; price: number; currency: string; turnaround_days: number
  test_type_label?: { code: string; label_ar: string; label_en: string }
}

const CATALOG_STATUS: Record<string, CatalogItem['status']> = { Active: 'STS01', 'On Hold': 'STS02' }

export async function fetchPublicCatalog(): Promise<CatalogItem[]> {
  const rows = await callMethod<PublicCatalogRow[]>('miyar.miyar_core.api.directory.get_public_catalog', {}, 'GET')
  return rows.map(r => ({
    id: r.name,
    labId: r.laboratory,
    refTestId: r.test_type,
    unit: 'Ea',
    methods: [],
    basePrice: r.price,
    sla: r.turnaround_days,
    status: 'STS01',
  }))
}

/** The lab's own full catalog (including On Hold items) — authenticated call. */
export async function fetchLabCatalog(laboratory: string): Promise<CatalogItem[]> {
  const rows = await getList<{ name: string; laboratory: string; test_type: string; price: number; turnaround_days: number; status: string }>(
    'Lab Test Catalog Item',
    { filters: { laboratory }, fields: ['name', 'laboratory', 'test_type', 'price', 'turnaround_days', 'status'] },
  )
  return rows.map(r => ({
    id: r.name, labId: r.laboratory, refTestId: r.test_type, unit: 'Ea', methods: [],
    basePrice: r.price, sla: r.turnaround_days, status: CATALOG_STATUS[r.status] ?? 'STS03',
  }))
}

/* ───────── Miyar Contract ───────── */

interface BackendContract {
  name: string; contractor: string; laboratory: string; consulting_office: string
  status: string; start_date: string; docstatus: number
}

export function contractFromBackend(c: BackendContract): Contract {
  return {
    id: c.name,
    contractorId: c.contractor,
    labId: c.laboratory,
    consultantId: c.consulting_office,
    project: c.name,
    // The backend Contract isn't scoped to a service type — any Test Request's own
    // service_type decides that — so both are always available on a real contract.
    services: ['standard', 'geotech'],
    payment: 'on-completion',
    startedAt: c.start_date,
    active: c.status === 'Active' && c.docstatus === 1,
  }
}

export async function fetchMyContracts(): Promise<Contract[]> {
  const rows = await getList<BackendContract>('Miyar Contract', {
    fields: ['name', 'contractor', 'laboratory', 'consulting_office', 'status', 'start_date', 'docstatus'],
    order_by: 'creation desc',
  })
  return rows.map(contractFromBackend)
}

/* ───────── Test Request ───────── */

const REQUEST_STATUS: Record<string, RequestStatus> = {
  Draft: 'STS09', 'Execution Planning': 'STS10', 'Pending Laboratory Decision': 'STS11', Accepted: 'STS12',
  Rejected: 'STS13', 'In Progress': 'STS14', Completed: 'STS15', Cancelled: 'STS16',
}
const TEST_STATUS: Record<string, TestStatus> = {
  'Not Started': 'STS17', 'In Progress': 'STS18', 'Pending Consultant Decision': 'STS19', Accepted: 'STS20', Rejected: 'STS21',
}

interface BackendTestRequestItem {
  name: string; idx: number; test_type: string; status: string
}
interface BackendTestRequest {
  name: string; contract: string; contractor: string; laboratory: string; consulting_office: string
  service_type?: string; status: string; creation: string; site_location?: string
  test_items: BackendTestRequestItem[]
  schedule_slots?: { slot_datetime: string; is_selected?: number }[]
  rejection_reason?: string
}

function slotFromDatetime(dt: string): TimeSlot {
  const d = new Date(dt.replace(' ', 'T'))
  const hh = String(d.getHours()).padStart(2, '0')
  return { date: d.toISOString().slice(0, 10), from: `${hh}:00`, to: `${String((d.getHours() + 2) % 24).padStart(2, '0')}:00` }
}

export function requestFromBackend(r: BackendTestRequest): TestRequest {
  return {
    id: r.name,
    contractId: r.contract,
    contractorId: r.contractor,
    labId: r.laboratory,
    consultantId: r.consulting_office,
    project: r.contract,
    service: r.service_type === 'GEO-STUDY' ? 'geotech' : 'standard',
    status: REQUEST_STATUS[r.status] ?? 'STS09',
    createdAt: r.creation,
    slots: (r.schedule_slots ?? []).map(s => slotFromDatetime(s.slot_datetime)),
    chosenSlot: (r.schedule_slots ?? []).find(s => s.is_selected)
      ? slotFromDatetime((r.schedule_slots ?? []).find(s => s.is_selected)!.slot_datetime)
      : undefined,
    location: r.site_location ?? '',
    tests: (r.test_items ?? []).map((t): TestItem => ({
      id: String(t.idx),
      refTestId: t.test_type,
      method: '',
      price: 0,
      sla: 0,
      status: TEST_STATUS[t.status] ?? 'STS17',
    })),
    history: [],
    rejectReason: r.rejection_reason,
  }
}

export async function fetchMyRequests(): Promise<TestRequest[]> {
  const rows = await getList<BackendTestRequest>('Test Request', {
    fields: ['name', 'contract', 'contractor', 'laboratory', 'consulting_office', 'service_type', 'status', 'creation', 'site_location', 'rejection_reason'],
    order_by: 'creation desc',
  })
  // test_items / schedule_slots are child tables — the list API omits them, so hydrate each doc.
  const { getDoc } = await import('./api')
  const full = await Promise.all(rows.map(r => getDoc<BackendTestRequest>('Test Request', r.name)))
  return full.map(requestFromBackend)
}

const SERVICE_TYPE_CODE: Record<'standard' | 'geotech', string> = { standard: 'STD-TEST', geotech: 'GEO-STUDY' }

function slotToDatetime(s: TimeSlot): string {
  return `${s.date} ${s.from}:00`
}

/** B.R.132, 135, 139 — create a real Draft Test Request, submit it, then send it to
 * the laboratory in one step (mirrors NewRequest.tsx's "send" action). Returns the
 * real backend id (e.g. "TR-2026-00007") — this replaces the mock "TST-2026-NNN"
 * numbering for anything created from here on. */
export async function createAndSendRequest(input: {
  contract: string
  service: 'standard' | 'geotech'
  testTypeIds: string[]
  slots: TimeSlot[]
  siteLocation?: string
}): Promise<string> {
  const created = await insertDoc<{ name: string }>('Test Request', {
    contract: input.contract,
    service_type: SERVICE_TYPE_CODE[input.service],
    test_items: input.testTypeIds.map(test_type => ({ test_type })),
    schedule_slots: input.slots.map(s => ({ slot_datetime: slotToDatetime(s) })),
  })
  // `Document.submit` is itself a whitelisted instance method — calling it via
  // callDocMethod fetches the document fresh from the DB server-side, unlike
  // frappe.client.submit (which reconstructs an in-memory Document from whatever
  // partial dict the caller passes, failing mandatory-field validation for anything
  // short of every field).
  await callDocMethod('Test Request', created.name, 'submit')
  await callDocMethod('Test Request', created.name, 'send_to_laboratory')
  return created.name
}

/** B.R.147 — the Laboratory's accept/reject decision. `slotDatetime` must be one of
 * the request's own proposed slots (required when accepting). */
export async function decideRequest(requestId: string, accept: boolean, slotDatetime?: string, rejectionReason?: string): Promise<void> {
  if (accept) {
    await callDocMethod('Test Request', requestId, 'laboratory_accept', { slot_datetime: slotDatetime })
  } else {
    await callDocMethod('Test Request', requestId, 'laboratory_reject', { rejection_reason: rejectionReason })
  }
}

export async function startRequestProgress(requestId: string): Promise<void> {
  await callDocMethod('Test Request', requestId, 'start_progress')
}

/** B.R.151-153 — Lab marks a test's output ready for review, or Consultant records Accept/Reject. */
export async function setTestItemStatus(requestId: string, itemIdx: number, status: string): Promise<void> {
  await callDocMethod('Test Request', requestId, 'set_item_status', { item_idx: itemIdx, status })
}

/* ───────── Delegation ───────── */

const DELEGATION_STATUS: Record<string, DelegationStatus> = {
  'Pending Acceptance': 'STS22', Active: 'STS23', Rejected: 'STS24',
}

interface BackendDelegation {
  name: string; delegation_type: string; scope: string; test_request: string; test_request_item?: string
  delegated_by: string; delegated_to: string; status: string; creation: string
}

export function delegationFromBackend(d: BackendDelegation, emailToUserId: Record<string, string>): Delegation {
  return {
    id: d.name,
    type: d.delegation_type === 'Direct' ? 'direct' : 'indirect',
    scope: d.scope === 'Single Test' ? 'test' : 'request',
    requestId: d.test_request,
    testId: d.test_request_item,
    fromUserId: emailToUserId[d.delegated_by] ?? d.delegated_by,
    toUserId: emailToUserId[d.delegated_to] ?? d.delegated_to,
    status: DELEGATION_STATUS[d.status] ?? 'STS22',
    createdAt: d.creation,
  }
}

async function resolveTestRequestItemName(requestId: string, idx: string): Promise<string> {
  const rows = await getList<{ name: string }>('Test Request Item', { filters: { parent: requestId, idx: Number(idx) }, fields: ['name'] })
  if (!rows.length) throw new ApiError('تعذّر تحديد الاختبار المحدد للتفويض.')
  return rows[0].name
}

/** B.R.232-233 — create a real Delegation. `toUserId` is the frontend's fixed demo
 * user id (e.g. "u-lab-emp"), resolved here to the real backend user email. */
export async function createRealDelegation(input: {
  type: 'direct' | 'indirect'
  scope: 'request' | 'test'
  requestId: string
  testId?: string
  toUserId: string
}): Promise<string> {
  const tokens = await loadDemoTokens()
  const toEmail = tokens[input.toUserId]?.email
  if (!toEmail) throw new ApiError(`لا يوجد حساب خلفي لهذا المستخدم التجريبي (${input.toUserId}).`)
  const testRequestItem = input.scope === 'test' && input.testId ? await resolveTestRequestItemName(input.requestId, input.testId) : undefined
  const created = await insertDoc<{ name: string }>('Delegation', {
    delegation_type: input.type === 'direct' ? 'Direct' : 'Indirect',
    scope: input.scope === 'test' ? 'Single Test' : 'Full Request',
    test_request: input.requestId,
    test_request_item: testRequestItem,
    delegated_to: toEmail,
  })
  await callDocMethod('Delegation', created.name, 'submit')
  return created.name
}

/** B.R.234 — the delegate's own accept/reject of an Indirect delegation. */
export async function respondToDelegation(delegationId: string, accept: boolean): Promise<void> {
  await callDocMethod('Delegation', delegationId, accept ? 'accept' : 'reject')
}

export async function fetchMyDelegations(): Promise<Delegation[]> {
  const [rows, emailToUserId] = await Promise.all([
    getList<BackendDelegation>('Delegation', {
      fields: ['name', 'delegation_type', 'scope', 'test_request', 'test_request_item', 'delegated_by', 'delegated_to', 'status', 'creation'],
      order_by: 'creation desc',
    }),
    emailToUserIdMap(),
  ])
  return rows.map(d => delegationFromBackend(d, emailToUserId))
}

export function authToUser(auth: AuthInfo) {
  return { email: auth.email, fullName: auth.fullName, orgId: auth.orgId, entity: auth.entity }
}
