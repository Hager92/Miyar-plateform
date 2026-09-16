import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useStore } from '@/lib/store'
import AppShell, { Toasts } from '@/layout/AppShell'
import Login from '@/features/auth/Login'
import Register from '@/features/auth/Register'
import Dashboard from '@/features/dashboard/Dashboard'
import RequestsList from '@/features/requests/RequestsList'
import NewRequest from '@/features/requests/NewRequest'
import RequestDetail from '@/features/requests/RequestDetail'
import ExecuteTest from '@/features/requests/ExecuteTest'
import ReviewResult from '@/features/requests/ReviewResult'
import Approvals from '@/features/requests/Approvals'
import Retest from '@/features/requests/Retest'
import Delegations from '@/features/delegation/Delegations'
import Catalog from '@/features/catalog/Catalog'
import Directory, { OrgProfile, ProfileManage } from '@/features/directory/Directory'
import StudyPrelim from '@/features/geotech/StudyPrelim'
import Study from '@/features/geotech/Study'
import Borehole, { BoreholeLog } from '@/features/geotech/Borehole'
import { Rules, Reference, Knowledge, Templates, Accounts, RatingsModeration, Contracts, Results } from '@/features/admin/Admin'
import { GovernancePage, ArchivePage, InvoicesPage, ReportsPage } from '@/features/governance/Governance'
import { SamplesPage, EquipmentPage } from '@/features/evidence/Evidence'
import EnginePage from '@/features/engine/Engine'
import QuotesPage from '@/features/contracts/Quotes'
import { PageHeader } from '@/ds/composite'
import { Section, KV, Callout, Toggle, Kpi, Button, Badge, Field, Select, Modal, Input, Textarea } from '@/ds/primitives'
import { ROLE_LABEL, POSITION_LABEL, can, type Permission } from '@/lib/roles'
import type { Role } from '@/lib/types'
import { uid } from '@/lib/format'
import { useState, useEffect } from 'react'
import { Bell, Globe, ShieldCheck, LifeBuoy, BookOpen, MessageSquare, Phone } from 'lucide-react'

function RequireAuth() { const user = useStore(s => s.user); const loc = useLocation(); return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: loc }} /> }

/** Route-level enforcement of the permission matrix (appendix 7.1). Every protected route declares the permission it needs; optional `roles` narrows further (e.g. per-org pages). */
function Can({ p, roles, children }: { p?: Permission; roles?: Role[]; children: React.ReactNode }) {
  const user = useStore(s => s.user)!
  const ok = (!p || can(user.role, user.position, p)) && (!roles || roles.includes(user.role))
  const loc = useLocation()
  useEffect(() => { if (!ok) useStore.getState().toast({ title: 'لا تملك صلاحية الوصول', body: `الصفحة ${loc.pathname} خارج صلاحيات ${ROLE_LABEL[user.role]} (${POSITION_LABEL[user.position]}) — سُجّلت المحاولة في سجل التدقيق.`, tone: 'danger' }) }, [ok, loc.pathname, user.role, user.position])
  // ECC-2 / B.R.158 — a refused access is an audit event, not a silent redirect
  useEffect(() => { if (!ok) useStore.setState(s => ({ audit: [{ id: uid('A'), at: new Date().toISOString(), actor: user.name, role: user.role, org: user.orgName, action: 'محاولة وصول مرفوضة', entity: 'auth', entityId: loc.pathname, ip: '10.20.4.17', severity: 'critical' as const, detail: 'خارج مصفوفة الصلاحيات' }, ...s.audit] })) }, [ok, loc.pathname, user.name, user.role, user.orgName])
  return ok ? <>{children}</> : <Navigate to="/" replace />
}

