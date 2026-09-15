# Copyright (c) 2026, Umran Tech and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class EntityRating(Document):
	def validate(self):
		self.validate_contract_completed()
		self.validate_rated_entity()
		self.validate_single_rating_per_contract()

	def validate_contract_completed(self):
		status = frappe.db.get_value("Miyar Contract", self.contract, "status")
		if status != "Completed":
			frappe.throw(_("Entity Rating can only be submitted for a Completed Contract (B.R.127)."))

	def validate_rated_entity(self):
		contract = frappe.get_cached_doc("Miyar Contract", self.contract)
		if self.entity not in (contract.laboratory, contract.consulting_office):
			frappe.throw(_("You can only rate the Laboratory or Consulting Office on this Contract."))

	def validate_single_rating_per_contract(self):
		existing = frappe.db.exists(
			"Entity Rating", {"contract": self.contract, "entity": self.entity, "name": ["!=", self.name]}
		)
		if existing:
			frappe.throw(_("This Contract has already been rated for {0} (B.R.127).").format(self.entity))

	def after_insert(self):
		self.recompute_entity_rating()

	def on_update(self):
		self.recompute_entity_rating()

	def on_trash(self):
		self.recompute_entity_rating()

	def recompute_entity_rating(self):
		frappe.get_doc("Entity", self.entity).recompute_rating()
