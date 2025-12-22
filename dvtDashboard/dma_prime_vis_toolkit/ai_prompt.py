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
from flask_login import login_required

client = Groq(
    api_key="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",
)

@bp.route('/<prompt>', methods=['GET'])
@login_required
def ai_prompt_input(prompt):
    # Flask passes route variables as keyword args; the parameter name must match
    print(prompt)

    try:
        prompt_type = ai_input_categorization(prompt)
    except Exception as e:
        current_app.logger.exception("AI categorization failed")
        return {"error": "AI request failed", "details": str(e)}, 500

    current_app.logger.info(f"AI prompt type: {prompt_type}")
    returnValue = ""
    
    if prompt_type.strip() == "1":
        returnValue = ai_answer_generalQuestion(prompt)
    elif prompt_type.strip() == "2":
        returnValue = ai_return_visChart(prompt)
    elif prompt_type.strip() == "3":
        returnValue = ai_explain_visChart(prompt)
    else:
        returnValue = ai_answer_generalQuestion(prompt)
        
    # print(chat_completion.choices[0].message.content)
    return {"response": returnValue}

def ai_input_categorization(prompt):
    # Build a clean, dedented prompt to send to the model
    user_message = textwrap.dedent(f"""
        Task: Classify the following prompt into exactly one of the three categories below and return only the corresponding number.

        Categories:
        1 — General question or request
        2 — Request to draw or generate a chart
        3 — Request asking about a chart or explaining a chart and providing insights

        Prompt to classify:
        {prompt}
    """)

    chat_completion = client.chat.completions.create(
        messages=[{"role": "user", "content": user_message}],
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
    pass

def ai_explain_visChart(prompt):
    pass