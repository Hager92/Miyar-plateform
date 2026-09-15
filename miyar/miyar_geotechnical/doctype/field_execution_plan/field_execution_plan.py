# Copyright (c) 2026, Umran Tech and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class FieldExecutionPlan(Document):
	def before_submit(self):
		"""B.R.176–179 — a Field Execution Plan can only be approved once its
		Geotechnical Study has an approved (submitted) Exploration Plan."""
		if not self.exploration_plan or frappe.db.get_value("Exploration Plan", self.exploration_plan, "docstatus") != 1:
			frappe.throw(_("The Geotechnical Study's Exploration Plan must be approved before the Field Execution Plan can be approved."))
		self.status = "Approved"

	def on_submit(self):
		self.generate_boreholes()
		study = frappe.get_doc("Geotechnical Study", self.geotechnical_study)
		study.db_set("field_execution_plan", self.name)
		study.refresh_progress_stage()

	@frappe.whitelist()
	def generate_boreholes(self):
		"""B.R.176 — one actual Borehole per row of the approved Exploration Plan."""
		if frappe.get_all("Borehole", filters={"field_execution_plan": self.name}, limit=1):
			return
		plan = frappe.get_doc("Exploration Plan", self.exploration_plan)
		for row in plan.boreholes:
			frappe.get_doc(
				{
					"doctype": "Borehole",
					"geotechnical_study": self.geotechnical_study,
					"field_execution_plan": self.name,
					"planned_location": row.location,
					"planned_depth_m": row.planned_depth_m,
				}
			).insert(ignore_permissions=True)
