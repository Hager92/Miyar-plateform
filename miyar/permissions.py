import frappe

UNRESTRICTED_ROLES = {
	"System Manager",
	"Administrator",
	"Miyar System Admin",
	"Miyar Technical Support",
	"Miyar Supervisory Authority",
}


def _user_has_unrestricted_access(user):
	return bool(UNRESTRICTED_ROLES & set(frappe.get_roles(user)))


def get_user_entities(user):
	"""Entities the user is the Principal Delegate of, or is actively delegated on."""
	return frappe.get_all(
		"Principal Delegate", filters={"user": user, "is_active": 1}, pluck="entity"
	)


def has_entity_permission(doc, ptype, user):
	"""B.R.126 — an Entity manages its OWN profile: write/create access is scoped to
	the Principal Delegate of that specific Entity, not to anyone holding the
	matching role. (Read stays open to any logged-in user via the 'All' role,
	unaffected by this hook — it only ever narrows write/create.)"""
	if ptype not in ("write", "create", "delete"):
		return True
	if _user_has_unrestricted_access(user):
		return True
	if doc.is_new():
		return True  # creation is gated by the role permission itself (B.R. registration flow)
	return doc.name in get_user_entities(user)


def get_contract_permission_query_conditions(user=None):
	user = user or frappe.session.user
	if _user_has_unrestricted_access(user):
		return ""
	entities = get_user_entities(user)
	if not entities:
		return "1=0"
	entity_list = ", ".join(frappe.db.escape(e) for e in entities)
	return (
		f"(`tabMiyar Contract`.contractor in ({entity_list}) "
		f"or `tabMiyar Contract`.laboratory in ({entity_list}) "
		f"or `tabMiyar Contract`.consulting_office in ({entity_list}))"
	)


def get_invoice_permission_query_conditions(user=None):
	user = user or frappe.session.user
	if _user_has_unrestricted_access(user):
		return ""
	entities = get_user_entities(user)
	if not entities:
		return "1=0"
	entity_list = ", ".join(frappe.db.escape(e) for e in entities)
	return f"(`tabMiyar Invoice`.contractor in ({entity_list}) or `tabMiyar Invoice`.laboratory in ({entity_list}))"


def has_invoice_permission(doc, ptype, user):
	"""Only the contractor being billed (write, to record payment) or the
	laboratory being paid (read-only) may touch an invoice."""
	if _user_has_unrestricted_access(user):
		return True
	entities = set(get_user_entities(user))
	if ptype == "write":
		return doc.contractor in entities
	return bool(entities & {doc.contractor, doc.laboratory})


def get_test_request_permission_query_conditions(user=None):
	user = user or frappe.session.user
	if _user_has_unrestricted_access(user):
		return ""
	entities = get_user_entities(user)
	delegated_names = frappe.get_all(
		"Delegation",
		filters={"delegated_to": user, "status": "Active", "docstatus": 1},
		pluck="test_request",
	)
	conditions = []
	if entities:
		entity_list = ", ".join(frappe.db.escape(e) for e in entities)
		conditions.append(
			f"(`tabTest Request`.contractor in ({entity_list}) "
			f"or `tabTest Request`.laboratory in ({entity_list}) "
			f"or `tabTest Request`.consulting_office in ({entity_list}))"
		)
	if delegated_names:
		name_list = ", ".join(frappe.db.escape(n) for n in delegated_names)
		conditions.append(f"(`tabTest Request`.name in ({name_list}))")
	if not conditions:
		return "1=0"
	return "(" + " or ".join(conditions) + ")"


def get_delegation_permission_query_conditions(user=None):
	user = user or frappe.session.user
	if _user_has_unrestricted_access(user):
		return ""
	return (
		f"(`tabDelegation`.delegated_by = {frappe.db.escape(user)} "
		f"or `tabDelegation`.delegated_to = {frappe.db.escape(user)})"
	)


def _visible_test_requests(user):
	"""Test Request names the user's Entities are party to (contractor/lab/consultant)."""
	entities = get_user_entities(user)
	if not entities:
		return []
	return frappe.get_all(
		"Test Request",
		or_filters={"contractor": ["in", entities], "laboratory": ["in", entities], "consulting_office": ["in", entities]},
		pluck="name",
	)


def _visible_geotechnical_studies(user):
	test_requests = _visible_test_requests(user)
	if not test_requests:
		return []
	return frappe.get_all("Geotechnical Study", filters={"test_request": ["in", test_requests]}, pluck="name")


def get_geotechnical_study_permission_query_conditions(user=None):
	user = user or frappe.session.user
	if _user_has_unrestricted_access(user):
		return ""
	test_requests = _visible_test_requests(user)
	if not test_requests:
		return "1=0"
	name_list = ", ".join(frappe.db.escape(n) for n in test_requests)
	return f"(`tabGeotechnical Study`.test_request in ({name_list}))"


def _geotechnical_study_scoped_condition(doctype, user=None):
	"""Generic scoping for any doctype with a `geotechnical_study` Link field."""
	user = user or frappe.session.user
	if _user_has_unrestricted_access(user):
		return ""
	studies = _visible_geotechnical_studies(user)
	if not studies:
		return "1=0"
	name_list = ", ".join(frappe.db.escape(s) for s in studies)
	return f"(`tab{doctype}`.geotechnical_study in ({name_list}))"


def get_exploration_plan_permission_query_conditions(user=None):
	return _geotechnical_study_scoped_condition("Exploration Plan", user)


def get_field_execution_plan_permission_query_conditions(user=None):
	return _geotechnical_study_scoped_condition("Field Execution Plan", user)


def get_borehole_permission_query_conditions(user=None):
	return _geotechnical_study_scoped_condition("Borehole", user)


def get_engineering_analysis_permission_query_conditions(user=None):
	return _geotechnical_study_scoped_condition("Engineering Analysis", user)


def get_geotechnical_report_permission_query_conditions(user=None):
	return _geotechnical_study_scoped_condition("Geotechnical Report", user)
