# Copyright (c) 2026, Umran Tech and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import nowdate


class BusinessFormula(Document):
	def autoname(self):
		self.version = frappe.db.count("Business Formula", {"formula_name": self.formula_name}) + 1
		self.effective_from = nowdate()
		self.name = f"{self.formula_name}-v{self.version}"

	def evaluate(self, context: dict):
		from miyar.miyar_geotechnical.calculations.engine import evaluate_expression

		return evaluate_expression(self.expression, context)


def get_active_formulas():
	names = frappe.get_all("Business Formula", filters={"is_active": 1}, pluck="name")
	return [frappe.get_doc("Business Formula", n) for n in names]
