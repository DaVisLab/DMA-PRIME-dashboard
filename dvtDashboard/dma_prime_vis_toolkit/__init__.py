# This is where the main flask code should lie

from flask import Flask, render_template, request, send_file
from werkzeug.middleware.proxy_fix import ProxyFix
import logging

import os
import datetime
import pandas as pd
import numpy as np
import json

from .utility import * 
from .authenticate import login_required, bp

logging.basicConfig(filename=main_dir+'/logs.log',level=logging.DEBUG)
def create_app(development=False, dataDir=None):
    if dataDir is None:
        exit("No data directory")
    # create and configure the app
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_mapping(
        SECRET_KEY='***REMOVED***',
        DEVELOPMENT=development,
        DATADIR=dataDir,
    )
    app.wsgi_app = ProxyFix( # allows a reverse proxy
        app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1
    )

    app.config.from_pyfile('config.py', silent=True)

    # ignores login requirements
    if not development:
        from . import database as db
        db.init_app(app)
    
    # ensure the instance folder exists
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    # # # routes # # #

    app.register_blueprint(authenticate.bp)

    from . import data_handling
    app.register_blueprint(data_handling.bp)
    
    # landing page, though now respiratory
    @app.route('/')
    @login_required
    def index():
        return render_template('index.html')

    @app.route('/respiratory')
    @login_required
    def respiratory():
        today = pd.to_datetime("today").normalize()
        current_week = today + pd.DateOffset(days=(5 - today.weekday()) % 7)
        metadata = {
            'diseases': {
                'covid-19': 'Covid-19'
            },
            'start_date': (current_week - pd.DateOffset(months=18)).strftime('%Y-%m-%d'),
            'current_week': current_week.strftime('%Y-%m-%d'),
            'end_date': (current_week + pd.DateOffset(weeks=4)).strftime('%Y-%m-%d')
        }

        with open(f'{app.config['DATADIR']}/processed/respiratory/metadata.json') as f:
            metadata = dict(json.load(f))

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

    @app.route('/modeling')
    @login_required
    def modeling():
        panels = [
            {
                'name': 'main',
                'displayName': 'DMA-PRIME',
            },
            {
                'name': 'map',
                'displayName': 'Map View',
                'active': True,
                'html': 'modeling/modeling-map-panel.html'
            },
        ]
        return render_template('modeling/modeling-base.html', panels=panels)
    
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
        with open(f'{app.config['DATADIR']}/processed/opioid_hcv_hiv/metadata.json') as f:
            metadata = dict(json.load(f))
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

    @app.route('/other-infectious-diseases')
    @login_required
    def other_infectious_diseases():
        disease_files = os.listdir(f'{app.config['DATADIR']}/raw/other_diseases')

        diseases = []

        for file in disease_files:
            disease_display_name = file.split(',')[0]
            disease = disease_display_name.split(',')[0]
            disease = disease.lower()
            disease = disease.split('(')[0]
            disease = disease.strip()
            disease = '-'.join(disease.split(' '))
            diseases.append({'display-name': disease_display_name, 'disease-name': disease})
        panels = [
            {
                'name': 'main',
                'displayName': 'DMA-PRIME',
            },
            {
                'name': 'map',
                'displayName': 'Map View',
                'active': True,
                'html': 'other-infectious-diseases/other-infectious-diseases-map-panel.html'
            },
        ]
        return render_template('other-infectious-diseases/other-infectious-diseases-base.html', panels=panels, diseases=diseases)

    @app.route('/waste-water')
    @login_required
    def waste_water():
        metadata = {
            'site_info': {},
            'diseases': {},
            'min_date': pd.to_datetime('today').strftime('%Y-%m-%d'),
            'max_date': pd.to_datetime('today').strftime('%Y-%m-%d'),
        }
        with open(f'{app.config['DATADIR']}/processed/waste_water/metadata.json') as f:
            metadata = dict(json.load(f))
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

