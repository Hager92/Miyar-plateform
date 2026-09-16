import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type {
  User, Organization, RefTest, CatalogItem, Contract, TestRequest, TestItem, Study, Delegation, Rating, BusinessRules, Notification,
  Role, TimeSlot, Borehole, Layer, Sample, Coord, AuditEntry, AuditEvent, Document, Invoice, Policy, Quote, QuoteItem, Template, KnowledgeVersion, Organization as Org,
} from './types'
import { USERS, ORGS, REF_TESTS, CATALOG, CONTRACTS, REQUESTS, STUDIES, DELEGATIONS, RATINGS, RULES, NOTIFICATIONS, AUDIT, DOCUMENTS, INVOICES, POLICIES, QUOTES, TEMPLATES, KNOWLEDGE_VERSIONS } from './mock'
import { EQUIPMENT, SAMPLES, type Equipment, type ArchivedSample, type CustodyEvent } from './evidence'
import { isoIn, uid } from './format'
import { can, type Permission } from './roles'
import { loginAsDemoUser, logoutDemoUser, getAuth, ApiError } from './api'
import { fetchDirectoryOrgs, fetchPublicCatalog, fetchMyRequests, fetchMyDelegations, fetchMyContracts, updateEntityProfile, createAndSendRequest, decideRequest, createRealDelegation, respondToDelegation } from './backend'

/** Real backend records use Frappe's naming series (CNT-/TR-.../DEL-.../INV-...); the
 * mock demo fixtures use a different scheme (عقد-.../TST-.../r-...) — this tells the
 * two apart so write actions route to the real backend only when there's real data
 * to act on. */
const isRealId = (id: string) => /^(CNT-\d{4}-|TR-\d{4}-|DEL-|INV-\d{4}-)/.test(id)

interface Toast { id: string; title: string; body?: string; tone?: 'ok' | 'warn' | 'danger' | 'info' }

interface State {
  user: User | null
  users: User[]
  orgs: Organization[]
  refTests: RefTest[]
  catalog: CatalogItem[]
  contracts: Contract[]
  requests: TestRequest[]
  studies: Study[]
  delegations: Delegation[]
  ratings: Rating[]
  rules: BusinessRules
  notifications: Notification[]
  audit: AuditEvent[]
  documents: Document[]
  invoices: Invoice[]
  policies: Policy[]
  quotes: Quote[]
  equipment: Equipment[]
  samples: ArchivedSample[]
  templates: Template[]
  knowledgeVersions: KnowledgeVersion[]
  toasts: Toast[]
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  markAllRead: (role: Role) => void

  // auth
  /** Real backend login (token auth, fixed demo roster) — see src/lib/api.ts. */
  login: (userId: string) => Promise<void>
  logout: () => void
  can: (p: Permission) => boolean
  backendReady: boolean
  backendError: string | null
  /** Fetches real Entities + the public Lab catalogue — safe for anonymous visitors (B.R.122). */
  bootstrapPublic: () => Promise<void>
  /** Fetches this logged-in user's real Test Requests + Delegations from the backend. */
  refreshBackendData: () => Promise<void>
  toast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
  markRead: (id: string) => void

  // catalog
  upsertCatalog: (item: CatalogItem) => void
  toggleCatalog: (id: string) => void
  updateRefTest: (t: RefTest) => void

  // directory
  updateOrg: (id: string, patch: Partial<Organization>) => void
  addRating: (r: Omit<Rating, 'id' | 'createdAt' | 'status'>) => void
  moderateRating: (id: string, status: 'STS06' | 'STS07' | 'STS08') => void

  // requests
  saveDraft: (r: Partial<TestRequest> & { id?: string }) => string
  submitRequest: (id: string) => string
  cancelRequest: (id: string) => void
  labDecide: (id: string, accept: boolean, slot?: TimeSlot, reason?: string) => void
  registerSample: (reqId: string, testId: string, s: { depth: number; technician: string }) => void
  confirmSample: (reqId: string, testId: string, ok: boolean, reason?: string) => void
  saveResult: (reqId: string, testId: string, result: Record<string, string | number>, report?: { name: string; size: string }, notes?: string) => void
  submitResult: (reqId: string, testId: string) => void
  consultantDecide: (reqId: string, testId: string, accept: boolean, reason?: string, auto?: boolean) => void
  createRetest: (reqId: string, testId: string, slots: TimeSlot[], notes?: string) => string

  // study
  patchStudy: (id: string, fn: (s: Study) => void) => void
  runEngine: (studyId: string) => void

  // delegation
  createDelegation: (d: Omit<Delegation, 'id' | 'createdAt' | 'status'>) => void
  decideDelegation: (id: string, accept: boolean) => void
  editDelegation: (id: string, toUserId: string) => void

  // admin
  setRules: (r: Partial<BusinessRules>) => void
  setOrgActive: (id: string, active: boolean) => void
  addEmployee: (name: string, mobile: string, canDelegate: boolean) => void
  setEmployeeDelegate: (id: string, canDelegate: boolean) => void
  addOrganization: (o: Pick<Org, 'type' | 'name' | 'cr' | 'city' | 'phone' | 'email'> & { principal: string; mobile: string }) => void
  // quotes → contracts
  requestQuote: (q: Omit<Quote, 'id' | 'status' | 'createdAt'>) => string
  respondQuote: (id: string, items: QuoteItem[], labNotes?: string) => void
  decideQuote: (id: string, accept: boolean, reason?: string) => void
  // equipment
  upsertEquipment: (e: Equipment) => void
  recordCalibration: (id: string, certificate: string, calibratedAt: string, provider: string) => void
  retireEquipment: (id: string) => void
  // samples
  registerArchivedSample: (s: Omit<ArchivedSample, 'custody' | 'status'> & { status?: ArchivedSample['status'] }) => void
  addCustodyEvent: (id: string, ev: Omit<CustodyEvent, 'at'>) => void
  disposeSample: (id: string, reason: string) => void
  // templates / knowledge / policies
  upsertTemplate: (t: Template) => void
  addTemplateVersion: (id: string, ver: string, note: string, publish: boolean) => void
  addKnowledgeVersion: (ver: string, changes: string) => void
  publishKnowledgeVersion: (ver: string) => void
  upsertPolicy: (p: Policy) => void
  payInvoice: (id: string, channel: string) => void
  /** Time-based rules (B.R.147 lab timeout, B.R.152 auto-approval) — called on login and every minute by the shell. */
  tick: () => void
  notify: (n: { forRole: Role; forOrgId?: string; title: string; body: string; link?: string; tone?: Notification['tone'] }) => void
}

const audit = (get: () => State, set: (f: (s: State) => Partial<State>) => void, action: string, entity: string, entityId: string, severity: AuditEvent['severity'] = 'info') => {
  const u = get().user; if (!u) return
  set(s => ({ audit: [{ id: uid('A'), at: new Date().toISOString(), actor: u.name, role: u.role, org: u.orgName, action, entity, entityId, ip: '10.20.4.17', severity }, ...s.audit] }))
}
const roleOf = (s: State, orgId: string): Role => s.orgs.find(o => o.id === orgId)?.type === 'lab' ? 'lab' : s.orgs.find(o => o.id === orgId)?.type === 'consultant' ? 'consultant' : 'contractor'
const log = (_r: TestRequest, actor: User | { name: string; role: Role }, action: string, detail?: string): AuditEntry => ({
  id: uid('h'), at: new Date().toISOString(), actor: actor.name, actorRole: actor.role, action, detail,
})

