import type { Role, Quote, Template, KnowledgeVersion,
  User, Organization, RefTest, CatalogItem, Contract, TestRequest, Study, Delegation, Rating, BusinessRules, Notification, TestItem, TestStatus, RequestStatus,
  AuditEvent, Document, Invoice, Policy, Category, AuditEntry,
} from './types'
import { isoIn } from './format'

/* ─────────────────────────────────────────────────────────────
   Deterministic seed — today is 13 Sep 2026; data spans Oct 2025 → Sep 2026.
   Hand-authored fixtures (the demo storyline) + a seeded generator for volume.
   ───────────────────────────────────────────────────────────── */
// Anchored to the real clock so countdowns/SLA stay live in demos (the seed keeps the data deterministic).
const NOW = Date.now()
const ago = (h: number) => new Date(NOW - h * 36e5).toISOString()
const day = (d: number) => new Date(NOW + d * 864e5).toISOString().slice(0, 10)
const LAB_DECISION_HOURS = 12 // mirrors RULES.labDecisionHours (RULES is declared later in the module)
const RULES_AT_SUBMIT = { labDecisionHours: 12, consultantDecisionHours: 48, vat: 15, minLeadHours: 48, geofenceMeters: 3, maxTestsPerRequest: 10, proposedSlots: 3 } // rules frozen on every already-submitted fixture
let seed = 20260913
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]
const between = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))

/* ── Organizations ─────────────────────────────────────────── */
export const ORGS: Organization[] = [
  { id: 'o-lab1', type: 'lab', name: 'مختبر التربة والمواد', cr: '4030123456', city: 'جدة', region: 'المنطقة الغربية', about: 'مختبر متخصص في اختبارات التربة والطرق والمواد الإنشائية وفق المعايير الدولية (ASTM / AASHTO / BS). معتمد من المركز السعودي للاعتماد.', specialties: ['تربة', 'إسفلت', 'خرسانة'], phone: '+966 12 673 0123', email: 'info@soilmat-lab.sa', website: 'www.soilmat-lab.sa', address: 'المنطقة الصناعية، شارع الأمير سلطان، جدة', rating: 4.2, reviews: 38, active: true, featured: true, saac: { number: 'SAC-L-2021-004', scope: 'اختبارات التربة والركام والخرسانة', expires: '2027-03-01' }, license: 'BLD-LAB-9834', since: '2009', employees: 46, onTime: 91, autoApprovals: 2, kpis: [{ label: 'اختبار متاح', value: '47' }, { label: 'اختبار منجز', value: '1,284' }, { label: 'الالتزام بالمواعيد', value: '91%' }] },
  { id: 'o-lab2', type: 'lab', name: 'مختبر الجودة الشاملة', cr: '1010987654', city: 'الرياض', region: 'المنطقة الوسطى', about: 'مختبر رائد في الفحوصات الجيوتقنية واختبارات الجودة للمشاريع الإنشائية الكبرى بخبرة تجاوزت 15 عاماً.', specialties: ['تربة', 'جيوتقنية', 'ركام'], phone: '+966 11 456 7890', email: 'lab@tqlab.sa', website: 'www.tqlab.sa', address: 'طريق الملك فهد، حي العليا، الرياض', rating: 4.8, reviews: 62, active: true, saac: { number: 'SAC-L-2019-011', scope: 'الجيوتقنية والتربة', expires: '2026-12-31' }, license: 'BLD-LAB-4410', since: '2008', employees: 72, onTime: 97, autoApprovals: 0, kpis: [{ label: 'اختبار متاح', value: '32' }, { label: 'اختبار منجز', value: '2,870' }, { label: 'الالتزام بالمواعيد', value: '97%' }] },
  { id: 'o-lab3', type: 'lab', name: 'مختبر الخليج للفحص', cr: '2050456789', city: 'الدمام', region: 'المنطقة الشرقية', about: 'مختبر متخصص في اختبارات الإسفلت والخرسانة لمشاريع الطرق في المنطقة الشرقية.', specialties: ['إسفلت', 'خرسانة'], phone: '+966 13 887 7665', email: 'lab@gulftest.sa', address: 'المنطقة الصناعية الثانية، الدمام', rating: 3.6, reviews: 21, active: true, license: 'BLD-LAB-7721', since: '2015', employees: 23, onTime: 82, autoApprovals: 5, kpis: [{ label: 'اختبار متاح', value: '28' }, { label: 'اختبار منجز', value: '689' }, { label: 'الالتزام بالمواعيد', value: '82%' }] },
  { id: 'o-lab4', type: 'lab', name: 'مختبر المواد المتقدمة', cr: '4030555666', city: 'جدة', region: 'المنطقة الغربية', about: 'اختبارات مواد البناء المتقدمة والجيوتقنية وفق المعايير الدولية.', specialties: ['تربة', 'إسفلت'], phone: '+966 12 654 4332', email: 'info@advmat.sa', address: 'حي الفيصلية، جدة', rating: 4.0, reviews: 44, active: true, saac: { number: 'SAC-L-2022-037', scope: 'اختبارات التربة', expires: '2027-08-15' }, license: 'BLD-LAB-6120', since: '2012', employees: 31, onTime: 88, autoApprovals: 1, kpis: [{ label: 'اختبار متاح', value: '41' }, { label: 'اختبار منجز', value: '956' }, { label: 'الالتزام بالمواعيد', value: '88%' }] },
  { id: 'o-lab5', type: 'lab', name: 'جسات لفحص التربة', cr: '1010223344', city: 'الرياض', region: 'المنطقة الوسطى', about: 'شركة فحص التربة للاستشارات الهندسية — فروع في الرياض وجدة والمدينة والدمام. اعتماد ISO/IEC 17025 و ilac-MRA.', specialties: ['جيوتقنية', 'تربة', 'خرسانة', 'حديد'], phone: '+966 56 306 7537', email: 'info@gssaat.com', website: 'www.gssaat.com', address: 'حي الربوة، الرياض', rating: 4.6, reviews: 57, active: true, featured: true, saac: { number: 'SAC-L-2018-002', scope: 'التربة والخرسانة وحديد التسليح', expires: '2027-01-20' }, license: 'BLD-LAB-3005', since: '2006', employees: 118, onTime: 94, autoApprovals: 1, kpis: [{ label: 'اختبار متاح', value: '63' }, { label: 'اختبار منجز', value: '4,120' }, { label: 'الالتزام بالمواعيد', value: '94%' }] },
  { id: 'o-lab6', type: 'lab', name: 'مختبر نجد للطرق', cr: '1010667788', city: 'القصيم', region: 'المنطقة الوسطى', about: 'مختبر متخصص في اختبارات الطرق والإسفلت والدمك الحقلي.', specialties: ['إسفلت', 'تربة'], phone: '+966 16 321 1234', email: 'info@najdroads.sa', address: 'طريق الملك عبدالعزيز، بريدة', rating: 3.9, reviews: 17, active: true, license: 'BLD-LAB-8102', since: '2017', employees: 19, onTime: 86, autoApprovals: 3, kpis: [{ label: 'اختبار متاح', value: '22' }, { label: 'اختبار منجز', value: '412' }, { label: 'الالتزام بالمواعيد', value: '86%' }] },
  { id: 'o-lab7', type: 'lab', name: 'مختبر مكة للفحوصات الإنشائية', cr: '4031122334', city: 'مكة المكرمة', region: 'المنطقة الغربية', about: 'فحوصات إنشائية وجيوتقنية لمشاريع المشاعر والتوسعة.', specialties: ['جيوتقنية', 'خرسانة'], phone: '+966 12 559 9887', email: 'lab@makkahtest.sa', address: 'حي الشرائع، مكة المكرمة', rating: 4.4, reviews: 29, active: true, saac: { number: 'SAC-L-2020-019', scope: 'الجيوتقنية', expires: '2026-11-30' }, license: 'BLD-LAB-5511', since: '2011', employees: 38, onTime: 90, autoApprovals: 0, kpis: [{ label: 'اختبار متاح', value: '35' }, { label: 'اختبار منجز', value: '1,102' }, { label: 'الالتزام بالمواعيد', value: '90%' }] },
  { id: 'o-lab8', type: 'lab', name: 'مختبر الشمال الهندسي', cr: '3450099887', city: 'تبوك', region: 'المنطقة الشمالية', about: 'اختبارات التربة والطرق لمشاريع نيوم والمنطقة الشمالية.', specialties: ['تربة', 'ركام'], phone: '+966 14 422 1100', email: 'info@northlab.sa', address: 'حي المروج، تبوك', rating: 4.1, reviews: 12, active: false, license: 'BLD-LAB-9302', since: '2020', employees: 14, onTime: 79, autoApprovals: 4, kpis: [{ label: 'اختبار متاح', value: '18' }, { label: 'اختبار منجز', value: '203' }, { label: 'الالتزام بالمواعيد', value: '79%' }] },
  { id: 'o-cont1', type: 'contractor', name: 'شركة الإنشاءات المتكاملة', cr: '1010111222', city: 'الرياض', region: 'المنطقة الوسطى', about: 'شركة متخصصة في أعمال الإنشاء والبنية التحتية والطرق بمشاريع تجاوزت قيمتها 1.2 مليار ريال.', specialties: ['طرق', 'إنشاءات', 'بنية تحتية'], phone: '+966 11 222 3344', email: 'info@integrated-const.sa', website: 'www.integrated-const.sa', address: 'حي العليا، الرياض', rating: 0, reviews: 0, active: true, since: '2003', employees: 640, kpis: [{ label: 'عقد فعّال', value: '7' }, { label: 'اختبار طُلب', value: '847' }, { label: 'نسبة الالتزام', value: '96%' }] },
  { id: 'o-cont2', type: 'contractor', name: 'شركة مشاريع البنية', cr: '1010333444', city: 'الرياض', region: 'المنطقة الوسطى', about: 'مقاول بنية تحتية وشبكات صرف ومياه.', specialties: ['بنية تحتية', 'شبكات'], phone: '+966 11 445 5667', email: 'info@infra-projects.sa', address: 'حي الملقا، الرياض', rating: 0, reviews: 0, active: true, since: '2011', employees: 210, kpis: [{ label: 'عقد فعّال', value: '3' }, { label: 'اختبار طُلب', value: '212' }] },
  { id: 'o-cont3', type: 'contractor', name: 'مجموعة بن لادن للطرق', cr: '4030001122', city: 'جدة', region: 'المنطقة الغربية', about: 'تنفيذ الطرق السريعة والجسور والأنفاق.', specialties: ['طرق', 'جسور'], phone: '+966 12 600 1122', email: 'roads@sbg.sa', address: 'طريق المدينة، جدة', rating: 0, reviews: 0, active: true, since: '1985', employees: 3200, kpis: [{ label: 'عقد فعّال', value: '5' }, { label: 'اختبار طُلب', value: '1,930' }] },
  { id: 'o-cont4', type: 'contractor', name: 'مؤسسة البناء الحديث', cr: '2050334455', city: 'الدمام', region: 'المنطقة الشرقية', about: 'مقاولات عامة ومشاريع سكنية.', specialties: ['إنشاءات', 'سكني'], phone: '+966 13 800 1122', email: 'info@modernbuild.sa', address: 'حي الفيصلية، الدمام', rating: 0, reviews: 0, active: true, since: '2016', employees: 85, kpis: [{ label: 'عقد فعّال', value: '2' }, { label: 'اختبار طُلب', value: '96' }] },
  { id: 'o-cont5', type: 'contractor', name: 'شركة روافد للتطوير العقاري', cr: '1010778899', city: 'الرياض', region: 'المنطقة الوسطى', about: 'تطوير مجمعات سكنية ضمن برنامج سكني.', specialties: ['سكني', 'تطوير'], phone: '+966 11 998 8776', email: 'dev@rawafid.sa', address: 'حي النرجس، الرياض', rating: 0, reviews: 0, active: true, since: '2019', employees: 120, kpis: [{ label: 'عقد فعّال', value: '4' }, { label: 'اختبار طُلب', value: '338' }] },
  { id: 'o-cons1', type: 'consultant', name: 'مكتب الاستشارات الهندسية المتكاملة', cr: '4030777888', city: 'جدة', region: 'المنطقة الغربية', about: 'استشارات جيوتقنية وهندسية وإشراف على مشاريع الطرق والبنية التحتية.', specialties: ['جيوتقنية', 'طرق', 'إشراف'], phone: '+966 12 667 7889', email: 'info@iec.sa', website: 'www.iec.sa', address: 'حي الروضة، جدة', rating: 0, reviews: 0, active: true, since: '2001', employees: 96, kpis: [{ label: 'عقد أشرف عليه', value: '22' }, { label: 'مخرج اعتمده', value: '1,412' }, { label: 'متوسط زمن الاعتماد', value: '19 س' }] },
  { id: 'o-cons2', type: 'consultant', name: 'شركة سماء للاستشارات الهندسية', cr: '1010445566', city: 'الرياض', region: 'المنطقة الوسطى', about: 'استشارات إنشائية وتقييم المباني القائمة والإشراف الهندسي.', specialties: ['إنشائية', 'تقييم مبانٍ', 'إشراف'], phone: '+966 11 200 9988', email: 'info@sama-eng.sa', address: 'حي الربوة، الرياض', rating: 0, reviews: 0, active: true, since: '2010', employees: 54, kpis: [{ label: 'عقد أشرف عليه', value: '14' }, { label: 'مخرج اعتمده', value: '620' }, { label: 'متوسط زمن الاعتماد', value: '26 س' }] },
  { id: 'o-cons3', type: 'consultant', name: 'دار الهندسة للاستشارات', cr: '2050778899', city: 'الخبر', region: 'المنطقة الشرقية', about: 'استشارات جيوتقنية للمشاريع الصناعية والبترولية.', specialties: ['جيوتقنية', 'صناعي'], phone: '+966 13 889 9001', email: 'geo@dar-eng.sa', address: 'الكورنيش، الخبر', rating: 0, reviews: 0, active: true, since: '2007', employees: 41, kpis: [{ label: 'عقد أشرف عليه', value: '9' }, { label: 'مخرج اعتمده', value: '388' }] },
  { id: 'o-sup', type: 'supervisor', name: 'الإدارة العامة لكود البناء السعودي', cr: '—', city: 'الرياض', region: 'المنطقة الوسطى', about: '', specialties: [], phone: '', email: '', address: '', rating: 0, reviews: 0, active: true, kpis: [] },
  { id: 'o-ops', type: 'ops', name: 'فريق تشغيل معيار', cr: '—', city: 'الرياض', region: 'المنطقة الوسطى', about: '', specialties: [], phone: '', email: '', address: '', rating: 0, reviews: 0, active: true, kpis: [] },
]
const orgName = (id: string) => ORGS.find(o => o.id === id)!.name

