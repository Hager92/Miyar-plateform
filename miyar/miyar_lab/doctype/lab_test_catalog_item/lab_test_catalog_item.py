# Copyright (c) 2026, Umran Tech and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import now_datetime


class LabTestCatalogItem(Document):
	def on_trash(self):
		frappe.throw(_("Lab Test Catalog Items cannot be deleted — set Status to On Hold instead (B.R.117)."))

	def on_update(self):
		self.sync_laboratory_directory_flag()

	def sync_laboratory_directory_flag(self):
		"""B.R.130 — a Laboratory only appears in the directory once it has at
		least one Active catalog item. Recomputed on every insert/status change
		(Active <-> On Hold) since Catalog Items can never be deleted (B.R.117)."""
		has_active = bool(
			frappe.db.exists("Lab Test Catalog Item", {"laboratory": self.laboratory, "status": "Active"})
		)
		if bool(frappe.db.get_value("Entity", self.laboratory, "has_active_test")) == has_active:
			return
		entity = frappe.get_doc("Entity", self.laboratory)
		entity.has_active_test = 1 if has_active else 0
		entity.compute_directory_visibility()
		entity.db_set("has_active_test", entity.has_active_test)
		entity.db_set("is_visible_in_directory", entity.is_visible_in_directory)

	@frappe.whitelist()
	def freeze_snapshot(self, reason="Quote Frozen"):
		"""B.R.115–116, 118 — freeze a point-in-time copy of this catalog item, e.g. when it
		is referenced by a quote/contract, so later catalog edits do not retroactively change it."""
		snapshot = frappe.get_doc(
			{
				"doctype": "Lab Test Catalog History",
				"catalog_item": self.name,
				"laboratory": self.laboratory,
				"test_type": self.test_type,
				"price": self.price,
				"turnaround_days": self.turnaround_days,
				"status": self.status,
				"snapshot_reason": reason,
				"snapshot_on": now_datetime(),
			}
		)
		snapshot.insert(ignore_permissions=True)
		return snapshot.name
