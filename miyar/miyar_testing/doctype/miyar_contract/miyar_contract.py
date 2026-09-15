# Copyright (c) 2026, Umran Tech and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class MiyarContract(Document):
	def validate(self):
		self.validate_entity_types()

	def validate_entity_types(self):
		self._check_entity_type(self.contractor, "Contractor")
		self._check_entity_type(self.laboratory, "Laboratory")
		self._check_entity_type(self.consulting_office, "Consulting Office")

	def _check_entity_type(self, entity, expected_type):
		if not entity:
			return
		entity_type = frappe.db.get_value("Entity", entity, "entity_type")
		if entity_type != expected_type:
			frappe.throw(
				frappe._("{0} must be an Entity of type {1}, not {2}.").format(entity, expected_type, entity_type)
			)

	def on_submit(self):
		if self.status == "Draft":
			self.db_set("status", "Active")

	def on_cancel(self):
		self.db_set("status", "Cancelled")