function Settings() {
  const user = useStore(s => s.user)!
  const rules = useStore(s => s.rules)
  const [n, setN] = useState({ sms: true, email: true, push: false, digest: true })
  return (
    <>
      <PageHeader title="الإعدادات" sub="إعدادات الحساب والإشعارات والجلسة" />
      <div className="grid grid-cols-12 gap-3">
        <Section title="الحساب" icon={ShieldCheck} className="col-span-12 lg:col-span-4" bodyClass="p-3"><KV cols={1} dense items={[{ k: 'الاسم', v: user.name }, { k: 'الدور', v: ROLE_LABEL[user.role] }, { k: 'الصفة', v: POSITION_LABEL[user.position] }, { k: 'المنشأة', v: user.orgName }, { k: 'الجوال', v: <span className="ltr">{user.mobile}</span> }, { k: 'صلاحية التفويض', v: user.canDelegate ? 'أصلية' : '—' }, { k: 'آخر دخول', v: 'اليوم 13:30 — الرياض · 10.20.4.17' }]} /><Button variant="secondary" size="sm" className="mt-3">تغيير رقم الجوال (OTP)</Button></Section>
        <Section title="الإشعارات" icon={Bell} className="col-span-12 lg:col-span-4" bodyClass="p-3"><div className="grid gap-3"><Toggle checked={n.sms} onChange={v => setN({ ...n, sms: v })} label="رسائل SMS للإجراءات الحرجة (المهل، الاعتماد)" /><Toggle checked={n.email} onChange={v => setN({ ...n, email: v })} label="بريد إلكتروني لكل إجراء رئيسي" /><Toggle checked={n.push} onChange={v => setN({ ...n, push: v })} label="إشعارات المتصفح الفورية" /><Toggle checked={n.digest} onChange={v => setN({ ...n, digest: v })} label="ملخص يومي الساعة 8 صباحاً" /></div><Callout tone="info" compact className="mt-3">الإشعارات تُرسل تلقائياً عند كل إجراء رئيسي في دورة حياة الطلب وفق نوع الخدمة وصلاحياتك (B.R.157).</Callout></Section>
        <Section title="القواعد السارية (للاطلاع)" icon={Globe} className="col-span-12 lg:col-span-4" bodyClass="p-3"><KV cols={2} dense items={[{ k: 'اختبارات لكل طلب', v: rules.maxTestsPerRequest }, { k: 'مهلة المختبر', v: `${rules.labDecisionHours} ساعة` }, { k: 'مهلة الاستشاري', v: `${rules.consultantDecisionHours} ساعة` }, { k: 'أول موعد', v: `≥ ${rules.minLeadHours} ساعة` }, { k: 'الضريبة', v: `${rules.vat}%` }, { k: 'النطاق الجغرافي', v: `${rules.geofenceMeters} م` }]} /><p className="meta mt-3">تُدار من مدير النظام وتُطبَّق على العمليات الجديدة فقط.</p></Section>
        <Section title="الجلسات والأجهزة النشطة" icon={ShieldCheck} className="col-span-12 lg:col-span-5" bodyClass="p-0" actions={<Button size="xs" variant="secondary" onClick={() => useStore.getState().toast({ title: 'تم إنهاء الجلسات الأخرى', body: 'ستُطلب إعادة الدخول عبر OTP على الأجهزة الأخرى.', tone: 'ok' })}>إنهاء الجلسات الأخرى</Button>}>
          <table className="w-full text-[12px]"><thead><tr className="bg-ink-50 text-[10.5px] text-ink-500"><th className="px-3 py-1.5 text-start font-semibold">الجهاز</th><th className="px-2 py-1.5 text-start font-semibold">الموقع / IP</th><th className="px-2 py-1.5 text-start font-semibold">آخر نشاط</th><th className="px-3 py-1.5 text-start font-semibold"></th></tr></thead>
            <tbody>{[['Chrome · Windows 11', 'الرياض · 10.20.4.17', 'الآن', true], ['تطبيق معيار · iPhone 15', 'الرياض · 10.20.7.88', 'منذ 3 ساعات', false], ['Edge · Windows 10', 'جدة · 172.16.9.44', 'منذ يومين', false]].map(([d, l, t, cur]: any) => <tr key={d} className="border-t border-ink-100"><td className="px-3 py-2 font-medium">{d} {cur && <Badge tone="ok" size="xs">الحالية</Badge>}</td><td className="ltr px-2 py-2 text-start text-ink-600">{l}</td><td className="px-2 py-2 text-ink-600">{t}</td><td className="px-3 py-2 text-end">{!cur && <button type="button" className="text-[11.5px] font-semibold text-danger-600 hover:underline" onClick={() => useStore.getState().toast({ title: 'أُنهيت الجلسة', body: d, tone: 'ok' })}>إنهاء</button>}</td></tr>)}</tbody></table>
        </Section>
        <Section title="الأمان" icon={ShieldCheck} className="col-span-12 lg:col-span-4" bodyClass="p-3">
          <KV cols={2} dense items={[{ k: 'طريقة الدخول', v: 'OTP على الجوال' }, { k: 'نفاذ الوطني', v: <Badge tone="ok" size="xs">مربوط</Badge> }, { k: 'آخر تغيير للجوال', v: '12 مايو 2026' }, { k: 'محاولات مرفوضة (30 يوماً)', v: <span className="num">0</span> }, { k: 'انتهاء الجلسة', v: 'بعد 30 دقيقة خمول' }, { k: 'الامتثال', v: 'NCA ECC-2:2024' }]} />
          <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => useStore.getState().toast({ title: 'أُرسل رمز التحقق', body: 'أدخل الرمز المرسل إلى جوالك المسجل لتأكيد الجهاز.', tone: 'info' })}>تأكيد هذا الجهاز</Button><Button size="sm" variant="ghost" onClick={() => useStore.getState().toast({ title: 'سجل الدخول', body: 'يُعرض آخر 90 يوماً في الحوكمة وسجل التدقيق.', tone: 'info' })}>سجل الدخول</Button></div>
        </Section>
        <Section title="التفضيلات" icon={Globe} className="col-span-12 lg:col-span-3" bodyClass="p-3">
          <div className="grid gap-3"><Field label="التقويم"><Select defaultValue="both"><option value="both">ميلادي مع الهجري</option><option value="g">ميلادي فقط</option><option value="h">هجري فقط</option></Select></Field><Field label="كثافة العرض"><Select defaultValue="comfortable"><option value="comfortable">عادية</option><option value="compact">مضغوطة</option></Select></Field><Field label="الصفحة الرئيسية"><Select defaultValue="dash"><option value="dash">لوحة المعلومات</option><option value="req">طلبات الاختبارات</option></Select></Field><Toggle checked label="اللغة: العربية (الوحيدة المتاحة)" onChange={() => {}} /></div>
        </Section>
      </div>
    </>
  )
}

