"""Flask application factory and page routes for the DMA-PRIME dashboard."""

import json
import os
from pathlib import Path
import re
import datetime

from flask import Flask, render_template, request, current_app, jsonify, url_for
from flask_login import current_user, login_required
from flask_bcrypt import Bcrypt

from werkzeug.middleware.proxy_fix import ProxyFix

from .utility import decrypt, get_data_version_from_request, load_pickle
from .authenticate import login_manager
from .admin import admin_required
from .database import User
from .data_handling import get_data_date, data_approver_required
from .maternal_child_dataHander import bp as maternal_child_data_bp
from .maternal_child_dataHander import get_maternal_child_data_conditions, get_years_for_condition, get_metrics_for_condition

# ensure the authenticate module itself is available for blueprint registration
from . import authenticate


MAP_AUTHORING_ARCHIVE_FOLDER = "map-authoring-archive"
MAP_AUTHORING_ARCHIVE_FILENAME = "workspace.json"


def _get_map_authoring_archive_identity(user):
    """Return the stable login identity used for map-authoring archives."""
    for attr in ("email", "username"):
        value = getattr(user, attr, None)
        if value:
            return str(value)

    get_id = getattr(user, "get_id", None)
    if callable(get_id):
        value = get_id()
        if value:
            return str(value)

    return "unknown-user"


def _normalize_map_authoring_archive_key(identity):
    key = re.sub(r"[^A-Za-z0-9_.-]+", "-", str(identity).strip())
    key = key.strip(".-")
    return key or "unknown-user"


def _get_map_authoring_archive_paths(user):
    identity = _get_map_authoring_archive_identity(user)
    user_key = _normalize_map_authoring_archive_key(identity)
    archive_root = (
        Path(current_app.static_folder) / "assets" / MAP_AUTHORING_ARCHIVE_FOLDER
    )
    user_dir = archive_root / user_key

    return {
        "identity": identity,
        "user_key": user_key,
        "user_dir": user_dir,
        "workspace_file": user_dir / MAP_AUTHORING_ARCHIVE_FILENAME,
    }


def _ensure_map_authoring_archive_dir(user):
    paths = _get_map_authoring_archive_paths(user)
    paths["user_dir"].mkdir(parents=True, exist_ok=True)
    return paths


