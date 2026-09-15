"""Configurable business-rule thresholds (BRD calls each of these out as
"configurable" without specifying an admin UI for them yet — kept as one
module so a future Settings DocType can source its defaults from here).
"""

MAX_TEST_ITEMS_PER_REQUEST = 10  # B.R.137
MIN_HOURS_TO_FIRST_SLOT = 48  # B.R.138
LAB_RESPONSE_SLA_HOURS = 12  # B.R.147
CONSULTANT_DECISION_SLA_HOURS = 48  # B.R.152
BOREHOLE_DEVIATION_TOLERANCE_M = 3  # B.R.183
DEFAULT_MIN_BOREHOLE_DEPTH_M = 10  # B.R.173
