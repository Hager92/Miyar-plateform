# Copyright (c) 2026, Umran Tech and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import now_datetime

APPROVER_ROLES = ("Miyar Consulting Office", "Miyar System Admin", "System Manager")


class ExplorationPlan(Document):
	def validate(self):
		self.validate_reduction_justification()

	def validate_reduction_justification(self):
		"""B.R.174 — the Consulting Office must justify any reduction below the
		Smart Engine's proposed borehole count."""
		if self.engine_proposed_count and len(self.boreholes or []) < self.engine_proposed_count:
			if not self.reduction_justification:
				frappe.throw(_("A justification is required when reducing the proposed borehole count (B.R.174)."))

	def before_submit(self):
		"""B.R.175 — approval of the Exploration Plan is always the Consulting Office."""
		if not set(frappe.get_roles(frappe.session.user)) & set(APPROVER_ROLES):
			frappe.throw(_("Only the Consulting Office can approve an Exploration Plan."))
		if not self.boreholes:
			frappe.throw(_("At least one Borehole is required before approving the Exploration Plan."))
		self.status = "Approved"
		self.approved_by = frappe.session.user
		self.approved_on = now_datetime()

	def on_submit(self):
		study = frappe.get_doc("Geotechnical Study", self.geotechnical_study)
		study.db_set("exploration_plan", self.name)
		study.refresh_progress_stage()

	def on_cancel(self):
		self.status = "Rejected"

	@frappe.whitelist()
	def propose_from_smart_engine(self):
		"""Populate `boreholes` from miyar_ai's geometric even-spacing proposal.
		B.R.173's own borehole-count formula ("المعادلة المعتمدة") is not published in the
		BRD, so this calls the pluggable Smart Engine service instead of guessing it."""
		from miyar.miyar_ai.inference.exploration_plan import propose_exploration_plan

		study = frappe.get_doc("Geotechnical Study", self.geotechnical_study)
		result = propose_exploration_plan(study, min_depth_m=self.min_depth_m)
		self.set("boreholes", [])
		for row in result["boreholes"]:
			self.append("boreholes", row)
		self.engine_proposed_count = len(result["boreholes"])
		self.save()
