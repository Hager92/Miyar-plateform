# Copyright (c) 2026, Umran Tech and contributors
# For license information, please see license.txt

"""Public Marketplace / Facility Directory API (دليل المنشآت والتقييمات, B.R.122-131).

The BRD is explicit that the directory is browsable by "جميع زوار المنصة" —
*all visitors of the platform*, i.e. unauthenticated members of the public,
not only logged-in Entities (B.R.122, 123, 125). No DocType-level permission
grants Guest read access to `Entity` or `Lab Test Catalog Item` (and it
should not: that would let an anonymous caller enumerate internal fields —
CR number, account_status, principal_delegate — for every row via the
generic `/api/resource/Entity` list endpoint). Instead this module exposes a
narrow, safe, allow_guest=True read surface that:
  - only ever returns Entities with is_visible_in_directory=1 (B.R.130),
  - only ever returns the specific public-profile fields the BRD names
    (B.R.125), never internal/administrative fields,
  - applies the mandated ranking rule itself (B.R.124, 129) rather than
    trusting the caller to sort correctly.
"""

import frappe
from frappe.utils import cint, flt, strip_html

PUBLIC_LIST_FIELDS = [
	"name",
	"entity_type",
	"entity_name",
	"logo",
	"description",
	"average_rating",
	"review_count",
]

PUBLIC_PROFILE_FIELDS = PUBLIC_LIST_FIELDS + ["geo_location"]


def _specializations_for(entity_names):
	if not entity_names:
		return {}
	rows = frappe.get_all(
		"Miyar Entity Specialization",
		filters={"parent": ["in", entity_names], "parenttype": "Entity"},
		fields=["parent", "reference_data_item"],
		ignore_permissions=True,
	)
	if not rows:
		return {e: [] for e in entity_names}
	item_names = list({r.reference_data_item for r in rows})
	labels = {
		i.name: {"code": i.item_code, "label_ar": i.item_label_ar, "label_en": i.item_label_en}
		for i in frappe.get_all(
			"Reference Data Item",
			filters={"name": ["in", item_names]},
			fields=["name", "item_code", "item_label_ar", "item_label_en"],
			ignore_permissions=True,
		)
	}
	by_entity = {e: [] for e in entity_names}
	for r in rows:
		if r.reference_data_item in labels:
			by_entity[r.parent].append(labels[r.reference_data_item])
	return by_entity


def _contact_channels_for(entity_name):
	return frappe.get_all(
		"Miyar Contact Channel",
		filters={"parent": entity_name, "parenttype": "Entity"},
		fields=["channel_type", "value"],
		order_by="idx",
		ignore_permissions=True,
	)


def _bbox_filters(min_lat, max_lat, min_lng, max_lng):
	"""B.R.123 — filter by geographic location, expressed as a bounding box
	over the Geolocation field's embedded GeoJSON Point coordinates."""
	if not all(v is not None for v in (min_lat, max_lat, min_lng, max_lng)):
		return None
	return (flt(min_lat), flt(max_lat), flt(min_lng), flt(max_lng))


def _point_in_bbox(geo_location, bbox):
	import json

	if not geo_location:
		return False
	try:
		data = json.loads(geo_location) if isinstance(geo_location, str) else geo_location
		for feature in data.get("features", []):
			coords = feature.get("geometry", {}).get("coordinates")
			if coords:
				lng, lat = coords[0], coords[1]
				min_lat, max_lat, min_lng, max_lng = bbox
				return min_lat <= lat <= max_lat and min_lng <= lng <= max_lng
	except Exception:
		return False
	return False


