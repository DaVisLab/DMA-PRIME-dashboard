import functools
import base64, re
from pydantic import BaseModel
from typing import Any
from .utility import * 
from flask import (
    Blueprint, flash, send_file, redirect, url_for, render_template, current_app, request
)
import os
import shutil
from groq import Groq
import textwrap
from pathlib import Path

bp = Blueprint('ai', __name__, url_prefix='/ai')

client = Groq(
    api_key="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",
)

@bp.route('/', methods=['POST'])
def ai_prompt_input():
    params = request.get_json()
    # Flask passes route variables as keyword args; the parameter name must match
    prompt = params["prompt"]

    try:
        prompt_type = ai_input_categorization(prompt)
    except Exception as e:
        current_app.logger.exception("AI categorization failed")
        return {"error": "AI request failed", "details": str(e)}, 500

    current_app.logger.info(f"AI prompt type: {prompt_type}")
    returnPromptType = ""
    returnValue = ""
    
    if prompt_type.strip() == "1":
        returnPromptType = "GeneralRequest"
        returnValue = ai_answer_generalQuestion(prompt)
    elif prompt_type.strip() == "2":
        returnPromptType = "VisRequest"
        returnValue = ""
    elif prompt_type.strip() == "3":
        returnPromptType = "InsightRequestFromVis"
        returnValue = ""
    elif prompt_type.strip() == "4":
        returnPromptType = "InsightRequestFromData"
        returnValue = ""
    else:
        returnValue = ai_answer_generalQuestion(prompt)
        
    print(returnValue)
    # print(chat_completion.choices[0].message.content)
    return {"response": returnValue, "prompt_type": returnPromptType}

@bp.route('/request_chart', methods=['POST'])
def ai_prompt_request_chart():
    params = request.get_json()
    # Flask passes route variables as keyword args; the parameter name must match
    prompt = params["prompt"]
    returnValue = ai_return_visChart(prompt)
    return {"response": returnValue}


    
def ai_input_categorization(prompt):
    # Build a clean, dedented prompt to send to the model
    
    SYSTEM_PROMPT = '''Task: Classify the following prompt into exactly one of the three categories below and return only the corresponding number.

        Categories:
        1 — General question or request
        2 — Request to draw or generate a chart
        3 — Request asking about a chart or explaining a chart and providing insights
        4 — Request to generate insights from data'''
    
    user_message = textwrap.dedent(f"""
        Prompt to classify:
        {prompt}
    """)

    chat_completion = client.chat.completions.create(
        messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": user_message}],
        model="llama-3.3-70b-versatile",
    )

    # Return the raw content (caller can parse/clean as needed)
    return chat_completion.choices[0].message.content



def ai_answer_generalQuestion(prompt):
    chat_completion = client.chat.completions.create(
        messages=[
            {
                "role": "user",
                "content": prompt,
            }
        ],
        model="llama-3.3-70b-versatile",
    )
    
    return chat_completion.choices[0].message.content

def ai_return_visChart(prompt):
    print("ai_return_visChart received prompt:", prompt)  # Debug log to check the incoming prompt
    
    SYSTEM_PROMPT = '''You are a strict Vega-Lite v6 JSON generator for rendering with vega-embed in JavaScript.

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
                        - If you cannot comply, output exactly: {"error":"cannot_comply"}'''
    
    chat_completion = client.chat.completions.create(
        messages=[
             {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt}],
        model="llama-3.3-70b-versatile",
        temperature=0.1,     # 🔑 형식 안정성
    )
    
    return chat_completion.choices[0].message.content.strip()



@bp.route('/request_insights_from_data', methods=['POST'])
def ai_prompt_request_insights_from_data():
    # params = request.get_json()
    # # Flask passes route variables as keyword args; the parameter name must match
    # prompt = params["prompt"]
     # ---- Text field ----
    print(request.form)
    user_prompt = request.form.get("prompt")

    # ---- JSON fields (sent as strings) ----
    vega_lite_spec_structure = json.loads(request.form.get("vega_lite_spec_structure", "{}"))
    transformed_data = json.loads(request.form.get("transformed_data", "[]"))

    # ---- File field ----
    image_file = request.files.get("image_file")

    if image_file:
        img_bytes = image_file.read()    
        img_base64 = base64.b64encode(img_bytes).decode("utf-8")

        upload_dir = Path("uploads")
        upload_dir.mkdir(exist_ok=True)
        
        img_path = upload_dir / image_file.filename 
        img_path.write_bytes(img_bytes)
    else:
        img_bytes = None
        img_path = None
        
    # print(user_prompt)
    # print(vega_lite_spec_structure)
    # print(transformed_data)
    # print(image_file)
    
    returnValue = ai_return_insights_from_data_attributes(user_prompt,
                                                        vega_lite_spec_structure,
                                                        transformed_data,
                                                        img_base64)
    
    return {"response": returnValue}

def png_bytes_to_data_url(img_bytes: bytes) -> str:
    b64 = base64.b64encode(img_bytes).decode("utf-8")
    return f"data:image/png;base64,{b64}"

def ai_return_insights_from_data_attributes(user_prompt,
                                            vega_lite_spec_structure,
                                            transformed_data,
                                            img_base64):
    print("ai_return_insights_from_data_attributes received prompt:", user_prompt)  # Debug log to check the incoming prompt

    SYSTEM_PROMPT =f"""
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

MAP_IMAGE:
(image provided)
"""
    # print(SYSTEM_PROMPT)

    chat_completion = client.chat.completions.create(
        messages=[
             {"role": "system", "content": SYSTEM_PROMPT},
             {"role": "user", "content": 
              [
                {
                    "type": "text",
                    "text": user_prompt
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/png;base64,{img_base64}"
                    }
                }
            ]
              }],
        # model="llama-3.3-70b-versatile",
        model="meta-llama/llama-4-scout-17b-16e-instruct",
        temperature=0.1,     # 🔑 형식 안정성
    )
    
    resp = extract_json(chat_completion.choices[0].message.content)
    return resp

def ai_explain_visChart(prompt):
    pass

def extract_json(text):
    text = text.strip()

    # 코드블록 제거
    if text.startswith("```"):
        text = text.split("```")[1]

    return text