/* ── Users ─────────────────────────────────────────────────── */
export const USERS: User[] = [
  { id: 'u-cont', name: 'أحمد العتيبي', role: 'contractor', position: 'principal', orgId: 'o-cont1', orgName: orgName('o-cont1'), mobile: '0551234567', canDelegate: true },
  { id: 'u-cont-emp', name: 'سارة الدوسري', role: 'contractor', position: 'employee', orgId: 'o-cont1', orgName: orgName('o-cont1'), mobile: '0551234568', canDelegate: false },
  { id: 'u-cont2', name: 'ماجد العنزي', role: 'contractor', position: 'principal', orgId: 'o-cont2', orgName: orgName('o-cont2'), mobile: '0552001001', canDelegate: true },
  { id: 'u-cont3', name: 'طلال بن لادن', role: 'contractor', position: 'principal', orgId: 'o-cont3', orgName: orgName('o-cont3'), mobile: '0553003003', canDelegate: true },
  { id: 'u-cont5', name: 'هند الشهراني', role: 'contractor', position: 'principal', orgId: 'o-cont5', orgName: orgName('o-cont5'), mobile: '0555005005', canDelegate: true },
  { id: 'u-lab', name: 'محمد السبيعي', role: 'lab', position: 'principal', orgId: 'o-lab1', orgName: orgName('o-lab1'), mobile: '0559876543', canDelegate: true },
  { id: 'u-lab-emp', name: 'فيصل القحطاني', role: 'lab', position: 'employee', orgId: 'o-lab1', orgName: orgName('o-lab1'), mobile: '0559876544', canDelegate: false },
  { id: 'u-lab-emp2', name: 'نواف الشمري', role: 'lab', position: 'employee', orgId: 'o-lab1', orgName: orgName('o-lab1'), mobile: '0559876545', canDelegate: false },
  { id: 'u-lab-emp3', name: 'عبدالرحمن الزهراني', role: 'lab', position: 'employee', orgId: 'o-lab1', orgName: orgName('o-lab1'), mobile: '0559876546', canDelegate: false },
  { id: 'u-lab2', name: 'سعود المطيري', role: 'lab', position: 'principal', orgId: 'o-lab2', orgName: orgName('o-lab2'), mobile: '0556002002', canDelegate: true },
  { id: 'u-lab5', name: 'معاذ الجديع', role: 'lab', position: 'principal', orgId: 'o-lab5', orgName: orgName('o-lab5'), mobile: '0556005005', canDelegate: true },
  { id: 'u-cons', name: 'خالد العسيري', role: 'consultant', position: 'principal', orgId: 'o-cons1', orgName: orgName('o-cons1'), mobile: '0553334444', canDelegate: true },
  { id: 'u-cons-emp', name: 'ريم الحربي', role: 'consultant', position: 'employee', orgId: 'o-cons1', orgName: orgName('o-cons1'), mobile: '0553334445', canDelegate: false },
  { id: 'u-cons2', name: 'سامي عبدالحق', role: 'consultant', position: 'principal', orgId: 'o-cons2', orgName: orgName('o-cons2'), mobile: '0557007007', canDelegate: true },
  { id: 'u-sup', name: 'عبدالله الغامدي', role: 'supervisor', position: 'principal', orgId: 'o-sup', orgName: orgName('o-sup'), mobile: '0551112222', canDelegate: false },
  { id: 'u-admin', name: 'ياسر علي', role: 'admin', position: 'principal', orgId: 'o-ops', orgName: orgName('o-ops'), mobile: '0550001111', canDelegate: true },
  { id: 'u-support', name: 'رحاب مدخلي', role: 'support', position: 'principal', orgId: 'o-ops', orgName: orgName('o-ops'), mobile: '0550001112', canDelegate: false },
]

/* ── Reference tests ────────────────────────────────────────── */
export const REF_TESTS: RefTest[] = [
  { id: 'rt-proctor', nameAr: 'اختبار الدمك القياسي', nameEn: 'Standard Proctor Test', category: 'soil', units: ['Ea'], methods: [{ code: 'ASTM D698', name: 'Standard Proctor', org: 'ASTM' }, { code: 'ASTM D1557', name: 'Modified Proctor', org: 'ASTM' }, { code: 'BS 1377-4', name: 'Compaction Test', org: 'BS' }, { code: 'AASHTO T-99', name: 'Standard Proctor', org: 'AASHTO' }], resultFields: [{ key: 'mdd', label: 'الكثافة الجافة القصوى MDD', unit: 'Mg/m³' }, { key: 'omc', label: 'نسبة الرطوبة المثلى OMC', unit: '%' }, { key: 'fc', label: 'درجة الدمك الحقلية', unit: '%' }] },
  { id: 'rt-cbr', nameAr: 'اختبار CBR', nameEn: 'California Bearing Ratio', category: 'soil', units: ['Ea'], methods: [{ code: 'ASTM D1883', name: 'CBR', org: 'ASTM' }, { code: 'BS 1377-4', name: 'CBR', org: 'BS' }], resultFields: [{ key: 'cbr', label: 'قيمة CBR', unit: '%' }, { key: 'swell', label: 'الانتفاخ', unit: '%' }] },
  { id: 'rt-sieve', nameAr: 'التحليل الحبيبي', nameEn: 'Sieve Analysis', category: 'soil', units: ['Ea'], methods: [{ code: 'ASTM D422', name: 'Particle-Size Analysis', org: 'ASTM' }, { code: 'ASTM D6913', name: 'Sieve Analysis', org: 'ASTM' }], resultFields: [{ key: 'p200', label: 'المار من منخل 200', unit: '%' }] },
  { id: 'rt-atterberg', nameAr: 'حدود أتربرج', nameEn: 'Atterberg Limits', category: 'soil', units: ['Ea'], methods: [{ code: 'ASTM D4318', name: 'Liquid & Plastic Limits', org: 'ASTM' }], resultFields: [{ key: 'll', label: 'حد السيولة LL', unit: '%' }, { key: 'pl', label: 'حد اللدونة PL', unit: '%' }, { key: 'pi', label: 'مؤشر اللدونة PI', unit: '%' }] },
  { id: 'rt-mc', nameAr: 'معامل الرطوبة', nameEn: 'Moisture Content', category: 'soil', units: ['Ea'], methods: [{ code: 'ASTM D2216', name: 'Water Content', org: 'ASTM' }], resultFields: [{ key: 'mc', label: 'المحتوى الرطوبي', unit: '%' }] },
  { id: 'rt-fdt', nameAr: 'الكثافة الحقلية (المخروط الرملي)', nameEn: 'Field Density – Sand Cone', category: 'soil', units: ['Ea'], methods: [{ code: 'ASTM D1556', name: 'Sand Cone', org: 'ASTM' }], resultFields: [{ key: 'dd', label: 'الكثافة الجافة الحقلية', unit: 'Mg/m³' }, { key: 'rc', label: 'نسبة الدمك النسبي', unit: '%' }] },
  { id: 'rt-consol', nameAr: 'اختبار الانضغاطية', nameEn: 'Consolidation Test', category: 'soil', units: ['Ea'], methods: [{ code: 'ASTM D2435', name: 'One-Dimensional Consolidation', org: 'ASTM' }] },
  { id: 'rt-shear', nameAr: 'اختبار القص المباشر', nameEn: 'Direct Shear Test', category: 'soil', units: ['Ea'], methods: [{ code: 'ASTM D3080', name: 'Direct Shear', org: 'ASTM' }], resultFields: [{ key: 'c', label: 'التماسك c', unit: 'kPa' }, { key: 'phi', label: 'زاوية الاحتكاك φ', unit: '°' }] },
  { id: 'rt-swell', nameAr: 'اختبار الانتفاخ', nameEn: 'Swell Test', category: 'soil', units: ['Ea'], methods: [{ code: 'ASTM D4546', name: 'Swell', org: 'ASTM' }, { code: 'ASTM D4829', name: 'Expansion Index', org: 'ASTM' }] },
  { id: 'rt-collapse', nameAr: 'اختبار الانهيارية', nameEn: 'Collapse Potential', category: 'soil', units: ['Ea'], methods: [{ code: 'ASTM D5333', name: 'Collapse Index', org: 'ASTM' }] },
  { id: 'rt-ucs', nameAr: 'مقاومة الضغط غير المحصور', nameEn: 'Unconfined Compressive Strength', category: 'soil', units: ['Ea'], methods: [{ code: 'ASTM D2166', name: 'UCS – Soil', org: 'ASTM' }, { code: 'ASTM D7012', name: 'UCS – Rock Core', org: 'ASTM' }], resultFields: [{ key: 'ucs', label: 'UCS', unit: 'MPa' }] },
  { id: 'rt-marshall', nameAr: 'اختبار المارشال', nameEn: 'Marshall Test', category: 'asphalt', units: ['Set'], methods: [{ code: 'ASTM D6927', name: 'Marshall Stability', org: 'ASTM' }, { code: 'BS EN 12697', name: 'Bituminous Mixtures', org: 'BS' }], resultFields: [{ key: 'stab', label: 'الثبات', unit: 'kN' }, { key: 'flow', label: 'الانسياب', unit: 'mm' }] },
  { id: 'rt-pen', nameAr: 'اختبار الاختراق', nameEn: 'Penetration Test', category: 'asphalt', units: ['Ea'], methods: [{ code: 'ASTM D5', name: 'Penetration of Bituminous', org: 'ASTM' }, { code: 'IP 49', name: 'Penetration', org: 'IP' }], resultFields: [{ key: 'pen', label: 'الاختراق', unit: '0.1mm' }] },
  { id: 'rt-core-asph', nameAr: 'كور إسفلتي (سمك وكثافة)', nameEn: 'Asphalt Core', category: 'asphalt', units: ['Ea'], methods: [{ code: 'ASTM D2726', name: 'Bulk SG', org: 'ASTM' }], resultFields: [{ key: 'thk', label: 'السمك', unit: 'mm' }, { key: 'den', label: 'الكثافة', unit: '%' }] },
  { id: 'rt-cube', nameAr: 'مقاومة ضغط المكعبات', nameEn: 'Concrete Cube Strength', category: 'concrete', units: ['Set'], methods: [{ code: 'BS EN 12390-3', name: 'Compressive Strength', org: 'BS' }], resultFields: [{ key: 'f7', label: 'مقاومة 7 أيام', unit: 'MPa' }, { key: 'f28', label: 'مقاومة 28 يوماً', unit: 'MPa' }] },
  { id: 'rt-core', nameAr: 'كور خرساني', nameEn: 'Concrete Core', category: 'concrete', units: ['Ea'], methods: [{ code: 'ASTM C42', name: 'Drilled Cores', org: 'ASTM' }], resultFields: [{ key: 'fc', label: 'مقاومة الضغط المصححة', unit: 'MPa' }] },
  { id: 'rt-slump', nameAr: 'اختبار الهبوط', nameEn: 'Slump Test', category: 'concrete', units: ['Ea'], methods: [{ code: 'ASTM C143', name: 'Slump', org: 'ASTM' }], resultFields: [{ key: 'slump', label: 'الهبوط', unit: 'mm' }] },
  { id: 'rt-halfcell', nameAr: 'كشف صدأ الحديد (Half-Cell)', nameEn: 'Half-Cell Potential', category: 'concrete', units: ['Ea'], methods: [{ code: 'ASTM C876', name: 'Corrosion Potential', org: 'ASTM' }], resultFields: [{ key: 'pot', label: 'أدنى جهد مسجّل', unit: 'mV' }, { key: 'prob', label: 'احتمالية الصدأ', unit: '%' }] },
  { id: 'rt-rebar', nameAr: 'اختبار شد حديد التسليح', nameEn: 'Rebar Tensile Test', category: 'concrete', units: ['Ea'], methods: [{ code: 'ASTM A370', name: 'Tension Test', org: 'ASTM' }, { code: 'ISO 6892-1', name: 'Tensile Testing', org: 'ISO' }], resultFields: [{ key: 'fy', label: 'إجهاد الخضوع', unit: 'MPa' }, { key: 'fu', label: 'إجهاد الشد الأقصى', unit: 'MPa' }, { key: 'el', label: 'الاستطالة', unit: '%' }] },
  { id: 'rt-la', nameAr: 'تآكل لوس أنجلوس', nameEn: 'LA Abrasion', category: 'aggregate', units: ['Ea'], methods: [{ code: 'ASTM C131', name: 'LA Abrasion', org: 'ASTM' }], resultFields: [{ key: 'la', label: 'نسبة التآكل', unit: '%' }] },
  { id: 'rt-sg', nameAr: 'الوزن النوعي للركام', nameEn: 'Specific Gravity', category: 'aggregate', units: ['Ea'], methods: [{ code: 'ASTM C127', name: 'Coarse Aggregate SG', org: 'ASTM' }] },
  { id: 'rt-geotech', nameAr: 'دراسة جيوتقنية شاملة', nameEn: 'Geotechnical Investigation', category: 'soil', units: ['per Test'], methods: [{ code: 'SBC 303', name: 'Chapter 2 – Geotechnical Investigations', org: 'SBC' }] },
]
export const CATEGORY_LABEL: Record<Category, string> = { soil: 'اختبارات التربة', asphalt: 'اختبارات الإسفلت', concrete: 'اختبارات الخرسانة', aggregate: 'اختبارات الركام' }

