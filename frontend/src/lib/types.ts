// ── Roles & entities (BRD 3.2) ──────────────────────────────
export type EntityType = 'contractor' | 'lab' | 'consultant' | 'supervisor' | 'ops'
export type Role = 'contractor' | 'lab' | 'consultant' | 'supervisor' | 'admin' | 'support' | 'visitor'
export type Position = 'principal' | 'employee' // المفوّض الرئيسي / موظف

export interface User {
  id: string
  name: string
  role: Role
  position: Position
  orgId: string
  orgName: string
  mobile: string
  canDelegate: boolean // صلاحية التفويض الأصلية
}

export interface Organization {
  id: string
  type: EntityType
  name: string
  cr: string // السجل التجاري
  city: string
  region: string
  logo?: string
  about: string
  specialties: string[]
  phone: string
  email: string
  website?: string
  address: string
  rating: number
  reviews: number
  active: boolean
  featured?: boolean
  saac?: { number: string; scope: string; expires: string }
  kpis: { label: string; value: string }[]
  license?: string
  since?: string
  employees?: number
  onTime?: number // % on-time delivery (labs)
  autoApprovals?: number
}

// ── Reference elements (managed by admin) ───────────────────
export type Category = 'soil' | 'asphalt' | 'concrete' | 'aggregate'
export interface Method { code: string; name: string; org: 'ASTM' | 'AASHTO' | 'BS' | 'SBC' | 'IP' | 'ISO' }
export interface RefTest {
  id: string
  allowExternalReport?: boolean
  active?: boolean
  nameAr: string
  nameEn: string
  category: Category
  methods: Method[]
  units: Unit[]
  resultFields?: { key: string; label: string; unit: string }[]
}
export type Unit = 'Ea' | 'Set' | 'per Test'

// ── Lab test list (BRD 4.1.1) ───────────────────────────────
export type CatalogStatus = 'STS01' | 'STS02' | 'STS03'
export interface CatalogItem {
  id: string
  labId: string
  refTestId: string
  unit?: Unit
  methods: string[] // method codes chosen
  basePrice?: number
  sla?: number // days
  status: CatalogStatus
}

// ── Contracts (phase 1 — inferred) ──────────────────────────
export interface Contract {
  id: string
  contractorId: string
  labId: string
  consultantId: string
  project: string
  services: ServiceType[]
  payment: 'advance' | 'on-completion'
  startedAt: string
  active: boolean
}

// ── Quotes → contracts (B.R.116/119 — pre-contract flow) ────
export type QuoteStatus = 'pending' | 'quoted' | 'accepted' | 'rejected' | 'expired'
export interface QuoteItem { refTestId: string; method: string; basePrice: number; price: number; sla: number }
export interface Quote {
  id: string; contractorId: string; labId: string; consultantId: string; project: string; city: string
  services: ServiceType[]; payment: 'advance' | 'on-completion'; items: QuoteItem[]; notes?: string
  status: QuoteStatus; createdAt: string; quotedAt?: string; decidedAt?: string; validUntil?: string; labNotes?: string; rejectReason?: string; contractId?: string
}
export interface Template { id: string; name: string; ver: string; ref: string; fields: string; updated: string; used: number; status: 'ساري' | 'مسودة' | 'مؤرشف'; sections: string[]; history?: { ver: string; date: string; note: string; status: 'ساري' | 'مسودة' | 'مؤرشف' }[] }
export interface KnowledgeVersion { ver: string; date: string; changes: string; studies: number; status: 'ساري' | 'مسودة' | 'مؤرشف' }

// ── Requests (BRD 4.1.3) ────────────────────────────────────
export type ServiceType = 'standard' | 'geotech'
export type RequestStatus = 'STS09' | 'STS10' | 'STS11' | 'STS12' | 'STS13' | 'STS14' | 'STS15' | 'STS16' | 'STS26'
export type TestStatus = 'STS17' | 'STS18' | 'STS19' | 'STS20' | 'STS21'

