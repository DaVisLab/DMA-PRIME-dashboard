GEOJSON_FILES = {
    "state": "sc_state_population_simplified.json",
    "county": "tl_2024_sc_county_simplified.json",
    "zcta": "tl_2024_sc_zcta_simplified.json",
}

SPATIAL_UNITS = {"state", "region", "county", "zcta", "facility"}

DATA_DASHBOARDS = [
    "respiratory",
    "waste_water",
    "other_infectious_diseases",
    "opioid_hcv_hiv",
    "mhc",
]

UI_TO_DATA_DASHBOARD = {
    "respiratory": "respiratory",
    "wastewater": "waste_water",
    "outbreak-detection": "other_infectious_diseases",
    "opioid-hcv-hiv": "opioid_hcv_hiv",
    "mobile-health-clinics": "mhc",
}

OPENAI_API_KEY = ""

WORKFLOW_AGENT_DEBUG_PREFIX = "[WorkflowAgent]"

WORKFLOW_MODEL_ALIASES = {
    "gpt4.1": "gpt-4.1",
    "gpt-4.1": "gpt-4.1",
    "gpt 5.5": "gpt-5.5",
    "gpt-5.5": "gpt-5.5",
    "gpt4o": "gpt-4o",
    "gpt-4o": "gpt-4o",
}

WORKFLOW_AGENT_SYSTEM_PROMPT = """You are a helpful and precise assistant for helping users find the right data visualizations in the Data Commons Dashboard. You will be provided with a user's question, and you will determine which dashboard and which visualization within that dashboard can best answer the user's question.
"""
