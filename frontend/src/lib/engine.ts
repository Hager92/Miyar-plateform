/**
 * Live client for the I-DO dual-path engineering engine (ido_dual_ai v0.2.8).
 *
 * This is a real HTTP client, not a simulation: the demo posts the actual PDF to
 * the running FastAPI service and renders whatever it returns. Nothing here
 * fabricates a verdict, a status, an elapsed time or a token count.
 *
 * When the service is unreachable the platform must keep working and say so —
 * that is B.R.230, not a fallback we invented.
 */

/* ───────── evaluation result (mirrors schemas/evaluation_schema.json) ───────── */

/** The six client-facing statuses from the control pack. The demo used to know only two. */
export type EvalStatus =
  | 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIALLY_COMPLIANT'
  | 'NOT_EVALUABLE' | 'NOT_APPLICABLE'

export type ResultType = 'MEASURED_DATA' | 'CALCULATED_DATA' | 'ANALYTICAL_FINDING' | 'RECOMMENDATION'

export interface Assessment {
  requirement_id: string
  requirement_text: string
  evidence: string
  source_location: string
  measured_value: string
  measured_unit: string
  required_condition_or_limit: string
  technical_reference: string
  knowledge_rule_id: string
  knowledge_version: string
  status: EvalStatus
  reasoning_summary: string
}

export interface EvidenceItem {
  evidence_type: string; identifier: string; value: string; unit: string
  location_or_depth: string; source_page_or_section: string; report_conclusion: string
}

export interface Conflict { description: string; source_a: string; source_b: string; action_required: string }
export interface Finding { finding: string; basis: string; reference: string; result_type: ResultType }
export interface Recommendation { recommendation: string; basis: string; reference: string; human_review_required: boolean }

/** Written by enforce_engineering_safety() in the engine — the deterministic guardrail pass. */
export interface EngineeringSafety {
  guardrails_version: string
  control_pack_version: string | null
  clause_registry_version: string | null
  edition_gate_required: boolean
  effective_for_production: boolean
  /** How many COMPLIANT/NON_COMPLIANT verdicts the gate downgraded to NOT_EVALUABLE. */
  downgraded_assessments: number
  human_review_required: boolean
}

export interface EvalResult {
  document: { type: string; discipline: string; project_or_site: string; scope_match: boolean; scope_reason: string }
  overall_status: EvalStatus
  executive_summary: string
  evidence: EvidenceItem[]
  assessments: Assessment[]
  analytical_findings: Finding[]
  missing_information: string[]
  conflicts: Conflict[]
  engineering_recommendations: Recommendation[]
  human_engineering_review_required: boolean
  overall_conclusion: string
  _engineering_safety?: EngineeringSafety
}

export interface ScopeGate {
  detected: 'geotechnical' | 'structural' | 'mixed_or_ambiguous' | 'unknown'
  scores: Record<string, number>
  hits: Record<string, string[]>
}

export interface Usage { prompt_tokens: number; completion_tokens: number; total_tokens: number; cost: number }

export interface PathRun {
  provider: string
  engine: string
  model: string
  elapsed_seconds: number
  privacy: string
  scope_gate?: ScopeGate
  usage?: Usage
  result: EvalResult
}

export interface AnalyzeResponse {
  mode: EngineMode
  profile: string
  cloud?: PathRun
  local?: PathRun
  cloud_error?: string
  local_error?: string
  comparison?: {
    scope_match_same: boolean; overall_status_same: boolean
    cloud_status: EvalStatus; local_status: EvalStatus
    cloud_seconds: number; local_seconds: number
    cloud_assessments: number; local_assessments: number
    cloud_recommendations: number; local_recommendations: number
  }
  scope_gate_stopped?: boolean
}

export interface EngineHealth {
  status: string
  cloud: { provider: string; configured: boolean; model: string; base_url: string; pdf_engine: string }
  local: {
    provider: string; reachable: boolean; model: string; base_url: string
    thinking_enabled: boolean; structured_mode: string; num_ctx: number
    num_predict: number; evidence_chars: number; timeout_seconds: number; error: string
  }
  policy_version: string
  meyar_engineering_controls: {
    guardrails_loaded: boolean
    control_pack_loaded: boolean
    clause_registry_loaded: boolean
    control_pack_version: string | null
    clause_registry_version: string | null
    /** false until a geotechnical expert approves the clause registry and the governing SBC edition is fixed. */
    effective_for_production: boolean
    edition_gate: { required?: boolean; reason?: string; on_unconfirmed?: string }
  }
}

