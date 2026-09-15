"""Standalone functional smoke test for the Miyar Phase 1 foundation.

`bench run-tests` on this bench currently fails before it even reaches Miyar's
own tests: any doctype with a Link to ERPNext's `Project` (our Test Request
does, per the BRD) makes Frappe's test-record generator walk into
`erpnext.tests.utils.ERPNextTestSuite`, which tries to bootstrap a default
Fiscal Year and collides with fiscal-year data already present on this shared
bench (pre-existing, unrelated to Miyar). Until that's cleaned up, this
script exercises the same scenarios as
`miyar_testing/doctype/test_request/test_test_request.py` directly via
`bench execute miyar.setup.dev_smoke_test.run`.
"""

import frappe
from frappe.utils import add_to_date, now_datetime, nowdate

RESULTS = []


def _check(label, cond):
	RESULTS.append((label, bool(cond)))
	print(("PASS" if cond else "FAIL"), "-", label)


def _expect_throw(label, fn):
	try:
		fn()
		_check(label, False)
	except frappe.exceptions.ValidationError:
		_check(label, True)


def _cleanup():
	# Lab Test Catalog Item blocks frappe.delete_doc on purpose (B.R.117); bypass
	# the controller for this test-fixture cleanup only, via a raw table delete.
	frappe.db.delete("Lab Test Catalog Item")
	frappe.db.delete("Lab Test Catalog History")
	frappe.db.delete("ToDo", {"allocated_to": ["like", "smoke_%@test.miyar"]})
	for dt in ("Entity Rating", "Delegation", "Test Request", "Miyar Contract", "Principal Delegate", "Entity"):
		for name in frappe.get_all(dt, pluck="name"):
			doc = frappe.get_doc(dt, name)
			if doc.meta.is_submittable and doc.docstatus == 1:
				doc.cancel()
			frappe.delete_doc(dt, name, force=True, ignore_permissions=True)
	for name in frappe.get_all("Reference Data Item", filters={"item_code": ["like", "SMOKE-%"]}, pluck="name"):
		frappe.delete_doc("Reference Data Item", name, force=True, ignore_permissions=True)
	for email in (
		"smoke_contractor_pd@test.miyar", "smoke_lab_pd@test.miyar",
		"smoke_consult_pd@test.miyar", "smoke_other_contractor@test.miyar",
	):
		if frappe.db.exists("User", email):
			frappe.delete_doc("User", email, force=True, ignore_permissions=True)
	frappe.db.commit()


def counts():
	for dt in ("Entity", "Principal Delegate", "Miyar Contract", "Test Request", "Delegation", "Entity Rating", "Lab Test Catalog Item"):
		print(dt, frappe.db.count(dt))


