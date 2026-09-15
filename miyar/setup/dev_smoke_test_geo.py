"""Standalone functional smoke test for the Phase 2 meyar_geotechnical + meyar_ai
foundation, run the same way as dev_smoke_test.py (see that file's docstring
for why `bench run-tests` doesn't work on this shared bench).

Usage: bench --site mysite.local execute miyar.setup.dev_smoke_test_geo.run
"""

import json

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
	except (frappe.exceptions.ValidationError, frappe.exceptions.PermissionError):
		_check(label, True)


def _point(lng, lat):
	return json.dumps({"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {}, "geometry": {"type": "Point", "coordinates": [lng, lat]}}]})


def _polygon(coords):
	ring = coords + [coords[0]]
	return json.dumps({"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {}, "geometry": {"type": "Polygon", "coordinates": [ring]}}]})


def counts():
	for dt in (
		"Geotechnical Report", "Engineering Analysis", "Soil Sample", "Soil Layer", "Borehole Log",
		"Borehole", "Field Execution Plan", "Exploration Plan", "Geotechnical Study",
		"Compliance Rule", "Business Formula",
	):
		print(dt, frappe.db.count(dt))


def _cleanup():
	frappe.db.delete("Lab Test Catalog Item")
	frappe.db.delete("Lab Test Catalog History")
	for dt in (
		"Geotechnical Report", "Engineering Analysis", "Soil Sample", "Soil Layer", "Borehole Log",
		"Borehole", "Field Execution Plan", "Exploration Plan", "Geotechnical Study", "Entity Rating",
		"Delegation", "Test Request", "Miyar Contract", "Principal Delegate", "Entity",
		"Compliance Rule", "Business Formula", "Reference Data Item",
	):
		filters = {"category": "Test Type", "item_code": ["like", "SMK-%"]} if dt == "Reference Data Item" else {}
		for name in frappe.get_all(dt, filters=filters, pluck="name"):
			doc = frappe.get_doc(dt, name)
			if doc.meta.is_submittable and doc.docstatus == 1:
				doc.cancel()
			frappe.delete_doc(dt, name, force=True, ignore_permissions=True)
	for email in ("smk2_contractor_pd@test.miyar", "smk2_lab_pd@test.miyar", "smk2_consult_pd@test.miyar"):
		if frappe.db.exists("User", email):
			frappe.delete_doc("User", email, force=True, ignore_permissions=True)
	frappe.db.commit()
	print("cleanup done")


def run():
	frappe.set_user("Administrator")
	_cleanup()

	geo_service_type = frappe.get_all("Reference Data Item", filters={"item_code": "GEO-STUDY"}, pluck="name")[0]

	contractor = frappe.get_doc({"doctype": "Entity", "entity_type": "Contractor", "cr_number": "SMK2-CR-1", "entity_name": "Geo Smoke Contracting", "account_status": "Active"}).insert(ignore_permissions=True)
	laboratory = frappe.get_doc({"doctype": "Entity", "entity_type": "Laboratory", "cr_number": "SMK2-CR-2", "entity_name": "Geo Smoke Labs", "account_status": "Active"}).insert(ignore_permissions=True)
	consultant = frappe.get_doc({"doctype": "Entity", "entity_type": "Consulting Office", "cr_number": "SMK2-CR-3", "entity_name": "Geo Smoke Consulting", "account_status": "Active"}).insert(ignore_permissions=True)

	for email, entity in (
		("smk2_contractor_pd@test.miyar", contractor.name),
		("smk2_lab_pd@test.miyar", laboratory.name),
		("smk2_consult_pd@test.miyar", consultant.name),
	):
		if not frappe.db.exists("User", email):
			frappe.get_doc({"doctype": "User", "email": email, "first_name": email.split("@")[0], "send_welcome_email": 0}).insert(ignore_permissions=True)
		frappe.get_doc({"doctype": "Principal Delegate", "entity": entity, "user": email}).insert(ignore_permissions=True)

	contract = frappe.get_doc({"doctype": "Miyar Contract", "contractor": contractor.name, "laboratory": laboratory.name, "consulting_office": consultant.name, "start_date": nowdate()}).insert(ignore_permissions=True)
	contract.submit()

	tr = frappe.get_doc(
		{
			"doctype": "Test Request", "contract": contract.name, "service_type": geo_service_type,
			"test_items": [{"test_type": geo_service_type}],
			"schedule_slots": [{"slot_datetime": add_to_date(now_datetime(), hours=72)}],
		}
	).insert(ignore_permissions=True)
	tr.submit()
	tr.send_to_laboratory()
	tr.laboratory_accept()

	study_name = frappe.db.get_value("Geotechnical Study", {"test_request": tr.name})
	_check("Geotechnical Study auto-created on Test Request Accepted", bool(study_name))

	study = frappe.get_doc("Geotechnical Study", study_name)
	study.site_boundary = _polygon([[46.0, 24.0], [46.001, 24.0], [46.001, 24.001], [46.0, 24.001]])
	study.save(ignore_permissions=True)

	# --- Exploration Plan: Smart Engine proposal + approval ---
	plan = frappe.get_doc({"doctype": "Exploration Plan", "geotechnical_study": study.name}).insert(ignore_permissions=True)
	plan.propose_from_smart_engine()
	plan.reload()
	_check("Smart Engine proposed boreholes from site polygon (4 corners + centroid)", len(plan.boreholes) == 5)
	_check("AI Engine Log recorded the call", frappe.db.exists("AI Engine Log", {"use_case": "Exploration Plan Proposal", "reference_name": study.name}))

	frappe.set_user("smk2_contractor_pd@test.miyar")
	_expect_throw("Non-Consulting-Office cannot approve Exploration Plan (B.R.175)", lambda: frappe.get_doc("Exploration Plan", plan.name).submit())
	frappe.set_user("Administrator")

	plan.reload()
	plan.boreholes = plan.boreholes[:2]  # reduce below engine_proposed_count
	_expect_throw("Reducing borehole count without justification blocked (B.R.174)", lambda: plan.save())
	plan.reload()
	plan.boreholes = plan.boreholes[:2]
	plan.reduction_justification = "Two corners are inaccessible due to an existing structure."
	frappe.set_user("smk2_consult_pd@test.miyar")
	plan.save()
	plan.reload()
	plan.submit()
	frappe.set_user("Administrator")
	plan.reload()
	_check("Exploration Plan Approved by Consulting Office", plan.status == "Approved")

	study.reload()
	_check("Study.exploration_plan linked + progress_stage advanced", study.exploration_plan == plan.name and study.progress_stage == "Exploration Plan")

	# --- Field Execution Plan -> generates actual Boreholes ---
	fep = frappe.get_doc({"doctype": "Field Execution Plan", "geotechnical_study": study.name}).insert(ignore_permissions=True)
	fep.submit()
	boreholes = frappe.get_all("Borehole", filters={"field_execution_plan": fep.name}, pluck="name")
	_check("Field Execution Plan generated Boreholes from approved plan", len(boreholes) == 2)

	bh = frappe.get_doc("Borehole", boreholes[0])
	bh.operational_location = _point(46.002, 24.002)  # far from planned -> deviation
	_expect_throw("Out-of-location Borehole save blocked without reason (B.R.183)", lambda: bh.save(ignore_permissions=True))

	bh.reload()
	bh.operational_location = _point(46.002, 24.002)
	bh.out_of_location_reason = "Access blocked by existing utility line."
	bh.save(ignore_permissions=True)
	bh.reload()
	_check("Borehole deviation computed + flagged out-of-location (B.R.183)", bh.deviation_meters > 3 and bh.is_out_of_location == 1)

	layer = frappe.get_doc({"doctype": "Soil Layer", "borehole": bh.name, "start_depth_m": 0, "end_depth_m": 2, "description": "Silty sand", "classification_field": "SM"}).insert(ignore_permissions=True)
	_check("Soil Layer standalone doc created with auto layer_code", layer.layer_code == "L1")

	_expect_throw("Borehole cannot Complete without Borehole Log (B.R.191)", lambda: setattr(bh, "status", "Completed") or bh.save())

	bh.generate_log()
	_check("Borehole Log generated", frappe.db.exists("Borehole Log", {"borehole": bh.name}))

	bh.reload()
	bh.actual_depth_m = 10
	bh.status = "Completed"
	bh.save(ignore_permissions=True)
	_check("Borehole Completed once layers + log + depth satisfied", bh.status == "Completed")

	# --- Soil Sample mandatory-test enforcement (config-driven, no invented catalog) ---
	sieve = frappe.get_doc({"doctype": "Reference Data Item", "category": "Test Type", "item_code": "SMK-SIEVE", "item_label_ar": "غربلة", "item_label_en": "Sieve Analysis", "mandatory_for_material_type": "Soil"}).insert(ignore_permissions=True)

	sample = frappe.get_doc({"doctype": "Soil Sample", "soil_layer": layer.name, "sample_no": "S1", "material_type": "Soil"}).insert(ignore_permissions=True)
	sample.reload()
	_check("Mandatory test auto-added to new Soil Sample (B.R.197)", any(r.test_name == sieve.name and r.is_mandatory for r in sample.lab_test_results))
	_check("Sample mandatory_tests_status Pending until result filled", sample.mandatory_tests_status == "Pending")

	# --- Compliance Rule evaluation (B.R.205) ---
	rule = frappe.get_doc({"doctype": "Compliance Rule", "test_type": sieve.name, "comparison_operator": ">=", "min_value": 50}).insert(ignore_permissions=True)
	sample.lab_test_results[0].result_value = "70"
	sample.save(ignore_permissions=True)
	sample.reload()
	result_row = sample.lab_test_results[0]
	_check("Lab Test Result evaluated Compliant against active rule (B.R.205)", result_row.compliance_status == "Compliant" and rule.name in (result_row.compliance_rule_version or ""))
	_check("Sample mandatory_tests_status Complete once result filled", sample.mandatory_tests_status == "Complete")

	# --- Engineering Analysis: Business Formula recompute + Smart Engine + approval -> auto Report ---
	bh.water_table_m = 4.5
	bh.save(ignore_permissions=True)

	formula = frappe.get_doc(
		{
			"doctype": "Business Formula", "formula_name": "SMK Depth Check", "output_fieldname": "Half Max Depth",
			"input_variables": "max_depth_m", "expression": "max_depth_m / 2",
		}
	).insert(ignore_permissions=True)

	ea = frappe.get_doc({"doctype": "Engineering Analysis", "geotechnical_study": study.name}).insert(ignore_permissions=True)
	ea.recompute()
	ea.reload()
	_check("Business Formula recompute produced Calculation Field Result", any(r.formula == formula.name and r.value == 5.0 for r in ea.calculation_fields))

	frappe.set_user("smk2_lab_pd@test.miyar")
	_expect_throw("Non-privileged user cannot edit engine-owned Calculation Fields (B.R.218)", lambda: (setattr(ea.calculation_fields[0], "value", 999), ea.save())[1])
	frappe.set_user("Administrator")
	ea.reload()

	ea.generate_smart_engine_outputs()
	ea.reload()
	_check("Smart Engine populated Analytical Fields", any(r.field_name == "Groundwater Encountered" and r.value == "Yes" for r in ea.analytical_fields))
	_check("Engineering Analysis Pending Consultant Review", ea.status == "Pending Consultant Review")

	frappe.set_user("smk2_consult_pd@test.miyar")
	frappe.get_doc("Engineering Analysis", ea.name).approve()
	frappe.set_user("Administrator")

	ea.reload()
	_check("Engineering Analysis Approved by Consulting Office", ea.status == "Approved")

	report_name = frappe.db.get_value("Geotechnical Report", {"geotechnical_study": study.name})
	_check("Geotechnical Report auto-generated + issued on approval (B.R.220, 223)", bool(report_name))
	if report_name:
		report = frappe.get_doc("Geotechnical Report", report_name)
		_check("Geotechnical Report submitted/immutable", report.docstatus == 1 and report.preview_status == "Finalized")

	study.reload()
	_check("Study.progress_stage = Report Issued", study.progress_stage == "Report Issued")

	frappe.db.commit()
	print("\n=== SUMMARY (Phase 2 / Geotechnical) ===")
	failed = [label for label, ok in RESULTS if not ok]
	print(f"{len(RESULTS) - len(failed)}/{len(RESULTS)} checks passed")
	if failed:
		print("FAILED:", failed)
	return not failed