/* ── Catalog ────────────────────────────────────────────────── */
const PRICE: Record<string, [number, number]> = { 'rt-proctor': [280, 3], 'rt-cbr': [420, 5], 'rt-sieve': [180, 2], 'rt-atterberg': [180, 2], 'rt-mc': [90, 1], 'rt-fdt': [220, 1], 'rt-consol': [380, 7], 'rt-shear': [350, 5], 'rt-swell': [320, 4], 'rt-collapse': [340, 4], 'rt-ucs': [300, 3], 'rt-marshall': [650, 4], 'rt-pen': [260, 2], 'rt-core-asph': [240, 2], 'rt-cube': [220, 28], 'rt-core': [480, 5], 'rt-slump': [80, 1], 'rt-halfcell': [900, 3], 'rt-la': [380, 3], 'rt-sg': [210, 2], 'rt-geotech': [4200, 21] }
const LAB_TESTS: Record<string, string[]> = {
  'o-lab1': ['rt-proctor', 'rt-cbr', 'rt-marshall', 'rt-consol', 'rt-sieve', 'rt-shear', 'rt-atterberg', 'rt-geotech', 'rt-ucs', 'rt-cube', 'rt-fdt', 'rt-mc', 'rt-slump', 'rt-la'],
  'o-lab2': ['rt-geotech', 'rt-proctor', 'rt-cbr', 'rt-sieve', 'rt-atterberg', 'rt-mc', 'rt-consol', 'rt-shear', 'rt-swell', 'rt-collapse', 'rt-ucs', 'rt-la', 'rt-sg'],
  'o-lab3': ['rt-marshall', 'rt-pen', 'rt-core-asph', 'rt-cube', 'rt-slump', 'rt-core'],
  'o-lab4': ['rt-proctor', 'rt-cbr', 'rt-sieve', 'rt-atterberg', 'rt-marshall', 'rt-pen', 'rt-fdt', 'rt-mc'],
  'o-lab5': ['rt-geotech', 'rt-proctor', 'rt-cbr', 'rt-sieve', 'rt-atterberg', 'rt-mc', 'rt-ucs', 'rt-cube', 'rt-core', 'rt-halfcell', 'rt-consol', 'rt-shear', 'rt-swell', 'rt-collapse', 'rt-la', 'rt-sg', 'rt-fdt'],
  'o-lab6': ['rt-proctor', 'rt-cbr', 'rt-fdt', 'rt-marshall', 'rt-core-asph', 'rt-sieve'],
  'o-lab7': ['rt-geotech', 'rt-cube', 'rt-core', 'rt-halfcell', 'rt-proctor', 'rt-sieve', 'rt-atterberg', 'rt-ucs'],
  'o-lab8': ['rt-proctor', 'rt-cbr', 'rt-sieve', 'rt-la', 'rt-sg'],
}
/* Realistic value ranges per result field [min, max, decimals] — used by the generated fixtures */
const FIELD_RANGE: Record<string, [number, number, number]> = {
  mdd: [1.72, 2.05, 2], omc: [8, 16, 1], fc: [92, 99.5, 1], cbr: [12, 95, 0], swell: [0.1, 1.6, 2], p200: [4, 28, 1], ll: [18, 42, 0], pl: [12, 24, 0], pi: [3, 18, 0], mc: [6, 18, 1],
  dd: [1.68, 1.98, 2], rc: [91, 99.4, 1], c: [5, 45, 0], phi: [26, 38, 0], ucs: [0.4, 48, 1], stab: [8.2, 14.5, 1], flow: [2.1, 3.9, 1], pen: [58, 72, 0], thk: [48, 62, 0], den: [95.5, 99, 1],
  f7: [21, 34, 1], f28: [30, 46, 1], slump: [60, 120, 0], la: [18, 34, 1],
}

export const CATALOG: CatalogItem[] = Object.entries(LAB_TESTS).flatMap(([labId, tests]) => tests.map((t, i) => {
  const rt = REF_TESTS.find(x => x.id === t)!; const [p, sla] = PRICE[t]
  const incomplete = labId === 'o-lab1' && t === 'rt-sieve'; const hold = labId === 'o-lab1' && t === 'rt-consol'
  return { id: `c-${labId}-${i}`, labId, refTestId: t, unit: incomplete ? undefined : rt.units[0], methods: incomplete ? [] : rt.methods.slice(0, labId === 'o-lab1' ? 2 : 1).map(m => m.code), basePrice: incomplete ? undefined : Math.round(p * (0.9 + rnd() * 0.25) / 10) * 10, sla: incomplete ? undefined : sla, status: incomplete ? 'STS03' : hold ? 'STS02' : 'STS01' } as CatalogItem
}))

/* ── Contracts ──────────────────────────────────────────────── */
export const CONTRACTS: Contract[] = [
  { id: 'عقد-2026-014', contractorId: 'o-cont1', labId: 'o-lab1', consultantId: 'o-cons1', project: 'توسعة الطريق الدائري الشمالي — المرحلة 2', services: ['standard'], payment: 'on-completion', startedAt: ago(24 * 60), active: true },
  { id: 'عقد-2026-009', contractorId: 'o-cont1', labId: 'o-lab1', consultantId: 'o-cons1', project: 'مجمع سكني — حي الياسمين (سكني)', services: ['standard', 'geotech'], payment: 'advance', startedAt: ago(24 * 90), active: true },
  { id: 'عقد-2025-009', contractorId: 'o-cont1', labId: 'o-lab3', consultantId: 'o-cons1', project: 'محطة معالجة — حي العزيزية', services: ['standard'], payment: 'on-completion', startedAt: ago(24 * 150), active: false },
  { id: 'عقد-2025-004', contractorId: 'o-cont1', labId: 'o-lab1', consultantId: 'o-cons1', project: 'مشروع الحي السكني — المرحلة 3', services: ['standard'], payment: 'on-completion', startedAt: ago(24 * 200), active: false },
  { id: 'عقد-2026-021', contractorId: 'o-cont2', labId: 'o-lab1', consultantId: 'o-cons1', project: 'توسعة شبكة الصرف الصحي — شمال الرياض', services: ['standard'], payment: 'advance', startedAt: ago(24 * 20), active: true },
  { id: 'عقد-2026-003', contractorId: 'o-cont3', labId: 'o-lab4', consultantId: 'o-cons1', project: 'طريق جدة – مكة السريع (تأهيل)', services: ['standard'], payment: 'on-completion', startedAt: ago(24 * 180), active: true },
  { id: 'عقد-2026-007', contractorId: 'o-cont3', labId: 'o-lab1', consultantId: 'o-cons1', project: 'جسر تقاطع الأمير ماجد', services: ['standard', 'geotech'], payment: 'advance', startedAt: ago(24 * 150), active: true },
  { id: 'عقد-2026-011', contractorId: 'o-cont5', labId: 'o-lab2', consultantId: 'o-cons2', project: 'مجمع روافد السكني — النرجس', services: ['standard', 'geotech'], payment: 'advance', startedAt: ago(24 * 110), active: true },
  { id: 'عقد-2026-016', contractorId: 'o-cont5', labId: 'o-lab5', consultantId: 'o-cons2', project: 'أبراج الربوة — تقييم إنشائي', services: ['standard'], payment: 'on-completion', startedAt: ago(24 * 45), active: true },
  { id: 'عقد-2026-018', contractorId: 'o-cont4', labId: 'o-lab3', consultantId: 'o-cons3', project: 'مستودعات الدمام اللوجستية', services: ['standard'], payment: 'advance', startedAt: ago(24 * 35), active: true },
  { id: 'عقد-2026-020', contractorId: 'o-cont2', labId: 'o-lab6', consultantId: 'o-cons2', project: 'طريق بريدة – عنيزة (إعادة تأهيل)', services: ['standard'], payment: 'on-completion', startedAt: ago(24 * 25), active: true },
  { id: 'عقد-2025-088', contractorId: 'o-cont2', labId: 'o-lab1', consultantId: 'o-cons1', project: 'محطة معالجة الرياض الشرقية', services: ['standard'], payment: 'on-completion', startedAt: ago(24 * 320), active: false },
  { id: 'عقد-2025-071', contractorId: 'o-cont2', labId: 'o-lab1', consultantId: 'o-cons1', project: 'شبكة مياه حي القادسية', services: ['standard'], payment: 'advance', startedAt: ago(24 * 400), active: false },
]

