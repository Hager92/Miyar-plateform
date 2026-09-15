# Copyright (c) 2026, Umran Tech and contributors
# For license information, please see license.txt

import frappe

STAGE_ORDER = [
	"Initial Data",
	"Exploration Plan",
	"Field Execution",
	"Lab Testing",
	"Engineering Analysis",
	"Report Issued",
]


def execute(filters=None):
	columns = [
		{"label": "Progress Stage", "fieldname": "progress_stage", "fieldtype": "Data", "width": 200},
		{"label": "Count", "fieldname": "count", "fieldtype": "Int", "width": 100},
	]

	rows = frappe.db.sql(
		"select progress_stage, count(name) as count from `tabGeotechnical Study` group by progress_stage",
		as_dict=True,
	)
	by_stage = {r.progress_stage: r.count for r in rows}
	data = [{"progress_stage": stage, "count": by_stage.get(stage, 0)} for stage in STAGE_ORDER]

	return columns, data
