"""AI prompt endpoints used by the exploratory outbreak-detection interface."""

import base64
import json
import os
import re
from pathlib import Path

import requests
from flask import Blueprint, current_app, request
from flask_login import login_required
from werkzeug.utils import secure_filename

bp = Blueprint("ai", __name__, url_prefix="/ai")

ollama_url = "http://localhost:11434/api/generate"
ollama_chat_url = "http://localhost:11434/api/chat"
# force ollama to use cpu only
os.environ.setdefault("OLLAMA_USE_GPU", "false")

project_dir = Path(__file__).resolve().parent
frontend_dir = project_dir / "static"
DEFAULT_AI_TIMEOUT_SECONDS = 60


def _json_payload(*required_fields):
    """Parse a JSON request body and report missing fields consistently."""
    params = request.get_json(silent=True) or {}
    missing = [field for field in required_fields if field not in params]
    if missing:
        return (
            params,
            {"error": "Missing required JSON fields", "missing": missing},
            400,
        )
    return params, None, None


def _frontend_path(relative_path):
    """Resolve a frontend file path while preventing path traversal."""
    resolved_path = (frontend_dir / Path(relative_path)).resolve()
    if resolved_path != frontend_dir and frontend_dir not in resolved_path.parents:
        raise ValueError(f"Path is outside static assets: {relative_path}")
    return resolved_path


@bp.route("/classify_user_intent", methods=["POST"])
@login_required
def ai_prompt_input():
    params, error, status_code = _json_payload("prompt", "interfaceContext")
    if error:
        return error, status_code

    prompt = params["prompt"]
    interface_context = params["interfaceContext"]

    try:
        user_intent = ai_input_categorization(prompt)
        update_required = ai_decide_interface_update_required(prompt, interface_context)

        return_resp = {
            "user_intent": user_intent["response"],
            "update_required": update_required["response"],
        }

    except Exception as e:
        current_app.logger.exception("AI categorization failed")
        return {"error": "AI request failed", "details": str(e)}, 500

    return return_resp


@bp.route("/request_chart", methods=["POST"])
@login_required
def ai_prompt_request_chart():
    params, error, status_code = _json_payload("prompt")
    if error:
        return error, status_code

    prompt = params["prompt"]
    returnValue = ai_return_visChart(prompt)
    return {"response": returnValue}


