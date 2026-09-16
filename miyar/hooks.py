app_name = "miyar"
app_title = "Miyar"
app_publisher = "Umran Tech"
app_description = "National digital platform for soil, road, and construction-material testing management"
app_email = "nadine.sherif@ido.sa"
app_license = "mit"

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
add_to_apps_screen = [
	{
		"name": "miyar",
		"title": "Miyar",
		"route": "/app/miyar",
	}
]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
app_include_css = "/assets/miyar/css/miyar.css"

# include js, css files in header of web template
# web_include_css = "/assets/miyar/css/miyar.css"
# web_include_js = "/assets/miyar/js/miyar.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "miyar/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "miyar/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# automatically load and sync documents of this doctype from downstream apps
# importable_doctypes = [doctype_1]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "miyar.utils.jinja_methods",
# 	"filters": "miyar.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "miyar.install.before_install"
after_install = [
	"miyar.setup.roles.ensure_roles",
	"miyar.setup.reference_data.ensure_reference_data",
]
after_migrate = [
	"miyar.setup.roles.ensure_roles",
	"miyar.setup.reference_data.ensure_reference_data",
]

# Uninstallation
# ------------

# before_uninstall = "miyar.uninstall.before_uninstall"
# after_uninstall = "miyar.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "miyar.utils.before_app_install"
# after_app_install = "miyar.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "miyar.utils.before_app_uninstall"
# after_app_uninstall = "miyar.utils.after_app_uninstall"

# Build
# ------------------
# To hook into the build process

# after_build = "miyar.build.after_build"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "miyar.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

permission_query_conditions = {
	"Miyar Contract": "miyar.permissions.get_contract_permission_query_conditions",
	"Miyar Invoice": "miyar.permissions.get_invoice_permission_query_conditions",
	"Test Request": "miyar.permissions.get_test_request_permission_query_conditions",
	"Delegation": "miyar.permissions.get_delegation_permission_query_conditions",
	"Geotechnical Study": "miyar.permissions.get_geotechnical_study_permission_query_conditions",
	"Exploration Plan": "miyar.permissions.get_exploration_plan_permission_query_conditions",
	"Field Execution Plan": "miyar.permissions.get_field_execution_plan_permission_query_conditions",
	"Borehole": "miyar.permissions.get_borehole_permission_query_conditions",
	"Engineering Analysis": "miyar.permissions.get_engineering_analysis_permission_query_conditions",
	"Geotechnical Report": "miyar.permissions.get_geotechnical_report_permission_query_conditions",
}

has_permission = {
	"Entity": "miyar.permissions.has_entity_permission",
	"Miyar Invoice": "miyar.permissions.has_invoice_permission",
}

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"miyar.tasks.all"
# 	],
# 	"daily": [
# 		"miyar.tasks.daily"
# 	],
# 	"hourly": [
# 		"miyar.tasks.hourly"
# 	],
# 	"weekly": [
# 		"miyar.tasks.weekly"
# 	],
# 	"monthly": [
# 		"miyar.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "miyar.install.before_tests"

# Extend DocType Class
# ------------------------------
#
# Specify custom mixins to extend the standard doctype controller.
# extend_doctype_class = {
# 	"Task": "miyar.custom.task.CustomTaskMixin"
# }

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "miyar.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "miyar.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["miyar.utils.before_request"]
# after_request = ["miyar.utils.after_request"]

# Job Events
# ----------
# before_job = ["miyar.utils.before_job"]
# after_job = ["miyar.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"miyar.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

# Translation
# ------------
# List of apps whose translatable strings should be excluded from this app's translations.
# ignore_translatable_strings_from = []