@frappe.whitelist(allow_guest=True)
def get_directory(
	entity_type=None,
	specialization=None,
	search=None,
	min_rating=None,
	min_lat=None,
	max_lat=None,
	min_lng=None,
	max_lng=None,
	start=0,
	page_length=20,
):
	"""B.R.122–124 — the public directory list: search/filter, then ranked by
	average rating desc, tie-broken by review count desc."""
	filters = {"is_visible_in_directory": 1}
	if entity_type:
		filters["entity_type"] = entity_type
	if search:
		filters["entity_name"] = ["like", f"%{search}%"]
	if min_rating:
		filters["average_rating"] = [">=", flt(min_rating)]

	entities = frappe.get_all(
		"Entity",
		filters=filters,
		fields=PUBLIC_LIST_FIELDS,
		ignore_permissions=True,
	)
	for e in entities:
		e.description = strip_html(e.description) if e.description else e.description

	if specialization:
		specs = _specializations_for([e.name for e in entities])
		entities = [e for e in entities if any(s["code"] == specialization or s["label_en"] == specialization for s in specs.get(e.name, []))]

	bbox = _bbox_filters(min_lat, max_lat, min_lng, max_lng)
	if bbox:
		locations = {
			r.name: r.geo_location
			for r in frappe.get_all("Entity", filters={"name": ["in", [e.name for e in entities]]}, fields=["name", "geo_location"], ignore_permissions=True)
		}
		entities = [e for e in entities if _point_in_bbox(locations.get(e.name), bbox)]

	# B.R.124 — average rating desc, then review count desc.
	entities.sort(key=lambda e: (flt(e.average_rating), cint(e.review_count)), reverse=True)

	total = len(entities)
	start = cint(start)
	page_length = cint(page_length) or 20
	page = entities[start : start + page_length]

	spec_map = _specializations_for([e.name for e in page])
	for e in page:
		e["specializations"] = spec_map.get(e.name, [])

	return {"total": total, "start": start, "page_length": page_length, "results": page}


@frappe.whitelist(allow_guest=True)
def get_entity_profile(entity):
	"""B.R.125 — full public profile, including a Laboratory's active test
	catalog with base prices. Raises if the Entity is not directory-visible
	(B.R.130) rather than leaking its existence/data."""
	row = frappe.db.get_value("Entity", {"name": entity, "is_visible_in_directory": 1}, PUBLIC_PROFILE_FIELDS, as_dict=True)
	if not row:
		frappe.throw(frappe._("Entity not found or not published in the directory."), frappe.DoesNotExistError)

	if row.get("description"):
		row["description"] = strip_html(row["description"])
	row["contact_channels"] = _contact_channels_for(entity)
	row["specializations"] = _specializations_for([entity]).get(entity, [])

	if row["entity_type"] == "Laboratory":
		catalog = frappe.get_all(
			"Lab Test Catalog Item",
			filters={"laboratory": entity, "status": "Active"},
			fields=["name", "test_type", "price", "currency", "turnaround_days", "description"],
			ignore_permissions=True,
		)
		test_types = {
			i.name: {"code": i.item_code, "label_ar": i.item_label_ar, "label_en": i.item_label_en}
			for i in frappe.get_all(
				"Reference Data Item",
				filters={"name": ["in", [c.test_type for c in catalog]]},
				fields=["name", "item_code", "item_label_ar", "item_label_en"],
				ignore_permissions=True,
			)
		}
		for c in catalog:
			c["test_type_label"] = test_types.get(c.test_type)
		row["test_catalog"] = catalog

	reviews = frappe.get_all(
		"Entity Rating",
		filters={"entity": entity, "is_hidden": 0},
		fields=["rating", "comments", "rated_by", "creation"],
		order_by="creation desc",
		limit_page_length=20,
		ignore_permissions=True,
	)
	row["recent_reviews"] = reviews
	return row


@frappe.whitelist(allow_guest=True)
def get_public_catalog():
	"""Flat list of every Active Lab Test Catalog Item across every directory-visible
	Laboratory — B.R.125's "قائمة الاختبارات مع أسعارها الأساسية", aggregated for the
	directory list view (one call instead of one per-lab profile fetch)."""
	visible_labs = frappe.get_all("Entity", filters={"entity_type": "Laboratory", "is_visible_in_directory": 1}, pluck="name")
	if not visible_labs:
		return []
	items = frappe.get_all(
		"Lab Test Catalog Item",
		filters={"laboratory": ["in", visible_labs], "status": "Active"},
		fields=["name", "laboratory", "test_type", "price", "currency", "turnaround_days"],
		ignore_permissions=True,
	)
	test_types = {
		i.name: {"code": i.item_code, "label_ar": i.item_label_ar, "label_en": i.item_label_en}
		for i in frappe.get_all(
			"Reference Data Item",
			filters={"name": ["in", [c.test_type for c in items]]},
			fields=["name", "item_code", "item_label_ar", "item_label_en"],
			ignore_permissions=True,
		)
	}
	for i in items:
		i["test_type_label"] = test_types.get(i.test_type)
	return items
