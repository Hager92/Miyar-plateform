# Copyright (c) 2026, Umran Tech and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import add_to_date, now_datetime

from miyar.settings import MAX_TEST_ITEMS_PER_REQUEST as MAX_TEST_ITEMS
from miyar.settings import MIN_HOURS_TO_FIRST_SLOT

GEO_STUDY_SERVICE_TYPE_CODE = "GEO-STUDY"


class TestRequest(Document):
	def validate(self):
		self.validate_test_item_count()
		self.validate_conditional_mandatory_fields()
		self.track_status_change()
		self.check_auto_complete()

	def validate_conditional_mandatory_fields(self):
		"""mandatory_depends_on in the JSON is Desk-UI-only in Frappe — it is never
		enforced server-side, so this conditional rule must be checked here too,
		as a backstop behind laboratory_reject()'s own check."""
		if self.status == "Rejected" and not self.rejection_reason:
			frappe.throw(_("A Rejection Reason is required (B.R.147)."))

	def before_update_after_submit(self):
		"""Frappe only calls validate() for the 'save'/'submit' actions; once the
		document is submitted (docstatus=1), further .save() calls go through the
		'update_after_submit' action instead, which calls this hook. All the status
		transition methods below run after submit, so the same logic must run here too."""
		self.track_status_change()
		self.check_auto_complete()

	def validate_test_item_count(self):
		"""B.R.137 — max test items per request (configurable)."""
		if len(self.test_items or []) > MAX_TEST_ITEMS:
			frappe.throw(_("A Test Request may not contain more than {0} tests (B.R.137).").format(MAX_TEST_ITEMS))

	def track_status_change(self):
		if self.is_new():
			return
		before = self.get_doc_before_save()
		if before and before.status != self.status:
			self.append(
				"status_history",
				{
					"from_status": before.status,
					"to_status": self.status,
					"changed_by": frappe.session.user,
					"changed_on": now_datetime(),
				},
			)

	def check_auto_complete(self):
		"""B.R.154 — auto-complete once every Test Request Item is Accepted or Rejected."""
		if self.status != "In Progress" or not self.test_items:
			return
		if all(item.status in ("Accepted", "Rejected") for item in self.test_items):
			self.status = "Completed"

	@frappe.whitelist()
	def send_to_laboratory(self):
		"""B.R.139 — Contractor sends the request once mandatory data + payment are complete."""
		if self.status not in ("Draft", "Execution Planning"):
			frappe.throw(_("Only a Draft or Execution Planning request can be sent."))
		if self.schedule_slots:
			first_slot = min(s.slot_datetime for s in self.schedule_slots)
			if first_slot < add_to_date(now_datetime(), hours=MIN_HOURS_TO_FIRST_SLOT):
				frappe.throw(_("The earliest proposed slot must be at least {0} hours from now (B.R.138).").format(
					MIN_HOURS_TO_FIRST_SLOT
				))
		self.status = "Pending Laboratory Decision"
		self.save()
		self.notify("New Test Request Received", self.laboratory)

	@frappe.whitelist()
	def laboratory_accept(self, slot_datetime=None):
		if self.status != "Pending Laboratory Decision":
			frappe.throw(_("Only a request Pending Laboratory Decision can be accepted."))
		if slot_datetime:
			for slot in self.schedule_slots:
				slot.is_selected = 1 if slot.slot_datetime == slot_datetime else 0
		self.status = "Accepted"
		self.save()
		self.create_geotechnical_study_if_needed()
		self.notify("Test Request Accepted by Laboratory", self.contractor)

	def notify(self, description, *entities):
		"""B.R.157, § 19 — in-app notification (email default is deferred; the
		BRD does not specify a channel matrix) to the Principal Delegate(s) of
		the given Entities."""
		from miyar.notifications import get_entity_notify_users, notify_users

		users = [u for entity in entities for u in get_entity_notify_users(entity)]
		notify_users(self.doctype, self.name, users, description)

	def create_geotechnical_study_if_needed(self):
		"""B.R.161, 164 — a Test Request whose service_type is دراسة جيوتقنية
		owns a 1:1 Geotechnical Study sub-lifecycle, created once the request is Accepted."""
		if self.service_type != GEO_STUDY_SERVICE_TYPE_CODE:
			return
		if frappe.db.exists("Geotechnical Study", {"test_request": self.name}):
			return
		frappe.get_doc({"doctype": "Geotechnical Study", "test_request": self.name}).insert(ignore_permissions=True)

	@frappe.whitelist()
	def laboratory_reject(self, rejection_reason):
		if self.status != "Pending Laboratory Decision":
			frappe.throw(_("Only a request Pending Laboratory Decision can be rejected."))
		if not rejection_reason:
			frappe.throw(_("A rejection reason is required (B.R.147)."))
		self.status = "Rejected"
		self.rejection_reason = rejection_reason
		self.save()
		self.notify("Test Request Rejected by Laboratory", self.contractor)

	@frappe.whitelist()
	def start_progress(self):
		if self.status != "Accepted":
			frappe.throw(_("Only an Accepted request can move In Progress."))
		self.status = "In Progress"
		self.save()

	@frappe.whitelist()
	def set_item_status(self, item_idx, status):
		"""Lab marks a Test Request Item's output ready for Consultant review, or
		the Consulting Office records its Accept/Reject decision (B.R.151–153)."""
		item = next((i for i in self.test_items if i.idx == int(item_idx)), None)
		if not item:
			frappe.throw(_("Test item #{0} not found.").format(item_idx))
		item.status = status
		self.save()
		if status == "Pending Consultant Decision":
			self.notify("Test Output Pending Your Review", self.consulting_office)
		elif status in ("Accepted", "Rejected"):
			self.notify(f"Test Output {status} by Consulting Office", self.contractor)
