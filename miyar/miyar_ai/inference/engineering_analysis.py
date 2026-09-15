"""Analytical field + recommendation generation (B.R.210, 215–216).

The BRD describes these as "rule-based, versioned knowledge base + SBC 303
requirements" but does not publish that knowledge base. Rather than invent
engineering interpretations, these functions only summarize data that is
already on record (depths achieved, groundwater presence, non-compliant test
results) — always as a draft the Consulting Office must review (B.R.217)
before anything here means anything.
"""

import frappe

from miyar.miyar_ai.api import run_use_case


def propose_analytical_fields(study):
	def _run():
		boreholes = frappe.get_all(
			"Borehole", filters={"geotechnical_study": study.name}, fields=["actual_depth_m", "water_table_m"]
		)
		rows = []
		depths = [b.actual_depth_m for b in boreholes if b.actual_depth_m]
		if depths:
			rows.append({"field_name": "Maximum Investigated Depth (m)", "value": str(max(depths))})
		water_tables = [b.water_table_m for b in boreholes if b.water_table_m is not None]
		rows.append({"field_name": "Groundwater Encountered", "value": "Yes" if water_tables else "No"})
		if water_tables:
			rows.append({"field_name": "Minimum Recorded Water Table (m)", "value": str(min(water_tables))})
		return rows

	return run_use_case("Analytical Field Generation", study, {"geotechnical_study": study.name}, _run)


def propose_recommendations(study):
	def _run():
		rows = []
		boreholes = frappe.get_all("Borehole", filters={"geotechnical_study": study.name}, pluck="name")
		for borehole in boreholes:
			layers = frappe.get_all("Soil Layer", filters={"borehole": borehole}, pluck="name")
			for layer in layers:
				samples = frappe.get_all("Soil Sample", filters={"soil_layer": layer}, fields=["name", "sample_no"])
				for sample in samples:
					for table in ("Lab Test Result", "Chemical Test Result"):
						non_compliant = frappe.get_all(
							table,
							filters={"parent": sample.name, "compliance_status": "Non-Compliant"},
							fields=["test_name", "compliance_rule_version"],
						)
						for row in non_compliant:
							rows.append(
								{
									"recommendation_text": (
										f"Sample {sample.sample_no}: {row.test_name} result is Non-Compliant "
										"— review before certifying this Study (B.R.217)."
									),
									"sbc_clause_reference": row.compliance_rule_version,
								}
							)
		return rows

	return run_use_case("Recommendation Generation", study, {"geotechnical_study": study.name}, _run)
