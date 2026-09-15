# Copyright (c) 2026, Umran Tech and contributors
# For license information, please see license.txt

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import add_to_date, now_datetime, nowdate


class TestMiyarPhase1(FrappeTestCase):
	"""End-to-end coverage of the Phase 1 foundation: Entity directory visibility,
	Principal Delegate, Contract -> Entity Rating gating, Lab Test Catalog delete-block,
	Test Request lifecycle + auto-completion, and Delegation direct/indirect flows."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		frappe.set_user("Administrator")
		cls.service_type = frappe.get_all(
			"Reference Data Item", filters={"category": "Service Type"}, pluck="name"
		)[0]

		cls.contractor = frappe.get_doc(
			{
				"doctype": "Entity",
				"entity_type": "Contractor",
				"cr_number": "TC-CR-1",
				"entity_name": "Test Contracting Co",
				"account_status": "Active",
			}
		).insert(ignore_permissions=True)

		cls.laboratory = frappe.get_doc(
			{
				"doctype": "Entity",
				"entity_type": "Laboratory",
				"cr_number": "TC-CR-2",
				"entity_name": "Test Labs Co",
				"account_status": "Active",
			}
		).insert(ignore_permissions=True)

		cls.consultant = frappe.get_doc(
			{
				"doctype": "Entity",
				"entity_type": "Consulting Office",
				"cr_number": "TC-CR-3",
				"entity_name": "Test Consulting Co",
				"account_status": "Active",
			}
		).insert(ignore_permissions=True)

		for email, entity in [
			("tc_contractor_pd@test.miyar", cls.contractor.name),
			("tc_lab_pd@test.miyar", cls.laboratory.name),
			("tc_consult_pd@test.miyar", cls.consultant.name),
		]:
			if not frappe.db.exists("User", email):
				frappe.get_doc(
					{"doctype": "User", "email": email, "first_name": email.split("@")[0], "send_welcome_email": 0}
				).insert(ignore_permissions=True)
			frappe.get_doc({"doctype": "Principal Delegate", "entity": entity, "user": email}).insert(
				ignore_permissions=True
			)

	def test_entity_directory_visibility(self):
		"""B.R.130: a Laboratory only appears in the directory once it has an active test."""
		self.laboratory.reload()
		self.assertEqual(self.laboratory.is_visible_in_directory, 0)
		self.consultant.reload()
		self.assertEqual(self.consultant.is_visible_in_directory, 1)

	def test_principal_delegate_uniqueness(self):
		self.contractor.reload()
		self.assertTrue(self.contractor.principal_delegate)
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc(
				{"doctype": "Principal Delegate", "entity": self.contractor.name, "user": "tc_lab_pd@test.miyar"}
			).insert(ignore_permissions=True)

	def _make_contract(self):
		contract = frappe.get_doc(
			{
				"doctype": "Miyar Contract",
				"contractor": self.contractor.name,
				"laboratory": self.laboratory.name,
				"consulting_office": self.consultant.name,
				"start_date": nowdate(),
			}
		).insert(ignore_permissions=True)
		contract.submit()
		return contract

	def test_contract_entity_type_validation(self):
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc(
				{
					"doctype": "Miyar Contract",
					"contractor": self.laboratory.name,
					"laboratory": self.laboratory.name,
					"consulting_office": self.consultant.name,
					"start_date": nowdate(),
				}
			).insert(ignore_permissions=True)

	def test_rating_gated_on_completed_contract(self):
		contract = self._make_contract()
		self.assertEqual(contract.status, "Active")

		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc(
				{"doctype": "Entity Rating", "entity": self.laboratory.name, "contract": contract.name, "rating": 0.8}
			).insert(ignore_permissions=True)

		contract.db_set("status", "Completed")
		rating = frappe.get_doc(
			{"doctype": "Entity Rating", "entity": self.laboratory.name, "contract": contract.name, "rating": 0.8}
		).insert(ignore_permissions=True)

		self.laboratory.reload()
		self.assertEqual(self.laboratory.average_rating, 0.8)
		self.assertEqual(self.laboratory.review_count, 1)

		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc(
				{"doctype": "Entity Rating", "entity": self.laboratory.name, "contract": contract.name, "rating": 0.5}
			).insert(ignore_permissions=True)

	def test_lab_catalog_item_cannot_be_deleted(self):
		item = frappe.get_doc(
			{"doctype": "Lab Test Catalog Item", "laboratory": self.laboratory.name, "test_type": self.service_type, "price": 500}
		).insert(ignore_permissions=True)

		with self.assertRaises(frappe.ValidationError):
			frappe.delete_doc("Lab Test Catalog Item", item.name, ignore_permissions=True)

		item.status = "On Hold"
		item.save(ignore_permissions=True)
		self.assertEqual(item.status, "On Hold")

		snapshot_name = item.freeze_snapshot()
		self.assertTrue(frappe.db.exists("Lab Test Catalog History", snapshot_name))

	def test_test_request_lifecycle_and_auto_completion(self):
		contract = self._make_contract()

		too_soon = frappe.get_doc(
			{
				"doctype": "Test Request",
				"contract": contract.name,
				"service_type": self.service_type,
				"test_items": [{"test_type": self.service_type}],
				"schedule_slots": [{"slot_datetime": add_to_date(now_datetime(), hours=2)}],
			}
		).insert(ignore_permissions=True)
		too_soon.submit()
		with self.assertRaises(frappe.ValidationError):
			too_soon.send_to_laboratory()

		tr = frappe.get_doc(
			{
				"doctype": "Test Request",
				"contract": contract.name,
				"service_type": self.service_type,
				"test_items": [{"test_type": self.service_type}],
				"schedule_slots": [{"slot_datetime": add_to_date(now_datetime(), hours=72)}],
			}
		).insert(ignore_permissions=True)
		tr.submit()
		self.assertEqual(tr.contractor, self.contractor.name)
		self.assertEqual(tr.laboratory, self.laboratory.name)

		tr.send_to_laboratory()
		self.assertEqual(tr.status, "Pending Laboratory Decision")
		tr.laboratory_accept()
		self.assertEqual(tr.status, "Accepted")
		tr.start_progress()
		self.assertEqual(tr.status, "In Progress")
		self.assertGreaterEqual(len(tr.status_history), 3)

		tr.test_items[0].status = "Accepted"
		tr.save()
		self.assertEqual(tr.status, "Completed")

	def test_delegation_direct_and_indirect(self):
		contract = self._make_contract()
		tr = frappe.get_doc(
			{
				"doctype": "Test Request",
				"contract": contract.name,
				"service_type": self.service_type,
				"test_items": [{"test_type": self.service_type}],
			}
		).insert(ignore_permissions=True)
		tr.submit()

		direct = frappe.get_doc(
			{
				"doctype": "Delegation",
				"delegation_type": "Direct",
				"scope": "Full Request",
				"test_request": tr.name,
				"delegated_to": "tc_lab_pd@test.miyar",
			}
		).insert(ignore_permissions=True)
		direct.submit()
		self.assertEqual(direct.status, "Active")

		indirect = frappe.get_doc(
			{
				"doctype": "Delegation",
				"delegation_type": "Indirect",
				"scope": "Full Request",
				"test_request": tr.name,
				"delegated_to": "tc_consult_pd@test.miyar",
			}
		).insert(ignore_permissions=True)
		indirect.submit()
		self.assertEqual(indirect.status, "Pending Acceptance")

		frappe.set_user("tc_consult_pd@test.miyar")
		frappe.get_doc("Delegation", indirect.name).accept()
		frappe.set_user("Administrator")

		indirect.reload()
		self.assertEqual(indirect.status, "Active")
		self.assertEqual(len(indirect.delegation_log), 2)
