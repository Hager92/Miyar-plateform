import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShieldCheck, Smartphone, ArrowRight, Fingerprint, Building2 } from 'lucide-react'
import { useStore, useSel } from '@/lib/store'
import { Button, Field, Input, Avatar, cx } from '@/ds/primitives'
import { MiyarLogo, MomrahLogo, IdoLogo } from '@/ds/Logo'
import { ROLE_LABEL, POSITION_LABEL } from '@/lib/roles'

const ROLE_ORDER = ['contractor', 'lab', 'consultant', 'supervisor', 'admin', 'support'] as const

export default function Login() {
  const users = useStore(s => s.users)
  const login = useStore(s => s.login)
  // Live figures from the same data the dashboards use — no marketing numbers that the demo can contradict
  const stats = useSel(s => { const done = s.requests.flatMap(r => r.tests).filter(t => t.status === 'STS20').length; const decided = s.requests.flatMap(r => r.tests).filter(t => t.decidedAt); const onTime = decided.length ? Math.round((decided.filter(t => !t.autoApproved).length / decided.length) * 100) : 0; return { done, onTime, studies: s.requests.filter(r => r.service === 'geotech').length, labs: s.orgs.filter(o => o.type === 'lab' && o.active).length } })
  const nav = useNavigate()
  const [step, setStep] = useState<'mobile' | 'otp'>('mobile')
  const [mobile, setMobile] = useState('0551234567')
  const [otp, setOtp] = useState('')
  const [err, setErr] = useState('')
  const quick = ROLE_ORDER.flatMap(r => users.filter(u => u.role === r).slice(0, r === 'lab' ? 3 : r === 'contractor' || r === 'consultant' ? 2 : 1))

  const submitMobile = (e: React.FormEvent) => { e.preventDefault(); if (!/^05\d{8}$/.test(mobile)) return setErr('أدخل رقم جوال سعودي صحيح يبدأ بـ 05'); setErr(''); setStep('otp') }
  const submitOtp = (e: React.FormEvent) => { e.preventDefault(); const u = users.find(x => x.mobile === mobile); if (otp.length !== 4) return setErr('رمز التحقق مكوّن من 4 أرقام'); if (!u) return setErr('رقم الجوال غير مسجّل في المنصة'); login(u.id).then(() => nav('/')) }

  return (
    <div className="grid h-screen overflow-hidden bg-canvas lg:grid-cols-[1.05fr_1fr]">
      {/* ── Brand panel ── */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-brand-900 p-8 text-white lg:flex">
        {/* Riyadh skyline (Kingdom Centre / KAFD) — CC BY-SA 4.0, Wikimedia Commons; see README for attribution — under a brand-green gradient */}
        <img src="/brand/momrah-hero.jpg" alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover object-top" />
        <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(11,51,45,0.45) 0%, rgba(16,72,64,0.25) 30%, rgba(16,72,64,0.78) 58%, rgba(16,72,64,0.96) 78%, #0B332D 100%)' }} />
        <div className="relative flex items-center justify-between">
          <MiyarLogo size="lg" onDark />
          <div className="rounded-md bg-white/95 px-3 py-2 shadow-md"><MomrahLogo height={38} /></div>
        </div>
        <div className="relative max-w-lg">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11.5px] font-medium backdrop-blur-sm"><ShieldCheck className="size-3.5 text-lime-300" />متوافق مع كود البناء السعودي SBC 303 · كود المنصات</div>
          <h2 className="text-[30px] font-bold leading-[1.35] text-white">من العقد إلى شهادة الإتمام — رحلة موحّدة لاختبارات التربة والطرق</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-white/75">المقاول والمختبر والمكتب الاستشاري والجهة الإشرافية في بيئة رقمية واحدة.</p>
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[[stats.done.toLocaleString('en-US'), 'مخرج اختبار معتمد'], [`${stats.onTime}%`, 'اعتماد ضمن المهلة'], [String(stats.studies), 'دراسة جيوتقنية']].map(([v, l]) => <div key={l} className="rounded-md border border-white/15 bg-white/10 px-3 py-2.5 backdrop-blur-sm"><div className="num text-[22px] font-bold leading-none">{v}</div><div className="mt-1 text-[11px] text-white/75">{l}</div></div>)}
          </div>
        </div>
        <div className="relative flex items-center justify-between text-[11px] text-white/60">
          <span>الإدارة العامة لكود البناء السعودي · وزارة البلديات والإسكان</span>
          <span className="flex items-center gap-1.5">نُفّذ بواسطة <IdoLogo height={16} className="brightness-0 invert opacity-80" /></span>
        </div>
      </section>

      {/* ── Form panel ── */}
      <section className="flex h-screen flex-col overflow-hidden px-6 py-5 lg:px-12">
        <div className="flex items-center justify-between lg:hidden"><MiyarLogo size="sm" /><MomrahLogo height={30} /></div>
        <div className="my-auto grid w-full max-w-md gap-5 self-center">
          <div>
            <h1 className="text-[22px] font-bold">تسجيل الدخول</h1>
            <p className="meta mt-0.5">{step === 'mobile' ? 'أدخل رقم الجوال المسجّل لمنشأتك — يصلك رمز تحقق OTP' : `أُرسل رمز التحقق إلى ${mobile}`}</p>
          </div>
          {step === 'mobile' ? (
            <form onSubmit={submitMobile} className="grid gap-3">
              <Field label="رقم الجوال" required error={err}><Input prefixIcon={Smartphone} value={mobile} onChange={e => setMobile(e.target.value)} placeholder="05xxxxxxxx" inputMode="tel" className="ltr h-10 text-start text-[14px]" autoFocus /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Button type="submit" size="lg">إرسال رمز التحقق</Button>
                <Button type="button" size="lg" variant="secondary" icon={Fingerprint} onClick={() => { login('u-cont').then(() => nav('/')) }}>الدخول عبر نفاذ</Button>
              </div>
              <p className="text-center text-[12px] text-ink-500">ليس لديك حساب؟ <Link to="/register" className="font-semibold text-brand-700 hover:underline">سجّل منشأتك</Link> · <Link to="/directory" className="font-semibold text-brand-700 hover:underline">تصفّح الدليل كزائر</Link></p>
            </form>
          ) : (
            <form onSubmit={submitOtp} className="grid gap-3">
              <Field label="رمز التحقق (OTP)" required error={err} hint="للعرض التجريبي: أي رمز من 4 أرقام"><Input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="••••" inputMode="numeric" className="ltr h-11 text-center text-2xl tracking-[0.5em]" autoFocus /></Field>
              <Button type="submit" size="lg">تأكيد الدخول</Button>
              <button type="button" onClick={() => setStep('mobile')} className="flex items-center justify-center gap-1 text-[12px] text-ink-500 hover:text-ink-800"><ArrowRight className="size-3" />تغيير رقم الجوال</button>
            </form>
          )}
          <div>
            <div className="mb-2 flex items-center justify-between"><span className="data-label">دخول سريع — بيئة العرض</span><span className="meta">10 حسابات · 6 أدوار</span></div>
            <div className="grid grid-cols-2 gap-1.5">
              {quick.map(u => (
                <button key={u.id} onClick={() => { login(u.id).then(() => nav('/')) }} data-role={u.role} className={cx('flex items-center gap-2 rounded-sm border border-ink-200 bg-ink-0 px-2 py-1.5 text-start transition-colors hover:border-accent hover:bg-accent-soft/40')}>
                  <Avatar name={u.name} size="xs" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-semibold text-ink-900">{u.name}</span><span className="block truncate text-[10.5px] text-ink-500">{ROLE_LABEL[u.role]} · {POSITION_LABEL[u.position]}</span></span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between text-[11px] text-ink-500">
          <span className="flex items-center gap-1"><Building2 className="size-3.5" />الإدارة العامة لكود البناء السعودي</span>
          <span className="flex items-center gap-1.5 lg:hidden">نُفّذ بواسطة <IdoLogo height={14} /></span>
          <span className="hidden lg:inline">سياسة الخصوصية · شروط الاستخدام · الدعم 920000000</span>
        </div>
      </section>
    </div>
  )
}
