# This is where the main flask code should lie
import os
import datetime
import pandas as pd

from flask import Flask, render_template, session, request, current_app
from flask_login import login_required
from flask_bcrypt import Bcrypt

from werkzeug.middleware.proxy_fix import ProxyFix

from .utility import *
from .authenticate import login_manager
from .admin import admin_required
from .database import User
from .data_handling import get_data_date, data_approver_required

# ensure the authenticate module itself is available for blueprint registration
from . import authenticate


def create_app(development=False, dataDir=None):
    if dataDir is None:
        exit("No data directory")
    # create and configure the app
    app = Flask(__name__, instance_relative_config=True)

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
                Bcrypt().generate_password_hash("adminpassword"),
                access_level=1,
                data_approver=True,
                verified_user=True,
            )
            db.session.add(test_user)
            test_user = User(
                "usertest",
                "usertest",
                Bcrypt().generate_password_hash("userpassword"),
                access_level=0,
                data_approver=True,
                verified_user=True,
            )
            db.session.add(test_user)
            test_user = User(
                "admin",
                "admin",
                Bcrypt().generate_password_hash("password"),
                access_level=1,
                verified_user=True,
            )
            db.session.add(test_user)
            test_user = User(
                "user",
                "user",
                Bcrypt().generate_password_hash("password"),
                access_level=0,
                verified_user=True,
            )
            db.session.add(test_user)
            test_user = User(
                "user2",
                "user2",
                Bcrypt().generate_password_hash("password"),
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

    from . import ai_prompt

    app.register_blueprint(ai_prompt.bp)

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

    @app.route("/respiratory", methods=["GET"])
    @login_required
    def respiratory():

        data_version = get_data_version_from_request(request, current_user)

        file = os.path.join(
            current_app.config["DATADIR"],
            "processed",
            data_version,
            "respiratory",
            "metadata.json",
        )
        decrypt_key = os.path.join(
            current_app.config["DATADIR"],
            "processed",
            data_version,
            "respiratory",
            "encrypt_key.bin",
        )

        metadata = dict(decrypt(file, decrypt_key))
        metadata["data_version"] = data_version

        print(metadata["available_models"])
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
                "html": "respiratory/respiratory-grid-panel.html",
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

        file = os.path.join(
            current_app.config["DATADIR"],
            "processed",
            data_version,
            "respiratory",
            "metadata.json",
        )
        decrypt_key = os.path.join(
            current_app.config["DATADIR"],
            "processed",
            data_version,
            "respiratory",
            "encrypt_key.bin",
        )

        metadata = dict(decrypt(file, decrypt_key))
        metadata["data_version"] = data_version

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
            src = f"/data/respiratory/model/{disease}/{geographic_unit}/{population}/{outcome_variable}/{location}"
            return render_template(
                "respiratory/respiratory-model-base.html",
                panels=panels,
                metadata=metadata,
                disease=disease,
                geographic_unit=geographic_unit,
                population=population,
                outcome_variable=outcome_variable,
                location=location,
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

        file = os.path.join(
            current_app.config["DATADIR"],
            "processed",
            data_version,
            "opioid_hcv_hiv",
            "metadata.json",
        )
        decrypt_key = os.path.join(
            current_app.config["DATADIR"],
            "processed",
            data_version,
            "opioid_hcv_hiv",
            "encrypt_key.bin",
        )

        metadata = dict(decrypt(file, decrypt_key))
        metadata["data_version"] = data_version

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

        file = os.path.join(
            current_app.config["DATADIR"],
            "processed",
            data_version,
            "other_infectious_diseases",
            "metadata.json",
        )
        decrypt_key = os.path.join(
            current_app.config["DATADIR"],
            "processed",
            data_version,
            "other_infectious_diseases",
            "encrypt_key.bin",
        )

        metadata = {"diseases": list(decrypt(file, decrypt_key))}
        metadata["data_version"] = data_version

        # print(metadata)

        panels = [
            {"name": "main", "displayName": "DMA-PRIME"},
           
            # {
            #     "name": "outbreak-detection",
            #     "displayName": "Outbreak Detection",
            #     'active': True,
            #     "html": "outbreak-detection/outbreak-detection-panel_dy.html",
            # },
            # {
            #     "name": "riskindex-assessment",
            #     "displayName": "Risk Index Assessment",
            #     # 'active': True,
            #     "html": "outbreak-detection/riskindex-analysis.html",
            # },
            # # {
            # #     'name': 'outbreak-exploration',
            # #     'displayName': 'Test Interface',
            # #     # 'active': True,
            # #     'html': 'outbreak-detection/test-page.html'
            # # },
            # {
            #     "name": "outbreak-exploration2",
            #     "displayName": "Test Interface2",
            #     # "active": True,
            #     "html": "outbreak-detection/test-page2.html",
            # },
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

        file = os.path.join(
            current_app.config["DATADIR"],
            "processed",
            data_version,
            "waste_water",
            "metadata.json",
        )
        decrypt_key = os.path.join(
            current_app.config["DATADIR"],
            "processed",
            data_version,
            "waste_water",
            "encrypt_key.bin",
        )

        metadata = dict(decrypt(file, decrypt_key))
        metadata["data_version"] = data_version
        print(metadata)

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

    if development:
        # Simply for my own convenience
        @app.route("/testing")
        def testing():
            return render_template("testing-vis.html")

    return app
