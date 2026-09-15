import frappe


def run():
	from miyar.miyar_testing.report.test_request_sla_aging.test_request_sla_aging import execute as sla_report
	from miyar.miyar_lab.report.lab_performance.lab_performance import execute as lab_report
	from miyar.miyar_geotechnical.report.geotechnical_pipeline_funnel.geotechnical_pipeline_funnel import execute as funnel_report

	cols, rows = sla_report()
	print("SLA Aging report:", len(cols), "columns,", len(rows), "rows")
	for r in rows[:5]:
		print("  ", r.get("name"), r.get("status"), r.get("hours_in_status"), "breached=" + str(r.get("sla_breached")))

	cols, rows = lab_report()
	print("Lab Performance report:", len(cols), "columns,", len(rows), "rows")
	for r in rows[:5]:
		print("  ", r.get("name"), r.get("average_rating"), r.get("active_catalog_items"))

	cols, rows = funnel_report()
	print("Geotechnical Pipeline Funnel:", len(cols), "columns,", len(rows), "rows")
	for r in rows:
		print("  ", r["progress_stage"], r["count"])
