# Copyright (c) 2026, Umran Tech and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.model.naming import make_autoname
from frappe.utils import cint, flt

ENTITY_TYPE_PREFIX = {
	"Contractor": "CON",
	"Laboratory": "LAB",
	"Consulting Office": "CNS",
	"Supervisory Authority": "SUP",
}


class Entity(Document):
	def autoname(self):
		prefix = ENTITY_TYPE_PREFIX.get(self.entity_type, "ENT")
		self.name = make_autoname(f"{prefix}-.#####")

	def validate(self):
		self.compute_directory_visibility()

	def compute_directory_visibility(self):
		"""B.R.130: (account_status == Active) AND (entity_type != Laboratory OR has_active_test == 1)"""
		is_active = self.account_status == "Active"
		lab_condition = self.entity_type != "Laboratory" or bool(self.has_active_test)
		self.is_visible_in_directory = 1 if (is_active and lab_condition) else 0

	def recompute_rating(self):
		"""B.R.124, B.R.129 — recompute average_rating/review_count from non-hidden Entity Ratings."""
		row = frappe.db.sql(
			"""select avg(rating) as avg_rating, count(name) as review_count
			from `tabEntity Rating` where entity = %s and is_hidden = 0""",
			(self.name,),
			as_dict=True,
		)[0]
		self.db_set("average_rating", flt(row.avg_rating) or 0)
		self.db_set("review_count", cint(row.review_count) or 0)