/* ── Requests: hand-authored storyline ──────────────────────── */
const slots = (d0: number) => [{ date: day(d0), from: '09:00', to: '12:00' }, { date: day(d0 + 1), from: '11:00', to: '14:00' }, { date: day(d0 + 2), from: '09:00', to: '12:00' }]
const FIXED: TestRequest[] = [
  { id: 'TST-2026-047', contractId: 'عقد-2026-014', contractorId: 'o-cont1', labId: 'o-lab1', consultantId: 'o-cons1', project: 'توسعة الطريق الدائري الشمالي — المرحلة 2', city: 'الرياض', priority: 'عالية', service: 'standard', category: 'soil', status: 'STS14', createdAt: ago(24 * 6), submittedAt: ago(24 * 6), slots: slots(-4), chosenSlot: { date: day(-4), from: '09:00', to: '12:00' }, location: 'الرياض — حي النرجس، تقاطع الدائري الشمالي مع طريق الملك عبدالعزيز', notes: 'يُفضل الفترة الصباحية — الموقع مغلق مسائياً',
    tests: [
      { id: 't1', refTestId: 'rt-proctor', method: 'ASTM D1557', price: 280, sla: 3, status: 'STS20', startedAt: ago(24 * 4), submittedAt: ago(24 * 3), decidedAt: ago(24 * 3 - 4), sample: { id: 'SMP-2026-0146', depth: 1.5, technician: 'فيصل القحطاني', receivedAt: ago(24 * 4), geoVerified: true, confirmedByContractor: true }, result: { mdd: 1.82, omc: 14.3, fc: 98.5 }, report: { name: 'تقرير-الدمك-TST-2026-047.pdf', size: '1.8 MB' }, delegateId: 'u-lab-emp' },
      { id: 't2', refTestId: 'rt-cbr', method: 'ASTM D1883', price: 420, sla: 5, status: 'STS18', startedAt: ago(24 * 3), deadlineAt: isoIn(48, NOW), sample: { id: 'SMP-2026-0147', depth: 1.5, technician: 'فيصل القحطاني', receivedAt: ago(24 * 3), geoVerified: true, confirmedByContractor: true }, delegateId: 'u-lab-emp' },
      { id: 't2b', refTestId: 'rt-fdt', method: 'ASTM D1556', price: 220, sla: 1, status: 'STS19', startedAt: ago(30), submittedAt: ago(6), deadlineAt: isoIn(42, NOW), sample: { id: 'SMP-2026-0149', depth: 0.3, technician: 'فيصل القحطاني', receivedAt: ago(30), geoVerified: true, confirmedByContractor: true }, result: { dd: 1.79, rc: 97.8 }, report: { name: 'تقرير-الكثافة-الحقلية-TST-2026-047.pdf', size: '0.9 MB' }, delegateId: 'u-lab-emp' },
    ],
    history: [
      { id: 'h1', at: ago(24 * 6), actor: 'أحمد العتيبي', actorRole: 'contractor', action: 'إنشاء الطلب وإرساله' },
      { id: 'h2', at: ago(24 * 6 - 7), actor: 'محمد السبيعي', actorRole: 'lab', action: 'قبول الطلب', detail: `نطاق ${day(-4)}` },
      { id: 'h2b', at: ago(24 * 6 - 8), actor: 'محمد السبيعي', actorRole: 'lab', action: 'تفويض مباشر للموظف فيصل القحطاني', detail: 'الطلب كاملاً' },
      { id: 'h3', at: ago(24 * 4), actor: 'فيصل القحطاني', actorRole: 'lab', action: 'تسجيل استلام العينة', detail: 'SMP-2026-0146 — تحقق جغرافي مطابق (1.2 م)' },
      { id: 'h4', at: ago(24 * 4 - 1), actor: 'أحمد العتيبي', actorRole: 'contractor', action: 'تأكيد استلام العينة', detail: 'بدأ عداد SLA' },
      { id: 'h5', at: ago(24 * 3), actor: 'فيصل القحطاني', actorRole: 'lab', action: 'رفع نتيجة اختبار الدمك القياسي' },
      { id: 'h6', at: ago(24 * 3 - 4), actor: 'خالد العسيري', actorRole: 'consultant', action: 'اعتماد نتيجة اختبار الدمك القياسي' },
      { id: 'h6b', at: ago(6), actor: 'فيصل القحطاني', actorRole: 'lab', action: 'رفع نتيجة الكثافة الحقلية (المخروط الرملي)' },
    ] },
  { id: 'TST-2026-046', contractId: 'عقد-2026-009', contractorId: 'o-cont1', labId: 'o-lab1', consultantId: 'o-cons1', project: 'مجمع سكني — حي الياسمين (سكني)', city: 'الرياض', priority: 'عالية', service: 'geotech', status: 'STS14', createdAt: ago(24 * 14), submittedAt: ago(24 * 13), slots: slots(-8), chosenSlot: { date: day(-8), from: '09:00', to: '12:00' }, location: 'الرياض — حي الياسمين، قطعة 1245 مخطط 2891', studyId: 'st-046',
    tests: [{ id: 't-geo', refTestId: 'rt-geotech', method: 'SBC 303', price: 4200, sla: 21, status: 'STS18', startedAt: ago(24 * 8), deadlineAt: isoIn(24 * 12, NOW), delegateId: 'u-lab-emp' }],
    history: [
      { id: 'g1', at: ago(24 * 14), actor: 'أحمد العتيبي', actorRole: 'contractor', action: 'إنشاء الطلب وإدخال البيانات الأولية', detail: 'رفع القرار المساحي — استخراج تلقائي' },
      { id: 'g2', at: ago(24 * 13), actor: 'خالد العسيري', actorRole: 'consultant', action: 'مراجعة واعتماد البيانات الأولية' },
      { id: 'g3', at: ago(24 * 12), actor: 'خالد العسيري', actorRole: 'consultant', action: 'اعتماد خطة الاستكشاف وإرسال الطلب للمختبر', detail: '4 جسات · 15 م — SBC 303 Table 2.1' },
      { id: 'g4', at: ago(24 * 11), actor: 'محمد السبيعي', actorRole: 'lab', action: 'قبول الطلب' },
      { id: 'g5', at: ago(24 * 9), actor: 'محمد السبيعي', actorRole: 'lab', action: 'مراجعة خطة التنفيذ الميداني', detail: 'نقل BH-02 بمقدار 4 م — وجود خط مرافق' },
      { id: 'g6', at: ago(24 * 8), actor: 'فيصل القحطاني', actorRole: 'lab', action: 'بدء تنفيذ الجسة BH-01' },
      { id: 'g7', at: ago(24 * 5), actor: 'فيصل القحطاني', actorRole: 'lab', action: 'اكتمال الجسة BH-01 وتوليد سجل الجسة', detail: '15 م · 4 طبقات · 4 عينات' },
      { id: 'g8', at: ago(24 * 2), actor: 'فيصل القحطاني', actorRole: 'lab', action: 'بدء تنفيذ الجسة BH-02' },
    ] },
  { id: 'TST-2026-038', contractId: 'عقد-2026-009', contractorId: 'o-cont1', labId: 'o-lab1', consultantId: 'o-cons1', project: 'مجمع سكني — حي الياسمين (سكني)', city: 'الرياض', priority: 'عادية', service: 'geotech', status: 'STS15', createdAt: ago(24 * 62), submittedAt: ago(24 * 61), slots: slots(-56), chosenSlot: { date: day(-56), from: '08:00', to: '11:00' }, location: 'الرياض — حي الياسمين، قطعة 1188 مخطط 2891 (المرحلة الأولى)', studyId: 'st-038',
    tests: [{ id: 't-geo-38', refTestId: 'rt-geotech', method: 'SBC 303', price: 4200, sla: 21, status: 'STS20', startedAt: ago(24 * 56), submittedAt: ago(24 * 38), decidedAt: ago(24 * 36), deadlineAt: ago(24 * 35), report: { name: 'التقرير-الجيوتقني-TST-2026-038.pdf', size: '6.4 MB' }, delegateId: 'u-lab-emp' }],
    history: [
      { id: 'h38-1', at: ago(24 * 62), actor: 'أحمد العتيبي', actorRole: 'contractor', action: 'إنشاء الطلب وإدخال البيانات الأولية', detail: 'رفع القرار المساحي — استخراج تلقائي' },
      { id: 'h38-2', at: ago(24 * 61), actor: 'خالد العسيري', actorRole: 'consultant', action: 'مراجعة واعتماد البيانات الأولية' },
      { id: 'h38-3', at: ago(24 * 60), actor: 'خالد العسيري', actorRole: 'consultant', action: 'اعتماد خطة الاستكشاف وإرسال الطلب للمختبر', detail: '3 جسات · 12 م — SBC 303 Table 2.1' },
      { id: 'h38-4', at: ago(24 * 59), actor: 'محمد السبيعي', actorRole: 'lab', action: 'قبول الطلب' },
      { id: 'h38-5', at: ago(24 * 56), actor: 'فيصل القحطاني', actorRole: 'lab', action: 'بدء الأعمال الميدانية — BH-01' },
      { id: 'h38-6', at: ago(24 * 49), actor: 'فيصل القحطاني', actorRole: 'lab', action: 'اكتمال الأعمال الحقلية', detail: '3 جسات · 36 م · 9 عينات' },
      { id: 'h38-7', at: ago(24 * 42), actor: 'محمد السبيعي', actorRole: 'lab', action: 'اعتماد النتائج المعملية والكيميائية' },
      { id: 'h38-8', at: ago(24 * 39), actor: 'محمد السبيعي', actorRole: 'lab', action: 'اكتمال التحليل الهندسي وتوليد معاينة التقرير' },
      { id: 'h38-9', at: ago(24 * 38), actor: 'محمد السبيعي', actorRole: 'lab', action: 'رفع التقرير الجيوتقني للاعتماد', detail: '17 بنداً — SBC 303 §2.6' },
      { id: 'h38-10', at: ago(24 * 36), actor: 'خالد العسيري', actorRole: 'consultant', action: 'اعتماد التقرير الجيوتقني النهائي' },
    ] },
  { id: 'TST-2026-051', contractId: 'عقد-2026-021', contractorId: 'o-cont2', labId: 'o-lab1', consultantId: 'o-cons1', project: 'توسعة شبكة الصرف الصحي — شمال الرياض', city: 'الرياض', priority: 'عادية', service: 'standard', category: 'soil', status: 'STS11', createdAt: ago(2), submittedAt: ago(2), labDeadlineAt: isoIn(10, NOW), slots: slots(3), location: 'الرياض — حي الملقا، شارع أنس بن مالك', notes: 'يُفضل الفترة الصباحية',
    tests: [{ id: 't3', refTestId: 'rt-proctor', method: 'ASTM D1557', price: 280, sla: 3, status: 'STS17' }, { id: 't4', refTestId: 'rt-cbr', method: 'ASTM D1883', price: 420, sla: 5, status: 'STS17' }, { id: 't4b', refTestId: 'rt-sieve', method: 'ASTM D422', price: 180, sla: 2, status: 'STS17' }],
    history: [{ id: 'h7', at: ago(2), actor: 'ماجد العنزي', actorRole: 'contractor', action: 'إنشاء الطلب وإرساله' }] },
  { id: 'TST-2026-049', contractId: 'عقد-2026-014', contractorId: 'o-cont1', labId: 'o-lab1', consultantId: 'o-cons1', project: 'توسعة الطريق الدائري الشمالي — المرحلة 2', city: 'الرياض', priority: 'عادية', service: 'standard', category: 'soil', status: 'STS12', createdAt: ago(24 * 3), submittedAt: ago(24 * 3), slots: [{ date: day(-1), from: '09:00', to: '12:00' }, { date: day(1), from: '09:00', to: '12:00' }, { date: day(2), from: '09:00', to: '12:00' }], chosenSlot: { date: day(-1), from: '09:00', to: '12:00' }, location: 'الرياض — حي النرجس، تقاطع الدائري الشمالي مع طريق الملك عبدالعزيز — محطة 3+200', notes: 'جاهز لبدء التنفيذ — الموعد المعتمد أمس',
    tests: [{ id: 't49-1', refTestId: 'rt-fdt', method: 'ASTM D1556', price: 220, sla: 1, status: 'STS17' }, { id: 't49-2', refTestId: 'rt-mc', method: 'ASTM D2216', price: 100, sla: 1, status: 'STS17' }],
    history: [{ id: 'h49-1', at: ago(24 * 3), actor: 'أحمد العتيبي', actorRole: 'contractor', action: 'إنشاء الطلب وإرساله' }, { id: 'h49-2', at: ago(24 * 2.6), actor: 'محمد السبيعي', actorRole: 'lab', action: 'قبول الطلب', detail: `نطاق ${day(-1)}` }] },
  { id: 'TST-2026-050', contractId: 'عقد-2026-014', contractorId: 'o-cont1', labId: 'o-lab1', consultantId: 'o-cons1', project: 'توسعة الطريق الدائري الشمالي — المرحلة 2', city: 'الرياض', priority: 'عادية', service: 'standard', category: 'soil', status: 'STS11', createdAt: ago(4), submittedAt: ago(4), labDeadlineAt: isoIn(8, NOW), slots: slots(4), location: 'الرياض — حي النرجس',
    tests: [{ id: 't5', refTestId: 'rt-atterberg', method: 'ASTM D4318', price: 180, sla: 2, status: 'STS17' }, { id: 't5b', refTestId: 'rt-mc', method: 'ASTM D2216', price: 90, sla: 1, status: 'STS17' }],
    history: [{ id: 'h8', at: ago(4), actor: 'أحمد العتيبي', actorRole: 'contractor', action: 'إنشاء الطلب وإرساله' }] },
  { id: 'TST-2026-044', contractId: 'عقد-2025-004', contractorId: 'o-cont1', labId: 'o-lab1', consultantId: 'o-cons1', project: 'مشروع الحي السكني — المرحلة 3', city: 'الرياض', priority: 'عادية', service: 'standard', category: 'soil', status: 'STS15', createdAt: ago(24 * 20), submittedAt: ago(24 * 20), slots: slots(-17), chosenSlot: { date: day(-17), from: '09:00', to: '12:00' }, location: 'الرياض — حي الرمال',
    tests: [
      { id: 't6', refTestId: 'rt-proctor', method: 'ASTM D1557', price: 280, sla: 3, status: 'STS20', decidedAt: ago(24 * 14), result: { mdd: 1.79, omc: 13.8, fc: 97.2 }, report: { name: 'تقرير-الدمك-TST-2026-044.pdf', size: '1.6 MB' } },
      { id: 't7', refTestId: 'rt-cbr', method: 'ASTM D1883', price: 420, sla: 5, status: 'STS21', decidedAt: ago(24 * 13), rejectReason: 'قيمة CBR أقل من الحد الأدنى المطلوب وفق مواصفات المشروع (80%). القيمة المسجلة 72%.', result: { cbr: 72, swell: 1.2 }, report: { name: 'تقرير-CBR-TST-2026-044.pdf', size: '1.1 MB' } },
    ],
    history: [
      { id: 'h9', at: ago(24 * 20), actor: 'أحمد العتيبي', actorRole: 'contractor', action: 'إنشاء الطلب وإرساله' }, { id: 'h10', at: ago(24 * 19), actor: 'محمد السبيعي', actorRole: 'lab', action: 'قبول الطلب' },
      { id: 'h11', at: ago(24 * 14), actor: 'خالد العسيري', actorRole: 'consultant', action: 'اعتماد نتيجة اختبار الدمك' }, { id: 'h12', at: ago(24 * 13), actor: 'خالد العسيري', actorRole: 'consultant', action: 'رفض نتيجة اختبار CBR', detail: 'CBR 72% < 80%' },
      { id: 'h13', at: ago(24 * 13), actor: 'المنصة', actorRole: 'admin', action: 'اكتمال الطلب تلقائياً', detail: 'صدر قرار الاستشاري على جميع الاختبارات' },
    ] },
  { id: 'TST-2026-044-R1', contractId: 'عقد-2025-004', contractorId: 'o-cont1', labId: 'o-lab1', consultantId: 'o-cons1', project: 'مشروع الحي السكني — المرحلة 3', city: 'الرياض', priority: 'عالية', service: 'standard', category: 'soil', status: 'STS12', createdAt: ago(24 * 12), submittedAt: ago(24 * 12), slots: slots(1), chosenSlot: { date: day(1), from: '09:00', to: '12:00' }, location: 'الرياض — حي الرمال', notes: 'يرجى التأكد من سحب العينة من العمق الصحيح المحدد في المخططات (1.2 م).', parentRequestId: 'TST-2026-044', retestOf: 't7',
    tests: [{ id: 't8', refTestId: 'rt-cbr', method: 'ASTM D1883', price: 420, sla: 5, status: 'STS17' }],
    history: [{ id: 'h14', at: ago(24 * 12), actor: 'أحمد العتيبي', actorRole: 'contractor', action: 'إنشاء طلب إعادة اختبار', detail: 'مرتبط بـ TST-2026-044' }, { id: 'h15', at: ago(24 * 11), actor: 'محمد السبيعي', actorRole: 'lab', action: 'قبول طلب الإعادة' }] },
  { id: 'TST-مسودة-002', contractId: 'عقد-2026-014', contractorId: 'o-cont1', labId: 'o-lab1', consultantId: 'o-cons1', project: 'توسعة الطريق الدائري الشمالي — المرحلة 2', city: 'الرياض', priority: 'عادية', service: 'standard', category: 'soil', status: 'STS09', createdAt: ago(24), slots: [], location: 'الرياض — حي النرجس',
    tests: [{ id: 't9', refTestId: 'rt-shear', method: 'ASTM D3080', price: 350, sla: 5, status: 'STS17' }],
    history: [{ id: 'h16', at: ago(24), actor: 'أحمد العتيبي', actorRole: 'contractor', action: 'حفظ الطلب كمسودة' }] },
]