export const useStore = create<State>((set, get) => ({
  user: (() => { try { const id = sessionStorage.getItem('miyar.user'); return USERS.find(u => u.id === id) ?? null } catch { return null } })(),
  users: USERS, orgs: ORGS, refTests: REF_TESTS, catalog: CATALOG, contracts: CONTRACTS, requests: REQUESTS, studies: STUDIES,
  delegations: DELEGATIONS, ratings: RATINGS, rules: RULES, notifications: NOTIFICATIONS, audit: AUDIT, documents: DOCUMENTS, invoices: INVOICES, policies: POLICIES, quotes: QUOTES, equipment: EQUIPMENT, samples: SAMPLES, templates: TEMPLATES, knowledgeVersions: KNOWLEDGE_VERSIONS, toasts: [],
  sidebarCollapsed: false,
  toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  markAllRead: (role) => set(s => ({ notifications: s.notifications.map(n => n.forRole === role ? { ...n, read: true } : n) })),
  notify: (n) => set(s => {
    // Scope to the organisation that owns the referenced request when the caller didn't say
    let forOrgId = n.forOrgId
    if (!forOrgId && n.link) { const id = n.link.split('/')[2]; const r = s.requests.find(x => x.id === id); if (r) forOrgId = n.forRole === 'lab' ? r.labId : n.forRole === 'consultant' ? r.consultantId : n.forRole === 'contractor' ? r.contractorId : undefined }
    return { notifications: [{ id: uid('n'), at: new Date().toISOString(), read: false, ...n, forOrgId }, ...s.notifications] }
  }),

  addOrganization: (o) => {
    const id = `o-${o.type}-${Date.now().toString(36)}`
    set(s => ({ orgs: [...s.orgs, { id, type: o.type, name: o.name, cr: o.cr, city: o.city, region: '—', about: '', specialties: [], phone: o.phone, email: o.email, address: o.city, rating: 0, reviews: 0, active: true, kpis: [], since: String(new Date().getFullYear()) }], users: [...s.users, { id: `u-${Date.now().toString(36)}`, name: o.principal, role: o.type as Role, position: 'principal', orgId: id, orgName: o.name, mobile: o.mobile, canDelegate: true }] }))
    audit(get, set, 'تفعيل منشأة', 'account', o.name, 'notice'); get().toast({ title: 'أُنشئت المنشأة وفُعّل حسابها', body: `${o.name} — أُرسل رمز التفعيل إلى ${o.mobile}.`, tone: 'ok' })
  },

  /* ── Quotes → contracts (B.R.116/119) ─────────────────────── */
  requestQuote: (q) => {
    const id = `QT-2026-${String(89 + get().quotes.length - 4).padStart(4, '0')}`
    set(s => ({ quotes: [{ ...q, id, status: 'pending', createdAt: new Date().toISOString() }, ...s.quotes] }))
    audit(get, set, 'طلب عرض سعر', 'quote', id); get().notify({ forRole: 'lab', forOrgId: q.labId, title: `طلب عرض سعر جديد ${id}`, body: `${q.project} — ${q.items.length} اختبار`, link: '/quotes', tone: 'warn' })
    get().toast({ title: 'أُرسل طلب عرض السعر', body: `${id} — يرد المختبر بعرضه خلال يومي عمل.`, tone: 'ok' })
    return id
  },
  respondQuote: (id, items, labNotes) => {
    const u = get().user!; const q = get().quotes.find(x => x.id === id); if (!q) return
    // B.R.119 — the lab may not respond before its catalogue is complete
    if (get().catalog.some(c => c.labId === u.orgId && c.status === 'STS03')) { get().toast({ title: 'قائمة الاختبارات غير مكتملة', body: 'أكمل الوحدة والطريقة والسعر لكل اختبار قبل الرد على عروض الأسعار (B.R.119).', tone: 'danger' }); return }
    set(s => ({ quotes: s.quotes.map(x => x.id === id ? { ...x, items, labNotes, status: 'quoted', quotedAt: new Date().toISOString(), validUntil: isoIn(24 * 14) } : x) }))
    audit(get, set, 'الرد على عرض سعر', 'quote', id); get().notify({ forRole: 'contractor', forOrgId: q.contractorId, title: `وصل عرض السعر ${id}`, body: `${get().orgs.find(o => o.id === q.labId)?.name} — صالح 14 يوماً`, link: '/quotes', tone: 'info' })
    get().toast({ title: 'أُرسل عرض السعر', body: 'السعر الأساسي في قائمتك لم يتغير (B.R.116).', tone: 'ok' })
  },
  decideQuote: (id, accept, reason) => {
    const q = get().quotes.find(x => x.id === id); if (!q || q.status !== 'quoted') return
    if (accept) {
      const n = get().contracts.length + 15; const cid = `عقد-2026-${String(n).padStart(3, '0')}`
      set(s => ({ quotes: s.quotes.map(x => x.id === id ? { ...x, status: 'accepted', decidedAt: new Date().toISOString(), contractId: cid } : x), contracts: [{ id: cid, contractorId: q.contractorId, labId: q.labId, consultantId: q.consultantId, project: q.project, services: q.services, payment: q.payment, startedAt: new Date().toISOString(), active: true }, ...s.contracts], documents: [{ id: `DOC-CNT-${cid}`, name: `العقد الإلكتروني ${cid}.pdf`, type: 'contract', contractId: cid, orgId: q.contractorId, size: '0.8 MB', at: new Date().toISOString(), version: 1, hash: `sha256:${Date.now().toString(16)}…`, retentionUntil: '2046-09-14', classification: 'سري' }, ...s.documents] }))
      audit(get, set, 'إنشاء عقد إلكتروني', 'contract', cid, 'notice')
      get().notify({ forRole: 'lab', forOrgId: q.labId, title: `قُبل عرض السعر — عقد ${cid}`, body: q.project, link: '/contracts', tone: 'ok' }); get().notify({ forRole: 'consultant', forOrgId: q.consultantId, title: `عقد جديد تحت إشرافك ${cid}`, body: q.project, link: '/contracts', tone: 'info' })
      get().toast({ title: `أُبرم العقد ${cid}`, body: 'وُقّع إلكترونياً بعد التحقق بـ OTP — يمكنك إنشاء طلبات الاختبارات عليه الآن.', tone: 'ok' })
    } else {
      set(s => ({ quotes: s.quotes.map(x => x.id === id ? { ...x, status: 'rejected', decidedAt: new Date().toISOString(), rejectReason: reason } : x) }))
      audit(get, set, 'رفض عرض سعر', 'quote', id); get().notify({ forRole: 'lab', forOrgId: q.labId, title: `رُفض عرض السعر ${id}`, body: reason ?? '', link: '/quotes', tone: 'warn' })
    }
  },

  /* ── Equipment (ISO/IEC 17025 §6.4) ───────────────────────── */
  upsertEquipment: (e) => { set(s => ({ equipment: s.equipment.some(x => x.id === e.id) ? s.equipment.map(x => x.id === e.id ? e : x) : [e, ...s.equipment] })); audit(get, set, 'تحديث سجل المعدات', 'equipment', e.name, 'notice'); get().toast({ title: 'حُفظت المعدّة', body: e.name, tone: 'ok' }) },
  recordCalibration: (id, certificate, calibratedAt, provider) => { const due = new Date(new Date(calibratedAt).getTime() + 365 * 864e5).toISOString().slice(0, 10); set(s => ({ equipment: s.equipment.map(x => x.id === id ? { ...x, certificate, calibratedAt, calibrationDue: due, provider, status: 'صالح' } : x) })); audit(get, set, 'تسجيل معايرة', 'equipment', id, 'notice'); get().toast({ title: 'سُجّلت المعايرة', body: `سارية حتى ${due}`, tone: 'ok' }) },
  retireEquipment: (id) => { set(s => ({ equipment: s.equipment.map(x => x.id === id ? { ...x, status: 'خارج الخدمة' } : x) })); audit(get, set, 'إخراج معدّة من الخدمة', 'equipment', id, 'warning'); get().toast({ title: 'أُخرجت المعدّة من الخدمة', body: 'لن تُقبل في أي نتيجة جديدة.', tone: 'warn' }) },

  /* ── Samples & chain of custody (ISO/IEC 17025 §7.4) ─────── */
  registerArchivedSample: (sm) => { const u = get().user!; set(s => ({ samples: [{ ...sm, status: sm.status ?? 'في الموقع', custody: [{ at: new Date().toISOString(), step: 'جمع', by: sm.collectedBy || u.name, where: sm.designation, note: `ختم ${sm.sealNo}`, tempC: 34 }] }, ...s.samples] })); audit(get, set, 'تسجيل عينة', 'sample', sm.id); get().toast({ title: `سُجّلت العينة ${sm.id}`, body: 'طُبع الملصق وبدأت سلسلة الحيازة.', tone: 'ok' }) },
  addCustodyEvent: (id, ev) => { const next: Record<CustodyEvent['step'], ArchivedSample['status']> = { 'جمع': 'في الموقع', 'نقل': 'قيد النقل', 'استلام': 'مستلمة', 'تجهيز': 'قيد التجهيز', 'اختبار': 'قيد الاختبار', 'تخزين': 'مؤرشفة', 'إتلاف': 'متلفة' }; set(s => ({ samples: s.samples.map(x => x.id === id ? { ...x, status: next[ev.step], custody: [...x.custody, { ...ev, at: new Date().toISOString() }] } : x) })); audit(get, set, `حيازة العينة — ${ev.step}`, 'sample', id) },
  disposeSample: (id, reason) => { get().addCustodyEvent(id, { step: 'إتلاف', by: get().user!.name, where: 'محضر إتلاف موقّع', note: reason }); get().toast({ title: 'أُتلفت العينة', body: 'سُجّل المحضر في سلسلة الحيازة.', tone: 'warn' }) },

  /* ── Templates / knowledge / policies ─────────────────────── */
  upsertTemplate: (t) => { set(s => ({ templates: s.templates.some(x => x.id === t.id) ? s.templates.map(x => x.id === t.id ? t : x) : [...s.templates, t] })); audit(get, set, 'تحديث قالب', 'template', t.name, 'notice'); get().toast({ title: 'حُفظ القالب', body: `${t.name} ${t.ver}`, tone: 'ok' }) },
  addTemplateVersion: (id, ver, note, publish) => { const today = new Date().toLocaleDateString('ar-SA-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }); set(s => ({ templates: s.templates.map(t => t.id !== id ? t : { ...t, ver: publish ? ver : t.ver, status: publish ? 'ساري' : t.status, updated: publish ? today : t.updated, history: [{ ver, date: today, note, status: publish ? 'ساري' : 'مسودة' }, ...(t.history ?? []).map(h => publish && h.status === 'ساري' ? { ...h, status: 'مؤرشف' as const } : h)] }) })); audit(get, set, publish ? 'نشر إصدار قالب' : 'إنشاء مسودة قالب', 'template', `${id} ${ver}`, publish ? 'critical' : 'notice') },
  addKnowledgeVersion: (ver, changes) => { set(s => ({ knowledgeVersions: [{ ver, date: '—', changes, studies: 0, status: 'مسودة' }, ...s.knowledgeVersions] })); audit(get, set, 'إنشاء مسودة قاعدة معرفة', 'knowledge', ver, 'notice'); get().toast({ title: `أُنشئت المسودة ${ver}`, body: 'لا تُطبَّق على أي دراسة قبل الاعتماد.', tone: 'ok' }) },
  publishKnowledgeVersion: (ver) => { const today = new Date().toLocaleDateString('ar-SA-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }); set(s => ({ knowledgeVersions: s.knowledgeVersions.map(v => v.ver === ver ? { ...v, status: 'ساري', date: today } : v.status === 'ساري' ? { ...v, status: 'مؤرشف' } : v) })); audit(get, set, 'تحديث قاعدة المعرفة', 'knowledge', ver, 'critical'); get().notify({ forRole: 'lab', title: `إصدار جديد من قاعدة المعرفة ${ver}`, body: 'يُطبَّق على الدراسات التي لم يصدر تقريرها النهائي (B.R.213).', link: '/help', tone: 'warn' }); get().toast({ title: `اعتُمد الإصدار ${ver}`, body: 'الدراسات الجارية بلا تقرير نهائي تنتقل إليه.', tone: 'ok' }) },
  upsertPolicy: (p) => { set(s => ({ policies: s.policies.some(x => x.id === p.id) ? s.policies.map(x => x.id === p.id ? p : x) : [...s.policies, p] })); audit(get, set, 'تحديث سياسة', 'policy', p.id, 'critical'); get().toast({ title: 'حُفظت السياسة', body: `${p.id} ${p.version}`, tone: 'ok' }) },
  payInvoice: (id, channel) => { const inv = get().invoices.find(i => i.id === id); if (!inv || inv.status === 'paid') return; set(s => ({ invoices: s.invoices.map(i => i.id === id ? { ...i, status: 'paid', paidAt: new Date().toISOString() } : i) })); audit(get, set, 'سداد فاتورة', 'invoice', id); get().notify({ forRole: 'lab', forOrgId: inv.labId, title: `سُدّدت الفاتورة ${id}`, body: `${(inv.amount + inv.vat).toLocaleString('en-US')} ر.س عبر ${channel}`, link: '/invoices', tone: 'ok' }); get().toast({ title: 'تم السداد', body: `${id} — إيصال ${channel} رقم ${Date.now().toString().slice(-8)}`, tone: 'ok' }) },

  // B.R.147 / B.R.152 — deadlines are enforced by the platform, not by people
  tick: () => {
    const { rules } = get(); const now = Date.now(); const sys = { name: 'المنصة', role: 'admin' as Role }
    const expired = get().requests.filter(r => r.status === 'STS11' && r.labDeadlineAt && new Date(r.labDeadlineAt).getTime() < now && !r.history.some(h => h.action === 'انتهاء مهلة قرار المختبر'))
    if (expired.length) {
      if (rules.labTimeoutAction === 'expire') {
        set(s => ({ requests: s.requests.map(r => expired.some(e => e.id === r.id) ? { ...r, status: 'STS26', rejectReason: `انتهاء مهلة قرار المختبر (${(r.rules ?? rules).labDecisionHours} ساعة) دون رد`, history: [...r.history, log(r, sys, 'انتهاء مهلة قرار المختبر', `لم يرد المختبر خلال ${(r.rules ?? rules).labDecisionHours} ساعة — الطلب منتهي المهلة ويُسجَّل في مؤشرات المختبر`)] } : r), orgs: s.orgs.map(o => expired.some(e => e.labId === o.id) ? { ...o, onTime: Math.max(0, (o.onTime ?? 90) - 1) } : o) }))
        expired.forEach(r => { get().notify({ forRole: 'contractor', title: `انتهت مهلة الطلب ${r.id}`, body: 'لم يرد المختبر خلال المهلة — يمكنك إنشاء طلب جديد بمواعيد أخرى.', link: `/requests/${r.id}`, tone: 'danger' }); get().notify({ forRole: 'lab', title: `فات الرد على ${r.id}`, body: 'الطلب منتهي المهلة وسُجّل التأخر في مؤشرات المختبر.', link: `/requests/${r.id}`, tone: 'danger' }) })
      } else {
        set(s => ({ requests: s.requests.map(r => expired.some(e => e.id === r.id) ? { ...r, history: [...r.history, log(r, sys, 'انتهاء مهلة قرار المختبر', 'تنبيه فقط وفق إعدادات المنصة — الطلب ما زال بانتظار قرار المختبر')] } : r) }))
        expired.forEach(r => { get().notify({ forRole: 'lab', title: `تجاوزت مهلة الرد على ${r.id}`, body: 'يُرجى اتخاذ القرار فوراً — التأخر مسجَّل.', link: `/requests/${r.id}`, tone: 'danger' }); get().notify({ forRole: 'supervisor', title: `مختبر تجاوز مهلة الرد — ${r.id}`, body: r.project, link: `/requests/${r.id}`, tone: 'warn' }) })
      }
    }
    get().requests.forEach(r => r.tests.forEach(t => { if (t.status === 'STS19' && t.deadlineAt && new Date(t.deadlineAt).getTime() < now) get().consultantDecide(r.id, t.id, true, undefined, true) }))
  },

  backendReady: false,
  backendError: null,

  bootstrapPublic: async () => {
    try {
      const [orgs, catalog] = await Promise.all([fetchDirectoryOrgs(), fetchPublicCatalog()])
      set({ orgs, catalog, backendReady: true, backendError: null })
    } catch (e) {
      // B.R.230 — a backend outage must not break the app; screens keep whatever they had (mock fixtures on first load).
      set({ backendError: e instanceof ApiError ? e.message : 'تعذّر الاتصال بالمنصة الخلفية.' })
    }
  },

  refreshBackendData: async () => {
    const u = get().user
    if (!u || !getAuth()) return
    try {
      const [requests, delegations, contracts] = await Promise.all([fetchMyRequests(), fetchMyDelegations(), fetchMyContracts()])
      // Merge real backend records in alongside the existing mock fixtures (matched by id) rather
      // than discarding the demo storyline — screens that read `s.requests` see both.
      set(s => ({
        requests: [...requests, ...s.requests.filter(r => !requests.some(x => x.id === r.id))],
        delegations: [...delegations, ...s.delegations.filter(d => !delegations.some(x => x.id === d.id))],
        contracts: [...contracts, ...s.contracts.filter(c => !contracts.some(x => x.id === c.id))],
      }))
    } catch (e) {
      get().toast({ title: 'تعذّر جلب بيانات الطلبات', body: e instanceof ApiError ? e.message : String(e), tone: 'danger' })
    }
  },

  login: async (userId) => {
    const localUser = get().users.find(x => x.id === userId) ?? null
    if (!localUser) return
    try {
      const auth = await loginAsDemoUser(userId)
      // Keep the frontend's own role/position/name (the backend doesn't model those per-user
      // in the same shape) but point orgId at the REAL backend Entity so every screen that
      // does `orgs.find(o => o.id === user.orgId)` resolves against real, fetched data.
      const u: User = { ...localUser, orgId: auth.entity ?? localUser.orgId }
      set({ user: u })
      try { sessionStorage.setItem('miyar.user', u.id) } catch { /* private mode */ }
      await get().bootstrapPublic()
      await get().refreshBackendData()
    } catch (e) {
      get().toast({ title: 'تعذّر تسجيل الدخول بالخادم الفعلي', body: e instanceof ApiError ? e.message : String(e), tone: 'danger' })
      // Fall back to the local-only mock identity so the demo still runs if the backend is down.
      set({ user: localUser })
      try { sessionStorage.setItem('miyar.user', localUser.id) } catch { /* private mode */ }
    }
  },
  logout: () => { logoutDemoUser(); set({ user: null }); try { sessionStorage.removeItem('miyar.user') } catch {} },
  can: (p) => { const u = get().user; return u ? can(u.role, u.position, p) : p === 'directory.view' },
  toast: (t) => { const id = uid('t'); set(s => ({ toasts: [...s.toasts, { ...t, id }] })); setTimeout(() => get().dismissToast(id), 4200) },
  dismissToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
  markRead: (id) => set(s => ({ notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n) })),

  upsertCatalog: (item) => set(s => {
    const complete = item.unit && item.methods.length > 0 && item.basePrice != null && item.basePrice > 0
    const status = complete ? (item.status === 'STS02' ? 'STS02' : 'STS01') : 'STS03'
    const next = { ...item, status } as CatalogItem
    const exists = s.catalog.some(c => c.id === item.id)
    return { catalog: exists ? s.catalog.map(c => c.id === item.id ? next : c) : [...s.catalog, next] }
  }),
  toggleCatalog: (id) => { set(s => ({ catalog: s.catalog.map(c => c.id === id ? { ...c, status: c.status === 'STS02' ? 'STS01' : c.status === 'STS01' ? 'STS02' : c.status } : c) })); const c = get().catalog.find(x => x.id === id)!; audit(get, set, c.status === 'STS02' ? 'إيقاف اختبار مؤقتاً' : 'تفعيل اختبار', 'catalog', get().refTests.find(t => t.id === c.refTestId)?.nameAr ?? id, 'notice') },
  updateRefTest: (t) => {
    const existed = get().refTests.some(r => r.id === t.id)
    set(s => ({ refTests: existed ? s.refTests.map(r => r.id === t.id ? t : r) : [...s.refTests, t] }))
    if (existed) {
      // B.R.113 — lab catalogues follow the reference automatically (methods no longer offered are dropped) and labs are notified; new tests are never auto-added
      const codes = new Set(t.methods.map(m => m.code))
      set(s => ({ catalog: s.catalog.map(c => c.refTestId === t.id ? { ...c, methods: c.methods.filter(m => codes.has(m)), status: c.methods.filter(m => codes.has(m)).length && c.unit && c.basePrice ? c.status : 'STS03' } : c) }))
      get().notify({ forRole: 'lab', title: `تحديث العنصر المرجعي: ${t.nameAr}`, body: 'حُدّثت بيانات الاختبار في قائمتك تلقائياً — راجع الطرق والسعر.', link: '/catalog', tone: 'warn' })
    }
    audit(get, set, existed ? 'تعديل عنصر مرجعي' : 'إضافة عنصر مرجعي', 'catalog', t.nameAr, 'notice')
  },

  updateOrg: (id, patch) => {
    set(s => ({ orgs: s.orgs.map(o => o.id === id ? { ...o, ...patch } : o) }))
    // B.R.126, 131 — real backend write for the fields with a 1:1 Entity mapping;
    // the rest of `patch` (city/address/specialties/website) stays local-only for now.
    if (getAuth()) {
      updateEntityProfile(id, { name: patch.name, about: patch.about, phone: patch.phone, email: patch.email }).catch(e => {
        get().toast({ title: 'تعذّر حفظ التعديلات في الخادم', body: e instanceof ApiError ? e.message : String(e), tone: 'danger' })
      })
    }
  },
  addRating: (r) => {
    // B.R.127 — once per contract, and only after the contract ends
    const c = get().contracts.find(x => x.id === r.contractId)
    if (!c || c.active) { get().toast({ title: 'التقييم غير متاح', body: 'يُقيَّم المختبر مرة واحدة لكل عقد بعد انتهائه (B.R.127).', tone: 'danger' }); return }
    if (get().ratings.some(x => x.contractId === r.contractId && x.contractorId === r.contractorId)) { get().toast({ title: 'تم تقييم هذا العقد مسبقاً', body: 'التقييم مرة واحدة لكل عقد.', tone: 'warn' }); return }
    set(s => {
    const rating: Rating = { ...r, id: uid('r'), createdAt: new Date().toISOString(), status: 'STS06' }
    const all = [...s.ratings, rating].filter(x => x.labId === r.labId && x.status === 'STS06')
    const avg = all.reduce((a, x) => a + (x.quality + x.punctuality + x.communication) / 3, 0) / all.length
    return { ratings: [...s.ratings, rating], orgs: s.orgs.map(o => o.id === r.labId ? { ...o, rating: Math.round(avg * 10) / 10, reviews: all.length } : o) }
    })
    audit(get, set, 'تقييم مختبر', 'rating', r.contractId)
    get().notify({ forRole: 'lab', title: 'تقييم جديد على منشأتك', body: `عقد ${r.contractId}`, link: '/profile', tone: 'info' })
  },
  moderateRating: (id, status) => {
    // B.R.129 — ranking reflects approved ratings only, so hiding/deleting recalculates the lab average
    set(s => { const ratings = s.ratings.map(r => r.id === id ? { ...r, status } : r); const labId = ratings.find(r => r.id === id)!.labId; const all = ratings.filter(x => x.labId === labId && x.status === 'STS06'); const avg = all.length ? all.reduce((a, x) => a + (x.quality + x.punctuality + x.communication) / 3, 0) / all.length : 0; return { ratings, orgs: s.orgs.map(o => o.id === labId ? { ...o, rating: Math.round(avg * 10) / 10, reviews: all.length } : o) } })
    audit(get, set, status === 'STS07' ? 'إخفاء تقييم' : status === 'STS08' ? 'حذف تقييم' : 'إعادة إظهار تقييم', 'rating', id, 'warning')
  },

  saveDraft: (r) => {
    const u = get().user!
    const id = r.id ?? `TST-مسودة-${String(get().requests.length + 1).padStart(3, '0')}`
    set(s => {
      const exists = s.requests.find(x => x.id === id)
      const base: TestRequest = exists ?? {
        id, contractId: '', contractorId: u.orgId, labId: '', consultantId: '', project: '', service: 'standard', status: 'STS09',
        createdAt: new Date().toISOString(), slots: [], location: '', tests: [], history: [log({} as any, u, 'حفظ الطلب كمسودة')],
      }
      const patch = Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined)) as Partial<TestRequest>
      return { requests: exists ? s.requests.map(x => x.id === id ? { ...base, ...patch, id } : x) : [...s.requests, { ...base, ...patch, id }] }
    })
    return id
  },
  submitRequest: (id) => {
    const { user, rules } = get(); const u = user!
    const r0 = get().requests.find(r => r.id === id); if (!r0 || r0.status !== 'STS09') { get().toast({ title: 'لا يمكن الإرسال', body: 'يُرسل الطلب من حالة المسودة فقط (B.R.145).', tone: 'danger' }); return id }
    const contract = get().contracts.find(c => c.id === r0.contractId)
    if (!contract?.active) { get().toast({ title: 'العقد غير فعّال', body: 'طلبات الاختبارات تُنشأ على العقود الفعّالة فقط (B.R.132).', tone: 'danger' }); return id }

    // Real backend path — engaged only when the chosen contract is a real, fetched
    // Miyar Contract (not one of the demo storyline's mock fixtures).
    if (isRealId(r0.contractId) && getAuth()) {
      void (async () => {
        try {
          const realId = await createAndSendRequest({
            contract: r0.contractId,
            service: r0.service,
            testTypeIds: r0.tests.map(t => t.refTestId),
            slots: r0.slots,
            siteLocation: r0.location,
          })
          set(s => ({ requests: s.requests.filter(r => r.id !== id) }))
          await get().refreshBackendData()
          get().toast({ title: 'أُرسل الطلب إلى الخادم الفعلي', body: `الرقم الحقيقي للطلب: ${realId}`, tone: 'ok' })
        } catch (e) {
          get().toast({ title: 'فشل إرسال الطلب إلى الخادم', body: e instanceof ApiError ? e.message : String(e), tone: 'danger' })
        }
      })()
      return id
    }

    // Sequential public number replaces the draft number on submission
    const seq = get().requests.filter(x => /^TST-\d{4}-\d{3}$/.test(x.id)).map(x => +x.id.slice(-3)).reduce((a, b) => Math.max(a, b), 0) + 1
    const newId = r0.id.includes('مسودة') ? `TST-2026-${String(seq).padStart(3, '0')}` : r0.id
    const geotech = r0.service === 'geotech'
    const frozen = { labDecisionHours: rules.labDecisionHours, consultantDecisionHours: rules.consultantDecisionHours, vat: rules.vat, minLeadHours: rules.minLeadHours, geofenceMeters: rules.geofenceMeters, maxTestsPerRequest: rules.maxTestsPerRequest, proposedSlots: rules.proposedSlots }
    set(s => ({
      requests: s.requests.map(r => r.id !== id ? r : { ...r, id: newId, rules: frozen, status: geotech ? 'STS10' : 'STS11', submittedAt: new Date().toISOString(),
        labDeadlineAt: geotech ? undefined : isoIn(rules.labDecisionHours),
        history: [...r.history, log(r, u, geotech ? 'إرسال الطلب — بانتظار مراجعة المكتب الاستشاري' : 'إرسال الطلب إلى المختبر')] }),
      // The public number replaces the draft number everywhere the draft was referenced (B.R.163/164)
      ...(newId !== id ? {
        studies: s.studies.map(st => st.requestId === id ? { ...st, requestId: newId, ref: `${newId}/GT-01` } : st),
        delegations: s.delegations.map(d => d.requestId === id ? { ...d, requestId: newId } : d),
        invoices: s.invoices.map(i => i.requestId === id ? { ...i, requestId: newId } : i),
        documents: s.documents.map(d => d.requestId === id ? { ...d, requestId: newId } : d),
      } : {}),
    }))
    // B.R.139 — advance payment is settled before the lab receives the request (simulated SADAD settlement)
    if (contract.payment === 'advance') {
      const amount = r0.tests.reduce((a, t) => a + t.price, 0), vat = Math.round(amount * rules.vat / 100)
      set(s => ({ invoices: [{ id: `INV-2026-${String(1300 + s.invoices.length).padStart(4, '0')}`, contractId: r0.contractId, requestId: newId, contractorId: r0.contractorId, labId: r0.labId, amount, vat, status: 'paid', issuedAt: new Date().toISOString(), dueAt: new Date().toISOString(), paidAt: new Date().toISOString() }, ...s.invoices],
        requests: s.requests.map(r => r.id === newId ? { ...r, history: [...r.history, log(r, u, 'سداد الدفعة المقدمة عبر سداد', `${(amount + vat).toLocaleString('en-US')} ر.س شامل الضريبة`)] } : r) }))
    }
    audit(get, set, 'إرسال طلب اختبار', 'request', newId)
    get().notify(geotech ? { forRole: 'consultant', title: `بيانات أولية بانتظار مراجعتك — ${newId}`, body: r0.project, link: `/requests/${newId}/study`, tone: 'info' } : { forRole: 'lab', title: `طلب اختبار جديد ${newId}`, body: `${r0.project} — الرد خلال ${rules.labDecisionHours} ساعة`, link: `/requests/${newId}`, tone: 'warn' })
    get().toast({ title: 'أُرسل الطلب', body: contract.payment === 'advance' ? 'سُدّدت الدفعة المقدمة وأُشعر المختبر.' : 'سيصلك إشعار عند اتخاذ الإجراء.', tone: 'ok' })
    return newId
  },
  cancelRequest: (id) => {
    const u = get().user!; const r0 = get().requests.find(r => r.id === id)
    // B.R.142 — only before the lab accepts and execution starts
    if (!r0 || !['STS09', 'STS10', 'STS11'].includes(r0.status)) { get().toast({ title: 'لا يمكن إلغاء الطلب', body: 'الإلغاء متاح قبل قبول المختبر وبدء التنفيذ فقط (B.R.142).', tone: 'danger' }); return }
    set(s => ({ requests: s.requests.map(r => r.id === id ? { ...r, status: 'STS16', history: [...r.history, log(r, u, 'إلغاء الطلب')] } : r) }))
    audit(get, set, 'إلغاء طلب اختبار', 'request', id, 'notice')
    if (r0.status !== 'STS09') { get().notify({ forRole: 'lab', title: `أُلغي الطلب ${id}`, body: 'ألغى المقاول الطلب قبل قبوله.', link: `/requests/${id}`, tone: 'info' }); get().notify({ forRole: 'consultant', title: `أُلغي الطلب ${id}`, body: r0.project, link: `/requests/${id}`, tone: 'info' }) }
    get().toast({ title: 'أُلغي الطلب', body: 'أُشعر المختبر وجميع الأطراف.', tone: 'info' })
  },
  labDecide: (id, accept, slot, reason) => {
    const u = get().user!
    // Matrix #20 — accept/reject is the lab principal's decision
    if (u.role === 'lab' && u.position !== 'principal') { get().toast({ title: 'صلاحية المفوّض الرئيسي', body: 'قبول الطلب أو رفضه من صلاحيات المفوّض الرئيسي للمختبر.', tone: 'danger' }); return }
    if (!accept && !reason?.trim()) { get().toast({ title: 'سبب الرفض مطلوب', body: 'يُرفض الطلب مع توضيح السبب (B.R.147).', tone: 'danger' }); return }
    if (accept && !slot) { get().toast({ title: 'اختر النطاق الزمني', body: 'القبول يكون باختيار أحد المواعيد المقترحة.', tone: 'danger' }); return }

    if (isRealId(id) && getAuth()) {
      void (async () => {
        try {
          await decideRequest(id, accept, slot ? `${slot.date} ${slot.from}:00` : undefined, reason)
          await get().refreshBackendData()
          get().toast({ title: accept ? 'قُبل الطلب فعلياً على الخادم' : 'رُفض الطلب فعلياً على الخادم', body: id, tone: accept ? 'ok' : 'warn' })
        } catch (e) {
          get().toast({ title: 'فشل تنفيذ القرار على الخادم', body: e instanceof ApiError ? e.message : String(e), tone: 'danger' })
        }
      })()
      return
    }

    set(s => ({ requests: s.requests.map(r => r.id === id ? {
      ...r, status: accept ? 'STS12' : 'STS13', chosenSlot: accept ? slot : undefined, rejectReason: accept ? undefined : reason,
      tests: r.tests.map(t => ({ ...t, status: 'STS17' as const })),
      history: [...r.history, log(r, u, accept ? 'قبول الطلب' : 'رفض الطلب', accept ? `نطاق ${slot?.date}` : reason)],
    } : r) }))
    audit(get, set, accept ? 'قبول طلب' : 'رفض طلب', 'request', id, accept ? 'info' : 'warning')
    const r1 = get().requests.find(r => r.id === id)!; const c = get().contracts.find(x => x.id === r1.contractId)
    // B.R.160 — invoice is issued on acceptance for on-completion contracts (becomes due at completion)
    if (accept && c?.payment !== 'advance' && !get().invoices.some(i => i.requestId === id)) { const amount = r1.tests.reduce((a, t) => a + t.price, 0); set(s => ({ invoices: [{ id: `INV-2026-${String(1300 + s.invoices.length).padStart(4, '0')}`, contractId: r1.contractId, requestId: r1.id, contractorId: r1.contractorId, labId: r1.labId, amount, vat: Math.round(amount * get().rules.vat / 100), status: 'draft', issuedAt: new Date().toISOString(), dueAt: isoIn(24 * 30) }, ...s.invoices] })) }
    get().notify({ forRole: 'contractor', title: accept ? `قُبل الطلب ${id}` : `رُفض الطلب ${id}`, body: accept ? `الموعد المعتمد ${slot?.date} ${slot?.from}–${slot?.to}` : `السبب: ${reason}`, link: `/requests/${id}`, tone: accept ? 'ok' : 'danger' })
    get().toast({ title: accept ? 'قُبل الطلب' : 'رُفض الطلب', body: 'أُشعر المقاول بالقرار.', tone: accept ? 'ok' : 'warn' })
  },
  registerSample: (reqId, testId, sm) => {
    const u = get().user!; const r0 = get().requests.find(r => r.id === reqId)!
    // B.R.149 — execution cannot start before the approved slot; starting after it is allowed but the delay is recorded
    const slotStart = r0.chosenSlot ? new Date(`${r0.chosenSlot.date}T${r0.chosenSlot.from}:00`).getTime() : 0
    if (slotStart && Date.now() < slotStart) { get().toast({ title: 'لا يمكن البدء قبل الموعد المعتمد', body: `الموعد المعتمد ${r0.chosenSlot!.date} ${r0.chosenSlot!.from} (B.R.149).`, tone: 'danger' }); return }
    const slotEnd = r0.chosenSlot ? new Date(`${r0.chosenSlot.date}T${r0.chosenSlot.to}:00`).getTime() : 0
    const delayH = slotEnd && Date.now() > slotEnd ? Math.round((Date.now() - slotEnd) / 36e5) : 0
    set(s => ({ requests: s.requests.map(r => r.id === reqId ? {
      ...r, status: 'STS14',
      tests: r.tests.map(t => t.id === testId ? { ...t, status: 'STS18', startedAt: new Date().toISOString(), delayHours: delayH || undefined,
        sample: { id: `SMP-2026-0${150 + Math.floor(Math.random() * 40)}`, depth: sm.depth, technician: sm.technician, receivedAt: new Date().toISOString(), geoVerified: true } } : t),
      history: [...r.history, log(r, u, 'تسجيل استلام العينة', delayH ? `بدء متأخر ${delayH} ساعة عن الموعد المعتمد — يُحتسب في مؤشرات المختبر` : 'تحقق جغرافي مطابق — بانتظار تأكيد المقاول')],
    } : r) }))
    if (delayH) set(s => ({ orgs: s.orgs.map(o => o.id === r0.labId ? { ...o, onTime: Math.max(0, (o.onTime ?? 90) - 1) } : o) }))
    get().notify({ forRole: 'contractor', title: `تسجيل عينة على ${reqId}`, body: 'سجّل المختبر استلام عينة في الموقع — أكّد الاستلام ليبدأ عداد SLA.', link: `/requests/${reqId}`, tone: 'warn' })
    get().toast({ title: 'سُجّل استلام العينة', body: delayH ? `سُجّل تأخر ${delayH} ساعة عن الموعد.` : 'يبدأ عداد SLA بعد تأكيد المقاول.', tone: delayH ? 'warn' : 'ok' })
  },
  confirmSample: (reqId, testId, ok, reason) => {
    const u = get().user!; const t0 = get().requests.find(r => r.id === reqId)?.tests.find(t => t.id === testId)
    if (!t0?.sample || t0.status !== 'STS18') { get().toast({ title: 'لا توجد عينة مسجّلة', body: 'يؤكد المقاول الاستلام بعد تسجيل المختبر للعينة.', tone: 'danger' }); return }
    set(s => ({ requests: s.requests.map(r => r.id === reqId ? {
      ...r,
      tests: r.tests.map(t => t.id === testId ? (ok
        ? { ...t, sample: { ...t.sample!, confirmedByContractor: true, confirmedAt: new Date().toISOString() }, deadlineAt: isoIn(t.sla * 24) }
        : { ...t, sample: undefined, status: 'STS17', notes: reason }) : t),
      history: [...r.history, log(r, u, ok ? 'تأكيد استلام العينة' : 'رفض تأكيد الاستلام', reason)],
    } : r) }))
  },
  saveResult: (reqId, testId, result, report, notes) => set(s => ({ requests: s.requests.map(r => r.id === reqId ? { ...r, tests: r.tests.map(t => t.id === testId && t.status === 'STS18' ? { ...t, result, report: report ?? t.report, notes } : t) } : r) })),
  submitResult: (reqId, testId) => {
    const { user, rules } = get(); const u = user!; const t0 = get().requests.find(r => r.id === reqId)?.tests.find(t => t.id === testId)
    // B.R.151 — an output is submitted from a test in execution, with its structured result and report attached (B.R.198)
    if (!t0 || t0.status !== 'STS18') { get().toast({ title: 'لا يمكن رفع المخرج', body: 'يُرفع المخرج لاختبار قيد التنفيذ فقط.', tone: 'danger' }); return }
    if (!t0.result || !Object.keys(t0.result).length || !t0.report) { get().toast({ title: 'المخرج غير مكتمل', body: 'أدخل حقول النتيجة وأرفق تقرير PDF قبل الرفع.', tone: 'danger' }); return }
    set(s => ({ requests: s.requests.map(r => r.id === reqId ? {
      ...r,
      tests: r.tests.map(t => t.id === testId ? { ...t, status: 'STS19', submittedAt: new Date().toISOString(), deadlineAt: isoIn((r.rules ?? rules).consultantDecisionHours) } : t),
      history: [...r.history, log(r, u, 'رفع مخرج الاختبار للمكتب الاستشاري')],
    } : r) }))
    const hrs = (get().requests.find(r => r.id === reqId)?.rules ?? rules).consultantDecisionHours
    get().notify({ forRole: 'consultant', forOrgId: get().requests.find(r => r.id === reqId)?.consultantId, title: `مخرج بانتظار اعتمادك — ${reqId}`, body: `يُعتمد تلقائياً بعد ${hrs} ساعة.`, link: `/requests/${reqId}/tests/${testId}/review`, tone: 'warn' })
    audit(get, set, 'رفع مخرج اختبار', 'test', `${reqId}/${testId}`)
    get().toast({ title: 'رُفعت النتيجة', body: `تُعتمد تلقائياً بعد ${hrs} ساعة إن لم يُتخذ إجراء.`, tone: 'ok' })
  },
  consultantDecide: (reqId, testId, accept, reason, auto) => {
    const u = auto ? { name: 'المنصة', role: 'admin' as Role } : get().user!
    const t0 = get().requests.find(r => r.id === reqId)?.tests.find(t => t.id === testId)
    if (!t0 || t0.status !== 'STS19') { if (!auto) get().toast({ title: 'لا يمكن اتخاذ القرار', body: 'القرار متاح على مخرج بانتظار قرار المكتب الاستشاري فقط.', tone: 'danger' }); return }
    // Matrix #24/25 — approve/reject is the consultant principal's decision
    if (!auto && get().user?.role === 'consultant' && get().user?.position !== 'principal') { get().toast({ title: 'صلاحية المفوّض الرئيسي', body: 'اعتماد المخرج أو رفضه من صلاحيات المفوّض الرئيسي للمكتب الاستشاري.', tone: 'danger' }); return }
    if (!accept && !reason?.trim()) { get().toast({ title: 'سبب الرفض مطلوب', body: 'يُرفض المخرج مع توضيح السبب (B.R.152).', tone: 'danger' }); return }
    set(s => ({ requests: s.requests.map(r => {
      if (r.id !== reqId) return r
      const tests = r.tests.map(t => t.id === testId ? { ...t, status: (accept ? 'STS20' : 'STS21') as TestItem['status'], decidedAt: new Date().toISOString(), rejectReason: accept ? undefined : reason, autoApproved: !!auto } : t)
      const allDecided = tests.every(t => t.status === 'STS20' || t.status === 'STS21')
      const hist = [...r.history, log(r, u, accept ? (auto ? 'اعتماد تلقائي للمخرج' : 'اعتماد مخرج الاختبار') : 'رفض مخرج الاختبار', reason)]
      if (allDecided) hist.push(log(r, { name: 'المنصة', role: 'admin' }, 'اكتمال الطلب تلقائياً', 'صدر قرار الاستشاري على جميع الاختبارات'))
      return { ...r, tests, status: allDecided ? 'STS15' : r.status, history: hist }
    }) }))
    audit(get, set, auto ? 'اعتماد تلقائي بعد المهلة' : accept ? 'اعتماد مخرج' : 'رفض مخرج', 'test', `${reqId}/${testId}`, accept && !auto ? 'notice' : 'warning')
    const r2 = get().requests.find(r => r.id === reqId)!; const t2 = r2.tests.find(t => t.id === testId)!
    // B.R.155 — SLA overrun (submitted after the execution deadline) is recorded against the lab
    if (t2.submittedAt && t2.startedAt && t2.sla && new Date(t2.submittedAt).getTime() - new Date(t2.startedAt).getTime() > t2.sla * 864e5) set(s => ({ orgs: s.orgs.map(o => o.id === r2.labId ? { ...o, onTime: Math.max(0, (o.onTime ?? 90) - 1) } : o) }))
    if (auto) set(s => ({ orgs: s.orgs.map(o => o.id === r2.labId ? { ...o, autoApprovals: (o.autoApprovals ?? 0) + 1 } : o) }))
    if (r2.status === 'STS15') { set(s => ({ invoices: s.invoices.map(i => i.requestId === reqId && i.status === 'draft' ? { ...i, status: 'due', issuedAt: new Date().toISOString(), dueAt: isoIn(24 * 30) } : i) })); get().notify({ forRole: 'contractor', title: `اكتمل الطلب ${reqId}`, body: 'صدر قرار الاستشاري على كل الاختبارات — الفاتورة مستحقة خلال 30 يوماً.', link: `/requests/${reqId}`, tone: 'ok' }) }
    get().notify({ forRole: 'contractor', title: accept ? `اعتُمد مخرج ${reqId}` : `رُفض مخرج ${reqId}`, body: accept ? (auto ? 'اعتماد تلقائي بعد انتهاء مهلة الاستشاري.' : 'اعتمد المكتب الاستشاري النتيجة.') : `السبب: ${reason} — يمكنك طلب إعادة الاختبار.`, link: `/requests/${reqId}`, tone: accept ? 'ok' : 'danger' })
    get().notify({ forRole: 'lab', title: accept ? `اعتُمد مخرج ${reqId}` : `رُفض مخرج ${reqId}`, body: accept ? '' : `السبب: ${reason}`, link: `/requests/${reqId}`, tone: accept ? 'ok' : 'warn' })
    if (!auto) get().toast({ title: accept ? 'اعتُمدت النتيجة' : 'رُفضت النتيجة', body: 'أُشعر المقاول والمختبر.', tone: accept ? 'ok' : 'warn' })
  },
  createRetest: (reqId, testId, slots, notes) => {
    const u = get().user!
    const parent = get().requests.find(r => r.id === reqId)!
    const t = parent.tests.find(x => x.id === testId)!
    // B.R.153 / B.R.132 — only a rejected output, once, on an active contract
    if (t.status !== 'STS21') { get().toast({ title: 'لا يمكن طلب الإعادة', body: 'إعادة الاختبار متاحة للمخرجات المرفوضة فقط.', tone: 'danger' }); return '' }
    if (get().requests.some(r => r.parentRequestId === reqId && r.retestOf === testId && r.status !== 'STS16' && r.status !== 'STS13')) { get().toast({ title: 'يوجد طلب إعادة قائم', body: 'لهذا الاختبار طلب إعادة جارٍ بالفعل.', tone: 'warn' }); return '' }
    if (!get().contracts.find(c => c.id === parent.contractId)?.active) { get().toast({ title: 'العقد منتهٍ', body: 'طلبات الاختبارات تُنشأ على العقود الفعّالة فقط (B.R.132).', tone: 'danger' }); return '' }
    const n = get().requests.filter(r => r.parentRequestId === reqId).length + 1
    const id = `${reqId}-R${n}`
    const req: TestRequest = {
      ...parent, id, status: 'STS11', createdAt: new Date().toISOString(), submittedAt: new Date().toISOString(), labDeadlineAt: isoIn(get().rules.labDecisionHours), rules: { labDecisionHours: get().rules.labDecisionHours, consultantDecisionHours: get().rules.consultantDecisionHours, vat: get().rules.vat, minLeadHours: get().rules.minLeadHours, geofenceMeters: get().rules.geofenceMeters, maxTestsPerRequest: get().rules.maxTestsPerRequest, proposedSlots: get().rules.proposedSlots },
      slots, chosenSlot: undefined, notes, parentRequestId: reqId, retestOf: testId, rejectReason: undefined, studyId: undefined, priority: parent.priority,
      tests: [{ id: uid('t'), refTestId: t.refTestId, method: t.method, price: t.price, sla: t.sla, status: 'STS17' }],
      history: [log(parent, u, 'إنشاء طلب إعادة اختبار', `مرتبط بـ ${reqId}`)],
    }
    set(s => ({ requests: [...s.requests, req] }))
    audit(get, set, 'إنشاء طلب إعادة اختبار', 'request', id)
    get().notify({ forRole: 'lab', title: `طلب إعادة اختبار ${id}`, body: `مرتبط بـ ${reqId} — الرد خلال ${get().rules.labDecisionHours} ساعة`, link: `/requests/${id}`, tone: 'warn' })
    get().toast({ title: 'أُرسل طلب الإعادة', body: `رقم الطلب ${id}`, tone: 'ok' })
    return id
  },

  patchStudy: (id, fn) => set(s => ({ studies: s.studies.map(st => { if (st.id !== id) return st; const c = structuredClone(st); fn(c); return c }) })),
  runEngine: (studyId) => {
    const { rules } = get()
    // B.R.175 — the approved exploration plan is the fixed reference; the engine never re-plans an approved study
    if (get().studies.find(s => s.id === studyId)?.plan.approved) { get().toast({ title: 'الخطة معتمدة', body: 'لا يمكن إعادة تشغيل المحرك بعد اعتماد خطة الاستكشاف (B.R.175).', tone: 'danger' }); return }
    get().patchStudy(studyId, (st) => {
      const p = st.prelim
      const floors = p.floors ?? 2, built = p.builtArea ?? p.area ?? 600
      // SBC 303 — Chapter 2, Table 2.1 (2007/2018 editions; 2024 values to be confirmed by client)
      let count = 3, codeMin = 4, codeMax = 6, special = false, row = ''
      if (floors >= 5 || built > 5000) { special = true; row = '≥5 أدوار أو > 5000 م² — يتطلب دراسة خاصة (Special investigation)' }
      else if (floors <= 2) { if (built < 600) { count = 3; codeMin = 4; codeMax = 6; row = '≤2 دور، مساحة مبنية < 600 م²' } else { count = Math.min(10, 3 + Math.ceil((built - 600) / 700)); codeMin = 5; codeMax = 8; row = '≤2 دور، 600–5000 م²' } }
      else { if (built < 600) { count = 3; codeMin = 6; codeMax = 9; row = '3–4 أدوار، مساحة مبنية < 600 م²' } else { count = Math.min(10, 3 + Math.ceil((built - 600) / 700)); codeMin = 8; codeMax = 12; row = '3–4 أدوار، 600–5000 م²' } }
      const depth = Math.max(rules.minBoreholeDepth, codeMax + (p.foundationDepth ?? 0))
      const spacing = Math.round(Math.sqrt((p.area ?? 625) / count) * 1.4)
      st.plan.engineSuggestion = {
        count, depth, spacing, special,
        ref: 'SBC 303 — الفصل الثاني (Geotechnical Investigations)، Table 2.1',
        basis: [
          `الصف المطبّق: ${row}`,
          `المساحة المبنية: ${built} م² · عدد الأدوار: ${floors}`,
          `عمق الكود: ⅔ الجسات ≥ ${codeMin} م و ⅓ ≥ ${codeMax} م من قاع الأساس (عمق التأسيس ${p.foundationDepth ?? 0} م)`,
          `سياسة المنصة: حد أدنى ${rules.minBoreholeDepth} م (قابل للتهيئة — ليس نصاً في الكود)`,
          'التوزيع: تغطية متوازنة لكامل القطعة بمسافات متساوية',
        ],
      }
      if (!special) {
        // distribute boreholes evenly in bounding box
        const ns = st.polygon.map(c => c.n), es = st.polygon.map(c => c.e)
        const n0 = Math.min(...ns), n1 = Math.max(...ns), e0 = Math.min(...es), e1 = Math.max(...es)
        const cols = Math.ceil(Math.sqrt(count)), rows = Math.ceil(count / cols)
        st.boreholes = Array.from({ length: count }, (_, i) => {
          const r = Math.floor(i / cols), c = i % cols
          const n = n0 + (n1 - n0) * ((r + 0.5) / rows), e = e0 + (e1 - e0) * ((c + 0.5) / cols)
          return { id: uid('bh'), code: `BH-${String(i + 1).padStart(2, '0')}`, approved: { n: +n.toFixed(5), e: +e.toFixed(5) }, approvedDepth: depth, status: 'ready', layers: [], samples: [], photos: [] } as Borehole
        })
      }
    })
  },

  createDelegation: (d) => {
    const u = get().user!; const to = get().users.find(x => x.id === d.toUserId); const req = get().requests.find(r => r.id === d.requestId)
    // B.R.232/233 — delegate must be an employee of the same organisation on a request the org is party to; only authorised users delegate directly
    if (!to || !req || to.orgId !== u.orgId || ![req.labId, req.consultantId, req.contractorId].includes(u.orgId) || to.id === u.id) { get().toast({ title: 'تفويض غير صالح', body: 'يجب أن يكون الموظف من نفس المنشأة وعلى طلب تخص المنشأة.', tone: 'danger' }); return }
    if (d.type === 'direct' && !(u.position === 'principal' || u.canDelegate)) { get().toast({ title: 'لا تملك صلاحية التفويض المباشر', body: 'المباشر للمفوّض الرئيسي أو من يملك صلاحية التفويض؛ يمكنك إنشاء تفويض غير مباشر ضمن نطاقك.', tone: 'danger' }); return }
    if (d.type === 'indirect' && u.position === 'employee' && !canActOnTest(get(), req, d.testId ?? '')) { get().toast({ title: 'خارج نطاق تفويضك', body: 'التفويض غير المباشر يكون ضمن الطلب أو الاختبار المفوَّض لك فقط (B.R.233).', tone: 'danger' }); return }
    if (get().delegations.some(x => x.requestId === d.requestId && x.toUserId === d.toUserId && (x.testId ?? '') === (d.testId ?? '') && (x.status === 'STS22' || x.status === 'STS23'))) { get().toast({ title: 'التفويض موجود مسبقاً', body: 'يوجد تفويض فعّال أو معلّق لنفس الموظف على نفس النطاق.', tone: 'warn' }); return }

    if (isRealId(d.requestId) && getAuth()) {
      void (async () => {
        try {
          await createRealDelegation({ type: d.type, scope: d.scope, requestId: d.requestId, testId: d.testId, toUserId: d.toUserId })
          await get().refreshBackendData()
          get().toast({ title: 'أُنشئ التفويض فعلياً على الخادم', body: `${to.name} — ${d.requestId}`, tone: 'ok' })
        } catch (e) {
          get().toast({ title: 'فشل إنشاء التفويض على الخادم', body: e instanceof ApiError ? e.message : String(e), tone: 'danger' })
        }
      })()
      return
    }

    const status = d.type === 'direct' ? 'STS23' : 'STS22'
    set(s => ({ delegations: [...s.delegations, { ...d, id: uid('d'), createdAt: new Date().toISOString(), status }] }))
    audit(get, set, 'إنشاء تفويض', 'delegation', d.requestId)
    get().notify({ forRole: to.role, title: status === 'STS23' ? `فُوِّضت على ${d.requestId}` : `تفويض بانتظار قبولك — ${d.requestId}`, body: `${u.name} — ${d.scope === 'request' ? 'الطلب كاملاً' : 'اختبار محدد'}`, link: '/delegations', tone: 'info' })
    get().toast({ title: status === 'STS23' ? 'فُعّل التفويض' : 'أُرسل التفويض', body: status === 'STS23' ? 'أُشعر الموظف بالتفويض.' : 'يصبح فعّالاً بعد قبول الموظف.', tone: 'ok' })
  },
  decideDelegation: (id, accept) => {
    const d0 = get().delegations.find(d => d.id === id); if (!d0 || d0.status !== 'STS22' || d0.toUserId !== get().user?.id) { get().toast({ title: 'لا يمكن اتخاذ القرار', body: 'القرار متاح للموظف المفوَّض إليه على تفويض معلّق فقط (B.R.234).', tone: 'danger' }); return }

    if (isRealId(id) && getAuth()) {
      void (async () => {
        try {
          await respondToDelegation(id, accept)
          await get().refreshBackendData()
          get().toast({ title: accept ? 'قُبل التفويض فعلياً على الخادم' : 'رُفض التفويض فعلياً على الخادم', body: id, tone: accept ? 'ok' : 'warn' })
        } catch (e) {
          get().toast({ title: 'فشل تنفيذ القرار على الخادم', body: e instanceof ApiError ? e.message : String(e), tone: 'danger' })
        }
      })()
      return
    }

    set(s => ({ delegations: s.delegations.map(d => d.id === id ? { ...d, status: accept ? 'STS23' : 'STS24', decidedAt: new Date().toISOString() } : d) }))
    audit(get, set, accept ? 'قبول تفويض' : 'رفض تفويض', 'delegation', d0.requestId)
    get().notify({ forRole: roleOf(get(), get().user!.orgId), title: accept ? `قُبل التفويض على ${d0.requestId}` : `رُفض التفويض على ${d0.requestId}`, body: get().user!.name, link: '/delegations', tone: accept ? 'ok' : 'warn' })
  },
  editDelegation: (id, toUserId) => {
    const u = get().user!; const old = get().delegations.find(d => d.id === id)!; const req = get().requests.find(r => r.id === old.requestId)
    // B.R.235 — after field works start, only the principal / an authorised user may change the delegate
    const started = req?.status === 'STS14' || req?.status === 'STS15'
    if (started && !(u.position === 'principal' || u.canDelegate)) { get().toast({ title: 'لا يمكن تعديل التفويض', body: 'بعد بدء الأعمال الميدانية يُعدَّل التفويض من المفوّض الرئيسي فقط (B.R.235).', tone: 'danger' }); return }
    if (get().users.find(x => x.id === toUserId)?.orgId !== u.orgId) { get().toast({ title: 'تفويض غير صالح', body: 'الموظف البديل يجب أن يكون من نفس المنشأة.', tone: 'danger' }); return }
    set(s => ({ delegations: [...s.delegations.map(d => d.id === id ? { ...d, status: 'STS25' as const } : d), { ...old, id: uid('d'), toUserId, status: old.type === 'direct' ? 'STS23' : 'STS22', createdAt: new Date().toISOString(), decidedAt: undefined }] }))
    audit(get, set, 'تعديل تفويض', 'delegation', old.requestId, 'notice')
  },

  setRules: (r) => { set(s => ({ rules: { ...s.rules, ...r } })); audit(get, set, 'تعديل قاعدة أعمال', 'settings', Object.keys(r).join(','), 'critical'); get().toast({ title: 'حُفظت الإعدادات', body: 'تُطبَّق على العمليات الجديدة فقط.', tone: 'ok' }) },
  setOrgActive: (id, active) => set(s => ({ orgs: s.orgs.map(o => o.id === id ? { ...o, active } : o) })),
  addEmployee: (name, mobile, canDelegate) => { const u = get().user!; set(s => ({ users: [...s.users, { id: `u-${Date.now()}`, name, mobile, role: u.role, position: 'employee', orgId: u.orgId, orgName: u.orgName, canDelegate }] })); audit(get, set, 'إضافة موظف', 'account', name, 'notice'); get().toast({ title: 'أُضيف الموظف', body: `${name} — يصله رمز التفعيل على ${mobile}.`, tone: 'ok' }) },
  setEmployeeDelegate: (id, canDelegate) => { set(s => ({ users: s.users.map(x => x.id === id ? { ...x, canDelegate } : x) })); audit(get, set, canDelegate ? 'منح صلاحية التفويض' : 'سحب صلاحية التفويض', 'account', get().users.find(x => x.id === id)?.name ?? id, 'notice') },
}))

// ── Selectors / helpers ─────────────────────────────────────
/** Selector hook for derived arrays/objects — shallow-compared so fresh `.filter()` results don't re-render forever. */
export const useSel = <T,>(sel: (s: State) => T): T => useStore(useShallow(sel))
export const useUser = () => useStore(s => s.user)
export const selectOrg = (id: string) => useStore.getState().orgs.find(o => o.id === id)
export const selectRefTest = (id: string) => useStore.getState().refTests.find(t => t.id === id)

/** Delegation-aware access: employee sees only delegated requests/tests; principal sees org scope. */
export const visibleRequests = (s: State): TestRequest[] => {
  const u = s.user
  if (!u) return []
  // Drafts (STS09) exist only for the contractor who is writing them — nobody else sees them.
  const orgScope = s.requests.filter(r => (r.status !== 'STS09' || u.role === 'contractor') && (
    u.role === 'admin' || u.role === 'support' || u.role === 'supervisor' ||
    (u.role === 'contractor' && r.contractorId === u.orgId) ||
    (u.role === 'lab' && r.labId === u.orgId) ||
    (u.role === 'consultant' && r.consultantId === u.orgId)))
  if (u.position === 'principal' || u.role === 'contractor' || u.role === 'consultant' || u.role === 'admin' || u.role === 'support' || u.role === 'supervisor') return orgScope
  const mine = new Set(s.delegations.filter(d => d.toUserId === u.id && d.status === 'STS23').map(d => d.requestId))
  return orgScope.filter(r => mine.has(r.id))
}

export const canActOnTest = (s: State, r: TestRequest, testId: string) => {
  const u = s.user; if (!u) return false
  if (u.position === 'principal') return true
  return s.delegations.some(d => d.toUserId === u.id && d.status === 'STS23' && d.requestId === r.id && (d.scope === 'request' || d.testId === testId))
}

export const emptyBorehole = (code: string, approved: Coord, depth: number): Borehole => ({ id: uid('bh'), code, approved, approvedDepth: depth, status: 'ready', layers: [], samples: [], photos: [] })
export type { Layer, Sample }
