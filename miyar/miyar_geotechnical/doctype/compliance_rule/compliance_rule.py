# Copyright (c) 2026, Umran Tech and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import nowdate


class ComplianceRule(Document):
	def autoname(self):
		self.version = (
			frappe.db.count("Compliance Rule", {"test_type": self.test_type}) + 1
		)
		self.effective_from = nowdate()
		self.name = f"CR-{self.test_type}-v{self.version}"

	def evaluate(self, value):
		"""Returns 'Compliant' / 'Non-Compliant' for a numeric result value."""
		try:
			value = float(value)
		except (TypeError, ValueError):
			return None
		op = self.comparison_operator
		if op == ">=":
			ok = value >= self.min_value
		elif op == "<=":
			ok = value <= self.max_value
		elif op == ">":
			ok = value > self.min_value
		elif op == "<":
			ok = value < self.max_value
		elif op == "==":
			ok = value == self.min_value
		elif op == "between":
			ok = self.min_value <= value <= self.max_value
		else:
			return None
		return "Compliant" if ok else "Non-Compliant"


def get_active_rule(test_type):
	name = frappe.db.get_value("Compliance Rule", {"test_type": test_type, "is_active": 1}, "name", order_by="version desc")
	return frappe.get_doc("Compliance Rule", name) if name else None