/* ── Generated volume (Oct 2025 → Sep 2026) ─────────────────── */
const LOCS: Record<string, string[]> = { 'الرياض': ['حي النرجس', 'حي الملقا', 'حي العارض', 'حي الرمال', 'حي القادسية', 'حي الياسمين', 'طريق الملك سلمان'], 'جدة': ['حي الروضة', 'حي أبحر الشمالية', 'طريق المدينة', 'حي الفيصلية', 'ذهبان'], 'الدمام': ['حي الفيصلية', 'المنطقة الصناعية الثانية', 'طريق الملك فهد'], 'مكة المكرمة': ['حي الشرائع', 'العزيزية'], 'القصيم': ['طريق بريدة – عنيزة', 'حي الصفراء'] }
const CITY_OF: Record<string, string> = { 'o-lab1': 'الرياض', 'o-lab2': 'الرياض', 'o-lab3': 'الدمام', 'o-lab4': 'جدة', 'o-lab5': 'الرياض', 'o-lab6': 'القصيم', 'o-lab7': 'مكة المكرمة' }
const ACTORS: Record<string, string> = { 'o-cont1': 'أحمد العتيبي', 'o-cont2': 'ماجد العنزي', 'o-cont3': 'طلال بن لادن', 'o-cont4': 'وليد الدوسري', 'o-cont5': 'هند الشهراني', 'o-lab1': 'محمد السبيعي', 'o-lab2': 'سعود المطيري', 'o-lab3': 'عمر الزهراني', 'o-lab4': 'بدر الحارثي', 'o-lab5': 'معاذ الجديع', 'o-lab6': 'فهد الرشيدي', 'o-lab7': 'ياسر السلمي', 'o-cons1': 'خالد العسيري', 'o-cons2': 'سامي عبدالحق', 'o-cons3': 'إبراهيم القرني' }
const gen = (): TestRequest[] => {
  const out: TestRequest[] = []
  let n = 300
  for (let i = 0; i < 44; i++) {
    const c = pick(CONTRACTS.filter(x => x.id !== 'عقد-2026-009'))
    const ageDays = i % 3 === 0 ? between(3, 14) : between(15, 330); const created = ago(24 * ageDays)
    const cat = pick<Category>(['soil', 'soil', 'soil', 'asphalt', 'concrete', 'aggregate'])
    const pool = (LAB_TESTS[c.labId] ?? []).filter(t => REF_TESTS.find(r => r.id === t)!.category === cat && t !== 'rt-geotech')
    if (!pool.length) continue
    const k = between(1, Math.min(4, pool.length)); const chosen = [...pool].sort(() => rnd() - 0.5).slice(0, k)
    const city = CITY_OF[c.labId] ?? 'الرياض'
    const outcome = rnd()
    const status: RequestStatus = ageDays > 40 ? (outcome < 0.9 ? 'STS15' : outcome < 0.95 ? 'STS16' : 'STS13') : ageDays > 14 ? (outcome < 0.7 ? 'STS15' : 'STS14') : ageDays < 0.5 ? pick<RequestStatus>(['STS11', 'STS12']) : pick<RequestStatus>(['STS14', 'STS14', 'STS12'])
    const id = `TST-${ageDays > 240 ? '2025' : '2026'}-${String(n++).padStart(3, '0')}`
    const tests: TestItem[] = chosen.map((t, j) => {
      const [p, sla] = PRICE[t]; const rt = REF_TESTS.find(x => x.id === t)!
      let ts: TestStatus = 'STS17'
      if (status === 'STS15') ts = rnd() < 0.9 ? 'STS20' : 'STS21'
      else if (status === 'STS14') ts = j === 0 ? pick<TestStatus>(['STS18', 'STS19', 'STS20']) : pick<TestStatus>(['STS20', 'STS18', 'STS19', 'STS17'])
      const auto = ts === 'STS20' && rnd() < 0.08
      const result = rt.resultFields && (ts === 'STS20' || ts === 'STS21' || ts === 'STS19') ? Object.fromEntries(rt.resultFields.map(f => { const [lo, hi, dp] = FIELD_RANGE[f.key] ?? [10, 99, 1]; return [f.key, +(lo + rnd() * (hi - lo)).toFixed(dp)] })) : undefined
      return { id: `${id}-t${j}`, refTestId: t, method: rt.methods[0].code, price: p, sla, status: ts, autoApproved: auto, startedAt: ts !== 'STS17' ? ago(24 * Math.max(1, ageDays - 2)) : undefined, submittedAt: ['STS19', 'STS20', 'STS21'].includes(ts) ? ago(24 * Math.max(0.4, ageDays - 4)) : undefined, decidedAt: ['STS20', 'STS21'].includes(ts) ? ago(24 * Math.max(0.2, ageDays - 5)) : undefined, deadlineAt: ts === 'STS19' ? isoIn(between(3, 40), NOW) : ts === 'STS18' ? isoIn(between(6, 96), NOW) : undefined, result, report: result ? { name: `تقرير-${rt.nameEn.split(' ')[0]}-${id}.pdf`, size: `${(0.6 + rnd() * 1.8).toFixed(1)} MB` } : undefined, rejectReason: ts === 'STS21' ? 'النتيجة أقل من الحد المطلوب في مواصفات المشروع' : undefined, sample: ts !== 'STS17' ? { id: `SMP-2026-0${between(100, 999)}`, depth: +(0.3 + rnd() * 2).toFixed(1), technician: pick(['فيصل القحطاني', 'نواف الشمري', 'عبدالرحمن الزهراني', 'حسن العمري']), receivedAt: ago(24 * Math.max(1, ageDays - 2)), geoVerified: rnd() > 0.05, confirmedByContractor: true } : undefined }
    })
    const hist: AuditEntry[] = [{ id: `${id}-h1`, at: created, actor: ACTORS[c.contractorId], actorRole: 'contractor', action: 'إنشاء الطلب وإرساله' }]
    if (status !== 'STS11') hist.push({ id: `${id}-h2`, at: ago(24 * ageDays - 5), actor: ACTORS[c.labId], actorRole: 'lab' as const, action: status === 'STS13' ? 'رفض الطلب' : 'قبول الطلب' })
    if (status === 'STS15') hist.push({ id: `${id}-h3`, at: ago(24 * (ageDays - 5)), actor: 'المنصة', actorRole: 'admin' as const, action: 'اكتمال الطلب تلقائياً' })
    if (status === 'STS16') hist.push({ id: `${id}-h4`, at: ago(24 * ageDays - 3), actor: ACTORS[c.contractorId], actorRole: 'contractor' as const, action: 'إلغاء الطلب' })
    out.push({ id, contractId: c.id, contractorId: c.contractorId, labId: c.labId, consultantId: c.consultantId, project: c.project, city, priority: pick(['عادية', 'عادية', 'عادية', 'عالية', 'حرجة']), service: 'standard', category: cat, status, createdAt: created, submittedAt: created, labDeadlineAt: status === 'STS11' ? new Date(new Date(created).getTime() + LAB_DECISION_HOURS * 36e5).toISOString() : undefined, slots: slots(-ageDays + 3), chosenSlot: status !== 'STS11' && status !== 'STS13' ? { date: day(-ageDays + 3), from: '09:00', to: '12:00' } : undefined, location: `${city} — ${pick(LOCS[city])}`, tests, history: hist, rejectReason: status === 'STS13' ? 'تعارض المواعيد المقترحة مع جدول الفرق الميدانية' : undefined })
  }
  return out
}
export const REQUESTS: TestRequest[] = [...FIXED, ...gen()].map(r => r.status === 'STS09' ? r : { ...r, rules: r.rules ?? RULES_AT_SUBMIT })

/* ── Geotechnical study (linked to TST-2026-046) ─────────────── */
const mkSample = (id: string, layerId: string, kind: 'soil' | 'rock', from: number, to: number, uscs: any, done = false): any => ({
  id, layerId, kind, type: kind === 'rock' ? 'CS' : 'SPT', from, to, fieldUSCS: uscs, labUSCS: done ? uscs : undefined, labStatus: done ? 'done' : 'ready',
  tests: kind === 'rock'
    ? [{ id: `${id}-ucs`, name: 'الضغط غير المحصور (UCS)', method: 'ASTM D7012', mandatory: true, unit: 'MPa', value: done ? '1.4' : undefined, attachment: done ? `ucs-${id}.pdf` : undefined }]
    : [{ id: `${id}-sieve`, name: 'التحليل الحبيبي', method: 'ASTM D422', mandatory: true, attachment: done ? `sieve-${id}.pdf` : undefined, value: done ? 'مار من 200: 25%' : undefined }, { id: `${id}-att`, name: 'حدود أتربرج', method: 'ASTM D4318', mandatory: true, attachment: done ? `att-${id}.pdf` : undefined, value: done ? 'LL 28 / PL 19 / PI 9' : undefined }, { id: `${id}-mc`, name: 'معامل الرطوبة', method: 'ASTM D2216', mandatory: true, unit: '%', value: done ? '14.3' : undefined }, { id: `${id}-uscs`, name: 'التصنيف المعملي النهائي (USCS)', method: 'ASTM D2487', mandatory: true, unit: 'رمز', value: done ? uscs : undefined }],
})
const layersFor = (bh: number, depthDone: number): any[] => [
  { id: `L-${bh}1`, from: 0, to: 3, uscs: 'SM', gradation: 'ناعم إلى متوسط', color: 'بني فاتح', moisture: 'رطبة قليلاً', description: 'رمل طمي، بني فاتح، رطبة قليلاً', spt: [5, 6, 8], n: 14, rec: 90 },
  { id: `L-${bh}2`, from: 3, to: 6, uscs: 'SC', gradation: 'متوسط', color: 'بني', moisture: 'رطبة', description: 'رمل طيني، بني، رطبة', spt: [6, 8, 9], n: 17, rec: 88 },
  { id: `L-${bh}3`, from: 6, to: 9, uscs: 'SM', gradation: 'ناعم إلى متوسط', color: 'بني فاتح', moisture: 'رطبة', description: 'رمل طمي، بني فاتح، رطبة', spt: [6, 9, 11], n: 20, rec: 92 },
  { id: `L-${bh}4`, from: 9, to: 15, uscs: 'ROCK', color: 'رمادي', description: 'صخر رملي متماسك', rec: 92 },
].filter(l => l.from < depthDone).map(l => ({ ...l, to: Math.min(l.to, depthDone) }))

