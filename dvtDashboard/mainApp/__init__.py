# This is where the main flask code should lie

from flask import Flask, render_template, request
from werkzeug.middleware.proxy_fix import ProxyFix
import logging

import os
import subprocess
import pandas as pd
import numpy as np
import pandas as pd

from .utility import * 
from .data_handling import load_data
from .auth import login_required

# TODO: update below
# Data:
#    map, county, zip code
#        past, current, prediction
#            prediction history vs actual

logging.basicConfig(filename=main_dir+'/logs.log',level=logging.DEBUG)
def create_app(development=False, updatedData=True):
    # create and configure the app
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_mapping(
        SECRET_KEY='***REMOVED***',
        DEVELOPMENT=development,
    )
    app.wsgi_app = ProxyFix( # allows a reverse proxy
        app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1
    )

    app.config.from_pyfile('config.py', silent=True)

    if not development:
        from . import db
        db.init_app(app)
    
    # ensure the instance folder exists
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    if updatedData:
        load_data()

    # # # routes # # #

    from . import auth
    app.register_blueprint(auth.bp)

    from . import data_handling
    app.register_blueprint(data_handling.bp)
    
    # landing page
    @app.route('/')
    @login_required
    def index():
        panels = [
            {
                'name': 'main',
                'displayName': 'DMA-PRIME',
            },
            {
                'name': 'map',
                'displayName': 'Map View',
                'active': True,
                'html': 'landing-page/map-panel.html'
            },
            {
                'name': 'grid',
                'displayName': 'Grid View',
                'html': 'landing-page/grid-panel.html'
            },
            # {
            #     'name': 'comparison',
            #     'displayName': 'Map Comparison View',
            #     'html': 'landing-page/comparison-panel.html'
            # }
        ]
        return render_template('index.html', panels=panels)
    
    @app.route('/update', methods=['POST', 'GET'])
    def webhook():
        script = ""+main_dir+"/update.cmd"
        if(request.is_json):
            data = request.get_json()
            if data['ref'] == 'refs/heads/main':
                subprocess.call(script, shell=True, timeout=90)

        else:
            print(subprocess.call(script, shell=True, timeout=90))
            pass

        return '', 200

    if development:
        # Simply for my own convenience
        @app.route('/testing')
        def testing():
            return render_template('testing-vis.html')

    return app

