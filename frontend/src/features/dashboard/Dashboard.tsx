import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FlaskConical, Clock, CheckCircle2, AlertTriangle, Users, Activity, Wallet, Timer, ShieldAlert, CalendarDays, ArrowLeft, Sparkles, Building2, Star } from 'lucide-react'
import { useStore, useSel, visibleRequests } from '@/lib/store'
import { PageHeader, Countdown } from '@/ds/composite'
import { Kpi, Section, Badge, ButtonLink, Segmented, Avatar, Progress, KV, cx } from '@/ds/primitives'
import { TimeArea, Donut, TimeLine, RankBars, Bars, Heat, STATUS_FILL, SERIES } from '@/ds/charts'
import { SERIES_MONTHLY, CATEGORY_MIX, CITY_MIX, CITY_CATEGORY, MONTHS } from '@/lib/mock'
import { fmtDate, ago } from '@/lib/format'
import { ROLE_LABEL } from '@/lib/roles'

/** Thin switch so each dashboard keeps an unconditional hook order (rules-of-hooks). */
export default function Dashboard() {
  const role = useStore(s => s.user!.role)
  return role === 'support' ? <SupportDashboard /> : <MainDashboard />
}

function MainDashboard() {
  const user = useStore(s => s.user)!
  const reqs = useSel(visibleRequests)
  const orgs = useStore(s => s.orgs)
  const refTests = useStore(s => s.refTests)
  const delegations = useStore(s => s.delegations)
  const invoices = useStore(s => s.invoices)
  const audit = useStore(s => s.audit)
  const ratings = useStore(s => s.ratings)
  const rules = useStore(s => s.rules)
  const contracts = useStore(s => s.contracts)
  const [period, setPeriod] = useState<'m3' | 'm6' | 'm12'>('m12')
  const months = SERIES_MONTHLY.slice(period === 'm3' ? -3 : period === 'm6' ? -6 : 0)

  const org = (id: string) => orgs.find(o => o.id === id)?.name ?? id
  const name = (id: string) => refTests.find(t => t.id === id)?.nameAr ?? id
  const byStatus = (s: string) => reqs.filter(r => r.status === s).length
  const tests = reqs.flatMap(r => r.tests.map(t => ({ r, t })))
  const pendingLab = reqs.filter(r => r.status === 'STS11')
  const pendingCons = tests.filter(x => x.t.status === 'STS19')
  const pendingPlan = reqs.filter(r => r.status === 'STS10')
  const running = tests.filter(x => x.t.status === 'STS18')
  const late = running.filter(x => x.t.deadlineAt && new Date(x.t.deadlineAt).getTime() < Date.now() + 24 * 36e5)
  const autoApproved = tests.filter(x => x.t.autoApproved).length
  const myDelegations = delegations.filter(d => d.toUserId === user.id && d.status === 'STS22')
  const revenue = invoices.filter(i => i.status !== 'draft').reduce((a, i) => a + i.amount, 0)
  const overdue = invoices.filter(i => i.status === 'overdue')
  const decided = tests.filter(x => x.t.status === 'STS20' || x.t.status === 'STS21'); const rejRate = decided.length ? Math.round((tests.filter(x => x.t.status === 'STS21').length / decided.length) * 100) : 0
  const urgent = useMemo(() => [
    ...pendingLab.map(r => ({ id: r.id, kind: user.role === 'lab' ? 'قرار مطلوب' : 'بانتظار المختبر', tone: 'warn' as const, until: r.labDeadlineAt, sub: `${r.project} · ${org(user.role === 'lab' ? r.contractorId : r.labId)}`, to: `/requests/${r.id}` })),
    ...pendingCons.map(({ r, t }) => ({ id: r.id, kind: user.role === 'consultant' ? 'اعتماد مطلوب' : 'بانتظار الاستشاري', tone: 'warn' as const, until: t.deadlineAt, sub: `${name(t.refTestId)} · ${org(r.labId)}`, to: user.role === 'consultant' ? `/requests/${r.id}/tests/${t.id}/review` : `/requests/${r.id}` })),
    ...pendingPlan.map(r => ({ id: r.id, kind: 'خطة استكشاف', tone: 'info' as const, until: undefined, sub: `${r.project} — بانتظار اعتماد الاستشاري`, to: `/requests/${r.id}/study` })),
    ...late.map(({ r, t }) => ({ id: r.id, kind: 'SLA على وشك الانتهاء', tone: 'danger' as const, until: t.deadlineAt, sub: `${name(t.refTestId)} · ${org(r.labId)}`, to: `/requests/${r.id}` })),
    ...reqs.filter(r => r.status === 'STS09').map(r => ({ id: r.id, kind: 'مسودة لم تُرسل', tone: 'neutral' as const, until: undefined, sub: r.project, to: `/requests/${r.id}` })),
    ...myDelegations.map(d => ({ id: d.id, kind: 'تفويض بانتظار قبولك', tone: 'info' as const, until: undefined, sub: `${d.requestId} — ${d.type === 'direct' ? 'تفويض مباشر' : 'تفويض غير مباشر'}`, to: '/delegations' })),
    ...(user.role === 'contractor' || user.role === 'lab' ? overdue.filter(i => i.contractorId === user.orgId || i.labId === user.orgId).map(i => ({ id: i.id, kind: 'فاتورة متأخرة', tone: 'danger' as const, until: undefined, sub: `${(i.amount + i.vat).toLocaleString('en')} ر.س · ${i.requestId}`, to: '/invoices' })) : []),
    ...(user.role === 'contractor' ? contracts.filter(c => !c.active && c.contractorId === user.orgId && !ratings.some(r => r.contractId === c.id)).map(c => ({ id: c.id, kind: 'تقييم مختبر مطلوب', tone: 'info' as const, until: undefined, sub: `${c.project} — ${org(c.labId)}`, to: '/results' })) : []),
  ].sort((a, b) => (a.until ?? '9').localeCompare(b.until ?? '9')).slice(0, 7), [reqs, user.id, user.role, user.orgId, delegations, invoices, contracts, ratings, orgs, refTests]) // eslint-disable-line react-hooks/exhaustive-deps
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = [
    ...reqs.filter(r => r.chosenSlot && r.chosenSlot.date >= today).map(r => ({ id: r.id, date: r.chosenSlot!.date, title: r.project, sub: `${r.id} · أخذ عينة ${r.chosenSlot!.from}–${r.chosenSlot!.to} · ${r.location.split('—')[1]?.trim() ?? r.city ?? ''}`, tone: 'accent' as const, to: `/requests/${r.id}` })),
    ...running.filter(({ t }) => t.deadlineAt && t.deadlineAt.slice(0, 10) >= today).map(({ r, t }) => ({ id: `${r.id}-${t.id}`, date: t.deadlineAt!.slice(0, 10), title: name(t.refTestId), sub: `${r.id} · موعد تسليم النتيجة · ${org(r.labId)}`, tone: 'warn' as const, to: `/requests/${r.id}` })),
    ...pendingLab.filter(r => r.labDeadlineAt).map(r => ({ id: `${r.id}-d`, date: r.labDeadlineAt!.slice(0, 10), title: r.project, sub: `${r.id} · انتهاء مهلة قرار المختبر`, tone: 'danger' as const, to: `/requests/${r.id}` })),
    ...pendingCons.filter(({ t }) => t.deadlineAt).map(({ r, t }) => ({ id: `${r.id}-${t.id}-c`, date: t.deadlineAt!.slice(0, 10), title: name(t.refTestId), sub: `${r.id} · اعتماد تلقائي عند انتهاء المهلة`, tone: 'warn' as const, to: `/requests/${r.id}` })),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 7)
  const visibleIds = new Set(reqs.map(r => r.id))
  const feed = (user.role === 'admin' || user.role === 'supervisor' ? audit : audit.filter(a => a.org === user.orgName || visibleIds.has(a.entityId))).slice(0, 8)
  const labs = orgs.filter(o => o.type === 'lab' && o.active).map(o => ({ name: o.name.replace('مختبر ', ''), value: o.onTime ?? 0, color: (o.onTime ?? 0) >= 90 ? STATUS_FILL.ok : (o.onTime ?? 0) >= 85 ? STATUS_FILL.warn : STATUS_FILL.danger })).sort((a, b) => b.value - a.value)
  const donut = [{ name: 'جارٍ التنفيذ', value: byStatus('STS14'), color: STATUS_FILL.accent }, { name: 'مقبول', value: byStatus('STS12'), color: '#7FB6A4' }, { name: 'بانتظار قرار', value: byStatus('STS11') + byStatus('STS10'), color: STATUS_FILL.warn }, { name: 'مكتمل', value: byStatus('STS15'), color: STATUS_FILL.ok }, { name: 'ملغي/مرفوض', value: byStatus('STS16') + byStatus('STS13'), color: STATUS_FILL.neutral }].filter(d => d.value)
  const cats = ['تربة', 'إسفلت', 'خرسانة', 'ركام']; const cities = ['الرياض', 'جدة', 'الدمام', 'مكة المكرمة', 'القصيم']
  const heat = (c: string, k: string) => CITY_CATEGORY[c]?.[k] ?? 0
  const CAT_AR: Record<string, string> = { soil: 'التربة', asphalt: 'الإسفلت', concrete: 'الخرسانة', aggregate: 'الركام' }
  const catMix = user.role === 'supervisor' || user.role === 'admin' ? CATEGORY_MIX : [...Object.entries(tests.reduce<Record<string, number>>((a, x) => { const k = x.t.refTestId === 'rt-geotech' ? 'جيوتقنية' : CAT_AR[refTests.find(t => t.id === x.t.refTestId)?.category ?? 'soil']; a[k] = (a[k] ?? 0) + 1; return a }, {})).map(([name, value]) => ({ name, value }))]
  const heatMax = Math.max(1, ...cities.flatMap(c => cats.map(k => heat(c, k))))
  const greeting = { contractor: 'متابعة الطلبات على العقود الفعّالة والمهل والمخرجات', lab: 'الطلبات الواردة، المهل، وأداء الفرق الميدانية', consultant: 'النتائج والخطط التي تنتظر اعتمادك ومؤشرات الجودة', supervisor: 'مراقبة سير الأعمال والامتثال لكود البناء في الوقت الفعلي', admin: 'صحة المنصة، التشغيل، والحوكمة', support: 'طلبات التسجيل والدعم والتقييمات', visitor: '' }[user.role]

  return (
    <>
      <PageHeader title={`مرحباً، ${user.name.split(' ')[0]}`} sub={`${greeting} — ${fmtDate(new Date().toISOString())}`}
        actions={<><Segmented value={period} onChange={setPeriod} items={[{ value: 'm3', label: '3 أشهر' }, { value: 'm6', label: '6 أشهر' }, { value: 'm12', label: '12 شهراً' }]} />{user.role === 'contractor' && <ButtonLink to="/requests/new" icon={FlaskConical}>طلب اختبار جديد</ButtonLink>}{user.role === 'lab' && pendingLab.length > 0 && <ButtonLink to="/requests" icon={Clock}>{pendingLab.length} طلبات تحتاج قرارك</ButtonLink>}{user.role === 'consultant' && pendingCons.length > 0 && <ButtonLink to="/approvals" icon={CheckCircle2}>{pendingCons.length} نتائج للاعتماد</ButtonLink>}</>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="إجمالي الطلبات" value={reqs.length} hint="على العقود الفعّالة" icon={FlaskConical} spark={months.map(m => m.requests)} trend={8} to="/requests" />
        {user.role === 'lab' ? <Kpi label="تحتاج قرارك" value={pendingLab.length} unit="طلب" hint={`خلال ${rules.labDecisionHours} ساعة من الاستلام`} tone={pendingLab.length ? 'warn' : 'ok'} icon={Clock} to="/requests" />
          : user.role === 'consultant' ? <Kpi label="تنتظر اعتمادك" value={pendingCons.length} unit="مخرج" hint="تُعتمد تلقائياً بعد المهلة" tone={pendingCons.length ? 'warn' : 'ok'} icon={Clock} to="/approvals" />
          : <Kpi label="بانتظار قرار" value={pendingLab.length + pendingPlan.length} unit="طلب" hint="مختبر / خطة استكشاف" tone="warn" icon={Clock} to="/requests" />}
        <Kpi label="جارٍ التنفيذ" value={byStatus('STS14')} unit="طلب" hint={`${running.length} اختباراً قيد التنفيذ`} tone="accent" icon={Activity} spark={months.map(m => m.requests - m.completed)} />
        <Kpi label="الالتزام بالمهل (SLA)" value={`${months.at(-1)!.sla}%`} hint="المستهدف ≥ 90%" tone={months.at(-1)!.sla >= 90 ? 'ok' : 'warn'} icon={Timer} spark={months.map(m => m.sla)} trend={2} />
        <Kpi label="معدل الرفض" value={`${rejRate}%`} hint={`${autoApproved} اعتماد تلقائي`} tone={rejRate > 10 ? 'danger' : 'ok'} icon={ShieldAlert} spark={months.map(m => m.rejected)} trend={-1} trendInvert />
        <Kpi label={user.role === 'lab' ? 'الإيراد المفوتر' : user.role === 'supervisor' || user.role === 'admin' ? 'قيمة الاختبارات على المنصة' : 'قيمة الاختبارات'} value={(revenue / 1000).toFixed(0)} unit="ألف ر.س" hint={overdue.length ? `${overdue.length} فواتير متأخرة` : 'لا فواتير متأخرة'} tone={overdue.length ? 'warn' : 'neutral'} icon={Wallet} spark={months.map(m => m.revenue)} trend={12} to="/invoices" />
      </div>

      {user.role === 'admin' && <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Section title="صحة المنصة" desc="آخر 30 يوماً" bodyClass="p-3"><div className="flex items-end justify-between"><div><div className="num text-[24px] font-bold leading-none text-ok-600">99.96%</div><div className="meta mt-1">التوافر · مستهدف 99.9%</div></div><div className="text-end text-[11.5px] text-ink-600"><div>زمن الاستجابة <b className="num">412 ms</b></div><div>أخطاء 5xx <b className="num">0.02%</b></div></div></div><Progress value={99.96} tone="ok" /></Section>
        <Section title="التكاملات الحكومية" bodyClass="p-3"><ul className="grid gap-1 text-[11.5px]">{[['واثق', 'ok', 'يعمل'], ['نفاذ', 'ok', 'يعمل'], ['ZATCA', 'ok', 'يعمل'], ['SMS', 'warn', 'تأخر 90 ث']].map(([n, t, st]) => <li key={n} className="flex items-center justify-between"><span>{n}</span><Badge tone={t as any} dot size="xs">{st}</Badge></li>)}</ul></Section>
        <Section title="المهام المجدولة" bodyClass="p-3"><ul className="grid gap-1 text-[11.5px]">{[['إنهاء الطلبات منتهية المهلة (12 س)', 'كل 15 د', 'ok'], ['الاعتماد التلقائي (48 س)', 'كل 15 د', 'ok'], ['الملخص اليومي 8 ص', 'يومي', 'ok'], ['نسخ الأرشيف الاحتياطي', 'يومي 02:00', 'ok']].map(([n, f, t]) => <li key={n} className="flex items-center justify-between gap-2"><span className="truncate">{n}</span><span className="meta shrink-0">{f}</span><span className={cx('size-2 shrink-0 rounded-full', t === 'ok' ? 'bg-ok-500' : 'bg-warn-500')} /></li>)}</ul></Section>
        <Section title="الأمن والامتثال" bodyClass="p-3"><KV cols={2} dense items={[{ k: 'أحداث حرجة (7 أيام)', v: <span className="num text-danger-600">{audit.filter(a => a.severity === 'critical' && Date.now() - new Date(a.at).getTime() < 7 * 864e5).length}</span> }, { k: 'وصول مرفوض', v: <span className="num">{audit.filter(a => a.entity === 'auth').length}</span> }, { k: 'ECC-2:2024', v: '90%' }, { k: 'جلسات نشطة', v: <span className="num">43</span> }]} /><Link to="/governance" className="meta mt-1 block text-brand-700 underline">سجل التدقيق الكامل</Link></Section>
      </div>}
      <div className="mt-3 grid grid-cols-12 gap-3">
        <Section title="حجم الطلبات والإنجاز" desc="شهرياً" className="col-span-12 xl:col-span-5" bodyClass="p-3">
          <TimeArea data={months} series={[{ key: 'requests', label: 'طلبات واردة' }, { key: 'completed', label: 'مكتملة' }, { key: 'geotech', label: 'دراسات جيوتقنية' }]} height={210} />
        </Section>
        <Section title="توزيع الطلبات حسب الحالة" className="col-span-12 md:col-span-6 xl:col-span-3" bodyClass="p-3">
          <Donut data={donut} height={140} center={reqs.length} centerLabel="طلب" stack />
        </Section>
        <Section title={user.role === 'supervisor' ? 'بنود قيد المتابعة' : 'يحتاج إجراءً الآن'} icon={AlertTriangle} desc={`${urgent.length} بند`} className="col-span-12 md:col-span-6 xl:col-span-4" noPad bodyClass="flex flex-col" actions={<Link to="/requests" className="text-[11.5px] font-semibold text-brand-700 hover:underline">كل الطلبات</Link>}>
          <ul className="divide-y divide-ink-100">{urgent.map((u, i) => (
            <li key={u.id + i}><Link to={u.to} className="flex items-center gap-2.5 px-3 py-2 hover:bg-ink-50">
              <span className={cx('size-2 shrink-0 rounded-full', { warn: 'bg-warn-500', danger: 'bg-danger-500', info: 'bg-info-500', neutral: 'bg-ink-400' }[u.tone])} />
              <span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-[12.5px]"><span className="font-semibold text-brand-700">{u.id}</span><Badge tone={u.tone} size="xs">{u.kind}</Badge></span><span className="block truncate text-[11.5px] text-ink-500">{u.sub}</span></span>
              {u.until ? <Countdown until={u.until} label="" /> : <ArrowLeft className="size-3.5 text-ink-400" />}
            </Link></li>))}</ul>
          <div className="mt-auto grid grid-cols-3 divide-x divide-x-reverse divide-ink-100 border-t border-ink-100 bg-ink-25 text-center">
            {[['حرج', urgent.filter(u => u.tone === 'danger').length, 'text-danger-600'], [user.role === 'supervisor' ? 'بانتظار طرف' : 'يحتاج قراراً', urgent.filter(u => u.tone === 'warn').length, 'text-warn-600'], ['معلومات', urgent.filter(u => u.tone === 'info' || u.tone === 'neutral').length, 'text-ink-700']].map(([l, v, c]: any) => <div key={l} className="py-1.5"><div className={cx('num text-[15px] font-bold leading-tight', c)}>{v}</div><div className="text-[10.5px] text-ink-500">{l}</div></div>)}
          </div>
        </Section>
      </div>

      <div className="mt-3 grid grid-cols-12 gap-3">
        <Section title="الالتزام بالمهل والاعتماد التلقائي" desc="% شهرياً" className="col-span-12 md:col-span-6 xl:col-span-4" bodyClass="p-3">
          <TimeLine data={months} series={[{ key: 'sla', label: 'الالتزام بالمهل %' }]} height={170} unit="%" refY={90} refLabel="المستهدف 90%" />
          <div className="mt-1 flex items-center justify-between text-[11.5px] text-ink-600"><span>اعتمادات تلقائية (48 س): <b className="num">{months.reduce((a, m) => a + m.auto, 0)}</b></span><span>رفض المخرجات: <b className="num">{months.reduce((a, m) => a + m.rejected, 0)}</b></span></div>
        </Section>
        <Section title="التزام المختبرات بالمواعيد" desc="% تسليم في الوقت" className="col-span-12 md:col-span-6 xl:col-span-4" bodyClass="p-3">
          <RankBars data={labs} height={200} benchmark={90} unit="%" labelWidth={130} />
        </Section>
        <Section title="الاختبارات حسب التصنيف" desc={user.role === 'supervisor' || user.role === 'admin' ? 'على مستوى المنصة — آخر 12 شهراً' : 'طلباتك'} className="col-span-12 xl:col-span-4" bodyClass="p-3">
          <Bars data={catMix.map(c => ({ m: c.name, value: c.value }))} series={[{ key: 'value', label: 'اختبارات' }]} height={170} />
          <div className="mt-1 grid grid-cols-5 gap-1 text-center">{catMix.map(c => <div key={c.name}><div className="num text-[13px] font-bold text-ink-900">{c.value}</div><div className="text-[10.5px] text-ink-500">{c.name}</div></div>)}</div>
        </Section>
      </div>

      <div className="mt-3 grid grid-cols-12 gap-3">
        <Section title="المواعيد القادمة" icon={CalendarDays} className="col-span-12 md:col-span-6 xl:col-span-3" noPad>
          <ul className="divide-y divide-ink-100">{upcoming.map(r => <li key={r.id}><Link to={r.to} className="flex items-center gap-2.5 px-3 py-2 hover:bg-ink-50"><span className={cx('grid size-9 shrink-0 place-items-center rounded-sm text-center leading-none', { accent: 'bg-brand-50 text-brand-800', warn: 'bg-warn-50 text-warn-700', danger: 'bg-danger-50 text-danger-700' }[r.tone])}><span className="num text-[13px] font-bold">{r.date.slice(-2)}</span><span className="text-[9px] opacity-80">{fmtDate(r.date).split(' ')[1]}</span></span><span className="min-w-0"><span className="block truncate text-[12.5px] font-semibold">{r.title}</span><span className="block truncate text-[11px] text-ink-500">{r.sub}</span></span></Link></li>)}</ul>
        </Section>
        <Section title="آخر النشاط" icon={Activity} className="col-span-12 md:col-span-6 xl:col-span-4" noPad actions={<Link to="/governance" className="text-[11.5px] font-semibold text-brand-700 hover:underline">سجل التدقيق</Link>}>
          <ul className="divide-y divide-ink-100">{feed.map(e => <li key={e.id} className="flex items-start gap-2.5 px-3 py-2"><Avatar name={e.actor} size="xs" /><span className="min-w-0 flex-1"><span className="block text-[12.5px]"><b>{e.actor}</b> <span className="text-ink-600">{e.action}</span> <span className="font-mono text-[11px] text-brand-700">{e.entityId}</span></span><span className="meta">{ROLE_LABEL[e.role]} · {ago(e.at)}</span></span>{e.severity === 'critical' && <Badge tone="danger" size="xs">حرج</Badge>}{e.severity === 'warning' && <Badge tone="warn" size="xs">تنبيه</Badge>}</li>)}</ul>
        </Section>
        <div className="col-span-12 grid gap-3 xl:col-span-5">
          {(user.role === 'supervisor' || user.role === 'admin') ? (
            <Section title="كثافة الطلبات — المدينة × التصنيف" desc="آخر 12 شهراً" bodyClass="p-3"><Heat rows={cities} cols={cats} get={heat} max={heatMax} /></Section>
          ) : user.role === 'lab' ? (
            <Section title="التفويضات والفريق الميداني" icon={Users} bodyClass="p-3">
              <div className="grid grid-cols-3 gap-2 text-center">{[['فعّالة', delegations.filter(d => d.status === 'STS23').length, 'ok'], ['بانتظار القبول', myDelegations.length, 'warn'], ['ملغاة/مرفوضة', delegations.filter(d => d.status === 'STS24' || d.status === 'STS25').length, 'neutral']].map(([l, v, t]: any) => <div key={l} className="rounded-sm bg-ink-50 py-2"><div className={cx('num text-lg font-bold', t === 'ok' ? 'text-ok-600' : t === 'warn' ? 'text-warn-600' : 'text-ink-700')}>{v}</div><div className="text-[11px] text-ink-500">{l}</div></div>)}</div>
              <ul className="mt-3 grid gap-2">{['فيصل القحطاني', 'نواف الشمري', 'عبدالرحمن الزهراني'].map((n, i) => <li key={n} className="flex items-center gap-2 text-[12px]"><Avatar name={n} size="xs" /><span className="w-32 truncate font-medium">{n}</span><div className="flex-1"><Progress value={[78, 45, 60][i]} tone={i === 0 ? 'warn' : 'accent'} label={`${[5, 3, 4][i]} مهام`} /></div></li>)}</ul>
            </Section>
          ) : (
            <Section title="أفضل المختبرات في الدليل" icon={Star} bodyClass="p-3">
              <ul className="grid gap-2">{orgs.filter(o => o.type === 'lab' && o.active).sort((a, b) => b.rating - a.rating).slice(0, 4).map(o => <li key={o.id} className="flex items-center gap-2 text-[12.5px]"><Building2 className="size-4 text-brand-600" /><Link to={`/directory/${o.id}`} className="w-44 truncate font-semibold hover:underline">{o.name}</Link><span className="num text-warn-600">★ {o.rating.toFixed(1)}</span><span className="meta">({o.reviews})</span><span className="ms-auto num text-[11.5px] text-ink-600">التزام {o.onTime}%</span></li>)}</ul>
            </Section>
          )}
          <Section title="توزيع الطلبات جغرافياً" bodyClass="p-3">
            <ul className="grid gap-1.5">{CITY_MIX.map((c, i) => <li key={c.name} className="flex items-center gap-2 text-[12px]"><span className="w-24 truncate text-ink-700">{c.name}</span><div className="flex-1"><Progress value={(c.value / CITY_MIX[0].value) * 100} tone={i === 0 ? 'accent' : 'neutral'} /></div><span className="num w-10 text-end font-semibold">{c.value}</span></li>)}</ul>
          </Section>
        </div>
      </div>

      {user.role === 'contractor' && (() => { const c = contracts.find(c => !c.active && c.contractorId === user.orgId && !ratings.some(r => r.contractId === c.id)); return c ? <div className="mt-3 flex items-center gap-2 rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-[12.5px] text-brand-800"><Sparkles className="size-4" />عقد <b>{c.id}</b> ({c.project}) منتهٍ ولم تقيّم <b>{org(c.labId)}</b> بعد — التقييم مطلوب قبل تحميل شهادة الإتمام. <Link to={`/directory/${c.labId}`} className="font-semibold underline">تقييم المختبر الآن</Link></div> : null })()}
    </>
  )
}

/* ───────── Support (الدعم التقني) — registrations, tickets, ratings, accounts ───────── */
const REG_MONTHLY = MONTHS.map((m, i) => ({ m, labs: [2, 3, 2, 4, 3, 5, 4, 6, 5, 6, 7, 4][i], contractors: [6, 8, 7, 9, 11, 12, 10, 14, 13, 15, 16, 9][i], consultants: [1, 2, 1, 2, 2, 3, 2, 3, 3, 4, 3, 2][i] }))
const TICKETS = [
  { id: 'SUP-2026-0412', t: 'تعذر رفع تقرير PDF أكبر من 10MB', org: 'مختبر التربة والمواد', cat: 'فني', st: 'قيد المعالجة', tone: 'warn' as const, age: 'منذ 3 ساعات', sla: 'متبقٍ 57 دقيقة' },
  { id: 'SUP-2026-0411', t: 'طلب نقل صلاحيات المفوّض الرئيسي', org: 'مختبر الخليج للفحص', cat: 'حساب', st: 'بانتظار مستند', tone: 'info' as const, age: 'منذ 5 ساعات', sla: 'موقوف' },
  { id: 'SUP-2026-0409', t: 'رمز OTP لا يصل — شريحة جديدة', org: 'شركة مشاريع البنية', cat: 'حساب', st: 'جديدة', tone: 'danger' as const, age: 'منذ 40 دقيقة', sla: 'متبقٍ 20 دقيقة' },
  { id: 'SUP-2026-0406', t: 'استفسار عن رسوم الدراسة الجيوتقنية', org: 'مؤسسة البناء الحديث', cat: 'مالي', st: 'قيد المعالجة', tone: 'warn' as const, age: 'منذ يوم', sla: 'متأخرة 3 س' },
  { id: 'SUP-2026-0398', t: 'إضافة اختبار مرجعي جديد (كثافة نووية)', org: 'مختبر نجد للطرق', cat: 'منتج', st: 'بانتظار مدير النظام', tone: 'info' as const, age: 'منذ يومين', sla: 'محوّلة' },
]
function SupportDashboard() {
  const user = useStore(s => s.user)!
  const orgs = useStore(s => s.orgs)
  const users = useStore(s => s.users)
  const ratings = useStore(s => s.ratings)
  const audit = useStore(s => s.audit)
  const [period, setPeriod] = useState<'m3' | 'm6' | 'm12'>('m12')
  const months = REG_MONTHLY.slice(period === 'm3' ? -3 : period === 'm6' ? -6 : 0)
  const avg = (r: { quality: number; punctuality: number; communication: number }) => (r.quality + r.punctuality + r.communication) / 3
  const lowRatings = ratings.filter(r => avg(r) <= 2 && r.status === 'STS06')
  const expiring = orgs.filter(o => o.saac && (new Date(o.saac.expires).getTime() - Date.now()) / 864e5 < 120)
  const pendingRegs = [['REG-2026-4471', 'مختبر النخبة للفحص الهندسي', 'مختبر', 'الرياض', 'منذ 4 ساعات'], ['REG-2026-4468', 'مؤسسة البناء الحديث — فرع الخبر', 'مقاول', 'الخبر', 'منذ يوم'], ['REG-2026-4460', 'مكتب الأفق للاستشارات الجيوتقنية', 'مكتب استشاري', 'جدة', 'منذ 3 أيام']]
  const urgent = [
    ...TICKETS.filter(t => t.tone === 'danger').map(t => ({ id: t.id, kind: 'تذكرة عاجلة', tone: 'danger' as const, sub: `${t.t} · ${t.org}`, to: '/help' })),
    ...pendingRegs.map(r => ({ id: r[0], kind: 'طلب تسجيل', tone: 'warn' as const, sub: `${r[1]} · ${r[2]}`, to: '/admin/accounts' })),
    ...lowRatings.slice(0, 2).map(r => ({ id: r.id, kind: 'تقييم منخفض', tone: 'warn' as const, sub: `${orgs.find(o => o.id === r.labId)?.name} · ${avg(r).toFixed(1)} من 5`, to: '/admin/ratings' })),
    ...expiring.map(o => ({ id: o.saac!.number, kind: 'اعتماد ينتهي', tone: 'info' as const, sub: `${o.name} · ${o.saac!.expires}`, to: '/admin/accounts' })),
  ].slice(0, 8)
  const byCat = ['فني', 'حساب', 'مالي', 'منتج'].map(c => ({ name: c, value: [31, 24, 9, 7][['فني', 'حساب', 'مالي', 'منتج'].indexOf(c)], color: [SERIES[0], SERIES[1], SERIES[2], SERIES[3]][['فني', 'حساب', 'مالي', 'منتج'].indexOf(c)] }))
  return (
    <>
      <PageHeader title={`مرحباً، ${user.name.split(' ')[0]}`} sub={`طلبات التسجيل، التذاكر، التقييمات، وصحة حسابات المنشآت — ${fmtDate(new Date().toISOString())}`}
        actions={<><Segmented value={period} onChange={setPeriod} items={[{ value: 'm3', label: '3 أشهر' }, { value: 'm6', label: '6 أشهر' }, { value: 'm12', label: '12 شهراً' }]} /><ButtonLink to="/admin/accounts" icon={Users}>{pendingRegs.length} طلبات تسجيل</ButtonLink></>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="طلبات تسجيل معلّقة" value={pendingRegs.length} hint="التحقق خلال يومي عمل" tone="warn" icon={Building2} to="/admin/accounts" />
        <Kpi label="تذاكر مفتوحة" value={TICKETS.length} hint={`${TICKETS.filter(t => t.tone === 'danger').length} عاجلة`} tone={TICKETS.some(t => t.tone === 'danger') ? 'danger' : 'neutral'} icon={AlertTriangle} spark={[9, 7, 8, 6, 7, 5, 5]} trend={-12} trendInvert to="/help" />
        <Kpi label="متوسط زمن الرد" value={38} unit="دقيقة" hint="المستهدف ≤ 60" tone="ok" icon={Timer} spark={[52, 49, 47, 44, 41, 40, 38]} trend={-8} trendInvert />
        <Kpi label="تقييمات تحتاج مراجعة" value={lowRatings.length} hint="≤ 2 من 5" tone={lowRatings.length ? 'warn' : 'ok'} icon={Star} to="/admin/ratings" />
        <Kpi label="منشآت فعّالة" value={orgs.filter(o => o.active && o.type !== 'ops' && o.type !== 'supervisor').length} hint={`${orgs.filter(o => !o.active).length} موقوفة · ${users.length} مستخدم`} icon={Users} to="/admin/accounts" />
        <Kpi label="اعتمادات تنتهي قريباً" value={expiring.length} hint="خلال 120 يوماً" tone={expiring.length ? 'warn' : 'ok'} icon={ShieldAlert} to="/admin/accounts" />
      </div>
      <div className="mt-3 grid grid-cols-12 gap-3">
        <Section title="التسجيلات الجديدة" desc="شهرياً حسب نوع المنشأة" className="col-span-12 xl:col-span-5" bodyClass="p-3">
          <Bars data={months} series={[{ key: 'contractors', label: 'مقاولون' }, { key: 'labs', label: 'مختبرات' }, { key: 'consultants', label: 'استشاريون' }]} height={280} stacked />
          <div className="mt-2 grid grid-cols-4 gap-1 text-center">{[['هذا الشهر', months.at(-1)!.contractors + months.at(-1)!.labs + months.at(-1)!.consultants], ['قيد التحقق', 3], ['مرفوضة (سجل غير قائم)', 2], ['متوسط زمن التفعيل', '1.4 يوم']].map(([l, v]) => <div key={l as string}><div className="num text-[14px] font-bold text-ink-900">{v}</div><div className="text-[10.5px] text-ink-500">{l}</div></div>)}</div>
        </Section>
        <Section title="التذاكر حسب التصنيف" desc="آخر 90 يوماً" className="col-span-12 md:col-span-6 xl:col-span-3" bodyClass="p-3">
          <Donut data={byCat} height={140} center={71} centerLabel="تذكرة" stack />
          <div className="mt-3 border-t border-ink-100 pt-2"><div className="data-label mb-1">الالتزام بمهلة الرد (ساعة عمل)</div><ul className="grid gap-1 text-[11.5px]">{[['فني', 96], ['حساب', 91], ['مالي', 88], ['منتج', 100]].map(([l, v]) => <li key={l} className="flex items-center gap-2"><span className="w-10 text-ink-700">{l}</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100"><div className={cx('h-full rounded-full', +v >= 90 ? 'bg-ok-500' : 'bg-warn-500')} style={{ width: `${v}%` }} /></div><span className="num w-8 text-end">{v}%</span></li>)}</ul></div>
        </Section>
        <Section title="يحتاج إجراءً الآن" icon={AlertTriangle} desc={`${urgent.length} بند`} className="col-span-12 md:col-span-6 xl:col-span-4" noPad bodyClass="flex flex-col">
          <ul className="divide-y divide-ink-100">{urgent.map((u, i) => <li key={u.id + i}><Link to={u.to} className="flex items-center gap-2.5 px-3 py-2 hover:bg-ink-50"><span className={cx('size-2 shrink-0 rounded-full', { warn: 'bg-warn-500', danger: 'bg-danger-500', info: 'bg-info-500' }[u.tone])} /><span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-[12.5px]"><span className="font-semibold text-brand-700">{u.id}</span><Badge tone={u.tone} size="xs">{u.kind}</Badge></span><span className="block truncate text-[11.5px] text-ink-500">{u.sub}</span></span><ArrowLeft className="size-3.5 text-ink-400" /></Link></li>)}</ul>
        </Section>
      </div>
      <div className="mt-3 grid grid-cols-12 gap-3">
        <Section title="التذاكر المفتوحة" icon={Activity} className="col-span-12 xl:col-span-7" noPad actions={<Link to="/help" className="text-[11.5px] font-semibold text-brand-700 hover:underline">كل التذاكر</Link>}>
          <table className="w-full text-[12px]"><thead><tr className="bg-ink-50 text-[10.5px] text-ink-500"><th className="px-3 py-1.5 text-start font-semibold">التذكرة</th><th className="px-2 py-1.5 text-start font-semibold">الموضوع</th><th className="px-2 py-1.5 text-start font-semibold">المنشأة</th><th className="px-2 py-1.5 text-start font-semibold">التصنيف</th><th className="px-2 py-1.5 text-start font-semibold">الحالة</th><th className="px-3 py-1.5 text-start font-semibold">SLA</th></tr></thead>
            <tbody>{TICKETS.map(t => <tr key={t.id} className="border-t border-ink-100 hover:bg-ink-50"><td className="whitespace-nowrap px-3 py-2 font-semibold text-brand-700">{t.id}<div className="meta font-normal">{t.age}</div></td><td className="px-2 py-2">{t.t}</td><td className="max-w-36 truncate px-2 py-2 text-ink-600">{t.org}</td><td className="px-2 py-2"><Badge tone="neutral" size="xs">{t.cat}</Badge></td><td className="px-2 py-2"><Badge tone={t.tone} dot size="xs">{t.st}</Badge></td><td className={cx('whitespace-nowrap px-3 py-2 text-[11.5px]', t.sla.includes('متأخرة') ? 'font-semibold text-danger-600' : 'text-ink-600')}>{t.sla}</td></tr>)}</tbody></table>
        </Section>
        <div className="col-span-12 grid gap-3 xl:col-span-5">
          <Section title="طلبات التسجيل المعلّقة" icon={Building2} noPad actions={<Link to="/admin/accounts" className="text-[11.5px] font-semibold text-brand-700 hover:underline">المراجعة</Link>}>
            <ul className="divide-y divide-ink-100">{pendingRegs.map(r => <li key={r[0]} className="flex items-center gap-2.5 px-3 py-2 text-[12px]"><Avatar name={r[1]} size="xs" /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{r[1]}</span><span className="meta">{r[0]} · {r[2]} · {r[3]} · {r[4]}</span></span><ButtonLink size="xs" variant="secondary" to="/admin/accounts">مراجعة</ButtonLink></li>)}</ul>
          </Section>
          <Section title="آخر إجراءات الدعم" icon={Activity} noPad>
            <ul className="divide-y divide-ink-100">{audit.filter(a => a.role === 'support' || a.entity === 'account' || a.entity === 'rating').slice(0, 5).map(e => <li key={e.id} className="flex items-start gap-2.5 px-3 py-2"><Avatar name={e.actor} size="xs" /><span className="min-w-0 flex-1"><span className="block text-[12.5px]"><b>{e.actor}</b> <span className="text-ink-600">{e.action}</span> <span className="font-mono text-[11px] text-brand-700">{e.entityId}</span></span><span className="meta">{ROLE_LABEL[e.role]} · {ago(e.at)}</span></span></li>)}</ul>
          </Section>
        </div>
      </div>
    </>
  )
}
