# Copyright (c) 2026, Umran Tech and contributors
# For license information, please see license.txt

import frappe


def execute(filters=None):
	columns = [
		{"label": "Laboratory", "fieldname": "name", "fieldtype": "Link", "options": "Entity", "width": 150},
		{"label": "Entity Name", "fieldname": "entity_name", "fieldtype": "Data", "width": 200},
		{"label": "Average Rating", "fieldname": "average_rating", "fieldtype": "Float", "width": 130},
		{"label": "Review Count", "fieldname": "review_count", "fieldtype": "Int", "width": 110},
		{"label": "Active Catalog Items", "fieldname": "active_catalog_items", "fieldtype": "Int", "width": 150},
		{"label": "Directory Visible", "fieldname": "is_visible_in_directory", "fieldtype": "Check", "width": 120},
	]

	labs = frappe.get_all(
		"Entity",
		filters={"entity_type": "Laboratory", **(filters or {})},
		fields=["name", "entity_name", "average_rating", "review_count", "is_visible_in_directory"],
	)
	for row in labs:
		row["active_catalog_items"] = frappe.db.count(
			"Lab Test Catalog Item", {"laboratory": row.name, "status": "Active"}
		)

	return columns, labs
