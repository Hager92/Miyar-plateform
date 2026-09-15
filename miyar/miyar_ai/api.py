"""Internal service-call wrapper for the Smart Engine (المحرك الذكي).

Per the BRD (B.R.224–231) the Smart Engine has no independent user identity and
only ever produces proposals for a human (always the Consulting Office, B.R.174,
217) to review — it never approves, signs, or issues a verdict itself. Every call
is logged to `AI Engine Log`, and a failure here must never block the caller
(B.R.230): callers should let the exception surface as a clear, recoverable
message so the user can fall back to entering data manually, not treat it as a
fatal error.
"""

import json

import frappe
from frappe.utils import now_datetime


def log_ai_call(use_case, reference_doc=None, input_data=None, output_data=None, error=None):
	frappe.get_doc(
		{
			"doctype": "AI Engine Log",
			"use_case": use_case,
			"reference_doctype": reference_doc.doctype if reference_doc else None,
			"reference_name": reference_doc.name if reference_doc else None,
			"status": "Failed" if error else "Success",
			"called_by": frappe.session.user,
			"called_on": now_datetime(),
			"input_summary": json.dumps(input_data, default=str) if input_data is not None else None,
			"output_summary": json.dumps(output_data, default=str) if output_data is not None else None,
			"error_message": str(error) if error else None,
		}
	).insert(ignore_permissions=True)


def run_use_case(use_case, reference_doc, input_data, fn):
	"""Run `fn()`, log the call either way, and re-raise on failure with the
	original exception so the caller can decide how to degrade gracefully."""
	try:
		output_data = fn()
	except Exception as e:
		log_ai_call(use_case, reference_doc, input_data, error=e)
		raise
	log_ai_call(use_case, reference_doc, input_data, output_data)
	return output_data
