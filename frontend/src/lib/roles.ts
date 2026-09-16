import type { Role } from './types'

export const ROLE_LABEL: Record<Role, string> = {
  contractor: 'المقاول',
  lab: 'المختبر',
  consultant: 'المكتب الاستشاري',
  supervisor: 'الجهة الإشرافية',
  admin: 'مدير النظام',
  support: 'الدعم التقني',
  visitor: 'زائر',
}

export const POSITION_LABEL = { principal: 'المفوّض الرئيسي', employee: 'موظف' } as const

// مصفوفة الصلاحيات (الملحق 7.1) بعد تصحيح البنود 11، 13–15
// صلاحيات على مستوى الميزة — التفويض يُتحقق منه على مستوى السجل في المتجر
export type Permission =
  | 'catalog.view' | 'catalog.manage'
  | 'directory.view' | 'profile.manage' | 'rating.create' | 'rating.moderate'
  | 'request.view' | 'request.create' | 'request.submit' | 'request.cancel' | 'request.retest'
  | 'request.plan' | 'request.decide' | 'test.execute' | 'test.submit' | 'output.review' | 'output.approve'
  | 'study.view' | 'study.prelim' | 'study.plan.approve' | 'study.fieldplan' | 'study.field' | 'study.lab' | 'study.analysis' | 'study.report.preview' | 'study.report.approve' | 'study.report.view'
  | 'delegation.view' | 'delegation.create' | 'delegation.decide' | 'delegation.edit'
  | 'admin.settings' | 'admin.reference' | 'admin.accounts' | 'admin.knowledge'
  | 'monitor.view' | 'results.view'
  // المحرك الذكي (4.1.5) — لا يُنشأ له مستخدم مستقل؛ هذه صلاحية تشغيله من داخل المنصة
  | 'engine.run'

type Key = `${Role}:${'principal' | 'employee'}`
const P = (...p: Permission[]) => new Set(p)

const ALL_ADMIN = P(
  'catalog.view','catalog.manage','directory.view','profile.manage','rating.moderate',
  'request.view','request.create','request.submit','request.cancel','request.retest','request.plan','request.decide','test.execute','test.submit','output.review','output.approve',
  'study.view','study.prelim','study.plan.approve','study.fieldplan','study.field','study.lab','study.analysis','study.report.preview','study.report.approve','study.report.view',
  'delegation.view','delegation.create','delegation.decide','delegation.edit',
  'admin.settings','admin.reference','admin.accounts','admin.knowledge','monitor.view','results.view','engine.run',
)

export const MATRIX: Record<Key, Set<Permission>> = {
  'contractor:principal': P('directory.view','profile.manage','rating.create','results.view','request.view','request.create','request.submit','request.cancel','request.retest','study.view','study.prelim','study.report.view','delegation.view','delegation.create','delegation.decide','delegation.edit'),
  'contractor:employee':  P('directory.view','results.view','request.view','request.create','request.submit','request.cancel','request.retest','study.view','study.prelim','study.report.view','delegation.view','delegation.create','delegation.decide'),
  'lab:principal':  P('catalog.view','catalog.manage','directory.view','profile.manage','request.view','request.plan','request.decide','test.execute','test.submit','study.view','study.fieldplan','study.field','study.lab','study.analysis','study.report.view','delegation.view','delegation.create','delegation.decide','delegation.edit','engine.run'),
  'lab:employee':   P('catalog.view','directory.view','request.view','request.plan','test.execute','test.submit','study.view','study.fieldplan','study.field','study.lab','study.analysis','study.report.view','delegation.view','delegation.create','delegation.decide','engine.run'),
  'consultant:principal': P('directory.view','profile.manage','request.view','request.plan','output.review','output.approve','study.view','study.plan.approve','study.report.preview','study.report.approve','study.report.view','delegation.view','delegation.create','delegation.decide','delegation.edit','engine.run'),
  'consultant:employee':  P('directory.view','request.view','request.plan','output.review','study.view','study.report.preview','study.report.view','delegation.view','delegation.create','delegation.decide','engine.run'),
  // الجهة الإشرافية بلا دور تشغيلي (BRD 3.2.1)، لكنها تطّلع على حوكمة المحرك وحالته
  'supervisor:principal': P('catalog.view','directory.view','request.view','study.view','study.report.view','monitor.view','engine.run'),
  'supervisor:employee':  P('catalog.view','directory.view','request.view','study.view','study.report.view','monitor.view','engine.run'),
  'admin:principal': ALL_ADMIN, 'admin:employee': ALL_ADMIN,
  'support:principal': P('catalog.view','directory.view','rating.moderate','request.view','request.cancel','study.view','study.report.view','delegation.view','delegation.create','delegation.decide','delegation.edit','admin.accounts','monitor.view'),
  'support:employee':  P('directory.view','request.view','study.view','study.report.view'),
  'visitor:principal': P('directory.view'), 'visitor:employee': P('directory.view'),
}