export interface TimeSlot { date: string; from: string; to: string }

export interface TestItem {
  id: string
  refTestId: string
  method: string
  price: number
  sla: number
  status: TestStatus
  startedAt?: string
  submittedAt?: string
  decidedAt?: string
  deadlineAt?: string
  autoApproved?: boolean
  delayHours?: number // B.R.149 — late start vs the approved slot
  sample?: { id: string; depth: number; technician: string; receivedAt: string; geoVerified: boolean; confirmedByContractor?: boolean; confirmedAt?: string }
  result?: Record<string, string | number>
  report?: { name: string; size: string }
  notes?: string
  rejectReason?: string
  delegateId?: string
}

export interface AuditEntry { id: string; at: string; actor: string; actorRole: Role; action: string; detail?: string }

export interface TestRequest {
  id: string
  attachments?: { name: string; size: string }[] // B.R.133
  rules?: Pick<BusinessRules, 'labDecisionHours' | 'consultantDecisionHours' | 'vat' | 'minLeadHours' | 'geofenceMeters' | 'maxTestsPerRequest' | 'proposedSlots'> // frozen at submit — rules apply to new operations only
  city?: string
  priority?: 'عادية' | 'عالية' | 'حرجة'
  contractId: string
  contractorId: string
  labId: string
  consultantId: string
  project: string
  service: ServiceType
  category?: Category
  status: RequestStatus
  createdAt: string
  submittedAt?: string
  labDeadlineAt?: string
  slots: TimeSlot[]
  chosenSlot?: TimeSlot
  location: string
  notes?: string
  tests: TestItem[]
  history: AuditEntry[]
  parentRequestId?: string // إعادة اختبار
  retestOf?: string
  rejectReason?: string
  delegateId?: string
  studyId?: string
}

// ── Geotechnical study (BRD 4.1.4) ──────────────────────────
export type StudyPhase = 1 | 2 | 3 | 4 | 5 | 6
export type BoreholeStatus = 'ready' | 'in-progress' | 'done'
export type USCS = 'SM' | 'SC' | 'SW' | 'SP' | 'ML' | 'CL' | 'CH' | 'GW' | 'GP' | 'ROCK'

export interface Coord { n: number; e: number }
export interface Sample {
  id: string
  layerId: string
  type: 'SPT' | 'UD' | 'D' | 'CS'
  kind: 'soil' | 'rock'
  from: number
  to: number
  fieldUSCS?: USCS
  labUSCS?: USCS
  labStatus: 'ready' | 'in-progress' | 'done'
  tests: SampleTest[]
}
export interface SampleTest {
  id: string
  name: string
  method: string
  mandatory: boolean
  value?: string
  unit?: string
  attachment?: string
  compliance?: 'ok' | 'fail'
  limit?: string
}
export interface Layer {
  id: string
  from: number
  to: number
  uscs: USCS
  gradation?: string
  color?: string
  moisture?: string
  description: string
  spt?: [number, number, number]
  n?: number
  rec?: number
  offsite?: { reason: string }
  photo?: string
}
export interface Borehole {
  id: string
  code: string
  approved: Coord // من الاستشاري — ثابت
  operational?: Coord // من المختبر
  actual?: Coord // GPS وقت التنفيذ
  approvedDepth: number
  executedDepth?: number
  status: BoreholeStatus
  moved?: number // متر
  addedByLab?: { reason: string }
  head?: {
    method: string; rig?: string; diameter: number; casing?: number
    groundLevel?: number; waterInstant?: number; water24h?: number
    date?: string; weather?: string; technician?: string
  }
  layers: Layer[]
  samples: Sample[]
  photos: string[]
  geoVerified?: { distance: number }
}