const GUIDES = [['إنشاء طلب اختبار وتحديد المواعيد المقترحة', 'المقاول', '4 دقائق'], ['قبول الطلب وتسجيل استلام العينة بالتحقق الجغرافي', 'المختبر', '3 دقائق'], ['تنفيذ الجسة وتسجيل الطبقات وعينات SPT', 'المختبر', '7 دقائق'], ['اعتماد المخرجات والاعتماد التلقائي بعد انتهاء المهلة', 'الاستشاري', '3 دقائق'], ['التفويض المباشر وغير المباشر', 'المختبر · الاستشاري', '2 دقيقة'], ['قراءة سجل الجسة (Borehole Log) وتقرير الدراسة', 'الجميع', '5 دقائق'], ['تصدير التقارير وجدولتها', 'الجهة الإشرافية', '2 دقيقة']]
const FAQ_FOR = (r: { labDecisionHours: number; consultantDecisionHours: number; minBoreholeDepth: number }) => [['لماذا أُنهي طلبي تلقائياً؟', `لم يرد المختبر خلال ${r.labDecisionHours} ساعة من الاستلام. أنشئ طلباً جديداً بمواعيد أخرى؛ التأخر يُسجَّل في مؤشرات المختبر.`], ['متى يبدأ عداد SLA للاختبار؟', 'بعد تأكيدك استلام العينة الذي سجّله المختبر في الموقع — لا قبل ذلك.'], ['هل يمكن تعديل الطلب بعد إرساله؟', 'لا. يمكن الإلغاء قبل قبول المختبر فقط، ثم إنشاء طلب جديد.'], ['ما الفرق بين التفويض المباشر وغير المباشر؟', 'المباشر يبدأ فوراً؛ غير المباشر يحتاج قبول الموظف ولا يُعدَّل بعد بدء الأعمال الميدانية إلا من المفوّض الرئيسي.'], ['كيف يُحسب عدد الجسات؟', `من SBC 303 Table 2.1 حسب المساحة المبنية وعدد الأدوار، مع حد أدنى ${r.minBoreholeDepth} م كسياسة منصة قابلة للتهيئة.`]]
const TICKETS = [['SUP-2026-0412', 'تعذر رفع تقرير PDF أكبر من 10MB', 'قيد المعالجة', 'warn', 'منذ 3 ساعات'], ['SUP-2026-0398', 'طلب إضافة اختبار مرجعي جديد (كثافة نووية)', 'بانتظار مدير النظام', 'info', 'منذ يومين'], ['SUP-2026-0371', 'تحديث رقم جوال المفوّض الرئيسي', 'مغلقة', 'ok', 'منذ 9 أيام']]
const INTEGRATIONS = [['واثق — السجل التجاري', 'يعمل', 'ok'], ['نفاذ الوطني الموحد', 'يعمل', 'ok'], ['ZATCA — الفوترة الإلكترونية', 'يعمل', 'ok'], ['بوابة SMS (OTP والإشعارات)', 'تأخر بسيط', 'warn'], ['خرائط المساحة الجيولوجية', 'صيانة مجدولة 20 سبتمبر', 'info']]
function Help() {
  const rules = useStore(s => s.rules)
  const FAQ = FAQ_FOR(rules)
  const [ticket, setTicket] = useState(false)
  const [faq, setFaq] = useState<number | null>(0)
  const [form, setForm] = useState({ subject: '', cat: 'فني', body: '' })
  return (
    <>
      <PageHeader title="المساعدة والدعم" sub="أدلة الاستخدام، الأسئلة الشائعة، والتواصل مع الدعم التقني" actions={<Button icon={MessageSquare} onClick={() => setTicket(true)}>فتح تذكرة</Button>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Kpi label="متوسط زمن الرد" value={38} unit="دقيقة" tone="ok" icon={LifeBuoy} /><Kpi label="تذاكري المفتوحة" value={TICKETS.filter(t => t[2] !== 'مغلقة').length} hint="آخر 30 يوماً" /><Kpi label="أدلة الاستخدام" value={GUIDES.length} icon={BookOpen} /><Kpi label="الدعم الهاتفي" value={<span className="ltr text-[20px]">920 000 000</span>} icon={Phone} hint="الأحد–الخميس 8–16" /></div>
      <div className="mt-3 grid grid-cols-12 gap-3">
        <div className="col-span-12 grid content-start gap-3 lg:col-span-5"><Section title="أدلة سريعة" icon={BookOpen} bodyClass="p-0"><ul className="divide-y divide-ink-100">{GUIDES.map(([t, who, dur]) => <li key={t} className="flex items-center gap-3 px-3 py-2 text-[12.5px]"><span className="min-w-0 flex-1"><span className="block truncate font-medium">{t}</span><span className="meta">{who} · {dur}</span></span><button type="button" className="shrink-0 text-[11.5px] font-semibold text-brand-700 hover:underline" onClick={() => useStore.getState().toast({ title: 'الدليل', body: t, tone: 'info' })}>فتح</button></li>)}</ul></Section><Section title="التواصل" icon={Phone} bodyClass="p-3"><KV cols={1} dense items={[{ k: 'الهاتف', v: <span className="ltr">920 000 000</span> }, { k: 'البريد', v: 'support@miyar.gov.sa' }, { k: 'الطوارئ الميدانية', v: <span className="ltr">0550 001 112</span> }]} /></Section></div>
        <div className="col-span-12 grid content-start gap-3 lg:col-span-4"><Section title="الأسئلة الشائعة" bodyClass="p-0"><ul className="divide-y divide-ink-100">{FAQ.map(([q, a], i) => <li key={q}><button type="button" onClick={() => setFaq(faq === i ? null : i)} className="flex w-full items-center justify-between px-3 py-2 text-start text-[12.5px] font-medium hover:bg-ink-50">{q}<span className="text-ink-400">{faq === i ? '−' : '+'}</span></button>{faq === i && <p className="px-3 pb-2.5 text-[12px] leading-relaxed text-ink-600">{a}</p>}</li>)}</ul></Section><Section title="حالة التكاملات" bodyClass="p-0"><ul className="divide-y divide-ink-100">{INTEGRATIONS.map(([n, st, tone]) => <li key={n} className="flex items-center justify-between gap-2 px-3 py-1.5 text-[12px]"><span className="truncate">{n}</span><Badge tone={tone as any} dot size="xs">{st}</Badge></li>)}</ul></Section></div>
        <div className="col-span-12 grid content-start gap-3 lg:col-span-3"><Section title="تذاكري" icon={MessageSquare} bodyClass="p-0"><ul className="divide-y divide-ink-100">{TICKETS.map(([id, t, st, tone, when]) => <li key={id} className="px-3 py-2 text-[12px]"><div className="flex items-center justify-between"><span className="font-semibold text-brand-700">{id}</span><Badge tone={tone as any} size="xs">{st}</Badge></div><div className="truncate text-ink-700">{t}</div><div className="meta">{when}</div></li>)}</ul></Section>
          <Section title="روابط مفيدة" bodyClass="p-3"><ul className="grid gap-1.5 text-[12px]">{[['كود البناء السعودي SBC 303', 'sbc.gov.sa'], ['المركز السعودي للاعتماد SAAC', 'saac.gov.sa'], ['كود المنصات — هيئة الحكومة الرقمية', 'dga.gov.sa'], ['الضوابط الأساسية للأمن السيبراني', 'nca.gov.sa']].map(([t, u]) => <li key={u} className="flex items-center justify-between gap-2"><span className="truncate">{t}</span><span className="ltr meta shrink-0">{u}</span></li>)}</ul></Section>
        </div>
      </div>
      <Modal open={ticket} onClose={() => setTicket(false)} title="تذكرة دعم جديدة" sub="يرد فريق الدعم التقني خلال ساعة عمل" width="sm" footer={<><Button variant="secondary" onClick={() => setTicket(false)}>إلغاء</Button><Button disabled={form.subject.trim().length < 5 || form.body.trim().length < 10} onClick={() => { setTicket(false); useStore.getState().toast({ title: 'أُنشئت التذكرة SUP-2026-0413', body: 'يصلك رد على جوالك وبريدك خلال ساعة عمل.', tone: 'ok' }); setForm({ subject: '', cat: 'فني', body: '' }) }}>إرسال</Button></>}>
        <div className="grid gap-3"><Field label="الموضوع" required><Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></Field><Field label="التصنيف"><Select value={form.cat} onChange={e => setForm({ ...form, cat: e.target.value })}><option>فني</option><option>حساب وصلاحيات</option><option>اعتماد منشأة</option><option>مالي</option><option>اقتراح</option></Select></Field><Field label="الوصف" required hint="أرفق رقم الطلب أو الجسة إن وجد"><Textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} className="min-h-24" /></Field></div>
      </Modal>
    </>
  )
}

