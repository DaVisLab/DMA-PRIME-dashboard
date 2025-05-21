# This is where the main flask code should lie
import os
import datetime
import pandas as pd

from flask import Flask, render_template
from flask_login import login_required
from flask_bcrypt import Bcrypt

from werkzeug.middleware.proxy_fix import ProxyFix

from .utility import * 
from .authenticate import login_manager, admin_required #login_required,
from .database import User

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
    app.config.from_envvar('DMAPRIME_CONFIG')
    
    app.wsgi_app = ProxyFix( # allows a reverse proxy
        app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1
    )
    
    # ensure the instance folder exists
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    # ignores login requirements
    # if not development:
    from .database import db
    db.init_app(app)

    with app.app_context():
        db.create_all()
    
        if app.config['DEVELOPMENT']:
            User.query.delete()
            test_user = User("admintest", "admintest", Bcrypt().generate_password_hash("adminpassword"), access_level=1, verified_user=True)
            db.session.add(test_user)
            test_user = User("usertest", "usertest", Bcrypt().generate_password_hash("userpassword"), access_level=0, verified_user=True)
            db.session.add(test_user)
            db.session.commit()

    login_manager.init_app(app)

    # # # routes # # #

    app.register_blueprint(authenticate.bp)

    from . import data_handling
    app.register_blueprint(data_handling.bp)

    from . import admin
    app.register_blueprint(admin.bp)
    
    # landing page, though now respiratory
    @app.route('/')
    @login_required
    def index():
        return render_template('index.html')

    @app.route('/admin')
    @login_required
    @admin_required
    def admin_controls():
        return render_template("admin/admin.html")

    @app.route('/respiratory')
    @login_required
    def respiratory():
        today = pd.to_datetime("today").normalize()
        current_week = today + pd.DateOffset(days=(5 - today.weekday()) % 7)
        metadata = {
            'diseases': {
                'covid-19': 'Covid-19'
            },
            'region_sizes': {
                'zcta': 'ZCTA',
                'county': 'County',
                'region': 'Region'
            },
            'start_date': (current_week - pd.DateOffset(months=18)).strftime('%Y-%m-%d'),
            'current_week': current_week.strftime('%Y-%m-%d'),
            'end_date': (current_week + pd.DateOffset(weeks=4)).strftime('%Y-%m-%d')
        }

        metadata = dict(decrypt(f"{app.config['DATADIR']}/processed/respiratory/metadata.json"))

        panels = [
            {
                'name': 'main',
                'displayName': 'DMA-PRIME',
            },
            {
                'name': 'map',
                'displayName': 'Map View',
                'active': True,
                'html': 'respiratory/respiratory-map-panel.html'
            },
            {
                'name': 'grid',
                'displayName': 'Grid View',
                'html': 'respiratory/respiratory-grid-panel.html'
            },
            # {
            #     'name': 'deckmap',
            #     'displayName': 'Deckgl Map View',
            #     'active': True,
            #     'html': 'respiratory/deckgl-respiratory-map-panel.html'
            # },
        ]
        return render_template('respiratory/respiratory-base.html', panels=panels, metadata=metadata)
    
    @app.route('/mobile-health-clinics')
    @login_required
    def mobile_health_clinics():
        panels = [
            {
                'name': 'main',
                'displayName': 'DMA-PRIME',
            },
            {
                'name': 'map',
                'displayName': 'Map View',
                'active': True,
                'html': 'mobile-health-clinic/mhc-map-panel.html'
            },
        ]
        return render_template('mobile-health-clinic/mhc-base.html', panels=panels)

    @app.route('/opioid-hcv-hiv')
    @login_required
    def opioid_hcv_hiv():
        metadata = {
            'diseases': {
                'opioid': 'Opioid',
                'hcv': 'HCV',
                'hiv': 'HIV',
            },
            'years': range(2020, int(datetime.datetime.now().year)),
            'variables': {
                'hospitalizations': 'Hospitalizations',
                'deaths': 'Deaths',
                'SVI': 'Social Vulnerability Index',
                'proportion_uninsured': 'Proportion Uninsured',
                'median_income': 'Median Income',
            }
        }
        
        metadata = dict(decrypt(f"{app.config['DATADIR']}/processed/opioid_hcv_hiv/metadata.json"))
        
        panels = [
            {
                'name': 'main',
                'displayName': 'DMA-PRIME',
            },
            {
                'name': 'map',
                'displayName': 'Map View',
                'active': True,
                'html': 'opioid-hcv-hiv/opioid-hcv-hiv-map-panel.html'
            },
        ]
        return render_template('opioid-hcv-hiv/opioid-hcv-hiv-base.html', panels=panels, metadata=metadata)

    @app.route('/outbreak-detection')
    @login_required
    def outbreak_detection():
        diseases = list(decrypt(f"{app.config['DATADIR']}/processed/other_infectious_diseases/metadata.json"))

        panels = [
            {
                'name': 'main',
                'displayName': 'DMA-PRIME',
            },
            {
                'name': 'map',
                'displayName': 'Map View',
                'active': True,
                'html': 'outbreak-detection/outbreak-detection-map-panel.html'
            },
        ]
        return render_template('outbreak-detection/outbreak-detection-base.html', panels=panels, diseases=diseases)

    @app.route('/waste-water')
    @login_required
    def waste_water():
        metadata = {
            'site_info': {},
            'diseases': {},
            'min_date': pd.to_datetime('today').strftime('%Y-%m-%d'),
            'max_date': pd.to_datetime('today').strftime('%Y-%m-%d'),
            'min_display_date': pd.to_datetime('today').strftime('%A, %B %d, %Y'),
            'max_display_date': pd.to_datetime('today').strftime('%A, %B %d, %Y'),
        }
        
        metadata = dict(decrypt(f"{app.config['DATADIR']}/processed/waste_water/metadata.json"))

        panels = [
            {
                'name': 'main',
                'displayName': 'DMA-PRIME',
            },
            {
                'name': 'grid',
                'displayName': 'Grid View',
                'active': True,
                'html': 'waste-water/waste-water-grid-panel.html'
            },
        ]
        return render_template('waste-water/waste-water-base.html', panels=panels, metadata=metadata)

    if development:
        # Simply for my own convenience
        @app.route('/testing')
        def testing():
            return render_template('testing-vis.html')

    return app