export const STUDIES: Study[] = [{
  id: 'st-046', requestId: 'TST-2026-046', ref: 'TST-2026-046/GT-01', phase: 3,
  prelim: { deedFile: 'قرار-مساحي-قطعة-1245.pdf', parcel: '1245', plan: '2891', district: 'الياسمين', city: 'الرياض', region: 'منطقة الرياض', deedNo: '410312007891', deedDate: '14/03/1446', area: 625, computedArea: 625.4, boundaryOk: true, owner: 'عبدالله بن محمد القحطاني', ownerId: '1023456789', buildingType: 'residential', structure: 'rc', floors: 4, builtArea: 480, foundationType: 'unknown', foundationDepth: 3.0, priorInfo: false, neighbors: true, siteConditions: ['قرب طريق رئيسي', 'أرض مستوية'], approvedByConsultant: true },
  polygon: [{ n: 24.82320, e: 46.63950 }, { n: 24.82320, e: 46.64050 }, { n: 24.82220, e: 46.64050 }, { n: 24.82220, e: 46.63950 }],
  plan: { engineSuggestion: { count: 4, depth: 15, spacing: 22, special: false, ref: 'SBC 303 — الفصل الثاني (Geotechnical Investigations)، Table 2.1', basis: ['الصف المطبّق: 3–4 أدوار، مساحة مبنية < 600 م²', 'المساحة المبنية: 480 م² · عدد الأدوار: 4', 'عمق الكود: ⅔ الجسات ≥ 6 م و ⅓ ≥ 9 م من قاع الأساس (عمق التأسيس 3 م)', 'سياسة المنصة: حد أدنى 10 م (قابل للتهيئة — ليس نصاً في الكود)', 'التوزيع: تغطية متوازنة لكامل القطعة بمسافات متساوية'] }, approved: true, approvedAt: ago(24 * 12) },
  fieldPlanReviewed: true, compliance: 92,
  boreholes: [
    { id: 'bh1', code: 'BH-01', approved: { n: 24.82280, e: 46.63980 }, operational: { n: 24.82280, e: 46.63980 }, actual: { n: 24.82281, e: 46.63981 }, approvedDepth: 15, executedDepth: 15, status: 'done', geoVerified: { distance: 1.2 }, head: { method: 'حفر دوراني رطب (Rotary Wash)', rig: 'CME-75', diameter: 100, casing: 3.0, groundLevel: 4.85, waterInstant: 8.2, water24h: 7.9, date: ago(24 * 8), weather: 'صافٍ', technician: 'فيصل القحطاني' }, layers: layersFor(1, 15), samples: [mkSample('S-1', 'L-11', 'soil', 2.0, 2.45, 'SM', true), mkSample('S-2', 'L-12', 'soil', 5.0, 5.45, 'SC', true), mkSample('S-3', 'L-13', 'soil', 8.0, 8.45, 'SM'), mkSample('C-1', 'L-14', 'rock', 12.0, 12.5, 'ROCK')], photos: ['bh1-1.jpg', 'bh1-2.jpg', 'bh1-3.jpg'] },
    { id: 'bh2', code: 'BH-02', approved: { n: 24.82290, e: 46.64010 }, operational: { n: 24.82294, e: 46.64013 }, actual: { n: 24.82294, e: 46.64013 }, approvedDepth: 15, executedDepth: 9, status: 'in-progress', moved: 4, geoVerified: { distance: 1.2 }, head: { method: 'حفر دوراني رطب (Rotary Wash)', rig: 'CME-75', diameter: 100, casing: 3.0, groundLevel: 4.85, waterInstant: 8.2, water24h: 7.9, technician: 'فيصل القحطاني', date: ago(24 * 2) }, layers: layersFor(2, 9), samples: [mkSample('S-5', 'L-21', 'soil', 2.0, 2.45, 'SM'), mkSample('S-6', 'L-22', 'soil', 5.0, 5.45, 'SC')], photos: ['bh2-1.jpg'] },
    { id: 'bh3', code: 'BH-03', approved: { n: 24.82260, e: 46.63990 }, operational: { n: 24.82260, e: 46.63990 }, approvedDepth: 15, status: 'ready', layers: [], samples: [], photos: [] },
    { id: 'bh4', code: 'BH-04', approved: { n: 24.82240, e: 46.63970 }, operational: { n: 24.82240, e: 46.63970 }, approvedDepth: 15, status: 'ready', layers: [], samples: [], photos: [] },
  ],
  chemical: { engineSuggestedSampleId: 'S-2', results: [
    { id: 'ch-ph', name: 'درجة الحموضة pH', method: 'ASTM D4972', mandatory: true, limit: '6 – 9', unit: '' }, { id: 'ch-so4', name: 'كبريتات SO₄', method: 'BS 1377-3', mandatory: true, limit: '< 0.2%', unit: '%' }, { id: 'ch-cl', name: 'كلوريد Cl⁻', method: 'BS 1377-3', mandatory: true, limit: '< 0.05%', unit: '%' }, { id: 'ch-carb', name: 'كربونات', method: 'ASTM D4373', mandatory: true, limit: '< 5%', unit: '%' }, { id: 'ch-org', name: 'مواد عضوية', method: 'ASTM D2974', mandatory: true, limit: '< 3%', unit: '%' },
  ] },
  analysis: { computed: {
    bearing: { unit: 'kN/m²', formula: 'q_net = c·Nc·sc + q·(Nq−1) + 0.5·γ·B·Nγ·sγ ÷ FS', inputs: { 'زاوية الاحتكاك φ': '', 'عامل الأمان FS': '3', 'عرض القاعدة B': '' } },
    settlement: { unit: 'mm', formula: 'S = Σ (Δσ · H) / Es', inputs: { 'معامل الانضغاط': '', 'الحمل الإنشائي': '' } },
    ks: { unit: 'kN/m³', formula: 'ks = q_all / δ_all', inputs: { 'عرض القاعدة الافتراضي': '' } },
    lateral: { unit: '—', formula: 'Ka = tan²(45−φ/2), Kp = tan²(45+φ/2), K0 = 1−sinφ', inputs: { 'زاوية الاحتكاك φ': '' } },
  }, analytical: {}, recommendations: {}, manual: {}, attachments: [] },
}, {
  id: 'st-038', requestId: 'TST-2026-038', ref: 'TST-2026-038/GT-01', phase: 6,
  prelim: { deedFile: 'قرار-مساحي-قطعة-1188.pdf', parcel: '1188', plan: '2891', district: 'الياسمين', city: 'الرياض', region: 'منطقة الرياض', deedNo: '410312006644', deedDate: '02/01/1446', area: 900, computedArea: 899.6, boundaryOk: true, owner: 'شركة الإنشاءات المتكاملة', ownerId: '7001234567', buildingType: 'residential', structure: 'rc', floors: 3, builtArea: 540, foundationType: 'unknown', foundationDepth: 2.5, priorInfo: false, neighbors: true, siteConditions: ['أرض مستوية', 'شبكة مرافق قائمة'], approvedByConsultant: true, reviewNotes: 'البيانات مكتملة — لا ملاحظات.' },
  polygon: [{ n: 24.82620, e: 46.64300 }, { n: 24.82620, e: 46.64420 }, { n: 24.82520, e: 46.64420 }, { n: 24.82520, e: 46.64300 }],
  plan: { engineSuggestion: { count: 3, depth: 12, spacing: 25, special: false, ref: 'SBC 303 — الفصل الثاني (Geotechnical Investigations)، Table 2.1', basis: ['الصف المطبّق: 3–4 أدوار، مساحة مبنية < 600 م²', 'المساحة المبنية: 540 م² · عدد الأدوار: 3', 'عمق الكود: ⅔ الجسات ≥ 6 م و ⅓ ≥ 9 م من قاع الأساس (عمق التأسيس 2.5 م)', 'سياسة المنصة: حد أدنى 10 م', 'التوزيع: مثلث متوازن يغطي القطعة'] }, approved: true, approvedAt: ago(24 * 60) },
  fieldPlanReviewed: true, fieldApproved: true, compliance: 100,
  boreholes: [1, 2, 3].map(i => ({ id: `bh38-${i}`, code: `BH-0${i}`, approved: { n: 24.7147 - i * 0.0002, e: 46.6773 + i * 0.0003 }, operational: { n: 24.7147 - i * 0.0002, e: 46.6773 + i * 0.0003 }, actual: { n: 24.7147 - i * 0.0002 + 0.00001, e: 46.6773 + i * 0.0003 }, approvedDepth: 12, executedDepth: 12, status: 'done' as const, geoVerified: { distance: 0.8 + i * 0.3 }, head: { method: 'حفر دوراني رطب (Rotary Wash)', rig: 'CME-55', diameter: 100, casing: 3.0, groundLevel: 5.1, waterInstant: 9.4, water24h: 9.1, date: ago(24 * (57 - i * 2)), weather: 'صافٍ', technician: 'فيصل القحطاني' }, layers: layersFor(i + 4, 12), samples: [mkSample(`S-${i}1`, `L-${i + 4}1`, 'soil', 1.5, 1.95, 'SM', true), mkSample(`S-${i}2`, `L-${i + 4}2`, 'soil', 4.5, 4.95, 'SC', true), mkSample(`C-${i}1`, `L-${i + 4}4`, 'rock', 10.0, 10.5, 'ROCK', true)], photos: [`bh38-${i}-1.jpg`, `bh38-${i}-2.jpg`] })),
  chemical: { engineSuggestedSampleId: 'S-12', sampleId: 'S-12', done: true, results: [
    { id: 'ch-ph', name: 'درجة الحموضة pH', method: 'ASTM D4972', mandatory: true, limit: '6 – 9', unit: '', value: '7.8' }, { id: 'ch-so4', name: 'كبريتات SO₄', method: 'BS 1377-3', mandatory: true, limit: '< 0.2%', unit: '%', value: '0.31' }, { id: 'ch-cl', name: 'كلوريد Cl⁻', method: 'BS 1377-3', mandatory: true, limit: '< 0.05%', unit: '%', value: '0.04' }, { id: 'ch-carb', name: 'كربونات', method: 'ASTM D4373', mandatory: true, limit: '< 5%', unit: '%', value: '3.2' }, { id: 'ch-org', name: 'مواد عضوية', method: 'ASTM D2974', mandatory: true, limit: '< 3%', unit: '%', value: '0.6' },
  ] },
  analysis: { done: true, computed: {
    bearing: { unit: 'kN/m²', formula: 'q_net = c·Nc·sc + q·(Nq−1) + 0.5·γ·B·Nγ·sγ ÷ FS', inputs: { 'زاوية الاحتكاك φ': '31', 'عامل الأمان FS': '3', 'عرض القاعدة B': '2' }, value: '196' },
    settlement: { unit: 'mm', formula: 'S = Σ (Δσ · H) / Es', inputs: { 'معامل الانضغاط': '25', 'الحمل الإنشائي': '150' }, value: '18' },
    ks: { unit: 'kN/m³', formula: 'ks = q_all / δ_all', inputs: { 'عرض القاعدة الافتراضي': '2' }, value: '7400' },
    lateral: { unit: '—', formula: 'Ka = tan²(45−φ/2), Kp = tan²(45+φ/2), K0 = 1−sinφ', inputs: { 'زاوية الاحتكاك φ': '31' }, value: '0.32 / 3.12 / 0.48' },
  }, analytical: { 'التصنيف الزلزالي للتربة (Site Class)': 'D', 'N̄ (متوسط SPT في أعلى 30 م)': '17', 'Ss': '0.85 g', 'S1': '0.32 g', 'Fa': '1.2', 'Fv': '1.8', 'Vs30 (مقدّر)': '210 m/s', 'PGA': '0.24 g', 'التكوين الجيولوجي': 'رواسب رملية طينية فوق صخر رملي', 'المرجع': 'SBC 301-2018 — الفصل 20 (تصنيف الموقع من N̄)، الفصل 22 (خرائط Ss/S1/PGA)، §11.4 (Fa/Fv)' },
  recommendations: { 'نوع الأساس الموصى به': 'لبشة خرسانية', 'عمق التأسيس الموصى به': '3 م', 'قدرة التحمل المسموح بها': '196 kN/m²', 'الهبوط المسموح به': '25 mm', 'نوع الأسمنت': 'Type V (مقاوم للكبريتات)', 'نوع حديد التسليح': 'عادي', 'توصيات المياه الجوفية': 'عزل مائي إلزامي', 'توصيات الصرف السطحي': 'نظام صرف دائم', 'الحد الأدنى للمحتوى الأسمنتي': '370 kg/m³', 'الحد الأدنى للغطاء الخرساني': '75 mm (SBC 304)', 'المرجع': 'قاعدة المعرفة v1.2 — SBC 303 الفصل 4، SBC 304 (حماية الخرسانة)' },
  manual: { 'تكهفات': 'غير موجودة', 'الميل': '1:1', 'الردم': 'صالحة جزئياً' }, attachments: ['calc-bearing-038.xlsx', 'seismic-038.pdf'] },
  report: { previewed: true, approved: true, approvedAt: ago(24 * 36), generatedFile: 'التقرير-الجيوتقني-TST-2026-038.pdf' },
}]

/* ── Delegations, ratings, rules, notifications ─────────────── */
export const DELEGATIONS: Delegation[] = [
  { id: 'd1', type: 'direct', scope: 'request', requestId: 'TST-2026-047', fromUserId: 'u-lab', toUserId: 'u-lab-emp', status: 'STS23', createdAt: ago(24 * 6) },
  { id: 'd2', type: 'direct', scope: 'request', requestId: 'TST-2026-046', fromUserId: 'u-lab', toUserId: 'u-lab-emp', status: 'STS23', createdAt: ago(24 * 11) },
  { id: 'd3', type: 'indirect', scope: 'test', requestId: 'TST-2026-047', testId: 't2', fromUserId: 'u-lab-emp', toUserId: 'u-lab-emp2', status: 'STS22', createdAt: ago(5) },
  { id: 'd4', type: 'direct', scope: 'request', requestId: 'TST-2026-044', fromUserId: 'u-lab', toUserId: 'u-lab-emp3', status: 'STS23', createdAt: ago(24 * 19) },
  { id: 'd5', type: 'direct', scope: 'request', requestId: 'TST-2026-044-R1', fromUserId: 'u-lab', toUserId: 'u-lab-emp3', status: 'STS23', createdAt: ago(24 * 11) },
  { id: 'd6', type: 'indirect', scope: 'request', requestId: 'TST-2026-044', fromUserId: 'u-lab-emp3', toUserId: 'u-lab-emp2', status: 'STS24', createdAt: ago(24 * 18), decidedAt: ago(24 * 17) },
  { id: 'd7', type: 'direct', scope: 'test', requestId: 'TST-2026-047', testId: 't1', fromUserId: 'u-lab', toUserId: 'u-lab-emp2', status: 'STS25', createdAt: ago(24 * 6), decidedAt: ago(24 * 5) },
  // Consultant office: the principal delegates review of specific outputs / the running study to an engineer
  { id: 'd8', type: 'direct', scope: 'test', requestId: 'TST-2026-047', testId: 't2b', fromUserId: 'u-cons', toUserId: 'u-cons-emp', status: 'STS23', createdAt: ago(5) },
  { id: 'd9', type: 'direct', scope: 'request', requestId: 'TST-2026-046', fromUserId: 'u-cons', toUserId: 'u-cons-emp', status: 'STS23', createdAt: ago(24 * 12) },
  { id: 'd10', type: 'indirect', scope: 'request', requestId: 'TST-2026-038', fromUserId: 'u-cons', toUserId: 'u-cons-emp', status: 'STS24', createdAt: ago(24 * 58), decidedAt: ago(24 * 57) },
]
const RATING_COMMENTS = ['التزام تام بالمواعيد ونتائج دقيقة.', 'التقارير واضحة ومفصّلة، تأخر بسيط في التسليم.', 'فريق ميداني محترف.', 'تحتاج سرعة أكبر في الرد على الطلبات.', 'نتائج متسقة مع اختبارات مختبر آخر.', 'الأسعار مناسبة والجودة جيدة.', 'تأخير في رفع النتائج لاعتماد الاستشاري.', 'خدمة ممتازة في الدراسة الجيوتقنية.']
/* Ratings — generated per lab so that count == org.reviews and the mean == org.rating (B.R.129 consistency) */
export const RATINGS: Rating[] = ORGS.filter(o => o.type === 'lab').flatMap(o => Array.from({ length: o.reviews }, (_, i) => {
  const target = o.rating; const jitter = (rnd() - 0.5) * 1.6
  const q = Math.max(1, Math.min(5, Math.round(target + jitter))), pnc = Math.max(1, Math.min(5, Math.round(target - jitter))), cm = Math.max(1, Math.min(5, Math.round(target + (rnd() - 0.5))))
  return { id: `r-${o.id}-${i + 1}`, contractId: `عقد-2025-${String(100 + i + ORGS.indexOf(o) * 40).padStart(3, '0')}`, labId: o.id, contractorId: pick(['o-cont1', 'o-cont2', 'o-cont3', 'o-cont4', 'o-cont5']), quality: q, punctuality: pnc, communication: cm, comment: pick(RATING_COMMENTS), createdAt: ago(24 * between(5, 300)), status: (i === 7 ? 'STS07' : 'STS06') as Rating['status'] }
}))
RATINGS.unshift({ id: 'r1', contractId: 'عقد-2025-004', labId: 'o-lab1', contractorId: 'o-cont1', quality: 5, punctuality: 5, communication: 4, comment: 'مختبر ممتاز، التزام تام بالمواعيد ونتائج دقيقة.', createdAt: ago(24 * 10), status: 'STS06' })

ORGS.filter(o => o.type === 'lab').forEach(o => { const rs = RATINGS.filter(r => r.labId === o.id && r.status === 'STS06'); if (rs.length) { o.rating = Math.round(rs.reduce((a, r) => a + (r.quality + r.punctuality + r.communication) / 3, 0) / rs.length * 10) / 10; o.reviews = rs.length } })

export const RULES: BusinessRules = { maxTestsPerRequest: 10, proposedSlots: 3, minLeadHours: 48, labDecisionHours: 12, consultantDecisionHours: 48, minBoreholeDepth: 10, geofenceMeters: 3, vat: 15, labTimeoutAction: 'expire', enginePolicy: 'screen-then-cloud' }

