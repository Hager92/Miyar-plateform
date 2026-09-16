# Copyright (c) 2026, Umran Tech and contributors
# For license information, please see license.txt

"""Seeds real backend records (Entities, Users, Reference Data, Lab Test Catalog)
that mirror the fixed demo roster in the Ido-app/Miyar frontend's src/lib/mock.ts,
and issues a real API key/secret per demo user so the frontend can authenticate
against this backend instead of its local mock store.

Run: bench --site mysite.local execute miyar.setup.seed_demo.run
Output: writes {frontend_repo}/miyar-app/public/demo-tokens.json (gitignored,
fetched at runtime by the frontend's API client) plus prints a summary.

Idempotent: re-running updates/reuses existing records (matched by cr_number
for Entities, email for Users) rather than duplicating them.
"""

import json
import os

import frappe
from frappe.core.doctype.user.user import generate_keys

ENTITY_TYPE = {"lab": "Laboratory", "contractor": "Contractor", "consultant": "Consulting Office", "supervisor": "Supervisory Authority"}
ROLE_FOR_PLATFORM_USER = {"admin": "Miyar System Admin", "support": "Miyar Technical Support"}

# id, type, name, cr, city, about, rating(1-5), reviews
ORGS = [
	("o-lab1", "lab", "مختبر التربة والمواد", "4030123456", "جدة", "مختبر متخصص في اختبارات التربة والطرق والمواد الإنشائية.", 4.2, 38),
	("o-lab2", "lab", "مختبر الجودة الشاملة", "1010987654", "الرياض", "مختبر رائد في الفحوصات الجيوتقنية واختبارات الجودة.", 4.8, 62),
	("o-lab3", "lab", "مختبر الخليج للفحص", "2050456789", "الدمام", "مختبر متخصص في اختبارات الإسفلت والخرسانة.", 3.6, 21),
	("o-lab4", "lab", "مختبر المواد المتقدمة", "4030555666", "جدة", "اختبارات مواد البناء المتقدمة والجيوتقنية.", 4.0, 44),
	("o-lab5", "lab", "جسات لفحص التربة", "1010223344", "الرياض", "شركة فحص التربة للاستشارات الهندسية.", 4.6, 57),
	("o-lab6", "lab", "مختبر نجد للطرق", "1010667788", "القصيم", "مختبر متخصص في اختبارات الطرق والإسفلت.", 3.9, 17),
	("o-lab7", "lab", "مختبر مكة للفحوصات الإنشائية", "4031122334", "مكة المكرمة", "فحوصات إنشائية وجيوتقنية.", 4.4, 29),
	("o-lab8", "lab", "مختبر الشمال الهندسي", "3450099887", "تبوك", "اختبارات التربة والطرق لمشاريع المنطقة الشمالية.", 4.1, 12),
	("o-cont1", "contractor", "شركة الإنشاءات المتكاملة", "1010111222", "الرياض", "شركة متخصصة في أعمال الإنشاء والبنية التحتية والطرق.", 0, 0),
	("o-cont2", "contractor", "شركة مشاريع البنية", "1010333444", "الرياض", "مقاول بنية تحتية وشبكات صرف ومياه.", 0, 0),
	("o-cont3", "contractor", "مجموعة بن لادن للطرق", "4030001122", "جدة", "تنفيذ الطرق السريعة والجسور والأنفاق.", 0, 0),
	("o-cont4", "contractor", "مؤسسة البناء الحديث", "2050334455", "الدمام", "مقاولات عامة ومشاريع سكنية.", 0, 0),
	("o-cont5", "contractor", "شركة روافد للتطوير العقاري", "1010778899", "الرياض", "تطوير مجمعات سكنية ضمن برنامج سكني.", 0, 0),
	("o-cons1", "consultant", "مكتب الاستشارات الهندسية المتكاملة", "4030777888", "جدة", "استشارات جيوتقنية وهندسية وإشراف على مشاريع الطرق.", 0, 0),
	("o-cons2", "consultant", "شركة سماء للاستشارات الهندسية", "1010445566", "الرياض", "استشارات إنشائية وتقييم المباني القائمة.", 0, 0),
	("o-cons3", "consultant", "دار الهندسة للاستشارات", "2050778899", "الخبر", "استشارات جيوتقنية للمشاريع الصناعية والبترولية.", 0, 0),
	("o-sup", "supervisor", "الإدارة العامة لكود البناء السعودي", "0000000000", "الرياض", "", 0, 0),
]