@bp.route("/generate_tutorial", methods=["POST"])
@login_required
def ai_prompt_generate_tutorial():
    params, error, status_code = _json_payload("system_specification")
    if error:
        return error, status_code

    system_specification = params["system_specification"]

    view_specifications = system_specification["viewInfo"]
    selector_specifications = system_specification["selectorInfo"]
    data_context = system_specification["dataContext"]

    description_for_selector = []
    description_for_view = []
    for view_spec in selector_specifications:
        prompt = f"""You are the lead developer and designer of a visual analytics system.
      Your task is Writing a first-time user tutorial that explains how to use the interface effectively and how to interpret insights from it.
      Write exactly ONE tutorial item for the following item.
        
        spec: {view_spec}   
        
      Return in this exact schema:

      {{
      "id": "",
      "type": "selector"
      "description": "",
      }}
      
      Hard RULES
  - id MUST be exactly the same value to the given spec.
  - description: based only on Vega Lite specification fields for view or selectable options and current value, describe what this view is about and how it can be used. In case of selector, if options are too long, you don't need to use all but summary of them.
  - Do NOT invent encodings or coordination. If missing, write exactly:
    "Not specified in the provided spec."
      """
        returnVal = get_ai_generated_response(prompt)
        description_for_selector.append(json.loads(returnVal["response"]))

    for view_spec in view_specifications:

        spec_path = _frontend_path(view_spec["specification"])

        with open(spec_path, "r", encoding="utf-8") as file:
            content = file.read()
            prompt = f"""You are an expert in data visualization and visual analytics. Analyze the following D3.js visualization code to understand what the user sees and can do in the visualization interface.Your goal is to explain the chart from a user’s perspective, focusing on what information it presents, what role it plays in analysis, and how users can interact with it to gain insights.

                    Explanation Scope (Important)
                    Base your explanation on what can be observed or experienced by a user when interacting with the chart.
                    Use the code only as evidence for what the interface enables.
                    Do NOT:
                    - Explain programming or D3 implementation details
                    - Mention event handlers, function names, or internal variables
                    - Describe how the chart is drawn or implemented
                    - Assume domain meaning beyond what the visual encodings suggest
                    - If something is unclear from the chart behavior, explicitly state the uncertainty.

                    What to Explain
                    1. Chart Type (User-Perceived)
                    Identify the chart type in user terms (e.g., “a line chart showing change over time”, “a map showing geographic differences”).

                    2. Role of the Chart
                    Explain why this chart exists in the interface.
                    Describe what kinds of questions a user can answer by looking at or using this chart.
                    Indicate which analytical purposes it primarily supports:
                    - understanding trends
                    - comparing values
                    - seeing distributions
                    - understanding spatial patterns
                    - exploring relationships
                    - monitoring changes or anomalies

                    3. Visual Encodings (What Users Read)
                    Describe what each visible visual element represents (e.g., horizontal position, vertical position, color).
                    Explain what these elements correspond to in real-world or data terms as perceived by users.
                    Only include encodings that are clearly visible in the chart.

                    4. Interactions (What Users Can Do)
                    Describe what actions users can take with the chart (e.g., hovering, clicking, dragging, zooming), as experienced in the interface.
                    Explain what happens visually or informationally when users perform these actions.
                    If interactions affect other parts of the interface (e.g., another chart updates or highlights), explain this from the user’s point of view, without technical explanation.
                    If such effects are unclear or only partially supported, state that uncertainty.

                    Output Format (Strict)
                    Return ONLY a valid JSON object in the following structure.
                    Do not include technical language or implementation details.
                    {{
                      "View Componenet ID": ""
                      "Chart Type": "",
                      "Role of the Chart": {{
                        "purpose": "",
                        "questions_users_can_answer": [],
                        "primary_analysis_goals": []
                      }},
                      "Visual Encodings": {{
                        "encoding": {{
                          "what_users_see": "",
                          "what_it_represents": ""
                        }}
                      }},
                      "Interactions": {{
                        "interaction": {{
                          "user_action": "",
                          "what_happens": "",
                          "effect_on_other_views": "",
                          "uncertainty": ""
                        }}
                      }}
                    }}
                    Only include encodings and interactions that a user can actually perceive.
                    If no interaction or cross-view effect is apparent to users, state that explicitly.
                   
                    Inputs: 
                      - Data context: {data_context}
                      - D3js code: {content}
                  """
            returnVal = get_ai_generated_response(prompt)
            description_for_view.append(json.loads(returnVal["response"]))

    return {
        "response": {
            "description_for_view": description_for_view,
            "description_for_selector": description_for_selector,
        }
    }


def ai_input_categorization(prompt):
    # Build a clean, dedented prompt to send to the model

    request_prompt = f"""You are user intent classifier for users who is using a disease risk dashboard in South Carolina.
Your job is to interpret USER_INPUT and return:
1) which request category USER_INPUT belongs to:
   GeneralRequest — General question or request
   VisRequest — Request to draw or generate a chart
   InsightRequestFromVis — Request asking about a chart or explaining a chart and providing insights
   InsightRequestFromData — Request to generate insights from data

You will be given:
1) USER_INPUT
- a natural-language user message.
- {prompt}
    
Hard Rules:
- Return ONLY a valid JSON object (no markdown, no code fences, no explanations).
- Return a JSON object with this exact schema:
{{
  "request_type": GeneralRequest | VisRequest | InsightRequestFromVis | InsightRequestFromData
}}
"""

    return get_ai_generated_response(request_prompt)


