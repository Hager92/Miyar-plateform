# Copyright (c) 2026, Umran Tech and contributors
# For license information, please see license.txt

"""Public website page for دليل المنشآت والتقييمات (B.R.122-131).

Server-renders the first page of the directory (so the page works and is
indexable with JavaScript disabled), then miyar-directory.js progressively
enhances it with live search/filter against the same guest API used here.
"""

import frappe

from miyar.miyar_core.api.directory import get_directory

no_cache = 1
sitemap = 1


def get_context(context):
	context.parents = [{"name": "Home", "route": "/"}]
	context.title = "دليل المنشآت والتقييمات"
	result = get_directory(page_length=20)
	context.entities = result["results"]
	context.total = result["total"]
	context.entity_types = frappe.get_all(
		"Entity",
		filters={"is_visible_in_directory": 1},
		distinct=True,
		pluck="entity_type",
	)
	return context