# id, name, position(principal/employee), orgId, mobile, role(only for admin/support)
USERS = [
	("u-cont", "أحمد العتيبي", "principal", "o-cont1", "0551234567", None),
	("u-cont-emp", "سارة الدوسري", "employee", "o-cont1", "0551234568", None),
	("u-cont2", "ماجد العنزي", "principal", "o-cont2", "0552001001", None),
	("u-cont3", "طلال بن لادن", "principal", "o-cont3", "0553003003", None),
	("u-cont5", "هند الشهراني", "principal", "o-cont5", "0555005005", None),
	("u-lab", "محمد السبيعي", "principal", "o-lab1", "0559876543", None),
	("u-lab-emp", "فيصل القحطاني", "employee", "o-lab1", "0559876544", None),
	("u-lab-emp2", "نواف الشمري", "employee", "o-lab1", "0559876545", None),
	("u-lab-emp3", "عبدالرحمن الزهراني", "employee", "o-lab1", "0559876546", None),
	("u-lab2", "سعود المطيري", "principal", "o-lab2", "0556002002", None),
	("u-lab5", "معاذ الجديع", "principal", "o-lab5", "0556005005", None),
	("u-cons", "خالد العسيري", "principal", "o-cons1", "0553334444", None),
	("u-cons-emp", "ريم الحربي", "employee", "o-cons1", "0553334445", None),
	("u-cons2", "سامي عبدالحق", "principal", "o-cons2", "0557007007", None),
	("u-sup", "عبدالله الغامدي", "principal", "o-sup", "0551112222", None),
	("u-admin", "ياسر علي", None, None, "0550001111", "admin"),
	("u-support", "رحاب مدخلي", None, None, "0550001112", "support"),
]

# ref test id, ar label, en label, category
REF_TESTS = [
	("rt-proctor", "اختبار الدمك القياسي", "Standard Proctor Test", "soil"),
	("rt-cbr", "اختبار CBR", "California Bearing Ratio", "soil"),
	("rt-sieve", "التحليل الحبيبي", "Sieve Analysis", "soil"),
	("rt-atterberg", "حدود أتربرج", "Atterberg Limits", "soil"),
	("rt-mc", "معامل الرطوبة", "Moisture Content", "soil"),
	("rt-fdt", "الكثافة الحقلية (المخروط الرملي)", "Field Density - Sand Cone", "soil"),
	("rt-consol", "اختبار الانضغاطية", "Consolidation Test", "soil"),
	("rt-shear", "اختبار القص المباشر", "Direct Shear Test", "soil"),
	("rt-swell", "اختبار الانتفاخ", "Swell Test", "soil"),
	("rt-collapse", "اختبار الانهيارية", "Collapse Potential", "soil"),
	("rt-ucs", "مقاومة الضغط غير المحصور", "Unconfined Compressive Strength", "soil"),
	("rt-marshall", "اختبار المارشال", "Marshall Test", "asphalt"),
	("rt-pen", "اختبار الاختراق", "Penetration Test", "asphalt"),
	("rt-core-asph", "كور إسفلتي (سمك وكثافة)", "Asphalt Core", "asphalt"),
	("rt-cube", "مقاومة ضغط المكعبات", "Concrete Cube Strength", "concrete"),
	("rt-core", "كور خرساني", "Concrete Core", "concrete"),
	("rt-slump", "اختبار الهبوط", "Slump Test", "concrete"),
	("rt-halfcell", "كشف صدأ الحديد (Half-Cell)", "Half-Cell Potential", "concrete"),
	("rt-rebar", "اختبار شد حديد التسليح", "Rebar Tensile Test", "concrete"),
	("rt-la", "تآكل لوس أنجلوس", "LA Abrasion", "aggregate"),
	("rt-sg", "الوزن النوعي للركام", "Specific Gravity", "aggregate"),
	("rt-geotech", "دراسة جيوتقنية شاملة", "Geotechnical Investigation", "soil"),
]