export const NOTIFICATIONS: Notification[] = [
  { id: 'n1', at: ago(1), title: 'طلب جديد بانتظار قرارك', body: 'TST-2026-051 — توسعة شبكة الصرف. متبقٍ 10 ساعات.', read: false, forRole: 'lab', link: '/requests/TST-2026-051', tone: 'warn' },
  { id: 'n1b', at: ago(3), title: 'طلب جديد بانتظار قرارك', body: 'TST-2026-050 — الدائري الشمالي. متبقٍ 8 ساعات.', read: false, forRole: 'lab', link: '/requests/TST-2026-050', tone: 'warn' },
  { id: 'n2', at: ago(5), title: 'تفويض بانتظار قبولك', body: 'فيصل القحطاني فوّض نواف الشمري على اختبار CBR في TST-2026-047.', read: false, forRole: 'lab', link: '/delegations', tone: 'info' },
  { id: 'n2b', at: ago(26), title: 'اقتراب انتهاء SLA', body: 'اختبار CBR — TST-2026-047 متبقٍ 48 ساعة.', read: true, forRole: 'lab', link: '/requests/TST-2026-047', tone: 'warn' },
  { id: 'n3', at: ago(24 * 3 - 4), title: 'اعتُمدت نتيجة اختبار الدمك', body: 'TST-2026-047 — المكتب الاستشاري اعتمد المخرج.', read: true, forRole: 'contractor', link: '/requests/TST-2026-047', tone: 'ok' },
  { id: 'n3b', at: ago(24 * 4 - 1), title: 'تأكيد استلام العينة مطلوب', body: 'TST-2026-047 — سجّل المختبر استلام عينة SMP-2026-0146.', read: true, forRole: 'contractor', link: '/requests/TST-2026-047', tone: 'warn' },
  { id: 'n4', at: ago(24 * 13), title: 'رُفضت نتيجة اختبار CBR', body: 'TST-2026-044 — يمكنك إنشاء طلب إعادة اختبار.', read: true, forRole: 'contractor', link: '/requests/TST-2026-044', tone: 'danger' },
  { id: 'n4b', at: ago(24 * 5), title: 'اكتملت الجسة BH-01', body: 'TST-2026-046 — تولّد سجل الجسة تلقائياً.', read: false, forRole: 'contractor', link: '/requests/TST-2026-046/study', tone: 'ok' },
  { id: 'n5', at: ago(6), title: 'نتيجة بانتظار اعتمادك', body: 'TST-2026-047 — الكثافة الحقلية. تُعتمد تلقائياً خلال 42 ساعة.', read: false, forRole: 'consultant', link: '/requests/TST-2026-047/tests/t2b/review', tone: 'warn' },
  { id: 'n5b', at: ago(24 * 2), title: 'بدأت الجسة BH-02', body: 'TST-2026-046 — نُقلت 4 م عن الموقع المعتمد بمبرر.', read: true, forRole: 'consultant', link: '/requests/TST-2026-046/study', tone: 'info' },
  { id: 'n6', at: ago(2), title: 'طلب تسجيل جديد', body: 'مختبر النخبة للفحص الهندسي — بانتظار التحقق.', read: false, forRole: 'support', link: '/admin/accounts', tone: 'info' },
  { id: 'n6b', at: ago(2), title: 'طلب تسجيل جديد', body: 'مختبر النخبة للفحص الهندسي — بانتظار التحقق.', read: false, forRole: 'admin', link: '/admin/accounts', tone: 'info' },
  { id: 'n7', at: ago(8), title: 'اعتماد تلقائي', body: 'مخرج TST-2026-318 اعتُمد تلقائياً بعد انتهاء مهلة الاستشاري.', read: false, forRole: 'supervisor', link: '/governance', tone: 'warn' },
  { id: 'n7b', at: ago(30), title: 'مختبر تجاوز SLA', body: 'مختبر الخليج للفحص — 3 اختبارات متأخرة هذا الأسبوع.', read: false, forRole: 'supervisor', link: '/reports', tone: 'danger' },
  { id: 'n8', at: ago(10), title: 'انتهاء اعتماد SAAC قريباً', body: 'مختبر الجودة الشاملة — ينتهي 31 ديسمبر 2026.', read: false, forRole: 'admin', link: '/admin/accounts', tone: 'warn' },
]

/* ── Governance: audit, documents, invoices, policies ───────── */
const IPS = ['10.20.4.', '10.20.7.', '172.16.9.', '192.168.30.']
const AUDIT_ACTIONS: [string, string, AuditEvent['severity'], Role[]][] = [
  ['تسجيل دخول', 'session', 'info', ['contractor', 'lab', 'consultant', 'supervisor', 'admin', 'support']],
  ['إنشاء طلب اختبار', 'request', 'info', ['contractor']], ['قبول طلب', 'request', 'info', ['lab']], ['رفض طلب', 'request', 'notice', ['lab']],
  ['رفع مخرج اختبار', 'test', 'info', ['lab']], ['اعتماد مخرج', 'test', 'notice', ['consultant']], ['رفض مخرج', 'test', 'warning', ['consultant']], ['اعتماد تلقائي بعد المهلة', 'test', 'warning', ['admin']],
  ['تعديل قاعدة أعمال', 'settings', 'critical', ['admin']], ['تعديل سعر أساسي', 'catalog', 'notice', ['lab']], ['إنشاء تفويض', 'delegation', 'info', ['lab', 'consultant']],
  ['إخفاء تقييم', 'rating', 'warning', ['support', 'admin']], ['تفعيل منشأة', 'account', 'notice', ['support']], ['تسجيل جسة خارج النطاق', 'borehole', 'warning', ['lab']],
  ['تصدير بيانات', 'export', 'notice', ['supervisor', 'admin']], ['محاولة وصول مرفوضة', 'auth', 'critical', ['contractor', 'lab', 'consultant', 'support']], ['تحديث قاعدة المعرفة', 'knowledge', 'critical', ['admin']],
]
export const AUDIT: AuditEvent[] = Array.from({ length: 96 }, (_, i) => {
  const [action, entity, severity, roles] = pick(AUDIT_ACTIONS); const u = action === 'اعتماد تلقائي بعد المهلة' ? { name: 'النظام (مهلة 48 س)', role: 'admin' as Role, orgName: 'منصة معيار' } : pick(USERS.filter(x => roles.includes(x.role)))
  return { id: `A-${String(9000 + i).padStart(5, '0')}`, at: ago(between(0, 24 * 40) + rnd()), actor: u.name, role: u.role, org: u.orgName, action, entity, entityId: entity === 'request' || entity === 'test' || entity === 'export' ? (pick(REQUESTS.filter(r => r.status !== 'STS09' && (u.role === 'lab' ? r.labId === (u as User).orgId : u.role === 'contractor' ? r.contractorId === (u as User).orgId : u.role === 'consultant' ? r.consultantId === (u as User).orgId : true))) ?? pick(REQUESTS)).id : entity === 'settings' ? pick(['labDecisionHours', 'consultantApprovalHours', 'minBoreholeDepth']) : entity === 'account' ? pick(ORGS).name : entity === 'delegation' ? pick(DELEGATIONS).id : entity === 'catalog' ? pick(REF_TESTS).nameAr : entity === 'borehole' ? pick(['BH-01', 'BH-02', 'BH-03', 'BH-04']) : entity === 'rating' ? pick(RATINGS).id : entity === 'knowledge' ? pick(['SBC 303 §2.4', 'SBC 301 §20.3', 'ASTM D1586']) : entity === 'session' ? u.orgName : pick(IPS) + between(2, 250), ip: `${pick(IPS)}${between(2, 250)}`, severity, detail: severity === 'critical' ? 'يتطلب مراجعة' : undefined }
}).sort((a, b) => b.at.localeCompare(a.at))

export const DOCUMENTS: Document[] = ([
  ...REQUESTS.flatMap(r => r.tests.filter(t => t.report).map(t => ({ id: `DOC-${r.id}-${t.id}`, name: t.report!.name, type: 'test-result' as const, requestId: r.id, contractId: r.contractId, orgId: r.labId, size: t.report!.size, at: t.submittedAt ?? r.createdAt, version: 1, hash: `sha256:${Math.floor(rnd() * 1e15).toString(16).padStart(12, '0')}…`, retentionUntil: '2036-09-13', classification: 'داخلي' as const }))),
  { id: 'DOC-GT-038', name: 'التقرير الجيوتقني النهائي — TST-2026-038.pdf', type: 'report', requestId: 'TST-2026-038', contractId: 'عقد-2026-009', orgId: 'o-lab1', size: '6.4 MB', at: ago(24 * 36), version: 1, hash: 'sha256:4c1e9a77b2d0…', retentionUntil: '2046-09-13', classification: 'عام' },
  ...[1, 2, 3].map(i => ({ id: `DOC-BH38-${i}`, name: `سجل الجسة BH-0${i} — TST-2026-038.pdf`, type: 'borehole-log' as const, requestId: 'TST-2026-038', contractId: 'عقد-2026-009', orgId: 'o-lab1', size: '0.5 MB', at: ago(24 * (55 - i * 2)), version: 1, hash: `sha256:7b${i}e2a9c01f…`, retentionUntil: '2036-09-13', classification: 'داخلي' as const })),
  { id: 'DOC-DEED-1188', name: 'قرار-مساحي-قطعة-1188.pdf', type: 'deed', requestId: 'TST-2026-038', contractId: 'عقد-2026-009', orgId: 'o-cont1', size: '1.9 MB', at: ago(24 * 62), version: 1, hash: 'sha256:0a9d4e7cc1…', retentionUntil: '2036-09-13', classification: 'سري' },
  { id: 'DOC-BH-01', name: 'سجل الجسة BH-01 — TST-2026-046.pdf', type: 'borehole-log', requestId: 'TST-2026-046', contractId: 'عقد-2026-009', orgId: 'o-lab1', size: '0.4 MB', at: ago(24 * 5), version: 2, hash: 'sha256:9f2a71c0d3e4…', retentionUntil: '2036-09-13', classification: 'داخلي' },
  { id: 'DOC-DEED-1245', name: 'قرار-مساحي-قطعة-1245.pdf', type: 'deed', requestId: 'TST-2026-046', contractId: 'عقد-2026-009', orgId: 'o-cont1', size: '2.1 MB', at: ago(24 * 14), version: 1, hash: 'sha256:11be7c5aa9…', retentionUntil: '2036-09-13', classification: 'سري' },
  { id: 'DOC-CERT-004', name: 'شهادة إتمام الاختبارات — عقد-2025-004.pdf', type: 'certificate', contractId: 'عقد-2025-004', orgId: 'o-cont1', size: '0.3 MB', at: ago(24 * 10), version: 1, hash: 'sha256:7d0c22e1f0…', retentionUntil: '2046-09-13', classification: 'عام' },
  ...CONTRACTS.map(c => ({ id: `DOC-CNT-${c.id}`, name: `العقد الإلكتروني ${c.id}.pdf`, type: 'contract' as const, contractId: c.id, orgId: c.contractorId, size: '0.8 MB', at: c.startedAt, version: 1, hash: `sha256:${Math.floor(rnd() * 1e15).toString(16)}…`, retentionUntil: '2046-09-13', classification: 'سري' as const })),
  ...Array.from({ length: 14 }, (_, i) => ({ id: `DOC-PH-${i}`, name: `صورة-جسة-BH-0${(i % 2) + 1}-${i + 1}.jpg`, type: 'photo' as const, requestId: 'TST-2026-046', contractId: 'عقد-2026-009', orgId: 'o-lab1', size: `${(1.2 + rnd() * 2).toFixed(1)} MB`, at: ago(24 * between(2, 8)), version: 1, hash: `sha256:${Math.floor(rnd() * 1e15).toString(16)}…`, retentionUntil: '2036-09-13', classification: 'داخلي' as const })),
] as Document[]).sort((a, b) => b.at.localeCompare(a.at))

export const INVOICES: Invoice[] = REQUESTS.filter(r => r.status === 'STS15' || r.status === 'STS14' || r.status === 'STS12').map((r, i) => {
  const amount = r.tests.reduce((a, t) => a + t.price, 0); const vat = Math.round(amount * 0.15)
  const ageDays = (NOW - new Date(r.createdAt).getTime()) / 864e5
  const status: Invoice['status'] = r.status === 'STS15' ? (ageDays <= 30 ? (i % 3 === 0 ? 'paid' : 'due') : ageDays > 75 && i % 4 === 1 ? 'overdue' : rnd() < 0.8 ? 'paid' : 'overdue') : r.status === 'STS14' && i % 2 === 0 ? 'due' : 'draft'
  return { id: `INV-2026-${String(1200 + i).padStart(4, '0')}`, contractId: r.contractId, requestId: r.id, contractorId: r.contractorId, labId: r.labId, amount, vat, status, issuedAt: r.submittedAt ?? r.createdAt, dueAt: new Date(new Date(r.createdAt).getTime() + 30 * 864e5).toISOString(), paidAt: status === 'paid' ? new Date(new Date(r.createdAt).getTime() + between(5, 28) * 864e5).toISOString() : undefined }
})

export const POLICIES: Policy[] = [
  { id: 'P-01', title: 'مهل القرار والاعتماد (12 س / 48 س) والاعتماد التلقائي', version: 'v2.0', effective: '2026-07-20', owner: 'الإدارة العامة لكود البناء', scope: 'طلبات الاختبارات', status: 'ساري', ref: 'B.R.147 · B.R.152' },
  { id: 'P-02', title: 'قاعدة عدد وعمق الجسات (SBC 303 Table 2.1) وسياسة الحد الأدنى 10 م', version: 'v1.2', effective: '2026-07-20', owner: 'إدارة المنتج', scope: 'الدراسة الجيوتقنية', status: 'ساري', ref: 'SBC 303 §2.4' },
  { id: 'P-03', title: 'الاختبارات المعملية الإلزامية ومحفّزات المحرك الذكي', version: 'v1.1', effective: '2026-06-01', owner: 'إدارة المنتج', scope: 'الدراسة الجيوتقنية', status: 'ساري', ref: 'ASTM D2487/D4318/D422' },
  { id: 'P-04', title: 'الحدود المرجعية للاختبارات الكيميائية', version: 'v1.0', effective: '2026-06-01', owner: 'إدارة المنتج', scope: 'المعملية', status: 'ساري', ref: 'SBC 304' },
  { id: 'P-05', title: 'قالب تقرير الدراسة الجيوتقنية (17 بنداً)', version: 'v2.1', effective: '2026-07-20', owner: 'الإدارة العامة لكود البناء', scope: 'التقارير', status: 'ساري', ref: 'SBC 303 §2.6' },
  { id: 'P-06', title: 'الاحتفاظ بالسجلات وتصنيف البيانات', version: 'v1.0', effective: '2026-05-10', owner: 'مكتب إدارة البيانات', scope: 'الأرشيف', status: 'ساري', ref: 'NDMO' },
  { id: 'P-07', title: 'الضوابط الأساسية للأمن السيبراني ECC-2:2024 — مصفوفة التغطية', version: 'v1.0', effective: '2026-05-10', owner: 'أمن المعلومات', scope: 'المنصة', status: 'ساري', ref: 'NCA ECC-2:2024' },
  { id: 'P-08', title: 'نموذج التقييم ومعايير ترتيب الدليل', version: 'v1.1', effective: '2026-08-01', owner: 'إدارة المنتج', scope: 'الدليل', status: 'مسودة', ref: 'B.R.124 · B.R.127' },
]

