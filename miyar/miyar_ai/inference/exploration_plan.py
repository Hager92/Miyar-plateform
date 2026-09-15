"""Exploration Plan proposal (خطة الاستكشاف) — one of the 5 confirmed Smart Engine use cases (B.R.173).

The BRD states a pre-approved, versioned borehole-count formula exists
("المعادلة المعتمدة") but does not publish it, and separately describes a
"Site-boundary distribution" use case as a geometric even-spacing algorithm.
Rather than inventing the unpublished count formula, this module implements
only the geometric part the BRD does describe: one candidate borehole at each
vertex of the site boundary polygon, plus one at its centroid. Every proposal
is always subject to Consulting Office review/approval before it means
anything (B.R.174, 175) — this function only ever produces a draft.
"""

import json

import frappe

from miyar.miyar_ai.api import run_use_case


def _extract_polygon_points(site_boundary):
	"""Parse a Frappe Geolocation field (GeoJSON FeatureCollection) into a
	flat list of (lng, lat) tuples from its first Polygon/LineString feature."""
	if not site_boundary:
		return []
	data = json.loads(site_boundary) if isinstance(site_boundary, str) else site_boundary
	for feature in data.get("features", []):
		geometry = feature.get("geometry", {})
		coords = geometry.get("coordinates")
		if not coords:
			continue
		if geometry.get("type") == "Polygon":
			ring = coords[0]
			return [(pt[0], pt[1]) for pt in ring[:-1]]  # drop closing point == first point
		if geometry.get("type") in ("LineString", "MultiPoint"):
			return [(pt[0], pt[1]) for pt in coords]
		if geometry.get("type") == "Point":
			return [(coords[0], coords[1])]
	return []


def _centroid(points):
	n = len(points)
	return (sum(p[0] for p in points) / n, sum(p[1] for p in points) / n)


def _point_geolocation(lng, lat):
	return json.dumps(
		{
			"type": "FeatureCollection",
			"features": [{"type": "Feature", "properties": {}, "geometry": {"type": "Point", "coordinates": [lng, lat]}}],
		}
	)


def propose_exploration_plan(study, min_depth_m=10):
	"""Returns {"boreholes": [{sequence_no, location, planned_depth_m, source}, ...]}."""

	def _run():
		points = _extract_polygon_points(study.site_boundary)
		if not points:
			frappe.throw(
				frappe._(
					"Site Boundary must be drawn on the Geotechnical Study before requesting a Smart Engine proposal."
				)
			)
		rows = [
			{
				"sequence_no": idx,
				"location": _point_geolocation(lng, lat),
				"planned_depth_m": min_depth_m,
				"source": "Smart Engine",
			}
			for idx, (lng, lat) in enumerate(points, start=1)
		]
		if len(points) > 1:
			c_lng, c_lat = _centroid(points)
			rows.append(
				{
					"sequence_no": len(points) + 1,
					"location": _point_geolocation(c_lng, c_lat),
					"planned_depth_m": min_depth_m,
					"source": "Smart Engine",
				}
			)
		return {"boreholes": rows}

	return run_use_case(
		"Exploration Plan Proposal", study, {"min_depth_m": min_depth_m, "site_boundary": study.site_boundary}, _run
	)
