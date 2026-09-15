# Copyright (c) 2026, Umran Tech and contributors
# For license information, please see license.txt

import json
from math import atan2, cos, radians, sin, sqrt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.model.naming import make_autoname

from miyar.settings import BOREHOLE_DEVIATION_TOLERANCE_M as DEVIATION_TOLERANCE_M

EARTH_RADIUS_M = 6371000


class Borehole(Document):
	def autoname(self):
		self.name = make_autoname(f"BH-{self.geotechnical_study}-.###")

	def validate(self):
		self.compute_deviation()
		self.validate_conditional_mandatory_fields()
		self.validate_completion()

	def validate_conditional_mandatory_fields(self):
		"""mandatory_depends_on in the JSON is Desk-UI-only in Frappe — it is never
		enforced server-side, so these conditional rules must be checked here."""
		if self.is_added_or_modified and not self.justification_note:
			frappe.throw(_("A Justification Note is required for an added/modified Borehole (B.R.178, 179)."))
		if self.is_out_of_location and not self.out_of_location_reason:
			frappe.throw(_("An Out-of-Location Reason is required when the deviation exceeds tolerance (B.R.183)."))

	def compute_deviation(self):
		"""B.R.183 — deviation between planned and operational location, using the
		standard haversine great-circle distance formula."""
		planned = self._point(self.planned_location)
		operational = self._point(self.operational_location)
		if not (planned and operational):
			return
		self.deviation_meters = self._haversine_m(planned, operational)
		self.is_out_of_location = 1 if self.deviation_meters > DEVIATION_TOLERANCE_M else 0

	@staticmethod
	def _point(geolocation):
		if not geolocation:
			return None
		data = json.loads(geolocation) if isinstance(geolocation, str) else geolocation
		for feature in data.get("features", []):
			coords = feature.get("geometry", {}).get("coordinates")
			if coords:
				return (coords[0], coords[1])
		return None

	@staticmethod
	def _haversine_m(p1, p2):
		lng1, lat1, lng2, lat2 = map(radians, [p1[0], p1[1], p2[0], p2[1]])
		dlng, dlat = lng2 - lng1, lat2 - lat1
		a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlng / 2) ** 2
		return EARTH_RADIUS_M * 2 * atan2(sqrt(a), sqrt(1 - a))

	def validate_completion(self):
		"""B.R.191 — a Borehole cannot be Completed until all layers are logged, its
		Borehole Log is generated, and either the approved depth is reached or a
		non-reach reason is documented."""
		if self.status != "Completed":
			return
		if not frappe.db.exists("Soil Layer", {"borehole": self.name}):
			frappe.throw(_("Cannot complete a Borehole with no Soil Layers logged (B.R.191)."))
		if not frappe.db.exists("Borehole Log", {"borehole": self.name}):
			frappe.throw(_("Cannot complete a Borehole before its Borehole Log is generated (B.R.191)."))
		depth_reached = self.actual_depth_m and self.planned_depth_m and self.actual_depth_m >= self.planned_depth_m
		if not depth_reached and not self.non_reach_reason:
			frappe.throw(_("Planned depth was not reached — a Non-Reach Reason is required (B.R.191)."))

	def on_update(self):
		self.refresh_study_progress()

	def refresh_study_progress(self):
		frappe.get_doc("Geotechnical Study", self.geotechnical_study).refresh_progress_stage()

	@frappe.whitelist()
	def generate_log(self):
		from miyar.miyar_geotechnical.doctype.borehole_log.borehole_log import BoreholeLog

		return BoreholeLog.generate(self.name)
