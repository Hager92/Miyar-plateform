# Copyright (c) 2026, Umran Tech and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import now_datetime


class LabTestCatalogItem(Document):
	def on_trash(self):
		frappe.throw(_("Lab Test Catalog Items cannot be deleted — set Status to On Hold instead (B.R.117)."))

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
