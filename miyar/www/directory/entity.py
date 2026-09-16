# Copyright (c) 2026, Umran Tech and contributors
# For license information, please see license.txt

"""Public entity profile page (B.R.125) — دليل المنشآت والتقييمات."""

import frappe

from miyar.miyar_core.api.directory import get_entity_profile

no_cache = 1
sitemap = 0


def get_context(context):
	entity = frappe.form_dict.get("name")
	if not entity:
		frappe.local.flags.redirect_location = "/directory"
		raise frappe.Redirect

	try:
		profile = get_entity_profile(entity)
	except frappe.DoesNotExistError:
		frappe.local.flags.redirect_location = "/directory"
		raise frappe.Redirect

	context.parents = [{"name": "Home", "route": "/"}, {"name": "دليل المنشآت", "route": "/directory"}]
	context.title = profile["entity_name"]
	context.profile = profile
	return context
