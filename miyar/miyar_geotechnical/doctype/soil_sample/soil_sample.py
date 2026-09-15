# Copyright (c) 2026, Umran Tech and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import now_datetime


class SoilSample(Document):
	def autoname(self):
		self.name = f"{self.soil_layer}-{self.sample_no}"

	def validate(self):
		self.ensure_mandatory_tests()
		self.evaluate_compliance()
		self.compute_mandatory_tests_status()

	def evaluate_compliance(self):
		"""B.R.205 — Frappe never calls a child table row's own controller
		validate() method automatically, so Lab/Chemical Test Result's Compliance
		Rule evaluation has to happen here, in the (standalone) parent, not there."""
		from miyar.miyar_geotechnical.doctype.compliance_rule.compliance_rule import get_active_rule

		for row in list(self.lab_test_results) + list(self.chemical_test_results):
			if not row.result_value:
				continue
			rule = get_active_rule(row.test_name)
			if not rule:
				continue
			status = rule.evaluate(row.result_value)
			if status:
				row.compliance_status = status
				row.compliance_rule_version = f"{rule.name} (v{rule.version})"
				row.evaluated_on = now_datetime()

	def ensure_mandatory_tests(self):
		"""B.R.197 — mandatory tests are non-removable once configured (via
		Reference Data Item.mandatory_for_material_type) for this Sample's material_type.
		Auto-adds any missing mandatory row and blocks removal of an existing one."""
		required = frappe.get_all(
			"Reference Data Item",
			filters={"category": "Test Type", "mandatory_for_material_type": ["in", (self.material_type, "Both")]},
			pluck="name",
		)
		if not required:
			return

		present = {row.test_name for row in self.lab_test_results}
		for code in required:
			if code not in present:
				self.append("lab_test_results", {"test_name": code, "is_mandatory": 1})

		for row in self.lab_test_results:
			if row.test_name in required:
				row.is_mandatory = 1

	def compute_mandatory_tests_status(self):
		mandatory_rows = [r for r in self.lab_test_results if r.is_mandatory]
		if mandatory_rows and all(r.result_value for r in mandatory_rows):
			self.mandatory_tests_status = "Complete"
		else:
			self.mandatory_tests_status = "Pending" if mandatory_rows else "Complete"