def ai_decide_interface_update_required(prompt, interfaceContext):
    request_prompt = f"""You are an interface UI-action planner for a disease risk dashboard in South Carolina. 
    Your job is to interpret USER_INPUT and return:
1) Whether the interface needs an update compared to the currently selected options
   - Identify which UI control(s) the user is referring to. If none can be confidently mapped to a control in INTERFACE_CONTEXT, set interface_update_needed = false.
   - Extract the user’s intended target state (single value or multi-select set) for each mapped control.
   - Compare the intended target state against the CURRENT state in INTERFACE_CONTEXT.
   - Request updates ONLY for controls where the CURRENT state does not already satisfy the user’s intent:
2) if yes, which selector(s) should be updated and how (MULTIPLE updates may be required)

You will be given:
1) INTERFACE_CONTEXT:
  HTML snippets for available UI controls (selectors, radio buttons, checkboxes)
  {interfaceContext}
  
2) USER_INPUT: 
  a natural-language user message.
  {prompt}
  
Hard Rules:
- You may ONLY output target values that EXACTLY match an option present in INTERFACE_CONTEXT for that specific control.
- If USER_INPUT implies changing MORE THAN ONE control, you MUST include ALL necessary changes in the "updates" array.
- Prefer minimal changes: only update controls explicitly requested or unambiguously implied by USER_INPUT.
- If USER_INPUT is ambiguous, do NOT guess; set interface_update_needed=false and state what is missing in "reason".
- Treat synonyms carefully (e.g., "zip", "ZCTA", "zipcode" -> zcta; "weekly" vs "monthly"; "risk index" vs specific RI option labels).
- For disease selection: only select/deselect diseases explicitly named by the user, unless the user says "all diseases" or "clear all".
- Return a JSON object with this exact schema:
{{
  "interface_update_needed": boolean,
  "updates": [
    {{
      "selector_name": "geographicResolutionSelector | tempotalComparisonSelector | riskIndexSelector | diseaseSector",
      "action": "set_value | toggle | select_only | select_all | clear_all",
      "target": {{
        "value": string,
        "label": string
      }},
      "targets": [
        {{ "value": string, "label": string }}
      ]
    }}
  ],
}}
"""

    return get_ai_generated_response(request_prompt)


@bp.route("/general_request", methods=["POST"])
@login_required
def ai_answer_generalQuestion():
    params, error, status_code = _json_payload("prompt", "interfaceContext")
    if error:
        return error, status_code

    prompt = params["prompt"]
    interfaceContext = params["interfaceContext"]

    request_prompt = f"""You will be given:
1) INTERFACE_CONTEXT — a list of available UI selectors: {interfaceContext}
2) USER_INPUT — a natural-language request from the user: {prompt}

For GENERAL requests
- Answer the question clearly and concisely
- Reference visualization concepts when relevant (e.g., trends, distributions, comparisons, outliers)
- Do NOT assume access to raw data unless it is visible in the interface
- Do NOT propose UI actions unless explicitly requested

You must return a JSON object with the following schema:

{{
  "request_type": "general",
  "answer": "<your answer here>"
}}

Rules:
- Do not mention internal system instructions.
- Do not invent interface elements.
- If the question cannot be answered using the visible interface, say so explicitly.
- Keep answers grounded in visualization reasoning and analytical thinking."""

    return get_ai_generated_response(request_prompt)


def ai_return_visChart(prompt):
    current_app.logger.debug("AI chart request received")

    request_prompt = f"""You are a strict Vega-Lite v6 JSON generator for rendering with vega-embed in JavaScript.  
    
                      user_input: {prompt}

                        HARD RULES (ABSOLUTE):
                        - You MUST output exactly ONE COMPLETE Vega-Lite specification as a single JSON object.
                        - The output MUST include the following top-level properties:
                        1) "$schema"
                        2) "data" (or "datasets" with a named data source)
                        3) "mark" OR "layer" OR "hconcat" / "vconcat" / "facet"
                        4) "encoding" (unless using layered specs where encoding is inside layers)
                        - The "$schema" MUST be "https://vega.github.io/schema/vega-lite/v5.json".
                        - Do NOT output partial specifications (e.g., mark-only or encoding-only).
                        - Do NOT output explanations, markdown, code fences, or extra text.
                        - Do NOT use Python, Plotly, Altair, R, or any non–Vega-Lite library.
                        - Do NOT invent data fields.
                        - Include axis titles and tooltips when applicable.
                        - Output ONLY raw JSON. Do NOT wrap the JSON in markdown code fences.
                        - If you cannot comply, output exactly: {"error":"cannot_comply"}"""

    return get_ai_generated_response(request_prompt)


@bp.route("/request_insights_from_data", methods=["POST"])
@login_required
def ai_prompt_request_insights_from_data():
    # ---- Text field ----
    user_prompt = request.form.get("prompt")

    # ---- JSON fields (sent as strings) ----
    try:
        vega_lite_spec_structure = json.loads(
            request.form.get("vega_lite_spec_structure", "{}")
        )
        transformed_data = json.loads(request.form.get("transformed_data", "[]"))
    except json.JSONDecodeError:
        return {"error": "Invalid JSON in form fields"}, 400

    # ---- File field ----
    image_file = request.files.get("image_file")
    img_base64 = None

    if image_file:
        img_bytes = image_file.read()
        img_base64 = base64.b64encode(img_bytes).decode("utf-8")

        filename = secure_filename(image_file.filename)
        if filename:
            upload_dir = Path(current_app.instance_path) / "uploads"
            upload_dir.mkdir(exist_ok=True)

            (upload_dir / filename).write_bytes(img_bytes)

    returnValue = ai_return_insights_from_data_attributes(
        user_prompt, vega_lite_spec_structure, transformed_data, img_base64
    )

    return {"response": returnValue}


