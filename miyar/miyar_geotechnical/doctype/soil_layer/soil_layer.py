# Copyright (c) 2026, Umran Tech and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class SoilLayer(Document):
	def autoname(self):
		seq = frappe.db.count("Soil Layer", {"borehole": self.borehole}) + 1
		self.layer_code = f"L{seq}"
		self.name = f"{self.borehole}-{self.layer_code}"

	def validate(self):
		self.compute_field_test_n_values()

	def compute_field_test_n_values(self):
		"""Frappe never calls a child table row's own controller validate() method
		automatically — only the (nearest standalone) parent's validate() runs —
		so Field Test Result's N-value calc has to happen here, not in its own class."""
		for row in self.field_tests:
			if row.blow_count_n2 is not None and row.blow_count_n3 is not None:
				row.n_value = row.blow_count_n2 + row.blow_count_n3