PRICE = {
	"rt-proctor": (280, 3), "rt-cbr": (420, 5), "rt-sieve": (180, 2), "rt-atterberg": (180, 2), "rt-mc": (90, 1),
	"rt-fdt": (220, 1), "rt-consol": (380, 7), "rt-shear": (350, 5), "rt-swell": (320, 4), "rt-collapse": (340, 4),
	"rt-ucs": (300, 3), "rt-marshall": (650, 4), "rt-pen": (260, 2), "rt-core-asph": (240, 2), "rt-cube": (220, 28),
	"rt-core": (480, 5), "rt-slump": (80, 1), "rt-halfcell": (900, 3), "rt-la": (380, 3), "rt-sg": (210, 2), "rt-geotech": (4200, 21),
}

LAB_TESTS = {
	"o-lab1": ["rt-proctor", "rt-cbr", "rt-marshall", "rt-consol", "rt-sieve", "rt-shear", "rt-atterberg", "rt-geotech", "rt-ucs", "rt-cube", "rt-fdt", "rt-mc", "rt-slump", "rt-la"],
	"o-lab2": ["rt-geotech", "rt-proctor", "rt-cbr", "rt-sieve", "rt-atterberg", "rt-mc", "rt-consol", "rt-shear", "rt-swell", "rt-collapse", "rt-ucs", "rt-la", "rt-sg"],
	"o-lab3": ["rt-marshall", "rt-pen", "rt-core-asph", "rt-cube", "rt-slump", "rt-core"],
	"o-lab4": ["rt-proctor", "rt-cbr", "rt-sieve", "rt-atterberg", "rt-marshall", "rt-pen", "rt-fdt", "rt-mc"],
	"o-lab5": ["rt-geotech", "rt-proctor", "rt-cbr", "rt-sieve", "rt-atterberg", "rt-mc", "rt-ucs", "rt-cube", "rt-core", "rt-halfcell", "rt-consol", "rt-shear", "rt-swell", "rt-collapse", "rt-la", "rt-sg", "rt-fdt"],
	"o-lab6": ["rt-proctor", "rt-cbr", "rt-fdt", "rt-marshall", "rt-core-asph", "rt-sieve"],
	"o-lab7": ["rt-geotech", "rt-cube", "rt-core", "rt-halfcell", "rt-proctor", "rt-sieve", "rt-atterberg", "rt-ucs"],
	"o-lab8": ["rt-proctor", "rt-cbr", "rt-sieve", "rt-la", "rt-sg"],
}

DEMO_EMAIL_DOMAIN = "demo.miyar.local"
OUTPUT_PATH = "/home/hager/miyar-design-ref/miyar-app/public/demo-tokens.json"


def _get_or_create_entity(org_id, org_type, name, cr, city, about, rating_1to5):
	existing = frappe.db.get_value("Entity", {"cr_number": cr}, "name")
	if existing:
		return existing
	doc = frappe.get_doc(
		{
			"doctype": "Entity",
			"entity_type": ENTITY_TYPE[org_type],
			"cr_number": cr,
			"entity_name": name,
			"account_status": "Active",
			"description": about,
		}
	)
	doc.insert(ignore_permissions=True)
	if rating_1to5:
		doc.db_set("average_rating", round(rating_1to5 / 5, 4))
		doc.db_set("review_count", int(rating_1to5 and 1 or 0))
	return doc.name


def _get_or_create_user(email, full_name, mobile):
	if frappe.db.exists("User", email):
		return frappe.get_doc("User", email)
	doc = frappe.get_doc(
		{
			"doctype": "User",
			"email": email,
			"first_name": full_name,
			"mobile_no": mobile,
			"send_welcome_email": 0,
			"user_type": "System User",
		}
	)
	doc.insert(ignore_permissions=True)
	return doc


def _ensure_principal_delegate(entity, user_email):
	if frappe.db.exists("Principal Delegate", {"entity": entity, "user": user_email}):
		return
	frappe.get_doc({"doctype": "Principal Delegate", "entity": entity, "user": user_email, "is_active": 1}).insert(ignore_permissions=True)


