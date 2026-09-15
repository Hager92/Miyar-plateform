import frappe

MIYAR_ROLES = [
	"Miyar System Admin",
	"Miyar Technical Support",
	"Miyar Principal Delegate",
	"Miyar Employee",
	"Miyar Contractor",
	"Miyar Laboratory",
	"Miyar Consulting Office",
	"Miyar Supervisory Authority",
]


def ensure_roles():
	for role_name in MIYAR_ROLES:
		if not frappe.db.exists("Role", role_name):
			frappe.get_doc(
				{"doctype": "Role", "role_name": role_name, "desk_access": 1}
			).insert(ignore_permissions=True)
	frappe.db.commit()
