# Copyright (c) 2026, Umran Tech and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class ReferenceDataItem(Document):
	def on_update(self):
		if self.category == "Test Type" and not self.is_new():
			self.notify_labs_with_active_catalog_items()

	def notify_labs_with_active_catalog_items(self):
		"""B.R.113, § 19 — an admin edit to a Test Type used in an active catalog
		quote workflow must notify the owning Laboratory."""
		from miyar.notifications import get_entity_notify_users, notify_users

		laboratories = frappe.get_all(
			"Lab Test Catalog Item", filters={"test_type": self.name, "status": "Active"}, pluck="laboratory"
		)
		for laboratory in set(laboratories):
			notify_users(
				self.doctype,
				self.name,
				get_entity_notify_users(laboratory),
				f"Reference data for '{self.item_label_en or self.item_label_ar}' was updated — review your active catalog quotes.",
			)
