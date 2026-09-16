# Copyright (c) 2026, Umran Tech and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt, nowdate

from miyar.settings import VAT_RATE_PERCENT


class MiyarInvoice(Document):
	def validate(self):
		self.vat_amount = flt(self.amount) * VAT_RATE_PERCENT / 100
		self.total_amount = flt(self.amount) + self.vat_amount

	@frappe.whitelist()
	def mark_paid(self, payment_channel=None):
		"""B.R.139/160 — settle the invoice (advance payment before dispatch, or
		on-completion payment after acceptance)."""
		if self.status == "Paid":
			frappe.throw(_("This invoice is already paid."))
		self.status = "Paid"
		self.paid_on = nowdate()
		self.payment_channel = payment_channel or "SADAD"
		self.save()
		return self.name


def create_invoice(test_request, contract, amount, status="Draft", issued_on=None, due_on=None):
	"""Issued either on submission (advance-payment contracts) or on lab
	acceptance (on-completion contracts) — see B.R.139, 160."""
	invoice = frappe.get_doc(
		{
			"doctype": "Miyar Invoice",
			"test_request": test_request,
			"contract": contract,
			"amount": amount,
			"status": status,
			"issued_on": issued_on or nowdate(),
			"due_on": due_on or nowdate(),
		}
	)
	invoice.insert(ignore_permissions=True)
	if status == "Paid":
		invoice.paid_on = nowdate()
		invoice.payment_channel = "SADAD"
		invoice.save(ignore_permissions=True)
	return invoice.name
