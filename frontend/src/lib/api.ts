/**
 * Real HTTP client for the Miyar Frappe backend (apps/miyar on this bench).
 *
 * Auth: token-based (`Authorization: token <api_key>:<api_secret>`) rather than
 * cookie/session — this avoids cross-origin cookie + CSRF complexity entirely
 * and matches how any real API client would integrate with Frappe. For the
 * fixed demo roster (see README's "الدخول التجريبي" table), the key/secret per
 * user is issued by `miyar.setup.seed_demo.run` and published to
 * `public/demo-tokens.json` (gitignored — regenerate it by re-running that
 * script; it is never checked into the design repo).
 *
 * This file deliberately knows nothing about React/Zustand — `store.ts` is the
 * only caller, and it owns translating these DTOs into the app's existing
 * `Organization` / `TestRequest` / ... shapes so every screen keeps working
 * unchanged.
 */

const LS_KEY = 'miyar.apiBaseUrl'
const AUTH_KEY = 'miyar.auth'

export function apiBaseUrl(): string {
  try {
    const stored = localStorage.getItem(LS_KEY)
    if (stored) return stored.replace(/\/+$/, '')
  } catch { /* private mode */ }
  const env = (import.meta as { env?: { VITE_API_URL?: string } }).env
  return (env?.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')
}

export interface AuthInfo { userId: string; email: string; apiKey: string; apiSecret: string; fullName: string; orgId: string | null; entity: string | null }

export function getAuth(): AuthInfo | null {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY)
    return raw ? (JSON.parse(raw) as AuthInfo) : null
  } catch { return null }
}

function setAuth(a: AuthInfo | null) {
  try {
    if (a) sessionStorage.setItem(AUTH_KEY, JSON.stringify(a))
    else sessionStorage.removeItem(AUTH_KEY)
  } catch { /* private mode */ }
}

export class ApiError extends Error {
  status?: number
  constructor(message: string, status?: number) { super(message); this.name = 'ApiError'; this.status = status }
}

async function extractError(res: Response): Promise<string> {
  try {
    const j = await res.json()
    if (j?._server_messages) {
      try {
        const msgs = JSON.parse(j._server_messages) as string[]
        const first = JSON.parse(msgs[0])
        if (first?.message) return first.message.replace(/<[^>]+>/g, '')
      } catch { /* fall through */ }
    }
    if (j?.exception) return String(j.exception).split(': ').slice(1).join(': ') || j.exception
    if (j?.message) return typeof j.message === 'string' ? j.message : JSON.stringify(j.message)
  } catch { /* non-JSON error body */ }
  return `طلب فشل بحالة ${res.status}`
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const auth = getAuth()
  const headers: Record<string, string> = { Accept: 'application/json', ...(init.headers as Record<string, string> | undefined) }
  if (!(init.body instanceof FormData) && init.body != null) headers['Content-Type'] = 'application/json'
  if (auth) headers['Authorization'] = `token ${auth.apiKey}:${auth.apiSecret}`
  let res: Response
  try {
    res = await fetch(`${apiBaseUrl()}${path}`, { ...init, headers })
  } catch {
    throw new ApiError('تعذّر الاتصال بالخادم — تأكد من تشغيل المنصة الخلفية.')
  }
  if (!res.ok) throw new ApiError(await extractError(res), res.status)
  if (res.status === 202 || res.headers.get('Content-Length') === '0') return undefined as T
  return res.json() as Promise<T>
}

/* ───────── generic Frappe REST helpers ───────── */

export function getList<T = Record<string, unknown>>(doctype: string, params: { filters?: unknown; or_filters?: unknown; fields?: string[]; order_by?: string; limit_page_length?: number; limit_start?: number } = {}): Promise<T[]> {
  const q = new URLSearchParams()
  if (params.filters) q.set('filters', JSON.stringify(params.filters))
  if (params.or_filters) q.set('or_filters', JSON.stringify(params.or_filters))
  if (params.fields) q.set('fields', JSON.stringify(params.fields))
  if (params.order_by) q.set('order_by', params.order_by)
  q.set('limit_page_length', String(params.limit_page_length ?? 0))
  if (params.limit_start) q.set('limit_start', String(params.limit_start))
  return request<{ data: T[] }>(`/api/resource/${encodeURIComponent(doctype)}?${q}`).then(r => r.data)
}