def run():
	frappe.set_user("Administrator")
	_cleanup()

	service_type = frappe.get_all("Reference Data Item", filters={"category": "Service Type"}, pluck="name")[0]

	contractor = frappe.get_doc(
		{"doctype": "Entity", "entity_type": "Contractor", "cr_number": "SMK-CR-1", "entity_name": "Smoke Contracting", "account_status": "Active"}
	).insert(ignore_permissions=True)
	laboratory = frappe.get_doc(
		{"doctype": "Entity", "entity_type": "Laboratory", "cr_number": "SMK-CR-2", "entity_name": "Smoke Labs", "account_status": "Active"}
	).insert(ignore_permissions=True)
	consultant = frappe.get_doc(
		{"doctype": "Entity", "entity_type": "Consulting Office", "cr_number": "SMK-CR-3", "entity_name": "Smoke Consulting", "account_status": "Active"}
	).insert(ignore_permissions=True)

	_check("Entity autoname prefix CON-", contractor.name.startswith("CON-"))
	_check("Lab not visible in directory (no active test yet, B.R.130)", laboratory.is_visible_in_directory == 0)
	_check("Consulting Office visible in directory", consultant.is_visible_in_directory == 1)

	for email, entity in (
		("smoke_contractor_pd@test.miyar", contractor.name),
		("smoke_lab_pd@test.miyar", laboratory.name),
		("smoke_consult_pd@test.miyar", consultant.name),
	):
		if not frappe.db.exists("User", email):
			frappe.get_doc({"doctype": "User", "email": email, "first_name": email.split("@")[0], "send_welcome_email": 0}).insert(ignore_permissions=True)
		frappe.get_doc({"doctype": "Principal Delegate", "entity": entity, "user": email}).insert(ignore_permissions=True)

	contractor.reload()
	_check("Entity.principal_delegate auto-set", bool(contractor.principal_delegate))
	_expect_throw(
		"Second active Principal Delegate for same Entity blocked",
		lambda: frappe.get_doc({"doctype": "Principal Delegate", "entity": contractor.name, "user": "smoke_lab_pd@test.miyar"}).insert(ignore_permissions=True),
	)

	contractor_roles = frappe.get_roles("smoke_contractor_pd@test.miyar")
	_check("Principal Delegate auto-granted entity-type Role", "Miyar Contractor" in contractor_roles and "Miyar Principal Delegate" in contractor_roles)

	contract = frappe.get_doc(
		{"doctype": "Miyar Contract", "contractor": contractor.name, "laboratory": laboratory.name, "consulting_office": consultant.name, "start_date": nowdate()}
	).insert(ignore_permissions=True)
	contract.submit()
	_check("Contract Active after submit", contract.status == "Active")

	_expect_throw(
		"Contract with wrong entity_type rejected",
		lambda: frappe.get_doc(
			{"doctype": "Miyar Contract", "contractor": laboratory.name, "laboratory": laboratory.name, "consulting_office": consultant.name, "start_date": nowdate()}
		).insert(ignore_permissions=True),
	)

	# --- permission scoping: an unrelated Contractor principal delegate must not see this Contract ---
	frappe.get_doc(
		{"doctype": "Entity", "entity_type": "Contractor", "cr_number": "SMK-CR-4", "entity_name": "Other Contracting", "account_status": "Active"}
	).insert(ignore_permissions=True)
	if not frappe.db.exists("User", "smoke_other_contractor@test.miyar"):
		frappe.get_doc({"doctype": "User", "email": "smoke_other_contractor@test.miyar", "first_name": "other", "send_welcome_email": 0}).insert(ignore_permissions=True)
	other_entity = frappe.get_last_doc("Entity", filters={"cr_number": "SMK-CR-4"})
	frappe.get_doc({"doctype": "Principal Delegate", "entity": other_entity.name, "user": "smoke_other_contractor@test.miyar"}).insert(ignore_permissions=True)

	# frappe.get_list() (unlike get_all) enforces user permissions/permission_query_conditions
	frappe.set_user("smoke_other_contractor@test.miyar")
	visible_contracts = frappe.get_list("Miyar Contract", filters={"name": contract.name})
	frappe.set_user("Administrator")
	_check("Unrelated Contractor cannot see this Contract (permission_query_conditions)", len(visible_contracts) == 0)

	frappe.set_user("smoke_contractor_pd@test.miyar")
	visible_contracts = frappe.get_list("Miyar Contract", filters={"name": contract.name})
	frappe.set_user("Administrator")
	_check("Owning Contractor CAN see this Contract (permission_query_conditions)", len(visible_contracts) == 1)

	_expect_throw(
		"Entity Rating blocked before Contract Completed (B.R.127)",
		lambda: frappe.get_doc({"doctype": "Entity Rating", "entity": laboratory.name, "contract": contract.name, "rating": 0.8}).insert(ignore_permissions=True),
	)

	contract.db_set("status", "Completed")
	frappe.get_doc({"doctype": "Entity Rating", "entity": laboratory.name, "contract": contract.name, "rating": 0.8}).insert(ignore_permissions=True)
	laboratory.reload()
	_check("Entity.average_rating recomputed", laboratory.average_rating == 0.8 and laboratory.review_count == 1)

	_expect_throw(
		"Duplicate rating for same Contract+Entity blocked (B.R.127)",
		lambda: frappe.get_doc({"doctype": "Entity Rating", "entity": laboratory.name, "contract": contract.name, "rating": 0.5}).insert(ignore_permissions=True),
	)

	catalog_item = frappe.get_doc(
		{"doctype": "Lab Test Catalog Item", "laboratory": laboratory.name, "test_type": service_type, "price": 500}
	).insert(ignore_permissions=True)
	_expect_throw(
		"Lab Test Catalog Item delete blocked (B.R.117)",
		lambda: frappe.delete_doc("Lab Test Catalog Item", catalog_item.name, ignore_permissions=True),
	)
	catalog_item.status = "On Hold"
	catalog_item.save(ignore_permissions=True)
	_check("Catalog item can be put On Hold instead of deleted", catalog_item.status == "On Hold")
	snapshot_name = catalog_item.freeze_snapshot()
	_check("Catalog snapshot created", frappe.db.exists("Lab Test Catalog History", snapshot_name))

	too_soon = frappe.get_doc(
		{
			"doctype": "Test Request", "contract": contract.name, "service_type": service_type,
			"test_items": [{"test_type": service_type}],
			"schedule_slots": [{"slot_datetime": add_to_date(now_datetime(), hours=2)}],
		}
	).insert(ignore_permissions=True)
	too_soon.submit()
	_expect_throw("Test Request send blocked if first slot < 48h (B.R.138)", too_soon.send_to_laboratory)

	tr = frappe.get_doc(
		{
			"doctype": "Test Request", "contract": contract.name, "service_type": service_type,
			"test_items": [{"test_type": service_type}],
			"schedule_slots": [{"slot_datetime": add_to_date(now_datetime(), hours=72)}],
		}
	).insert(ignore_permissions=True)
	tr.submit()
	_check("Test Request contractor/laboratory fetched from Contract", tr.contractor == contractor.name and tr.laboratory == laboratory.name)

	tr.send_to_laboratory()
	_check("Test Request Pending Laboratory Decision after send", tr.status == "Pending Laboratory Decision")
	_check("Laboratory notified of new Test Request (§ 19)", frappe.db.exists("ToDo", {"reference_type": "Test Request", "reference_name": tr.name, "allocated_to": "smoke_lab_pd@test.miyar"}))

	tr.laboratory_accept()
	_check("Test Request Accepted", tr.status == "Accepted")
	_check("Contractor notified of Laboratory acceptance (§ 19)", frappe.db.exists("ToDo", {"reference_type": "Test Request", "reference_name": tr.name, "allocated_to": "smoke_contractor_pd@test.miyar"}))

	tr.start_progress()
	_check("Test Request In Progress", tr.status == "In Progress")
	_check("Status history logged", len(tr.status_history) >= 3)

	tr.set_item_status(tr.test_items[0].idx, "Pending Consultant Decision")
	_check("Consulting Office notified test output pending review (§ 19)", frappe.db.exists("ToDo", {"reference_type": "Test Request", "reference_name": tr.name, "allocated_to": "smoke_consult_pd@test.miyar"}))

	tr.reload()
	tr.set_item_status(tr.test_items[0].idx, "Accepted")
	_check("Test Request auto-Completed once all items resolved (B.R.154)", tr.status == "Completed")

	sieve = frappe.get_doc({"doctype": "Reference Data Item", "category": "Test Type", "item_code": "SMOKE-SIEVE", "item_label_ar": "غربلة", "item_label_en": "Sieve"}).insert(ignore_permissions=True)
	frappe.get_doc({"doctype": "Lab Test Catalog Item", "laboratory": laboratory.name, "test_type": sieve.name, "price": 100}).insert(ignore_permissions=True)
	sieve.item_label_en = "Sieve Analysis (updated)"
	sieve.save(ignore_permissions=True)
	_check("Laboratory notified of Reference Data Item update affecting active catalog (B.R.113)", frappe.db.exists("ToDo", {"reference_type": "Reference Data Item", "reference_name": sieve.name, "allocated_to": "smoke_lab_pd@test.miyar"}))

	direct = frappe.get_doc(
		{"doctype": "Delegation", "delegation_type": "Direct", "scope": "Full Request", "test_request": tr.name, "delegated_to": "smoke_lab_pd@test.miyar"}
	).insert(ignore_permissions=True)
	direct.submit()
	_check("Direct delegation Active immediately (B.R.233)", direct.status == "Active")

	indirect = frappe.get_doc(
		{
			"doctype": "Delegation", "delegation_type": "Indirect", "scope": "Full Request", "test_request": tr.name,
			"delegated_by": "smoke_contractor_pd@test.miyar", "delegated_to": "smoke_consult_pd@test.miyar",
		}
	).insert(ignore_permissions=True)
	indirect.submit()
	_check("Indirect delegation Pending Acceptance (B.R.233)", indirect.status == "Pending Acceptance")
	_check("Delegate notified of Indirect delegation (§ 19)", frappe.db.exists("ToDo", {"reference_type": "Delegation", "reference_name": indirect.name, "allocated_to": "smoke_consult_pd@test.miyar"}))

	frappe.set_user("smoke_consult_pd@test.miyar")
	frappe.get_doc("Delegation", indirect.name).accept()
	frappe.set_user("Administrator")
	indirect.reload()
	_check("Indirect delegation Active after accept (B.R.234)", indirect.status == "Active")
	_check("Delegation log has Created+Accepted entries", len(indirect.delegation_log) == 2)
	_check("Delegator notified of Delegation acceptance (§ 19)", frappe.db.exists("ToDo", {"reference_type": "Delegation", "reference_name": indirect.name, "allocated_to": "smoke_contractor_pd@test.miyar"}))

	frappe.db.commit()
	print("\n=== SUMMARY ===")
	failed = [label for label, ok in RESULTS if not ok]
	print(f"{len(RESULTS) - len(failed)}/{len(RESULTS)} checks passed")
	if failed:
		print("FAILED:", failed)
	return not failed
