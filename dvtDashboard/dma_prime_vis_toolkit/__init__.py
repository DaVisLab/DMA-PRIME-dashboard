# This is where the main flask code should lie

from flask import Flask, render_template, request, send_file
from werkzeug.middleware.proxy_fix import ProxyFix
import logging

import os
import subprocess
import pandas as pd
import numpy as np

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
            #     'name': 'comparison',
            #     'displayName': 'Map Comparison View',
            #     'html': 'respiratory/comparison-panel.html'
            # }
        ]
        return render_template('respiratory/respiratory-base.html', panels=panels, diseases=list(files.keys()))
    
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
    
    @app.route('/opioid')
    @login_required
    def opioid():
        panels = [
            {
                'name': 'main',
                'displayName': 'DMA-PRIME',
            },
            {
                'name': 'map',
                'displayName': 'Map View',
                'active': True,
                'html': 'opioid/opioid-map-panel.html'
            },
        ]
        return render_template('opioid/opioid-base.html', panels=panels)

    if development:
        # Simply for my own convenience
        @app.route('/testing')
        def testing():
            return render_template('testing-vis.html')

    return app

