# Copyright (c) 2026, Umran Tech and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import now_datetime, time_diff_in_hours

from miyar.settings import CONSULTANT_DECISION_SLA_HOURS, LAB_RESPONSE_SLA_HOURS

SLA_HOURS_BY_STATUS = {
	"Pending Laboratory Decision": LAB_RESPONSE_SLA_HOURS,  # B.R.147
	"In Progress": CONSULTANT_DECISION_SLA_HOURS,  # B.R.152 (approximated at request level)
}


def execute(filters=None):
	columns = [
		{"label": "Test Request", "fieldname": "name", "fieldtype": "Link", "options": "Test Request", "width": 150},
		{"label": "Status", "fieldname": "status", "fieldtype": "Data", "width": 160},
		{"label": "Contractor", "fieldname": "contractor", "fieldtype": "Link", "options": "Entity", "width": 150},
		{"label": "Laboratory", "fieldname": "laboratory", "fieldtype": "Link", "options": "Entity", "width": 150},
		{"label": "Consulting Office", "fieldname": "consulting_office", "fieldtype": "Link", "options": "Entity", "width": 150},
		{"label": "Hours in Current Status", "fieldname": "hours_in_status", "fieldtype": "Float", "width": 160},
		{"label": "SLA Breached", "fieldname": "sla_breached", "fieldtype": "Check", "width": 100},
	]

	requests = frappe.get_all(
		"Test Request",
		filters=filters or {},
		fields=["name", "status", "contractor", "laboratory", "consulting_office", "modified"],
	)
	now = now_datetime()
	data = []
	for row in requests:
		last_change = frappe.db.get_value(
			"Test Status History", {"parent": row.name}, "changed_on", order_by="changed_on desc"
		)
		hours = time_diff_in_hours(now, last_change or row.modified)
		threshold = SLA_HOURS_BY_STATUS.get(row.status)
		row["hours_in_status"] = round(hours, 1)
		row["sla_breached"] = 1 if threshold and hours > threshold else 0
		data.append(row)

	return columns, data