export type EngineMode = 'cloud' | 'local' | 'compare'

/** Assessment profiles the engine exposes. The Arabic strings are the engine's own keys — do not translate. */
export const ENGINE_PROFILES = [
  'الدراسة الجيوتقنية — منصة معيار',
  'الفحص والتقييم الإنشائي',
  'تقرير هندسي عام — نسخة العرض',
] as const
export type EngineProfile = (typeof ENGINE_PROFILES)[number]

/* ───────── endpoint ───────── */

const LS_KEY = 'miyar.engineBaseUrl'

/**
 * Where to reach the engine.
 *
 * In dev we go through the Vite proxy at `/engine-api` so the request is same-origin —
 * the reference service has no CORS middleware and a direct call would be blocked.
 * A build points at VITE_ENGINE_URL (which must then allow this origin), and a
 * localStorage override wins over both so the presenter can repoint without a rebuild.
 */
export function engineBaseUrl(): string {
  try {
    const stored = localStorage.getItem(LS_KEY)
    if (stored) return stored.replace(/\/+$/, '')
  } catch { /* private mode / blocked storage — fall through to the default */ }
  const env = (import.meta as { env?: { DEV?: boolean; VITE_ENGINE_URL?: string } }).env
  if (env?.DEV) return '/engine-api'
  return (env?.VITE_ENGINE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')
}

/** Human-readable target — the proxy path alone tells the presenter nothing. */
export function engineTarget(): string {
  const b = engineBaseUrl()
  return b === '/engine-api' ? 'http://127.0.0.1:8000 (عبر وسيط التطوير)' : b
}

export function setEngineBaseUrl(url: string) {
  try {
    if (url) localStorage.setItem(LS_KEY, url.replace(/\/+$/, ''))
    else localStorage.removeItem(LS_KEY)
  } catch { /* private mode / blocked storage */ }
}

/** The explicit override, if one is set. Empty string means "use the default for this build". */
export function engineOverride(): string {
  try { return localStorage.getItem(LS_KEY) ?? '' } catch { return '' }
}

/**
 * User-facing reason for a transport failure, shown under B.R.230.
 * Deliberately free of endpoints, stack text and operator instructions — the technical
 * detail goes to the console for whoever runs the service, not to the screen.
 */
function transportReason(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  if (typeof console !== 'undefined') console.warn('[engine]', m)
  if (/abort/i.test(m)) return 'انتهت مهلة الاتصال بخدمة التحليل قبل وصول نتيجة.'
  return 'خدمة التحليل غير متاحة حالياً.'
}

export async function fetchHealth(signal?: AbortSignal): Promise<EngineHealth> {
  const r = await fetch(`${engineBaseUrl()}/api/health`, { signal })
  if (!r.ok) throw new Error(`المحرك ردّ بحالة ${r.status}`)
  return r.json() as Promise<EngineHealth>
}

/**
 * Poll health. Returns a cleanup function. Never throws — the caller gets `null` when unreachable.
 * A failed probe retries sooner than a successful one so the badge recovers quickly once the
 * engine comes up mid-demo (the first probe can be slow while the dev proxy warms up).
 */
export function watchHealth(onChange: (h: EngineHealth | null, reason?: string) => void, everyMs = 15000, retryMs = 4000) {
  let stopped = false
  let timer: ReturnType<typeof setTimeout>
  const tick = async () => {
    const ctl = new AbortController()
    const to = setTimeout(() => ctl.abort(), 10000)
    let ok = false
    try {
      const h = await fetchHealth(ctl.signal)
      ok = true
      if (!stopped) onChange(h)
    } catch (e) {
      if (!stopped) onChange(null, transportReason(e))
    } finally {
      clearTimeout(to)
      if (!stopped) timer = setTimeout(tick, ok ? everyMs : retryMs)
    }
  }
  tick()
  return () => { stopped = true; clearTimeout(timer) }
}

export class EngineError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'EngineError'
    this.status = status
  }
}

export async function analyze(file: File, profile: EngineProfile, mode: EngineMode, signal?: AbortSignal): Promise<AnalyzeResponse> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('profile', profile)
  fd.append('mode', mode)
  let r: Response
  try {
    r = await fetch(`${engineBaseUrl()}/api/analyze`, { method: 'POST', body: fd, signal })
  } catch (e) {
    throw new EngineError(transportReason(e))
  }
  if (!r.ok) {
    // FastAPI puts the Arabic message in `detail`
    const detail = await r.json().then((d: { detail?: string }) => d?.detail).catch(() => undefined)
    throw new EngineError(detail || `تعذّر إجراء التحليل — حالة ${r.status}`, r.status)
  }
  return r.json() as Promise<AnalyzeResponse>
}

