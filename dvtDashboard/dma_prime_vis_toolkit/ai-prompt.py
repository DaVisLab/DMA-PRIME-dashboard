import functools

from .utility import * 
from flask import (
    Blueprint, flash, send_file, redirect, url_for, render_template, current_app, request
)
import os
import shutil

bp = Blueprint('ai', __name__, url_prefix='/ai')
from flask_login import login_required

@bp.route('/<prompt>', methods=['GET'])
def ai_prompt_input(prompt):
    # Flask passes route variables as keyword args; the parameter name must match
    print(prompt)
    return {"response": "This is a test response from the AI endpoint."}