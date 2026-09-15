# Copyright (c) 2026, Umran Tech and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import now_datetime

APPROVER_ROLES = ("Miyar Consulting Office", "Miyar System Admin", "System Manager")


class EngineeringAnalysis(Document):
	def before_save(self):
		self.guard_field_level_lock()

	CONTENT_FIELDS = {
		"calculation_fields": ("fieldname_label", "value", "unit", "formula", "formula_version"),
		"analytical_fields": ("field_name", "value"),
		"recommendations": ("recommendation_text", "sbc_clause_reference"),
	}

	def guard_field_level_lock(self):
		"""B.R.218 — Calculation/Analytical/Recommendation rows are engine/system-owned;
		block direct user edits from Desk/API while still allowing our own
		recompute methods (which call save(ignore_permissions=True) internally).
		Compares only the substantive columns — not framework-managed ones like
		`modified`/`docstatus`, which legitimately differ on every save regardless
		of content and would otherwise cause false positives here."""
		if frappe.flags.in_miyar_ai_recompute:
			return
		if set(frappe.get_roles(frappe.session.user)) & {"Miyar System Admin", "System Manager"}:
			return
		before = self.get_doc_before_save()
		if not before:
			return
		for table_field, content_cols in self.CONTENT_FIELDS.items():
			current = [tuple(row.get(c) for c in content_cols) for row in self.get(table_field) or []]
			previous = [tuple(row.get(c) for c in content_cols) for row in before.get(table_field) or []]
			if current != previous:
				frappe.throw(_("{0} are system/engine-owned and cannot be edited directly (B.R.218).").format(table_field))

	def report_already_issued(self):
		return bool(frappe.db.exists("Geotechnical Report", {"geotechnical_study": self.geotechnical_study, "docstatus": 1}))

	@frappe.whitelist()
	def recompute(self):
		"""B.R.213–214 — re-run every active Business Formula against this Study's
		current field/lab data. A no-op once the Geotechnical Report is issued."""
		if self.report_already_issued():
			frappe.throw(_("This Study's Geotechnical Report has already been issued; Engineering Analysis is frozen."))

		from miyar.miyar_geotechnical.doctype.business_formula.business_formula import get_active_formulas

		context = self._build_context()
		frappe.flags.in_miyar_ai_recompute = True
		try:
			self.calculation_fields = []
			for formula in get_active_formulas():
				variables = [v.strip() for v in (formula.input_variables or "").split(",") if v.strip()]
				if not all(v in context for v in variables):
					continue
				try:
					value = formula.evaluate({v: context[v] for v in variables})
				except Exception as e:
					frappe.log_error(title="Business Formula evaluation failed", message=str(e))
					continue
				self.append(
					"calculation_fields",
					{
						"fieldname_label": formula.output_fieldname,
						"value": value,
						"unit": formula.unit,
						"formula": formula.name,
						"formula_version": formula.version,
					},
				)
			self.save(ignore_permissions=True)
		finally:
			frappe.flags.in_miyar_ai_recompute = False

	def _build_context(self):
		"""Flatten this Study's Boreholes/Layers/Samples into named variables a
		Business Formula's expression can reference."""
		context = {}
		boreholes = frappe.get_all("Borehole", filters={"geotechnical_study": self.geotechnical_study}, fields=["name", "actual_depth_m", "water_table_m"])
		if boreholes:
			depths = [b.actual_depth_m for b in boreholes if b.actual_depth_m]
			water_tables = [b.water_table_m for b in boreholes if b.water_table_m is not None]
			if depths:
				context["max_depth_m"] = max(depths)
				context["avg_depth_m"] = sum(depths) / len(depths)
			if water_tables:
				context["min_water_table_m"] = min(water_tables)
			context["borehole_count"] = len(boreholes)
		return context

	@frappe.whitelist()
	def generate_smart_engine_outputs(self):
		"""B.R.215–216 — populate Analytical Fields + Recommendations via the Smart
		Engine, then require Consulting Office review before anything is binding."""
		if self.report_already_issued():
			frappe.throw(_("This Study's Geotechnical Report has already been issued; Engineering Analysis is frozen."))

		from miyar.miyar_ai.inference.engineering_analysis import propose_analytical_fields, propose_recommendations

		study = frappe.get_doc("Geotechnical Study", self.geotechnical_study)
		frappe.flags.in_miyar_ai_recompute = True
		try:
			self.analytical_fields = []
			for row in propose_analytical_fields(study):
				self.append("analytical_fields", {**row, "generated_on": now_datetime()})
			self.recommendations = []
			for row in propose_recommendations(study):
				self.append("recommendations", {**row, "generated_on": now_datetime()})
			self.status = "Pending Consultant Review"
			self.save(ignore_permissions=True)
		finally:
			frappe.flags.in_miyar_ai_recompute = False

	@frappe.whitelist()
	def approve(self):
		"""B.R.217 — compliance verdicts and analysis content are always Consultant-gated,
		even though the engine/formula layer computed the draft values."""
		if not set(frappe.get_roles(frappe.session.user)) & set(APPROVER_ROLES):
			frappe.throw(_("Only the Consulting Office can approve Engineering Analysis."))
		self.status = "Approved"
		self.reviewed_by = frappe.session.user
		self.reviewed_on = now_datetime()
		self.save(ignore_permissions=True)

		study = frappe.get_doc("Geotechnical Study", self.geotechnical_study)
		study.db_set("engineering_analysis", self.name)
		study.refresh_progress_stage()

		from miyar.miyar_geotechnical.doctype.geotechnical_report.geotechnical_report import generate_report

		generate_report(self.geotechnical_study)