export interface Study {
  id: string
  requestId: string
  ref: string
  phase: StudyPhase
  prelim: {
    deedFile?: string
    parcel?: string; plan?: string; district?: string; city?: string; region?: string
    deedNo?: string; deedDate?: string
    area?: number; computedArea?: number; boundaryOk?: boolean
    owner?: string; ownerId?: string
    buildingType?: 'residential' | 'commercial' | 'industrial'
    structure?: 'rc' | 'steel'
    floors?: number
    builtArea?: number
    foundationType?: 'unknown' | 'isolated' | 'raft'
    foundationDepth?: number
    priorInfo?: boolean; neighbors?: boolean
    siteConditions: string[]
    permitNo?: string
    approvedByConsultant?: boolean
    reviewNotes?: string
  }
  polygon: Coord[]
  plan: {
    engineSuggestion?: { count: number; depth: number; spacing: number; basis: string[]; special?: boolean; ref: string }
    approved?: boolean
    approvedAt?: string
    justification?: string
  }
  fieldPlanReviewed?: boolean
  compliance?: number
  boreholes: Borehole[]
  fieldApproved?: boolean
  chemical?: { sampleId?: string; engineSuggestedSampleId?: string; reasonOverride?: string; results: SampleTest[]; done?: boolean; partialReason?: string }
  analysis: {
    computed: Record<string, { value?: string; inputs: Record<string, string>; formula: string; unit: string }>
    analytical: Record<string, string>
    recommendations: Record<string, string>
    manual: Record<string, string>
    attachments: string[]
    done?: boolean
  }
  report?: { previewed?: boolean; approved?: boolean; approvedAt?: string; rejectReason?: string; generatedFile?: string }
}

// ── Delegation (BRD 4.1.6) ──────────────────────────────────
export type DelegationStatus = 'STS22' | 'STS23' | 'STS24' | 'STS25'
export interface Delegation {
  id: string
  type: 'direct' | 'indirect'
  scope: 'request' | 'test'
  requestId: string
  testId?: string
  fromUserId: string
  toUserId: string
  status: DelegationStatus
  createdAt: string
  decidedAt?: string
}

// ── Ratings ────────────────────────────────────────────────
export interface Rating {
  id: string
  contractId: string
  labId: string
  contractorId: string
  quality: number; punctuality: number; communication: number
  comment?: string
  createdAt: string
  status: 'STS06' | 'STS07' | 'STS08'
}

// ── Business rules (admin, snapshotted per request) ────────
export interface BusinessRules {
  maxTestsPerRequest: number
  proposedSlots: number
  minLeadHours: number
  labDecisionHours: number
  consultantDecisionHours: number
  minBoreholeDepth: number
  geofenceMeters: number
  vat: number
  labTimeoutAction: 'expire' | 'none'
  /** Which analysis path the smart engine uses, and what happens when one is unavailable (B.R.230). */
  enginePolicy: 'screen-then-cloud' | 'cloud-first' | 'local-first' | 'compare'
}

export interface Notification { id: string; at: string; title: string; body: string; read: boolean; forRole: Role; forOrgId?: string; link?: string; tone?: 'ok' | 'warn' | 'danger' | 'info' }

// ── Governance / archive ───────────────────────────────────
export interface AuditEvent { id: string; at: string; actor: string; role: Role; org: string; action: string; entity: string; entityId: string; ip: string; severity: 'info' | 'notice' | 'warning' | 'critical'; detail?: string }
export interface Document { id: string; name: string; type: 'report' | 'borehole-log' | 'test-result' | 'certificate' | 'contract' | 'deed' | 'invoice' | 'photo'; requestId?: string; contractId?: string; orgId: string; size: string; at: string; version: number; hash: string; retentionUntil: string; classification: 'عام' | 'داخلي' | 'سري' }
export interface Invoice { id: string; contractId: string; requestId: string; contractorId: string; labId: string; amount: number; vat: number; status: 'paid' | 'due' | 'overdue' | 'draft'; issuedAt: string; dueAt: string; paidAt?: string }
export interface Policy { id: string; title: string; version: string; effective: string; owner: string; scope: string; status: 'ساري' | 'مسودة' | 'منتهٍ'; ref: string }