def _ensure_role(user_doc, role):
	if not any(r.role == role for r in user_doc.roles):
		user_doc.append("roles", {"role": role})
		user_doc.save(ignore_permissions=True)


def run():
	frappe.set_user("Administrator")

	# 1. Reference Data Items (Test Type)
	for code, ar, en, _category in REF_TESTS:
		if not frappe.db.exists("Reference Data Item", code):
			frappe.get_doc(
				{"doctype": "Reference Data Item", "category": "Test Type", "item_code": code, "item_label_ar": ar, "item_label_en": en, "is_active": 1}
			).insert(ignore_permissions=True)

	# 2. Entities
	entity_by_org = {}
	for org_id, org_type, name, cr, city, about, rating, reviews in ORGS:
		if org_type not in ENTITY_TYPE:
			continue  # 'ops' has no Entity — its users map straight to platform roles
		entity_by_org[org_id] = _get_or_create_entity(org_id, org_type, name, cr, city, about, rating)
	frappe.db.commit()

	# 3. Lab Test Catalog (Active items per lab, per the frontend's LAB_TESTS map)
	for org_id, tests in LAB_TESTS.items():
		lab_entity = entity_by_org.get(org_id)
		if not lab_entity:
			continue
		for code in tests:
			if frappe.db.exists("Lab Test Catalog Item", {"laboratory": lab_entity, "test_type": code}):
				continue
			base_price, sla = PRICE[code]
			frappe.get_doc(
				{
					"doctype": "Lab Test Catalog Item",
					"laboratory": lab_entity,
					"test_type": code,
					"price": base_price,
					"turnaround_days": sla,
					"status": "Active",
				}
			).insert(ignore_permissions=True)
	frappe.db.commit()

	# 3b. A handful of real, Active Miyar Contracts so the demo contractor has
	# something real to submit Test Requests against (B.R.132/135).
	from frappe.utils import nowdate

	CONTRACT_TRIADS = [("o-cont1", "o-lab1", "o-cons1"), ("o-cont1", "o-lab2", "o-cons1"), ("o-cont1", "o-lab5", "o-cons1")]
	for contractor_org, lab_org, consultant_org in CONTRACT_TRIADS:
		contractor, lab, consultant = entity_by_org[contractor_org], entity_by_org[lab_org], entity_by_org[consultant_org]
		if frappe.db.exists("Miyar Contract", {"contractor": contractor, "laboratory": lab, "consulting_office": consultant, "docstatus": 1}):
			continue
		contract = frappe.get_doc(
			{
				"doctype": "Miyar Contract",
				"contractor": contractor,
				"laboratory": lab,
				"consulting_office": consultant,
				"start_date": nowdate(),
			}
		)
		contract.insert(ignore_permissions=True)
		contract.submit()
	frappe.db.commit()

	# 4. Users + Principal Delegates / platform roles + API keys
	tokens = {}
	for user_id, name, position, org_id, mobile, platform_role in USERS:
		email = f"{user_id}@{DEMO_EMAIL_DOMAIN}"
		user_doc = _get_or_create_user(email, name, mobile)

		if platform_role:
			_ensure_role(user_doc, ROLE_FOR_PLATFORM_USER[platform_role])
		elif position == "principal":
			entity = entity_by_org[org_id]
			_ensure_principal_delegate(entity, email)
		# 'employee' position users get no standing access yet — they gain it via
		# a live Delegation created through the app, same as the real workflow.

		keys = generate_keys(email)
		user_doc.reload()
		tokens[user_id] = {
			"email": email,
			"full_name": name,
			"api_key": user_doc.api_key,
			"api_secret": keys["api_secret"],
			"org_id": org_id,
			"entity": entity_by_org.get(org_id),
		}
	frappe.db.commit()

	os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
	with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
		json.dump(tokens, f, ensure_ascii=False, indent=2)

	print(f"Seeded {len(entity_by_org)} entities, {len(USERS)} users, wrote tokens to {OUTPUT_PATH}")
	return tokens
