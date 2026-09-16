import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, CheckCircle2, Search, ShieldCheck } from 'lucide-react'
import { Button, Field, Input, Callout, Card, Checkbox, cx, KV } from '@/ds/primitives'
import { Step } from '@/ds/composite'
import { MiyarLogo, MomrahLogo, IdoLogo } from '@/ds/Logo'
import { useSel } from '@/lib/store'

const TYPES = [{ v: 'contractor', l: 'مقاول' }, { v: 'lab', l: 'مختبر' }, { v: 'consultant', l: 'مكتب استشاري' }]

export default function Register() {
  const nav = useNavigate()
  const counts = useSel(s => ({ lab: s.orgs.filter(o => o.type === 'lab' && o.active).length, contractor: s.orgs.filter(o => o.type === 'contractor' && o.active).length, consultant: s.orgs.filter(o => o.type === 'consultant' && o.active).length }))
  const [cr, setCr] = useState('')
  const [looked, setLooked] = useState<null | { name: string; city: string; activity: string; status: string; issued: string }>(null)
  const [type, setType] = useState('lab')
  const [rep, setRep] = useState({ name: '', id: '', mobile: '', email: '', saac: '' })
  const [agree, setAgree] = useState(false)
  const [otp, setOtp] = useState('')
  const [done, setDone] = useState(false)
  const lookup = () => { if (!/^\d{10}$/.test(cr)) return; setLooked({ name: 'مختبر النخبة للفحص الهندسي', city: 'الرياض', activity: 'اختبارات المواد والتربة — 71201', status: 'قائم', issued: '12/03/1442' }) }
  const step2ok = looked && rep.name && /^\d{10}$/.test(rep.id) && /^05\d{8}$/.test(rep.mobile) && rep.email.includes('@') && agree
  return (
    <div className="grid h-screen overflow-hidden bg-canvas lg:grid-cols-[380px_1fr]">
      <aside className="hidden flex-col justify-between bg-brand-800 p-7 text-white lg:flex">
        <div><MiyarLogo size="md" onDark /><div className="mt-6 rounded-md bg-white px-3 py-2 w-fit"><MomrahLogo height={34} /></div></div>
        <div>
          <h2 className="text-[22px] font-bold leading-snug">تسجيل منشأة في المنصة</h2>
          <p className="mt-2 text-[12.5px] leading-relaxed text-white/75">السجل التجاري هو المعرّف الفريد للمنشأة. يتحقق فريق الدعم التقني من الاعتماد يدوياً في المرحلة الحالية حتى توفر الربط الحكومي، ويُفعَّل الحساب خلال يومي عمل.</p>
          <ul className="mt-4 grid gap-1.5 text-[12.5px]">{['التحقق من السجل التجاري عبر واثق', 'المفوّض الرئيسي يمثّل المنشأة قانونياً', 'اعتماد SAAC (ISO/IEC 17025) يظهر شارة في الدليل'].map(t => <li key={t} className="flex items-center gap-2"><ShieldCheck className="size-3.5 shrink-0 text-lime-300" />{t}</li>)}</ul>
          <div className="mt-5 rounded-md bg-white/10 p-3">
            <div className="text-[10.5px] font-bold tracking-wider text-white/60">ماذا بعد الإرسال؟</div>
            <ol className="mt-2 grid gap-2 text-[12px]">{[['خلال دقائق', 'رسالة استلام على الجوال برقم الطلب'], ['خلال يومي عمل', 'مراجعة الدعم التقني للسجل والاعتماد'], ['بعد التفعيل', 'إضافة الموظفين، ضبط القائمة، وإنشاء العقود']].map(([t, d], i) => <li key={t} className="flex items-start gap-2"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-lime-500 text-[10.5px] font-bold text-brand-900">{i + 1}</span><span><span className="block font-semibold">{t}</span><span className="block text-white/70">{d}</span></span></li>)}</ol>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">{[[String(counts.lab), 'مختبراً معتمداً'], [String(counts.contractor), 'مقاولاً'], [String(counts.consultant), 'مكتباً استشارياً']].map(([v, l]) => <div key={l} className="rounded-sm bg-white/10 px-2 py-2 text-center"><div className="num text-[17px] font-bold">{v}</div><div className="text-[10.5px] text-white/70">{l}</div></div>)}</div>
        </div>
        <div className="flex items-center justify-between text-[11px] text-white/60"><span>الإدارة العامة لكود البناء السعودي</span><span className="flex items-center gap-1.5">نُفّذ بواسطة <IdoLogo height={14} className="brightness-0 invert opacity-80" /></span></div>
      </aside>
      <section className="overflow-y-auto p-5 lg:p-8">
        {done ? <Card className="mx-auto mt-10 max-w-md text-center"><CheckCircle2 className="mx-auto size-12 text-ok-500" /><h1 className="mt-2 text-xl font-bold">استُلم طلب التسجيل</h1><p className="mt-2 text-[13px] text-ink-600">سيراجع فريق الدعم التقني بيانات المنشأة ويتحقق من اعتمادها خلال يومي عمل. يصلك إشعار على {rep.mobile} عند التفعيل.</p><KV cols={2} dense items={[{ k: 'رقم الطلب', v: 'REG-2026-4472' }, { k: 'المنشأة', v: looked?.name }]} /><Button className="mt-4" onClick={() => nav('/login')}>العودة لتسجيل الدخول</Button></Card> : (
          <div className="mx-auto max-w-2xl">
            <div className="mb-4 flex items-center justify-between lg:hidden"><MiyarLogo size="sm" /><MomrahLogo height={28} /></div>
            <h1 className="text-[20px] font-bold">تسجيل منشأة جديدة</h1><p className="meta mb-4">3 خطوات — التحقق من السجل، بيانات المفوّض الرئيسي، تأكيد الجوال</p>
            <div className="grid gap-3">
              <Step n={1} title="التحقق من السجل التجاري" state={looked ? 'done' : 'active'}><div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><Field label="رقم السجل التجاري" required hint="يُستعلم عنه تلقائياً من منصة واثق"><Input value={cr} onChange={e => setCr(e.target.value.replace(/\D/g, '').slice(0, 10))} className="ltr text-start" placeholder="10 أرقام" /></Field><Button variant="secondary" icon={Search} onClick={lookup} disabled={!/^\d{10}$/.test(cr)}>استعلام</Button></div>{looked && <div className="mt-3 rounded-sm border border-ok-100 bg-ok-25 p-3"><div className="flex items-center gap-2 text-[13px] font-semibold text-ok-700"><Building2 className="size-4" />{looked.name}</div><KV cols={4} dense items={[{ k: 'المدينة', v: looked.city }, { k: 'النشاط', v: looked.activity }, { k: 'الحالة', v: looked.status }, { k: 'تاريخ الإصدار', v: looked.issued }]} /></div>}</Step>
              <Step n={2} title="نوع المنشأة وبيانات المفوّض الرئيسي" state={!looked ? 'locked' : step2ok ? 'done' : 'active'}><div className="grid gap-3"><div className="grid grid-cols-3 gap-2">{TYPES.map(t => <button key={t.v} type="button" onClick={() => setType(t.v)} className={cx('rounded-sm border px-3 py-2 text-[13px] font-semibold', type === t.v ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-ink-300 bg-ink-0 text-ink-700')}>{t.l}</button>)}</div><Callout tone="info" compact>بإنشاء الحساب يُقرّ المفوّض الرئيسي بأنه يمثّل المنشأة قانونياً ويلتزم بشروط المنصة ويتحمّل مسؤولية حسابات الموظفين (A.S.05، A.S.09).</Callout><div className="grid gap-3 sm:grid-cols-2"><Field label="اسم المفوّض الرئيسي" required><Input value={rep.name} onChange={e => setRep({ ...rep, name: e.target.value })} /></Field><Field label="رقم الهوية الوطنية" required><Input value={rep.id} onChange={e => setRep({ ...rep, id: e.target.value.replace(/\D/g, '').slice(0, 10) })} className="ltr text-start" /></Field><Field label="رقم الجوال" required hint="لرموز التحقق OTP"><Input value={rep.mobile} onChange={e => setRep({ ...rep, mobile: e.target.value })} className="ltr text-start" placeholder="05xxxxxxxx" /></Field><Field label="البريد الإلكتروني" required><Input value={rep.email} onChange={e => setRep({ ...rep, email: e.target.value })} className="ltr text-start" type="email" /></Field>{type === 'lab' && <Field label="رقم اعتماد المركز السعودي للاعتماد" hint="اختياري — ISO/IEC 17025 — يُتحقق منه ويظهر كشارة" className="sm:col-span-2"><Input value={rep.saac} onChange={e => setRep({ ...rep, saac: e.target.value })} className="ltr text-start" placeholder="SAC-L-YYYY-NNN" /></Field>}</div><Checkbox checked={agree} onChange={setAgree} label={<>أوافق على <a className="font-semibold text-brand-700 underline" href="#">شروط وأحكام المنصة</a> وسياسة الخصوصية</>} /></div></Step>
              <Step n={3} title="تأكيد رقم الجوال" state={!step2ok ? 'locked' : 'active'}><div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><Field label="رمز التحقق" hint="للعرض التجريبي أي 4 أرقام"><Input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))} className="ltr text-center tracking-[0.5em]" disabled={!step2ok} /></Field><Button onClick={() => setDone(true)} disabled={!step2ok || otp.length !== 4}>إرسال طلب التسجيل</Button></div></Step>
            </div>
            {!looked && <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Card pad={false} className="p-3"><div className="section-title mb-2 text-[12.5px]">ما تحتاجه قبل البدء</div><ul className="grid gap-1.5 text-[12px] text-ink-700">{[['رقم السجل التجاري (10 أرقام)', 'يُستعلم عنه من واثق'], ['هوية المفوّض الرئيسي وجواله', 'يُرسل عليه رمز OTP'], ['شهادة اعتماد SAAC للمختبرات', 'اختياري — يظهر كشارة'], ['بريد إلكتروني رسمي للمنشأة', 'للإشعارات والفواتير']].map(([t, d]) => <li key={t} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-ok-500" /><span><span className="font-medium">{t}</span><span className="meta block">{d}</span></span></li>)}</ul></Card>
              <Card pad={false} className="p-3"><div className="section-title mb-2 text-[12.5px]">أسئلة شائعة</div><ul className="grid gap-2 text-[12px]">{[['هل يمكن لأكثر من شخص إدارة الحساب؟', 'نعم — المفوّض الرئيسي يضيف موظفين ويحدد صلاحياتهم بعد التفعيل.'], ['ماذا لو كان السجل مسجلاً مسبقاً؟', 'يظهر تنبيه ويُحال الطلب لفريق الدعم للتحقق من ملكية الحساب.'], ['كم يستغرق التفعيل؟', 'يومي عمل كحد أقصى بعد اكتمال البيانات.']].map(([q, a]) => <li key={q}><div className="font-semibold text-ink-900">{q}</div><div className="text-ink-600">{a}</div></li>)}</ul></Card>
            </div>}
            <p className="mt-4 text-center text-[12px] text-ink-500">لديك حساب؟ <Link to="/login" className="font-semibold text-brand-700 hover:underline">تسجيل الدخول</Link></p>
          </div>
        )}
      </section>
    </div>
  )
}
