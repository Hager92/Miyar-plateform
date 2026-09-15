# Copyright (c) 2026, Umran Tech and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime


class BoreholeLog(Document):
	def before_save(self):
		self.generated_on = now_datetime()
		self.generated_by = frappe.session.user

	@staticmethod
	def generate(borehole_name):
		"""B.R.189–190 — create or refresh this Borehole's log from its current
		layers/samples/lab results. Called after field logging and again whenever
		lab results come in, so the log always reflects the latest data.

		Soil Layer and Soil Sample are standalone DocTypes (not nested child
		tables of Borehole), so each level is fetched independently rather than
		via attribute traversal — Frappe does not auto-load a child table more
		than one level deep from whatever document was directly loaded."""
		borehole = frappe.get_doc("Borehole", borehole_name)
		lines = [f"Borehole {borehole.name} — Planned depth {borehole.planned_depth_m or '-'} m, Actual depth {borehole.actual_depth_m or '-'} m"]
		layers = frappe.get_all("Soil Layer", filters={"borehole": borehole_name}, fields=["name", "layer_code", "start_depth_m", "end_depth_m", "description", "classification_field"], order_by="layer_code asc")
		for layer in layers:
			lines.append(f"\n{layer.layer_code}: {layer.start_depth_m}-{layer.end_depth_m}m — {layer.description}")
			if layer.classification_field:
				lines.append(f"  Field classification: {layer.classification_field}")
			layer_doc = frappe.get_doc("Soil Layer", layer.name)
			for ft in layer_doc.field_tests:
				lines.append(f"  Field test @ {ft.test_depth_m}m: N={ft.n_value}, REC={ft.recovery_percent}%")
			samples = frappe.get_all("Soil Sample", filters={"soil_layer": layer.name}, fields=["sample_no", "material_type", "lab_classification"])
			for sample in samples:
				lines.append(f"  Sample {sample.sample_no} ({sample.material_type}): lab classification = {sample.lab_classification or 'pending'}")

		content = "\n".join(lines)
		name = frappe.db.get_value("Borehole Log", {"borehole": borehole_name})
		if name:
			log = frappe.get_doc("Borehole Log", name)
			log.content = content
			log.save(ignore_permissions=True)
		else:
			log = frappe.get_doc({"doctype": "Borehole Log", "borehole": borehole_name, "content": content})
			log.insert(ignore_permissions=True)
		return log.name