/* ── Quotes (pre-contract) ───────────────────────────────── */
export const QUOTES: Quote[] = [
  { id: 'QT-2026-0088', contractorId: 'o-cont1', labId: 'o-lab2', consultantId: 'o-cons1', project: 'مستودعات لوجستية — المنطقة الصناعية الثانية', city: 'الرياض', services: ['standard'], payment: 'on-completion', items: [{ refTestId: 'rt-proctor', method: 'ASTM D1557', basePrice: 300, price: 300, sla: 3 }, { refTestId: 'rt-cbr', method: 'ASTM D1883', basePrice: 450, price: 450, sla: 5 }, { refTestId: 'rt-fdt', method: 'ASTM D1556', basePrice: 240, price: 240, sla: 1 }], notes: 'أعمال ردم وطبقات أساس لمساحة 12,000 م²', status: 'pending', createdAt: ago(20) },
  { id: 'QT-2026-0087', contractorId: 'o-cont1', labId: 'o-lab5', consultantId: 'o-cons1', project: 'برج مكاتب — طريق الملك فهد', city: 'الرياض', services: ['geotech'], payment: 'advance', items: [{ refTestId: 'rt-geotech', method: 'SBC 303', basePrice: 4800, price: 4500, sla: 21 }], status: 'quoted', createdAt: ago(24 * 3), quotedAt: ago(24 * 1.5), validUntil: isoIn(24 * 12, NOW), labNotes: 'خصم 6% لتنفيذ 6 جسات دفعة واحدة — الحفار متاح من الأسبوع القادم' },
  { id: 'QT-2026-0079', contractorId: 'o-cont2', labId: 'o-lab1', consultantId: 'o-cons1', project: 'توسعة شبكة الصرف الصحي — شمال الرياض', city: 'الرياض', services: ['standard'], payment: 'on-completion', items: [{ refTestId: 'rt-proctor', method: 'ASTM D1557', basePrice: 280, price: 280, sla: 3 }, { refTestId: 'rt-cbr', method: 'ASTM D1883', basePrice: 420, price: 420, sla: 5 }], status: 'accepted', createdAt: ago(24 * 30), quotedAt: ago(24 * 28), decidedAt: ago(24 * 27), contractId: 'عقد-2026-021' },
  { id: 'QT-2026-0071', contractorId: 'o-cont3', labId: 'o-lab1', consultantId: 'o-cons2', project: 'مجمع تجاري — حي الملقا', city: 'الرياض', services: ['standard'], payment: 'advance', items: [{ refTestId: 'rt-cube', method: 'BS EN 12390-3', basePrice: 230, price: 260, sla: 28 }], status: 'rejected', createdAt: ago(24 * 45), quotedAt: ago(24 * 43), decidedAt: ago(24 * 41), rejectReason: 'السعر أعلى من العرض المنافس' },
]

/* ── Templates & knowledge versions (admin CRUD) ─────────────── */
export const TEMPLATES: Template[] = [
  { id: 'geo', name: 'تقرير الدراسة الجيوتقنية', ver: 'v2.1', ref: 'SBC 303 §2.6 — 17 بنداً', fields: '105 حقل / 13 قسماً', updated: '20 يوليو 2026', used: 31, status: 'ساري', sections: ['القرار المساحي وبيانات الموقع', 'بيانات المالك', 'بيانات المختبر والاعتماد', 'وصف المشروع', 'المعلومات الجيولوجية والزلزالية (SBC 301)', 'الاستكشاف الحقلي وخريطة الجسات', 'اختبارات التربة الخاصة', 'طبيعة الطبقات ونتائج المعملية', 'الاستنتاجات والتوصيات', 'التكهفات ورد الفعل الجانبي', 'الرسومات والصور والمرفقات', 'سجل كل جسة', 'الاعتماد والتوقيع'], history: [{ ver: 'v2.1', date: '20 يوليو 2026', note: 'إضافة قسم SBC 301', status: 'ساري' }, { ver: 'v2.0', date: '1 يونيو 2026', note: 'مطابقة 17 بند §2.6', status: 'مؤرشف' }] },
  { id: 'log', name: 'سجل الجسة (Borehole Log)', ver: 'v1.3', ref: 'SBC 303 §2.6 (6)', fields: '11 عموداً', updated: '5 يوليو 2026', used: 128, status: 'ساري', sections: ['ترويسة: المشروع، الجسة، الإحداثيات، الفني', 'بيانات الحفرة: الطريقة، الحفّار، القطر، التغليف', 'منسوب الأرض والمياه (لحظي / 24 س)', 'جدول الطبقات: العمق، المنسوب، USCS حقلي/معملي', 'العينات وSPT وREC%', 'منحنى SPT-N', 'مفتاح الرموز USCS', 'الاعتماد'], history: [{ ver: 'v1.3', date: '5 يوليو 2026', note: 'منحنى SPT-N', status: 'ساري' }] },
  { id: 'std', name: 'تقرير نتيجة اختبار قياسي', ver: 'v1.0', ref: 'ASTM — حقول لكل معيار', fields: 'متغير', updated: '1 يونيو 2026', used: 1102, status: 'ساري', sections: ['بيانات الطلب والعقد', 'العينة والتحقق الجغرافي', 'المعيار والطريقة', 'حقول النتيجة والوحدات', 'الحدود المرجعية', 'ملاحظات المختبر', 'قرار الاستشاري'] },
  { id: 'cert', name: 'شهادة إتمام الاختبارات', ver: 'v1.0', ref: 'نموذج الجهة (A.S.02)', fields: '9 حقول', updated: '1 يونيو 2026', used: 0, status: 'مسودة', sections: ['رقم الشهادة ورمز التحقق QR', 'المقاول والمشروع', 'المختبر ورقم الاعتماد', 'الاستشاري المشرف', 'العقد وعدد الاختبارات', 'ملخص القرارات', 'التقييم', 'تاريخ الإصدار', 'الختم الرقمي'] },
  { id: 'contract', name: 'العقد الإلكتروني', ver: 'v1.2', ref: 'المرحلة الأولى', fields: '14 بنداً', updated: '12 مايو 2026', used: 12, status: 'ساري', sections: ['الأطراف الثلاثة', 'نطاق الخدمات', 'الأسعار المثبتة من القائمة', 'آلية الدفع', 'المهل وSLA', 'التوقيع الرقمي'] },
  { id: 'inv', name: 'الفاتورة الضريبية', ver: 'v1.1', ref: 'هيئة الزكاة والضريبة — الفوترة الإلكترونية', fields: '12 حقلاً', updated: '15 أغسطس 2026', used: 96, status: 'ساري', sections: ['بيانات البائع والمشتري', 'الرقم الضريبي', 'البنود والأسعار', 'الضريبة 15%', 'QR ZATCA', 'حالة السداد'] },
]
export const KNOWLEDGE_VERSIONS: KnowledgeVersion[] = [
  { ver: 'v1.3', date: '—', changes: 'تحديث قيم Table 2.1 لطبعة 2024 (بانتظار النص)', studies: 0, status: 'مسودة' },
  { ver: 'v1.2', date: '20 يوليو 2026', changes: 'إضافة المعاملات الزلزالية SBC 301 · معادلة الهبوط', studies: 31, status: 'ساري' },
  { ver: 'v1.1', date: '1 يونيو 2026', changes: 'محفّزات الانتفاخ والسبخة', studies: 38, status: 'مؤرشف' },
  { ver: 'v1.0', date: '10 مايو 2026', changes: 'الإصدار الأول — Table 2.1 والحدود الكيميائية', studies: 14, status: 'مؤرشف' },
]

/* ── Knowledge base: acceptance limits shown beside result fields ── */
export const REF_LIMITS: Record<string, { key: string; rule: string; ref: string }[]> = {
  'rt-proctor': [{ key: 'fc', rule: '≥ 95% للطبقات الحاملة · ≥ 90% للردم العام', ref: 'SBC 303 / MOMRAH specs' }, { key: 'omc', rule: '±2% من OMC المعملية', ref: 'ASTM D1557' }],
  'rt-cbr': [{ key: 'cbr', rule: '≥ 8% طبقة التأسيس · ≥ 30% الأساس السفلي · ≥ 80% الأساس', ref: 'MOMRAH Roads §3' }, { key: 'swell', rule: '≤ 1% (تربة غير انتفاخية)', ref: 'ASTM D1883' }],
  'rt-fdt': [{ key: 'rc', rule: '≥ 95% من MDD المعدّل', ref: 'ASTM D1556' }],
  'rt-atterberg': [{ key: 'pi', rule: 'PI ≤ 6 لمواد الأساس · PI ≤ 12 للردم', ref: 'ASTM D4318' }, { key: 'll', rule: 'LL ≤ 25 لمواد الأساس', ref: 'MOMRAH Roads' }],
  'rt-sieve': [{ key: 'p200', rule: '≤ 12% لمواد الأساس', ref: 'ASTM D422' }],
  'rt-mc': [{ key: 'mc', rule: 'ضمن OMC ±2%', ref: 'ASTM D2216' }],
  'rt-shear': [{ key: 'phi', rule: 'يُستخدم لحساب قدرة التحمل (Terzaghi)', ref: 'SBC 303 §2.6' }],
  'rt-ucs': [{ key: 'ucs', rule: 'يُصنّف الصخر: ضعيف < 25 · متوسط 25–50 · قوي > 50 MPa', ref: 'ISRM' }],
  'rt-marshall': [{ key: 'stab', rule: '≥ 8 kN للطبقة السطحية', ref: 'MOMRAH Roads §5' }, { key: 'flow', rule: '2–4 mm', ref: 'ASTM D6927' }],
  'rt-pen': [{ key: 'pen', rule: '60–70 (درجة البيتومين 60/70)', ref: 'ASTM D5' }],
  'rt-core-asph': [{ key: 'den', rule: '≥ 97% من كثافة مارشال', ref: 'ASTM D2726' }],
  'rt-cube': [{ key: 'f28', rule: '≥ المقاومة المميزة fcu المحددة بالتصميم', ref: 'SBC 304' }, { key: 'f7', rule: '≈ 65–70% من مقاومة 28 يوماً', ref: 'BS EN 12390-3' }],
  'rt-core': [{ key: 'fc', rule: '≥ 85% من fc المحددة (متوسط 3 كور)', ref: 'ACI 318 / SBC 304' }],
  'rt-slump': [{ key: 'slump', rule: 'حسب التصميم ±25 mm', ref: 'ASTM C143' }],
  'rt-la': [{ key: 'la', rule: '≤ 40% للأساس · ≤ 30% للإسفلت', ref: 'ASTM C131' }],
}

/* ── Analytics series (12 months) ───────────────────────────── */
export const MONTHS = ['أكتوبر', 'نوفمبر', 'ديسمبر', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر']
export const SERIES_MONTHLY = MONTHS.map((m, i) => ({ m, requests: [38, 41, 36, 44, 52, 58, 61, 67, 63, 72, 78, 54][i], completed: [31, 36, 33, 39, 46, 51, 55, 60, 58, 64, 69, 31][i], geotech: [3, 4, 3, 5, 6, 7, 8, 9, 8, 11, 12, 7][i], rejected: [2, 3, 1, 3, 4, 3, 4, 5, 3, 4, 6, 2][i], sla: [88, 90, 91, 89, 92, 93, 94, 93, 95, 94, 96, 95][i], auto: [4, 3, 3, 2, 3, 2, 2, 1, 2, 1, 2, 1][i], revenue: [186, 204, 178, 231, 268, 301, 322, 358, 341, 396, 424, 288][i] }))
export const CATEGORY_MIX = [{ name: 'التربة', value: 412 }, { name: 'الإسفلت', value: 138 }, { name: 'الخرسانة', value: 121 }, { name: 'الركام', value: 46 }, { name: 'جيوتقنية', value: 83 }]
export const CITY_CATEGORY: Record<string, Record<string, number>> = {
  'الرياض': { 'تربة': 210, 'إسفلت': 72, 'خرسانة': 61, 'ركام': 28 },
  'جدة': { 'تربة': 98, 'إسفلت': 38, 'خرسانة': 34, 'ركام': 14 },
  'الدمام': { 'تربة': 51, 'إسفلت': 20, 'خرسانة': 18, 'ركام': 7 },
  'مكة المكرمة': { 'تربة': 39, 'إسفلت': 14, 'خرسانة': 13, 'ركام': 5 },
  'القصيم': { 'تربة': 24, 'إسفلت': 9, 'خرسانة': 8, 'ركام': 3 },
}
export const CITY_COORD: Record<string, [number, number]> = { 'الرياض': [24.8390, 46.6540], 'حي النرجس': [24.8390, 46.6540], 'حي الياسمين': [24.8232, 46.6395], 'حي الملقا': [24.8130, 46.6060], 'حي الرمال': [24.8630, 46.8040], 'حي الربوة': [24.6970, 46.7590], 'جدة': [21.5433, 39.1728], 'الدمام': [26.4207, 50.0888], 'مكة المكرمة': [21.3891, 39.8579], 'القصيم': [26.3260, 43.9750], 'الخبر': [26.2172, 50.1971], 'المدينة المنورة': [24.5247, 39.5692] }
export const CITY_MIX = [{ name: 'الرياض', value: 371 }, { name: 'جدة', value: 184 }, { name: 'الدمام', value: 96 }, { name: 'مكة المكرمة', value: 71 }, { name: 'القصيم', value: 44 }, { name: 'أخرى', value: 34 }]