/* ───────── presentation helpers ───────── */

export const STATUS_AR: Record<EvalStatus, string> = {
  COMPLIANT: 'متوافق',
  NON_COMPLIANT: 'غير متوافق',
  PARTIALLY_COMPLIANT: 'متوافق جزئياً',
  NOT_EVALUABLE: 'غير قابل للتقييم',
  NOT_APPLICABLE: 'غير منطبق',
}

export const STATUS_TONE: Record<EvalStatus, 'ok' | 'danger' | 'warn' | 'neutral' | 'info'> = {
  COMPLIANT: 'ok',
  NON_COMPLIANT: 'danger',
  PARTIALLY_COMPLIANT: 'warn',
  NOT_EVALUABLE: 'neutral',
  NOT_APPLICABLE: 'neutral',
}

export const RESULT_TYPE_AR: Record<ResultType, string> = {
  MEASURED_DATA: 'بيانات مقاسة',
  CALCULATED_DATA: 'بيانات محسوبة',
  ANALYTICAL_FINDING: 'استنتاج تحليلي',
  RECOMMENDATION: 'توصية',
}

/* ───────── routing policy ─────────
   The ministry's stated pain is not only the cloud bill — it is that the subscription
   lapses when payment is late and work stops. So the path is chosen by a platform
   policy, not by the operator picking a radio button each time, and an unavailable
   path fails over automatically and says so. */

export type RoutePolicy = 'local-first' | 'cloud-first' | 'screen-then-cloud' | 'compare'

export const ROUTE_POLICY_AR: Record<RoutePolicy, { label: string; detail: string }> = {
  'screen-then-cloud': {
    label: 'فحص محلي ثم سحابي',
    detail: 'يفحص المسار المحلي المستند أولاً بلا تكلفة، ولا يُستدعى السحابي إلا إذا كان المستند مستوفياً وصالحاً للتحليل العميق.',
  },
  'local-first': {
    label: 'محلي أولاً',
    detail: 'يُشغَّل المسار المحلي دائماً، ولا يُستدعى السحابي إلا عند تعذّر المحلي. أقل تكلفة وأعلى سيادة.',
  },
  'cloud-first': {
    label: 'سحابي أولاً',
    detail: 'يُشغَّل المسار السحابي، ويتحوّل التشغيل تلقائياً إلى المحلي إذا توقف الاشتراك أو تعذّر الوصول.',
  },
  compare: {
    label: 'مقارنة المسارين',
    detail: 'يُشغَّل المساران بالسياسة نفسها لقياس الفارق قبل اعتماد المحلي بديلاً دائماً.',
  },
}

export interface RouteDecision {
  /** The mode actually sent to the engine, or null when neither path can serve. */
  mode: EngineMode | null
  /** Arabic explanation shown next to the decision — never leave the user guessing why. */
  reason: string
  /** True when the policy's preferred path was unavailable and the platform switched. */
  failedOver: boolean
  /** True when "compare" could only run one path. */
  degraded: boolean
}

/** Resolve which path to run. `cloudOutage` lets a presenter demonstrate a lapsed subscription. */
export function resolveRoute(policy: RoutePolicy, health: EngineHealth | null, cloudOutage = false): RouteDecision {
  const cloud = !!health?.cloud.configured && !cloudOutage
  const local = !!health?.local.reachable

  if (!cloud && !local) {
    return { mode: null, reason: 'لا يتوفر أي مسار تحليل — تستمر إجراءات الدراسة النظامية دون نتيجة من المحرك (B.R.230).', failedOver: false, degraded: false }
  }
  if (policy === 'compare') {
    if (cloud && local) return { mode: 'compare', reason: 'المساران متاحان — يُشغَّلان معاً بالسياسة وحزمة المعرفة نفسها.', failedOver: false, degraded: false }
    const only: EngineMode = cloud ? 'cloud' : 'local'
    return {
      mode: only, degraded: true, failedOver: false,
      reason: `تعذّرت المقارنة لأن المسار ${cloud ? 'المحلي' : 'السحابي'} غير متاح — نُفِّذ المسار ${cloud ? 'السحابي' : 'المحلي'} وحده.`,
    }
  }
  // screen-then-cloud starts on the local path too; escalation is decided after it answers
  const prefer: EngineMode = policy === 'local-first' || policy === 'screen-then-cloud' ? 'local' : 'cloud'
  const preferUp = prefer === 'local' ? local : cloud
  if (preferUp) {
    return { mode: prefer, reason: ROUTE_POLICY_AR[policy].detail, failedOver: false, degraded: false }
  }
  const fallback: EngineMode = prefer === 'local' ? 'cloud' : 'local'
  return {
    mode: fallback, failedOver: true, degraded: false,
    reason: prefer === 'cloud'
      ? 'المسار السحابي غير متاح — تحوّل التشغيل تلقائياً إلى المسار المحلي الآمن ولم تتوقف الدراسة.'
      : 'المسار المحلي غير متاح — تحوّل التشغيل تلقائياً إلى المسار السحابي.',
  }
}

