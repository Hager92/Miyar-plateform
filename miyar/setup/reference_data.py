import frappe

# Only items explicitly named in the BRD's own process flow (§2.4) are seeded here.
# Test-type catalogs, drilling methods, and units are intentionally left empty:
# the BRD does not enumerate them, and inventing a list would violate the
# "no engineering data fabrication" principle carried through this design.
SERVICE_TYPES = [
	{"item_code": "STD-TEST", "item_label_ar": "اختبار قياسي", "item_label_en": "Standard Test"},
	{"item_code": "GEO-STUDY", "item_label_ar": "دراسة جيوتقنية", "item_label_en": "Geotechnical Study"},
]


def ensure_reference_data():
	for row in SERVICE_TYPES:
		if not frappe.db.exists("Reference Data Item", row["item_code"]):
			frappe.get_doc(
				{
					"doctype": "Reference Data Item",
					"category": "Service Type",
					"is_active": 1,
					**row,
				}
			).insert(ignore_permissions=True)
	frappe.db.commit()