export const can = (role: Role, position: 'principal' | 'employee', p: Permission) =>
  MATRIX[`${role}:${position}`]?.has(p) ?? false

/** Rows of the appendix-7.1 matrix as shown in Governance — derived from MATRIX so there is one source of truth. */
export const MATRIX_ROWS: { label: string; p: Permission }[] = [
  { label: 'عرض قائمة الاختبارات', p: 'catalog.view' }, { label: 'إدارة قائمة الاختبارات (إضافة/تعديل/سعر/إيقاف/تفعيل)', p: 'catalog.manage' },
  { label: 'استعراض الدليل والبحث وتفاصيل المنشأة', p: 'directory.view' }, { label: 'إدارة الملف التعريفي', p: 'profile.manage' }, { label: 'تقييم المختبر', p: 'rating.create' }, { label: 'إخفاء / حذف تقييم', p: 'rating.moderate' },
  { label: 'عرض طلبات الاختبارات وتفاصيلها', p: 'request.view' }, { label: 'إنشاء طلب اختبار', p: 'request.create' }, { label: 'إرسال / إلغاء طلب', p: 'request.cancel' }, { label: 'إنشاء طلب إعادة اختبار', p: 'request.retest' },
  { label: 'إعداد واعتماد خطة التنفيذ', p: 'request.plan' }, { label: 'مراجعة الطلب والرد عليه (قبول/رفض)', p: 'request.decide' }, { label: 'تنفيذ الاختبار واستكمال المخرج', p: 'test.execute' }, { label: 'مراجعة مخرج الاختبار', p: 'output.review' }, { label: 'الموافقة على / رفض المخرج', p: 'output.approve' },
  { label: 'عرض الدراسة الجيوتقنية وتقدمها', p: 'study.view' }, { label: 'إدارة البيانات الأولية', p: 'study.prelim' }, { label: 'مراجعة واعتماد خطة الاستكشاف', p: 'study.plan.approve' }, { label: 'مراجعة خطة التنفيذ الميداني', p: 'study.fieldplan' }, { label: 'الأعمال الميدانية وإدارة الجسات', p: 'study.field' }, { label: 'إدارة البيانات المعملية', p: 'study.lab' }, { label: 'إدارة البيانات الحسابية', p: 'study.analysis' }, { label: 'معاينة تقرير الدراسة', p: 'study.report.preview' }, { label: 'الموافقة على / رفض مخرج الدراسة', p: 'study.report.approve' }, { label: 'عرض تقرير الدراسة', p: 'study.report.view' },
  { label: 'عرض التفاويض', p: 'delegation.view' }, { label: 'إنشاء تفويض', p: 'delegation.create' }, { label: 'قبول / رفض تفويض', p: 'delegation.decide' }, { label: 'تعديل تفويض', p: 'delegation.edit' },
  { label: 'تشغيل المحرك الذكي (سحابي / محلي)', p: 'engine.run' },
  { label: 'قواعد الأعمال والقوالب', p: 'admin.settings' }, { label: 'العناصر المرجعية', p: 'admin.reference' }, { label: 'قاعدة المعرفة والمعادلات', p: 'admin.knowledge' }, { label: 'المنشآت والحسابات', p: 'admin.accounts' }, { label: 'سجل التدقيق الكامل والامتثال', p: 'monitor.view' },
]
export const MATRIX_COLS: { label: string; key: Key }[] = [
  { label: 'إشرافية — مفوّض', key: 'supervisor:principal' }, { label: 'إشرافية — موظف', key: 'supervisor:employee' }, { label: 'مدير النظام', key: 'admin:principal' }, { label: 'الدعم التقني', key: 'support:principal' },
  { label: 'مقاول — مفوّض', key: 'contractor:principal' }, { label: 'مقاول — موظف', key: 'contractor:employee' }, { label: 'استشاري — مفوّض', key: 'consultant:principal' }, { label: 'استشاري — موظف', key: 'consultant:employee' }, { label: 'مختبر — مفوّض', key: 'lab:principal' }, { label: 'مختبر — موظف', key: 'lab:employee' },
]
