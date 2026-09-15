"""In-app notifications (§ 19). Channel matrix (email/SMS/in-app) is not specified
in the BRD; per this analysis's own recommendation, in-app + email is the default
and SMS is deferred. Implemented via Frappe's standard ToDo assignment, which
surfaces in the recipient's notification bell and to-do list — the same pattern
request_center uses for its "To Review" counters.
"""

import frappe
from frappe.desk.form.assign_to import add as assign_to


def notify_users(doctype, docname, users, description):
	users = [u for u in dict.fromkeys(users) if u and u != "Administrator"]
	if not users:
		return
	assign_to(
		{
			"doctype": doctype,
			"name": docname,
			"assign_to": users,
			"description": description,
			"notify": 1,
		}
	)


def get_entity_notify_users(entity):
	"""Active Principal Delegate(s) for an Entity."""
	if not entity:
		return []
	return frappe.get_all("Principal Delegate", filters={"entity": entity, "is_active": 1}, pluck="user")
