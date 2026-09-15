# Copyright (c) 2026, Umran Tech and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

GEO_STUDY_SERVICE_TYPE_CODE = "GEO-STUDY"


class GeotechnicalStudy(Document):
	def validate(self):
		self.validate_service_type()

	def validate_service_type(self):
		service_type = frappe.db.get_value("Test Request", self.test_request, "service_type")
		if service_type != GEO_STUDY_SERVICE_TYPE_CODE:
			frappe.throw(_("A Geotechnical Study can only be linked to a Test Request whose Service Type is Geotechnical Study."))

	def refresh_progress_stage(self):
		"""B.R.166 — progress tracker only, computed from downstream stage documents.
		Never writes to Test Request.status."""
		stage = "Initial Data"
		if self.geotechnical_report:
			stage = "Report Issued"
		elif self.engineering_analysis:
			stage = "Engineering Analysis"
		elif self.field_execution_plan and self._all_boreholes_complete():
			stage = "Lab Testing"
		elif self.field_execution_plan:
			stage = "Field Execution"
		elif self.exploration_plan and frappe.db.get_value("Exploration Plan", self.exploration_plan, "docstatus") == 1:
			stage = "Exploration Plan"
		if stage != self.progress_stage:
			self.db_set("progress_stage", stage)

	def _all_boreholes_complete(self):
		boreholes = frappe.get_all("Borehole", filters={"geotechnical_study": self.name}, fields=["status"])
		return bool(boreholes) and all(b.status == "Completed" for b in boreholes)

	@frappe.whitelist()
	def ready_for_lab_testing(self):
		"""B.R.192 — the platform-wide gate: no Lab (chemical/physical) testing may
		start until every Borehole in this Study is Completed and field works approved."""
		return self._all_boreholes_complete()
