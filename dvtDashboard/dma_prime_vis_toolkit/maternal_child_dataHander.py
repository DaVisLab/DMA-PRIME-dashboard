import os
import json
from pathlib import Path

from flask import (
    Blueprint,
    current_app,
    jsonify
)

from flask_login import current_user, login_required
bp = Blueprint("maternal_child_data", __name__, url_prefix="/maternal_child_data")


def get_maternal_child_data_path():
    data_path = os.path.join(
        current_app.config["DATADIR"],
        "processed",
        "current",
        "maternal_child_health_ZCTA",
    )
    return data_path

def get_maternal_child_data_conditions():
    data_conditions_dir  = get_maternal_child_data_path()
    
    data_conditions = [
        os.path.splitext(filename)[0]
        for filename in os.listdir(data_conditions_dir)
        if filename.endswith(".json")
    ]

    return data_conditions

def get_years_for_condition(condition):
    data_conditions_dir  =  get_maternal_child_data_path()
    condition_file = os.path.join(data_conditions_dir, f"{condition}.json")
    
    if not os.path.exists(condition_file):
        return []

    with open(condition_file, "r") as f:
        data = json.load(f)
    
    years = sorted(data.keys(), key=int)
    return years

def get_metrics_for_condition(condition):
    data_conditions_dir = get_maternal_child_data_path()

    condition_file = os.path.join(data_conditions_dir, f"{condition}.json")

    if not os.path.exists(condition_file):
        return []

    with open(condition_file, "r") as f:
        data = json.load(f)

    if not data:
        return []

    first_year = next(iter(data.values()))
    if not first_year:
        return []

    first_zcta = next(iter(first_year.values()))
    if not first_zcta:
        return []

    metrics = [
        metric["metric_type"]
        for metric in first_zcta
        if "metric_type" in metric
    ]

    return metrics

@bp.route("/<condition>/<measure>/<year>", methods=["GET"])
@bp.route("/get_maternal_child_data/<condition>/<measure>/<year>", methods=["GET"])
@login_required
def get_maternal_child_data_by(condition, measure, year):
    data_conditions_dir = get_maternal_child_data_path()

    file_path = os.path.join(
        data_conditions_dir,
        f"{condition}.json",
    )

    if not os.path.exists(file_path):
        return jsonify({"error": f"Condition '{condition}' not found"}), 404

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    data_for_year = data.get(year, {})

    return_data = {}

    for zcta, metrics in data_for_year.items():
        for metric in metrics:
            if metric.get("metric_type") == measure:
                return_data[zcta] = {
                    "metric_value": metric.get("metric_value"),
                    "map_group": metric.get("map_group"),
                    "map_color": metric.get("map_color"),
                }
                break

    return jsonify(return_data)