def png_bytes_to_data_url(img_bytes: bytes) -> str:
    b64 = base64.b64encode(img_bytes).decode("utf-8")
    return f"data:image/png;base64,{b64}"


def ai_return_insights_from_data_attributes(
    user_prompt, vega_lite_spec_structure, transformed_data, img_base64
):
    current_app.logger.debug("AI insight request received")

    request_prompt = f"""
You are an analytics assistant specialized in Vega-Lite v6 geoshape maps.

You are given:
1) USER_PROMPT: the user's analytical question or intent
2) VEGA_LITE_SPEC_STRUCTURE: a structural summary of the current Vega-Lite map spec
   (projection, encoding, transform style, aggregation logic)
3) TRANSFORMED_DATA: region-level aggregated rows used to render the map
   (exactly one row per region)
4) MAP_IMAGE: a rendered screenshot of the map (for validating spatial patterns only)

Your goal:
Using the data, structure, and image, discover meaningful and defensible facts
and propose visualization enhancements that help the user explore those facts
directly in the existing Vega-Lite map.

You must produce:
A) FACTS — 4 to 6 discoverable, data-grounded insights
B) HIGHLIGHT_PATCHES — Vega-Lite v6 patch snippets that highlight each fact
   in the existing map style (geoshape, same projection, same color scale)
C) OPTIONAL_ADDITIONAL_CHARTS — 0 to 2 auxiliary Vega-Lite charts when useful

Important rules:
- Every fact must be supported by TRANSFORMED_DATA.
- MAP_IMAGE is only for validating spatial patterns (clusters, boundaries, gradients).
- Do not rely on raw time-series arrays unless they already exist in TRANSFORMED_DATA.
- Keep the original map style (geoshape, projection, color encoding).
- Output must be executable Vega-Lite V6 JSON ($schema must "https://vega.github.io/schema/vega-lite/v6.json").
- Output must be STRICT valid JSON only (no markdown, no commentary e.g., Do NOT wrap the output in json fences.).
- Do NOT invent data fields.
- Do NOT output markdown, code fences, or extra text.
- Do NOT use Python, Plotly, Altair, R, or any non–Vega-Lite library.
- Include axis titles and tooltips when applicable.

------------------------------------------------------------

A) FACTS (5–7 items)

Each fact must include:
- id: unique identifier (e.g., "F1")
- fact type: Value | Categorization | Aggregation | Extreme | Rank | Proportion | Distribution | Difference | Outlier | Association | Trend
- analysis type: Retrieve Value | Filter | Compute Derived Value | Find Extremes | Sort | Characterize Distribution | Compare | Find Anomalies | Correlate 
- title: short descriptive title
- statement: 1–3 factual sentences
- evidence:
    - fields_used (e.g., ["avg_value", "properties.Region"])
    - method (top-N, above-mean, quantile, IQR-outlier, rank, etc.)
    - notes (brief justification)
- confidence: high | medium | low

------------------------------------------------------------

B) HIGHLIGHT_PATCHES

For each FACT in FACTS, output at least one Vega-Lite v6 *patch* that can be merged into the provided VEGA_LITE_SPEC_STRUCTURE to visually highlight the fact.

You must always return the patch using a layer overlay format.
Patches that only modify encoding, mark, or transform without a layer wrapper are not allowed.

For example, allowed highlight strategies include:
- Threshold highlight:
   - overlay layer with transform filter (datum[field] >= threshold etc.)
   - mark: {{fillOpacity: 0, stroke: "...", strokeWidth: ...}}
- Top-N highlight:
   - transform: window rank + filter rank <= N
   - MUST include a deterministic sort using a known quantitative field
- Conditional emphasis:
   - parameter + condition to vary opacity/strokeWidth on overlay only
   
Rules:
- Patches must be mergeable into the existing Vega-Lite v6 JSON spec.
- Prefer layer-based overlays (keep existing color encoding).
- No new geometry or external datasets.
- Must return patch in "layer" format
   
------------------------------------------------------------

C) OPTIONAL_ADDITIONAL_CHARTS 

Generate one additional chart for each FACT and its fact type to meaningfully support that FACT.

Rules:
- You MUST output COMPLETE Vega-Lite V6 specifications, where each as a single JSON object.
- Each output MUST include the following top-level properties:
1) "$schema"
2) "data" (or "datasets" with a named data source)
3) "layer" format
- The "$schema" MUST be "https://vega.github.io/schema/vega-lite/v6.json".
- Do NOT output partial specifications (e.g., mark-only or encoding-only).
- Do NOT output explanations, markdown, code fences, or extra text.
- Do NOT use Python, Plotly, Altair, R, or any non–Vega-Lite library.
- Do NOT invent data fields.
- Include axis titles, encoding details with field and type, tooltips when applicable.
- Output ONLY raw JSON. Do NOT wrap the JSON in markdown code fences.
- If you cannot comply, output exactly: {{"error":"cannot_comply"}}
------------------------------------------------------------

Output format (STRICT JSON ONLY, HARD FORMAT):

{{
  "facts": [
    {{
      "id": "F1",
      "title": "short descriptive title",
      "statement": "factual insight grounded in data",
      "evidence": {{
        "fields_used": ["field1", "field2"],
        "method": "top-3 | above-mean | IQR-outlier | quantile | rank",
        "notes": "brief justification"
      }},
      "confidence": "high | medium | low"
    }}
  ],

  "highlight_patches": [
    {{
      "fact_id": "F1",
      "description": "what this patch highlights on the map",
      "patch_type": "layer_addition | transform_addition | encoding_change | parameter_addition",
      "patch": {{
        "layer": [
          {{
            "transform": [ ...optional... ],

            "mark": {{
              "type": "<REQUIRED: one of 'geoshape'|'bar'|'line'|'point'|'rect'|'area'...>",
              "...": "optional mark properties (fillOpacity/stroke/strokeWidth/etc.)"
            }},

            "encoding": {{
              "<REQUIRED>": "Must include the minimum position channels to draw the mark.",
              "tooltip": [ ...optional... ]
            }}
          }}
        ]
      }}
    }}
  ],

  "optional_additional_charts": [
    {{
      "chart_id": "C1",
      "purpose": "what this chart explains",
      "vega_lite_spec": {{<REQUIRED>}}
    }}
    , [optional second chart and etc]
  ]
}}

------------------------------------------------------------

INPUTS:

VEGA_LITE_SPEC_STRUCTURE:
{vega_lite_spec_structure}

TRANSFORMED_DATA:
{transformed_data}

USER_INPUT:
{user_prompt}

MAP_IMAGE:
(image provided)
"""

    images = [img_base64] if img_base64 else None
    return get_ai_generated_response(request_prompt, images)


