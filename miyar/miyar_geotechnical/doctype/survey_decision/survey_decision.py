# Copyright (c) 2026, Umran Tech and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class SurveyDecision(Document):
	def before_insert(self):
		if not self.uploaded_by:
			self.uploaded_by = frappe.session.user

	def on_update(self):
		frappe.db.set_value("Geotechnical Study", self.geotechnical_study, "survey_decision", self.name)