def _get_utc_timestamp():
    return (
        datetime.datetime.now(datetime.timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def _load_metadata(data_version, dashboard_folder):
    """Load encrypted dashboard metadata for the selected data version."""
    file = os.path.join(
        current_app.config["DATADIR"],
        "processed",
        data_version,
        dashboard_folder,
        "metadata.json",
    )
    decrypt_key = os.path.join(
        current_app.config["DATADIR"],
        "processed",
        data_version,
        dashboard_folder,
        "encrypt_key.bin",
    )
    metadata = decrypt(file, decrypt_key)
    if isinstance(metadata, list):
        metadata = {"diseases": metadata}
    else:
        metadata = dict(metadata)
    metadata["data_version"] = data_version
    return metadata


def create_app(development=False, dataDir=None):
    if dataDir is None:
        raise ValueError("No data directory")
    # create and configure the app
    app = Flask(__name__, instance_relative_config=True)
    bcrypt = Bcrypt()

    app.config.from_mapping(
        # SECRET_KEY='***REMOVED***',
        DEVELOPMENT=development,
        DATADIR=dataDir,
        PERMANENT_SESSION_LIFETIME=datetime.timedelta(minutes=15),
        SESSION_REFRESH_EACH_REQUEST=True,
        # SQLALCHEMY_DATABASE_URI = '***REMOVED***'
    )
    app.config.from_envvar("DMAPRIME_CONFIG")

    app.wsgi_app = ProxyFix(  # allows a reverse proxy
        app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1
    )

    # ensure the instance folder exists
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    # initializes the database
    from .database import db

    db.init_app(app)

    with app.app_context():
        db.create_all()

        if app.config["DEVELOPMENT"]:
            User.query.delete()
            test_user = User(
                "admintest",
                "admintest",
                bcrypt.generate_password_hash("adminpassword"),
                access_level=1,
                data_approver=True,
                verified_user=True,
            )
            db.session.add(test_user)
            test_user = User(
                "usertest",
                "usertest",
                bcrypt.generate_password_hash("userpassword"),
                access_level=0,
                data_approver=True,
                verified_user=True,
            )
            db.session.add(test_user)
            test_user = User(
                "admin",
                "admin",
                bcrypt.generate_password_hash("password"),
                access_level=1,
                verified_user=True,
            )
            db.session.add(test_user)
            test_user = User(
                "user",
                "user",
                bcrypt.generate_password_hash("password"),
                access_level=0,
                verified_user=True,
            )
            db.session.add(test_user)
            test_user = User(
                "user2",
                "user2",
                bcrypt.generate_password_hash("password"),
                access_level=-1,
                verified_user=True,
            )
            db.session.add(test_user)
            db.session.commit()

    login_manager.init_app(app)

    # # # routes # # #

    app.register_blueprint(authenticate.bp)

    from . import data_handling

    app.register_blueprint(data_handling.bp)
    app.register_blueprint(maternal_child_data_bp)

    from . import ai_prompt

    app.register_blueprint(ai_prompt.bp)

    from . import KG_recommendation

    app.register_blueprint(KG_recommendation.bp)
    kg_path = os.path.join(app.static_folder, "assets", "kg_test_covid.pkl")
    app.predefined_kg = load_pickle(kg_path)

    from . import admin

    app.register_blueprint(admin.bp)

    # landing page, though now respiratory
    @app.route("/", methods=["GET"])
    @login_required
    def index():
        return render_template("index.html")

    @app.route("/admin", methods=["GET"])
    @login_required
    @admin_required
    def admin_controls():
        from flask import current_app

        return render_template("admin/admin.html")

    @app.route("/data-approval", methods=["GET"])
    @login_required
    @data_approver_required
    def approval_page():
        column_headers = [
            {"display": "Disease", "code": "disease"},
            {"display": "Date of Current Data", "code": "current"},
            {"display": "Date of New Data", "code": "new"},
            {"display": "Date of Last Approved Data", "code": "previous"},
        ]
        dashboards = [
            {"display": "Respiratory", "code": "respiratory"},
            {"display": "Wastewater", "code": "wastewater"},
            {"display": "Outbreak Detection", "code": "outbreak-detection"},
            {"display": "Opioid, HCV, HIV", "code": "opioid-hcv-hiv"},
            {"display": "Mobile Health Clinics", "code": "mobile-health-clinics"},
        ]
        return render_template(
            "data-approval/data-approval.html",
            column_headers=column_headers,
            dashboards=dashboards,
            dates=get_data_date("all", "all"),
        )

    @app.route("/map-authoring", methods=["GET"])
    @login_required
    def map_authoring():
        data_version = get_data_version_from_request(request, current_user)
        metadata = _load_metadata(data_version, "other_infectious_diseases")
        archive_paths = _ensure_map_authoring_archive_dir(current_user)
        metadata["archive"] = {
            "url": url_for("map_authoring_archive"),
            "exists": archive_paths["workspace_file"].exists(),
            "userKey": archive_paths["user_key"],
        }

        return render_template("map-authoring/index.html", metadata=metadata)

    @app.route("/map-authoring/archive", methods=["GET", "POST", "PUT"])
    @login_required
    def map_authoring_archive():
        archive_paths = _ensure_map_authoring_archive_dir(current_user)
        workspace_file = archive_paths["workspace_file"]

        if request.method == "GET":
            if not workspace_file.exists():
                return jsonify({"exists": False, "tabs": []})

            try:
                payload = json.loads(workspace_file.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                current_app.logger.exception(
                    "Failed to read map-authoring archive for %s",
                    archive_paths["identity"],
                )
                return jsonify({"exists": False, "tabs": []}), 500

            return jsonify(payload)

        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "Expected a JSON object."}), 400

        archived_payload = dict(payload)
        archived_payload["serverSavedAt"] = _get_utc_timestamp()
        archived_payload["archiveUserKey"] = archive_paths["user_key"]

        try:
            temp_file = workspace_file.with_suffix(".tmp")
            temp_file.write_text(
                json.dumps(archived_payload, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            temp_file.replace(workspace_file)
        except OSError:
            current_app.logger.exception(
                "Failed to save map-authoring archive for %s",
                archive_paths["identity"],
            )
            return jsonify({"error": "Unable to save map-authoring archive."}), 500

        return jsonify(
            {
                "ok": True,
                "savedAt": archived_payload["serverSavedAt"],
                "userKey": archive_paths["user_key"],
            }
        )

    @app.route("/respiratory", methods=["GET"])
    @login_required
    def respiratory():
        data_version = get_data_version_from_request(request, current_user)
        metadata = _load_metadata(data_version, "respiratory")

        panels = [
            {
                "name": "main",
                "displayName": "DMA-PRIME",
            },
            {
                "name": "map",
                "displayName": "Map View",
                "active": True,
                "html": "respiratory/respiratory-map-panel.html",
            },
            {
                "name": "grid",
                "displayName": "Grid View",
                # "active": True,
                "html": "respiratory/respiratory-grid-panel.html",
            },
            {
                "name": "exploration",
                "displayName": "Model Exploration",
                # "active": True,
                "html": "respiratory/respiratory-model-exploration-panel-container.html",
            },
        ]

        return render_template(
            "respiratory/respiratory-base.html", panels=panels, metadata=metadata
        )

    @app.route("/respiratory-model-exploration", methods=["GET"])
    @login_required
    def respiratory_model_exploration():

        data_version = get_data_version_from_request(request, current_user)

        disease = request.args.get("disease")
        geographic_unit = request.args.get("geographic-unit")
        population = request.args.get("population")
        outcome_variable = request.args.get("outcome-variable")
        location = request.args.get("location")

        if disease is None:
            disease = "covid_19"
        if geographic_unit is None:
            geographic_unit = "region"
        if population is None:
            population = "general_population"
        # if outcome_variable is None:
        #     outcome_variable = 'all_encounters'
        if outcome_variable is None:
            outcome_variable = "all_hospitalizations"
        if location is None:
            location = ""

        metadata = _load_metadata(data_version, "respiratory")

        panels = [
            {
                "name": "main",
                "displayName": "DMA-PRIME",
            },
            {
                "name": "exploration",
                "displayName": "Model Exploration",
                "active": True,
                "html": "respiratory/respiratory-model-exploration-panel.html",
            },
        ]

        if location == "":
            return render_template(
                "respiratory/respiratory-model-base.html",
                panels=panels,
                metadata=metadata,
                disease=disease,
                geographic_unit=geographic_unit,
                population=population,
                outcome_variable=outcome_variable,
                location=location,
            )
        else:
            if outcome_variable == "%_influenza-attributable_ed_visits":
                outcome_variable = "attributable_ed_visits"
            src = f"/data/respiratory/model/{disease}/{geographic_unit}/{population}/{outcome_variable}/{location}/{data_version}"

            return render_template(
                "respiratory/respiratory-model-base.html",
                panels=panels,
                metadata=metadata,
                disease=disease,
                geographic_unit=geographic_unit,
                population=population,
                outcome_variable=outcome_variable,
                location=location,
                data_version=data_version,
                src=src,
            )

    @app.route("/mobile-health-clinics", methods=["GET"])
    @login_required
    def mobile_health_clinics():
        data_version = get_data_version_from_request(request, current_user)

        metadata = {"data_version": data_version}

        panels = [
            {
                "name": "main",
                "displayName": "DMA-PRIME",
            },
            {
                "name": "map",
                "displayName": "Map View",
                "active": True,
                "html": "mobile-health-clinic/mhc-map-panel.html",
            },
        ]
        return render_template(
            "mobile-health-clinic/mhc-base.html", panels=panels, metadata=metadata
        )

    @app.route("/opioid-hcv-hiv", methods=["GET"])
    @login_required
    def opioid_hcv_hiv():

        data_version = get_data_version_from_request(request, current_user)
        metadata = _load_metadata(data_version, "opioid_hcv_hiv")

        panels = [
            {
                "name": "main",
                "displayName": "DMA-PRIME",
            },
            {
                "name": "map",
                "displayName": "Map View",
                "active": True,
                "html": "opioid-hcv-hiv/opioid-hcv-hiv-map-panel.html",
            },
        ]
        return render_template(
            "opioid-hcv-hiv/opioid-hcv-hiv-base.html", panels=panels, metadata=metadata
        )

    @app.route("/outbreak-detection", methods=["GET"])
    @login_required
    def outbreak_detection():
        data_version = get_data_version_from_request(request, current_user)
        metadata = _load_metadata(data_version, "other_infectious_diseases")

        panels = [
            {"name": "main", "displayName": "DMA-PRIME"},
            # {
            #     "name": "outbreak-detection",
            #     "displayName": "Outbreak Detection",
            #     # 'active': True,
            #     "html": "outbreak-detection/outbreak-detection-panel_dy.html",
            # },
            # {
            #     "name": "riskindex-assessment",
            #     "displayName": "Risk Index Assessment",
            #     # 'active': True,
            #     "html": "outbreak-detection/riskindex-analysis.html",
            # },
           
        #    {
        #         "name": "outbreak-exploration2",
        #         "displayName": "Test Interface2",
        #         "active": True,
        #         "html": "outbreak-detection/test-page.html",
        #     },
        #      {
        #         "name": "outbreak-kg",
        #         "displayName": "KG Interface",
        #         # "active": True,
        #         # "html": "outbreak-detection/riskindex-analysis.html",
        #         "html": "outbreak-detection/kg-test-page.html",
        #     },

            {
                "name": "map",
                "displayName": "Map View",
                "active": True,
                "html": "outbreak-detection/outbreak-detection-map-panel.html",
            },
        ]
        return render_template(
            "outbreak-detection/outbreak-detection-base.html",
            panels=panels,
            metadata=metadata,
        )

    @app.route("/wastewater", methods=["GET"])
    @login_required
    def waste_water():
        data_version = get_data_version_from_request(request, current_user)
        metadata = _load_metadata(data_version, "waste_water")

        panels = [
            {"name": "main", "displayName": "DMA-PRIME"},
            {
                "name": "grid",
                "displayName": "Grid View",
                "active": True,
                "html": "waste-water/waste-water-grid-panel.html",
            },
        ]
        return render_template(
            "waste-water/waste-water-base.html", panels=panels, metadata=metadata
        )
    
    @app.route("/maternal-child", methods=["GET"])
    @login_required
    def maternal_child():
        data_conditions = get_maternal_child_data_conditions()
        default_condition = data_conditions[0] if data_conditions else None
        data_years_by_condition = {
            condition: get_years_for_condition(condition)
            for condition in data_conditions
        }
        data_metrics_by_condition = {
            condition: get_metrics_for_condition(condition)
            for condition in data_conditions
        }
        data_years = (
            data_years_by_condition.get(default_condition, [])
            if default_condition
            else []
        )
        
        data_years = data_years.sort(reverse=True)  # Sort years in descending order
        data_metrics = (
            data_metrics_by_condition.get(default_condition, [])
            if default_condition
            else []
        )
        # data_version = get_data_version_from_request(request, current_user)
        # metadata = _load_metadata(data_version, "waste_water")

        panels = [
            {"name": "main", "displayName": "DMA-PRIME"},
            {
                "name": "map",
                "displayName": "Maternal and Child Health ZCTA",
                "active": True,
                "html": "maternal-child-health/map-panel.html",
            },
        ]
        metadata = {
            "data_conditions": data_conditions,
            "data_years": data_years,
            "data_metrics": data_metrics,
            "data_years_by_condition": data_years_by_condition,
            "data_metrics_by_condition": data_metrics_by_condition,
        }
        return render_template(
            "maternal-child-health/base.html", metadata=metadata, panels=panels
        )

    if development:
        # Simply for my own convenience
        @app.route("/testing")
        def testing():
            return render_template("testing-vis.html")

    return app