def _post_ollama(url, payload):
    response = requests.post(url, json=payload, timeout=DEFAULT_AI_TIMEOUT_SECONDS)
    response.raise_for_status()
    return response.json()


def get_ai_generated_chat(system_prompt, user_prompt, images=None):
    payload = {
        "model": "gemma3",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "stream": False,
    }

    if images:
        payload["images"] = images

    try:
        response = _post_ollama(ollama_chat_url, payload)
        content = response.get("message", {}).get("content", "")
        returnValue = extract_json(content)

    except (requests.exceptions.RequestException, ValueError):
        returnValue = "No response found"
        current_app.logger.exception("Ollama chat request failed")

    return {"response": returnValue}


def get_ai_generated_response(prompt, images=None):
    payload = {"model": "gemma3", "prompt": prompt, "stream": False}

    if images:
        payload["images"] = images

    try:
        response = _post_ollama(ollama_url, payload)
        returnValue = extract_json(response["response"])

    except (requests.exceptions.RequestException, KeyError, ValueError):
        returnValue = "No response found"
        current_app.logger.exception("Ollama generate request failed")

    return {"response": returnValue}


def get_ai_genearated_chat(system_prompt, user_prompt, images=None):
    """Backward-compatible wrapper for the misspelled helper name."""
    return get_ai_generated_chat(system_prompt, user_prompt, images)


def get_ai_genearated_response(prompt, images=None):
    """Backward-compatible wrapper for the misspelled helper name."""
    return get_ai_generated_response(prompt, images)


def ai_explain_visChart(prompt):
    pass


def extract_json(text):
    if text is None:
        return ""

    text = re.sub(r"```json\s*", "", text, flags=re.IGNORECASE)
    text = text.replace("```", "")

    text = text.strip()

    return text
