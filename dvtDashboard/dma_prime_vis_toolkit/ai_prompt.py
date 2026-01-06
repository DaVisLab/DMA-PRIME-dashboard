import functools

from .utility import * 
from flask import (
    Blueprint, flash, send_file, redirect, url_for, render_template, current_app, request
)
import os
import shutil

from groq import Groq
import textwrap

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

@bp.route('/request_insights_from_data', methods=['POST'])
def ai_prompt_request_insights_from_data():
    params = request.get_json()
    # Flask passes route variables as keyword args; the parameter name must match
    prompt = params["prompt"]
    
    print(prompt)
    returnValue = ai_return_insights_from_data_attributes(prompt)
    
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

def ai_return_insights_from_data_attributes(prompt):
    print("ai_return_visChart received prompt:", prompt)  # Debug log to check the incoming prompt
    
    SYSTEM_PROMPT = '''You are an analytical assistant.
                      Given a tabular dataset description, your task is to suggest actions for insightful observations from the data. 
                      Considering field names and types, you should:
                      1) Propose plausible insight hypotheses (e.g.,comparisons, trends, associations)
                      2) Indicate what summary statistics would be required to validate each hypothesis
                      3) Avoid making claims without sufficient data
                      - Do NOT generate visualizations yet.
                      - Do NOT assume access to full raw data.
                      '''
    
    chat_completion = client.chat.completions.create(
        messages=[
             {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt}],
        model="llama-3.3-70b-versatile",
        temperature=0.1,     # 🔑 형식 안정성
    )
    
    return chat_completion.choices[0].message.content.strip()

def ai_explain_visChart(prompt):
    pass