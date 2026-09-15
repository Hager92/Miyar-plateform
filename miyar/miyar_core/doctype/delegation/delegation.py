# Copyright (c) 2026, Umran Tech and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import now_datetime

DELEGATION_PRIVILEGED_ROLES = ("Miyar Principal Delegate", "Miyar System Admin", "System Manager")


class Delegation(Document):
	def before_insert(self):
		if not self.delegated_by:
			self.delegated_by = frappe.session.user

	def validate(self):
		self.guard_edit_after_field_work_started()
		self.validate_conditional_mandatory_fields()

	def validate_conditional_mandatory_fields(self):
		"""mandatory_depends_on in the JSON is Desk-UI-only in Frappe — it is never
		enforced server-side, so this conditional rule must be checked here."""
		if self.scope == "Single Test" and not self.test_request_item:
			frappe.throw(_("Test (row name) is required when Scope is Single Test (B.R.232)."))

	def guard_edit_after_field_work_started(self):
		"""B.R.235 — once field work has started, only the Principal Delegate / a
		delegation-privileged user may change who the delegate is."""
		if self.is_new() or not self.field_work_started:
			return
		before = self.get_doc_before_save()
		if not before or before.delegated_to == self.delegated_to:
			return
		if not set(frappe.get_roles(frappe.session.user)) & set(DELEGATION_PRIVILEGED_ROLES):
			frappe.throw(_("Only the Principal Delegate can reassign a Delegation after field work has started."))

	def before_submit(self):
		if self.delegation_type == "Direct":
			self.status = "Active"
		else:
			self.status = "Pending Acceptance"
		self.append(
			"delegation_log",
			{"action": "Created", "action_by": frappe.session.user, "action_on": now_datetime()},
		)

	def on_submit(self):
		if self.status == "Active":
			self.grant_employee_role()
		if self.delegation_type == "Indirect":
			self._notify([self.delegated_to], "You have been delegated on a Test Request — please accept or reject")

	def on_update_after_submit(self):
		if self.status == "Active":
			self.grant_employee_role()

	def grant_employee_role(self):
		"""So a delegated user without their own Principal Delegate access can be
		scoped in via permission_query_conditions (miyar.permissions)."""
		user = frappe.get_doc("User", self.delegated_to)
		if not any(r.role == "Miyar Employee" for r in user.roles):
			user.append("roles", {"role": "Miyar Employee"})
			user.save(ignore_permissions=True)

	def on_cancel(self):
		self.append(
			"delegation_log",
			{"action": "Cancelled", "action_by": frappe.session.user, "action_on": now_datetime()},
		)
		self.db_update()

	@frappe.whitelist()
	def accept(self):
		"""B.R.234 — the delegate accepts an Indirect delegation."""
		self._respond_to_delegation("Accepted", "Active")

	@frappe.whitelist()
	def reject(self):
		"""B.R.234 — the delegate declines an Indirect delegation."""
		self._respond_to_delegation("Rejected", "Rejected")

	def _respond_to_delegation(self, log_action, new_status):
		if self.docstatus != 1 or self.status != "Pending Acceptance":
			frappe.throw(_("Only a Delegation Pending Acceptance can be responded to."))
		if frappe.session.user != self.delegated_to:
			frappe.throw(_("Only the delegate can respond to this Delegation."))
		self.status = new_status
		self.append(
			"delegation_log",
			{"action": log_action, "action_by": frappe.session.user, "action_on": now_datetime()},
		)
		self.save(ignore_permissions=True)
		self._notify([self.delegated_by], f"Delegation {log_action} by {self.delegated_to}")

	def _notify(self, users, description):
		from miyar.notifications import notify_users

		notify_users(self.doctype, self.name, users, description)
