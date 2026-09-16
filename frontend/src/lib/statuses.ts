// جدول الحالات — BRD القسم 6 (STS01–STS24) + STS25 "ملغي" للتفويض (تعارض 10) + STS26 "منتهي المهلة" للطلب (تعارض 3)
export type Tone = 'neutral' | 'info' | 'accent' | 'ok' | 'warn' | 'danger'

export interface StatusDef { code: string; ar: string; en: string; tone: Tone; entity: string }

export const STATUSES: Record<string, StatusDef> = {
  // الاختبار في قائمة المختبر
  STS01: { code: 'STS01', ar: 'فعّال', en: 'Active', tone: 'ok', entity: 'catalog' },
  STS02: { code: 'STS02', ar: 'موقوف', en: 'Hold', tone: 'danger', entity: 'catalog' },
  STS03: { code: 'STS03', ar: 'بيانات ناقصة', en: 'Incomplete', tone: 'warn', entity: 'catalog' },
  // المنشأة في الدليل
  STS04: { code: 'STS04', ar: 'ظاهرة', en: 'Visible', tone: 'ok', entity: 'directory' },
  STS05: { code: 'STS05', ar: 'مخفية', en: 'Hidden', tone: 'neutral', entity: 'directory' },
  // التقييم
  STS06: { code: 'STS06', ar: 'معتمد', en: 'Approved', tone: 'ok', entity: 'rating' },
  STS07: { code: 'STS07', ar: 'مخفي', en: 'Hidden', tone: 'neutral', entity: 'rating' },
  STS08: { code: 'STS08', ar: 'محذوف', en: 'Deleted', tone: 'danger', entity: 'rating' },
  // طلب الاختبار
  STS09: { code: 'STS09', ar: 'مسودة', en: 'Draft', tone: 'neutral', entity: 'request' },
  STS10: { code: 'STS10', ar: 'إعداد خطة التنفيذ', en: 'Execution Planning', tone: 'info', entity: 'request' },
  STS11: { code: 'STS11', ar: 'بانتظار قرار المختبر', en: 'Pending Laboratory Decision', tone: 'warn', entity: 'request' },
  STS12: { code: 'STS12', ar: 'مقبول', en: 'Accepted', tone: 'ok', entity: 'request' },
  STS13: { code: 'STS13', ar: 'مرفوض', en: 'Rejected', tone: 'danger', entity: 'request' },
  STS14: { code: 'STS14', ar: 'جارٍ التنفيذ', en: 'In Progress', tone: 'accent', entity: 'request' },
  STS15: { code: 'STS15', ar: 'مكتمل', en: 'Completed', tone: 'ok', entity: 'request' },
  STS16: { code: 'STS16', ar: 'ملغي', en: 'Cancelled', tone: 'neutral', entity: 'request' },
  // إضافة المنصة (تعارض 3): انتهاء مهلة قرار المختبر دون رد — يُميَّز عن الإلغاء لأنه يُحتسب على المختبر لا المقاول
  STS26: { code: 'STS26', ar: 'منتهي المهلة', en: 'Expired', tone: 'danger', entity: 'request' },
  // الاختبار
  STS17: { code: 'STS17', ar: 'لم يتم البدء', en: 'Not Started', tone: 'neutral', entity: 'test' },
  STS18: { code: 'STS18', ar: 'جارٍ التنفيذ', en: 'In Progress', tone: 'accent', entity: 'test' },
  STS19: { code: 'STS19', ar: 'بانتظار قرار المكتب الاستشاري', en: 'Pending Consultant Decision', tone: 'warn', entity: 'test' },
  STS20: { code: 'STS20', ar: 'مقبول', en: 'Accepted', tone: 'ok', entity: 'test' },
  STS21: { code: 'STS21', ar: 'مرفوض', en: 'Rejected', tone: 'danger', entity: 'test' },
  // التفويض
  STS22: { code: 'STS22', ar: 'بانتظار القبول', en: 'Pending Acceptance', tone: 'warn', entity: 'delegation' },
  STS23: { code: 'STS23', ar: 'فعّال', en: 'Active', tone: 'ok', entity: 'delegation' },
  STS24: { code: 'STS24', ar: 'مرفوض', en: 'Rejected', tone: 'danger', entity: 'delegation' },
  STS25: { code: 'STS25', ar: 'ملغي', en: 'Cancelled', tone: 'neutral', entity: 'delegation' },
}

export const status = (code: string): StatusDef => STATUSES[code] ?? { code, ar: code, en: code, tone: 'neutral', entity: '' }

// مراحل الدراسة الجيوتقنية — تقدّم لا حالة (B.R.166)
export const STUDY_PHASES = [
  { n: 1, label: 'البيانات الأولية' },
  { n: 2, label: 'خطة الاستكشاف' },
  { n: 3, label: 'الأعمال الميدانية' },
  { n: 4, label: 'البيانات المعملية' },
  { n: 5, label: 'التحليل الهندسي' },
  { n: 6, label: 'التقرير النهائي' },
] as const

export const BOREHOLE_STATUS = {
  ready: { ar: 'جاهزة للتنفيذ', tone: 'neutral' as Tone },
  'in-progress': { ar: 'قيد التنفيذ', tone: 'accent' as Tone },
  done: { ar: 'مكتملة', tone: 'ok' as Tone },
}