export function getDoc<T = Record<string, unknown>>(doctype: string, name: string): Promise<T> {
  return request<{ data: T }>(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`).then(r => r.data)
}

export function insertDoc<T = Record<string, unknown>>(doctype: string, data: Record<string, unknown>): Promise<T> {
  return request<{ data: T }>(`/api/resource/${encodeURIComponent(doctype)}`, { method: 'POST', body: JSON.stringify(data) }).then(r => r.data)
}

export function updateDoc<T = Record<string, unknown>>(doctype: string, name: string, data: Record<string, unknown>): Promise<T> {
  return request<{ data: T }>(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`, { method: 'PUT', body: JSON.stringify(data) }).then(r => r.data)
}

/** Calls a `@frappe.whitelist()` *document* method — e.g. Test Request.send_to_laboratory().
 * `run_method` must travel in the JSON body, not the query string: Frappe's
 * `make_form_dict()` populates form_dict PURELY from the JSON body whenever one is
 * present, ignoring query params entirely — a query-string-only `run_method` is
 * silently dropped as soon as any POST body is also sent. */
export function callDocMethod<T = unknown>(doctype: string, name: string, method: string, args: Record<string, unknown> = {}): Promise<T> {
  return request<{ message: T; data?: T }>(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`, {
    method: 'POST',
    body: JSON.stringify({ run_method: method, ...args }),
  }).then(r => (r.message !== undefined ? r.message : (r.data as T)))
}

/** Calls a `@frappe.whitelist()` *module-level* function — e.g. miyar_core.api.directory.get_directory. */
export function callMethod<T = unknown>(dottedPath: string, args: Record<string, unknown> = {}, httpMethod: 'GET' | 'POST' = 'POST'): Promise<T> {
  if (httpMethod === 'GET') {
    const q = new URLSearchParams(args as Record<string, string>)
    return request<{ message: T }>(`/api/method/${dottedPath}?${q}`).then(r => r.message)
  }
  return request<{ message: T }>(`/api/method/${dottedPath}`, { method: 'POST', body: JSON.stringify(args) }).then(r => r.message)
}

/* ───────── demo auth (fixed roster — see README "الدخول التجريبي") ───────── */

export interface DemoTokenEntry { email: string; full_name: string; api_key: string; api_secret: string; org_id: string | null; entity: string | null }

let demoTokensCache: Record<string, DemoTokenEntry> | null = null

export async function loadDemoTokens(): Promise<Record<string, DemoTokenEntry>> {
  if (demoTokensCache) return demoTokensCache
  const res = await fetch('/demo-tokens.json')
  if (!res.ok) throw new ApiError('لم يتم إنشاء حسابات العرض التجريبي بعد — شغّل miyar.setup.seed_demo.run على الخادم.')
  demoTokensCache = await res.json()
  return demoTokensCache!
}

/** Resolves a demo `userId` (e.g. "u-lab") to a live backend session (token auth). */
export async function loginAsDemoUser(userId: string): Promise<AuthInfo> {
  const tokens = await loadDemoTokens()
  const entry = tokens[userId]
  if (!entry) throw new ApiError(`لا يوجد حساب خلفي مطابق لهذا المستخدم التجريبي (${userId}).`)
  const auth: AuthInfo = { userId, email: entry.email, apiKey: entry.api_key, apiSecret: entry.api_secret, fullName: entry.full_name, orgId: entry.org_id, entity: entry.entity }
  setAuth(auth)
  // Verify the token actually works against the live backend before committing to it.
  await request<string>('/api/method/frappe.auth.get_logged_user')
  return auth
}

export function logoutDemoUser() { setAuth(null) }