const asParam = new URLSearchParams(window.location.search).get('as')
if (asParam) { void useStore.getState().login(asParam); window.history.replaceState({}, '', window.location.pathname) }

export default function App() {
  const user = useStore(s => s.user)
  // Real Entities + the public Lab catalogue (B.R.122) load once, for visitors and members alike —
  // independent of login, since the directory must work for anonymous visitors too.
  useEffect(() => { void useStore.getState().bootstrapPublic() }, [])
  // `login()` fetches this user's real requests/delegations/contracts, but that only runs once,
  // at the moment of logging in. A user who was already logged in (restored from sessionStorage)
  // and simply reloads the page never re-triggers it otherwise, so their real data goes stale —
  // this re-syncs it on every mount where a session already exists.
  useEffect(() => { if (user) void useStore.getState().refreshBackendData() }, [user?.id])
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <><Login /><Toasts /></>} />
        <Route path="/register" element={<><Register /><Toasts /></>} />
        {!user && <Route path="/directory" element={<Directory />} />}
        {!user && <Route path="/directory/:id" element={<OrgProfile />} />}
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="requests" element={<Can p="request.view"><RequestsList /></Can>} />
            <Route path="requests/new" element={<Can p="request.create"><NewRequest /></Can>} />
            <Route path="requests/new/:id" element={<Can p="request.create"><NewRequest /></Can>} />
            <Route path="requests/:id/edit" element={<Can p="request.create"><NewRequest /></Can>} />
            <Route path="requests/:id" element={<Can p="request.view"><RequestDetail /></Can>} />
            <Route path="requests/:id/tests/:testId/execute" element={<Can p="test.execute"><ExecuteTest /></Can>} />
            <Route path="requests/:id/tests/:testId/review" element={<Can p="output.review"><ReviewResult /></Can>} />
            <Route path="requests/:id/tests/:testId/retest" element={<Can p="request.retest"><Retest /></Can>} />
            <Route path="samples" element={<Can p="request.view"><SamplesPage /></Can>} />
            <Route path="quotes" element={<Can p="directory.view"><QuotesPage /></Can>} />
            <Route path="equipment" element={<Can p="request.view"><EquipmentPage /></Can>} />
            <Route path="requests/:id/study/prelim" element={<Can p="study.prelim"><StudyPrelim /></Can>} />
            <Route path="requests/:id/study" element={<Can p="study.view"><Study /></Can>} />
            <Route path="requests/:id/study/:phase" element={<Can p="study.view"><Study /></Can>} />
            <Route path="requests/:id/study/borehole/:bhId" element={<Can p="study.view"><Borehole /></Can>} />
            <Route path="requests/:id/study/borehole/:bhId/log" element={<Can p="study.view"><BoreholeLog /></Can>} />
            <Route path="engine" element={<Can p="engine.run"><EnginePage /></Can>} />
            <Route path="approvals" element={<Can p="output.review"><Approvals /></Can>} />
            <Route path="results" element={<Can p="results.view"><Results /></Can>} />
            <Route path="contracts" element={<Contracts />} />
            <Route path="invoices" element={<InvoicesPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="archive" element={<ArchivePage />} />
            <Route path="governance" element={<GovernancePage />} />
            <Route path="governance/policies" element={<GovernancePage initial="policies" />} />
            <Route path="catalog" element={<Can p="catalog.view" roles={['lab', 'admin']}><Catalog /></Can>} />
            <Route path="directory" element={<Directory />} />
            <Route path="directory/:id" element={<OrgProfile />} />
            <Route path="profile" element={<Can p="profile.manage"><ProfileManage /></Can>} />
            <Route path="delegations" element={<Can p="delegation.view"><Delegations /></Can>} />
            <Route path="settings" element={<Settings />} />
            <Route path="help" element={<Help />} />
            <Route path="admin/rules" element={<Can p="admin.settings"><Rules /></Can>} />
            <Route path="admin/reference" element={<Can p="admin.reference"><Reference /></Can>} />
            <Route path="admin/knowledge" element={<Can p="admin.knowledge"><Knowledge /></Can>} />
            <Route path="admin/templates" element={<Can p="admin.settings"><Templates /></Can>} />
            <Route path="admin/accounts" element={<Can p="admin.accounts"><Accounts /></Can>} />
            <Route path="admin/ratings" element={<Can p="rating.moderate"><RatingsModeration /></Can>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
