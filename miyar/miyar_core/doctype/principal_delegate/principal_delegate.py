# Copyright (c) 2026, Umran Tech and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

ENTITY_TYPE_ROLE = {
	"Contractor": "Miyar Contractor",
	"Laboratory": "Miyar Laboratory",
	"Consulting Office": "Miyar Consulting Office",
	"Supervisory Authority": "Miyar Supervisory Authority",
}


class PrincipalDelegate(Document):
	def validate(self):
		self.check_single_active_delegate_per_entity()

	def check_single_active_delegate_per_entity(self):
		if not self.is_active:
			return
		existing = frappe.db.exists(
			"Principal Delegate",
			{"entity": self.entity, "is_active": 1, "name": ["!=", self.name]},
		)
		if existing:
			frappe.throw(
				_("Entity {0} already has an active Principal Delegate ({1}).").format(
					self.entity, existing
				)
			)

	def on_update(self):
		self.sync_entity_principal_delegate()
		self.grant_entity_role()

	def on_trash(self):
		entity = frappe.get_doc("Entity", self.entity)
		if entity.principal_delegate == self.name:
			entity.db_set("principal_delegate", None)

	def sync_entity_principal_delegate(self):
		if not self.is_active:
			return
		entity = frappe.get_doc("Entity", self.entity)
		if entity.principal_delegate != self.name:
			entity.db_set("principal_delegate", self.name)

	def grant_entity_role(self):
		"""Give the Principal Delegate's User the Role matching their Entity's type
		(e.g. Contractor -> 'Miyar Contractor'), plus 'Miyar Principal Delegate',
		so role-based permissions on Contract/Test Request/Delegation actually apply."""
		if not self.is_active:
			return
		entity_type = frappe.db.get_value("Entity", self.entity, "entity_type")
		roles_to_grant = {"Miyar Principal Delegate"}
		if entity_type in ENTITY_TYPE_ROLE:
			roles_to_grant.add(ENTITY_TYPE_ROLE[entity_type])

		user = frappe.get_doc("User", self.user)
		existing_roles = {r.role for r in user.roles}
		missing_roles = roles_to_grant - existing_roles
		if missing_roles:
			for role in missing_roles:
				user.append("roles", {"role": role})
			user.save(ignore_permissions=True)
