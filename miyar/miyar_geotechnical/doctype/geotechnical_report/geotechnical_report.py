# Copyright (c) 2026, Umran Tech and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime


class GeotechnicalReport(Document):
	def before_submit(self):
		"""B.R.220–223 — final, immutable once issued. B.R.221: no field here holds
		free-text technical content — the print output renders from the linked
		Engineering Analysis / Borehole Logs / Study directly, never authored here."""
		self.preview_status = "Finalized"

	def on_submit(self):
		frappe.get_doc("Geotechnical Study", self.geotechnical_study).db_set("geotechnical_report", self.name)
		frappe.get_doc("Geotechnical Study", self.geotechnical_study).refresh_progress_stage()


def generate_report(geotechnical_study):
	"""B.R.223 — auto-triggered the moment the Consulting Office approves the
	Engineering Analysis. Idempotent: does nothing if already generated."""
	existing = frappe.db.get_value("Geotechnical Report", {"geotechnical_study": geotechnical_study})
	if existing:
		return existing
	report = frappe.get_doc(
		{
			"doctype": "Geotechnical Report",
			"geotechnical_study": geotechnical_study,
			"generation_trigger": "Auto on Consultant Approval",
			"generated_on": now_datetime(),
		}
	)
	report.insert(ignore_permissions=True)
	report.submit()
	return report.name