/* ───────── local screening before a paid cloud run ─────────
   The engine already refuses an out-of-scope document for free. Screening goes one step
   further: the local model reads the document first, and the cloud is only paid for when
   the document is actually worth a deep analysis. */

export interface ScreenDecision {
  escalate: boolean
  reason: string
}

/**
 * Decide whether a local screening result justifies paying for a cloud run.
 *
 * Conservative on purpose: escalate unless the screening shows the document cannot
 * benefit from it. A missed escalation costs an engineer a second run; a wrong one
 * costs the ministry money on a document that was never evaluable.
 */
export function shouldEscalate(r: EvalResult): ScreenDecision {
  if (!r.document.scope_match) {
    return { escalate: false, reason: 'المستند خارج نطاق ملف التقييم المختار — لا فائدة من تحليل سحابي مدفوع.' }
  }
  // nothing was assessed and nothing was extracted: the document lacks the inputs entirely
  if (r.assessments.length === 0 && r.evidence.length === 0 && r.missing_information.length > 0) {
    return { escalate: false, reason: 'لا يحتوي المستند على البيانات اللازمة للتقييم — يلزم استكمالها قبل أي تحليل عميق.' }
  }
  if (r.overall_status === 'NOT_APPLICABLE') {
    return { escalate: false, reason: 'حالة الاستخدام غير منطبقة على هذا المستند.' }
  }
  return { escalate: true, reason: 'اجتاز المستند الفحص المحلي — يُحال إلى التحليل السحابي العميق.' }
}

/** One step of a screened run, for the stage strip the user sees. */
export interface RunStage {
  key: 'scope' | 'local' | 'cloud'
  label: string
  ran: boolean
  note: string
  seconds?: number
  cost?: number
}

/* ───────── cost model ─────────
   Every figure below is quoted from one source and is shown to the user with that
   source attached. Nothing here is estimated by us.
   Source: «عمران تيك — فحص التربة + OCI», §5.1 «خيار التشغيل» and §7 «العرض المالي». */
export const COST_REF = {
  source: 'التسعيرة المرجعية المعتمدة في إعدادات المنصة',
  /** SAR per document, cloud API consumption. */
  cloudPerDoc: 15000 / 9000,
  monthlyBudgetSAR: 15000,
  budgetCoversDocs: 9000,
  /** The same budget, redirected to dedicated GPU instances inside the client tenancy. */
  localNote: 'يحوّل العرض ميزانية الاستهلاك نفسها إلى تكلفة نسخ GPU داخل بيئة العميل — تكلفة سعة ثابتة بدل استهلاك متغيّر.',
  sovereignty: {
    cloud: 'يغادر المستند بيئة العميل إلى واجهة نموذج خارجية — يتطلب اعتماد سياسة إقامة البيانات.',
    local: 'لا يغادر المستند الجهاز ولا تُستدعى أي خدمة سحابية — أعلى مستوى لسيادة البيانات.',
  },
  /** The reason the local path exists, in the ministry's own terms. */
  continuity: 'انقطاع الاشتراك السحابي لتأخر السداد لا يوقف الدراسة — يتحوّل التشغيل تلقائياً إلى المسار المحلي بالسياسة وحزمة المعرفة نفسها.',
} as const

/** Monthly cloud spend for a given volume, in SAR. Linear by definition of the quoted rate. */
export const cloudMonthlySAR = (docsPerMonth: number) => docsPerMonth * COST_REF.cloudPerDoc
