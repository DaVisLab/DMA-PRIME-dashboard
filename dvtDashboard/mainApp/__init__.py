# This is where the main flask code should lie

from flask import Flask, jsonify, render_template, request
from werkzeug.middleware.proxy_fix import ProxyFix

import os
import pandas as pd
import numpy as np
import pandas as pd
import glob
import json

from .utility import * 

# Data:
#    map, county, zip code
#        past, current, prediction
#            prediction history vs actual


# cases and deaths should be MultiIndexes 
# stats and usage can be normal dataframes
zcta_hospitalizations_dict = {
    'data': None
}

def create_app():
    # create and configure the app
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_mapping(
        SECRET_KEY='***REMOVED***',
    )
    app.wsgi_app = ProxyFix( # allows a reverse proxy
        app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1
    )

    app.config.from_pyfile('config.py', silent=True)

    # ensure the instance folder exists
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    load_data()

    # # # routes # # #

    # landing page
    @app.route('/')
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
            {
                'name': 'comparison',
                'displayName': 'Map Comparison View',
                'html': 'landing-page/comparison-panel.html'
            }
        ]
        return render_template('index.html', panels=panels)
    
    # Not including this as part of the website yet
    # @app.route('/model-exploration')
    # def modelExploration():
    #     panels = [
    #         {
    #             'name': 'main',
    #             'displayName': 'DMA-PRIME',
    #         },
    #         {
    #             'name': 'grid',
    #             'displayName': 'Grid View',
    #             'active': True,
    #             'html': 'model-exploration/grid-panel.html'
    #         },
    #         {
    #             'name': 'map',
    #             'displayName': 'Map View',
    #             'html': 'model-exploration/map-panel.html'
    #         }, 
    #     ]
    #     return render_template('model-exploration.html', panels=panels)

    # Simply for my own convenience
    @app.route('/testing')
    def testing():
        return render_template('testing-vis.html')
    
    @app.route('/map-data/<mapType>', methods=['GET', 'POST'])
    def mapData(mapType):
        if mapType == 'zcta_county_crosswalk':
            mapDataDict = json.load(open(f'{main_dir}/static/data/zcta_county_crosswalk.json'))
        elif mapType == 'hospitals':
            mapDataDict = json.load(open(f'{main_dir}/static/data/Hospitals.geojson'))
        else:
            mapDataDict = json.load(open(f'{main_dir}/static/data/tl_2023_sc_{mapType}_trimmed.json'))
        return mapDataDict
    
    @app.route('/hospitalizations/<disease>/<dataSource>')
    def getHospitalizations(disease='covid-19', dataSource='jiandeModel'):
        base_data = zcta_hospitalizations_dict.data[disease]

        return ''
    


def load_data():
    load_zcta_hospitalization()

def load_zcta_hospitalization():
    files = {
        'covid-19': main_dir+'/static/data/covid-19 hospitalization (CDC visit TEMPORARY) v2.csv'
    }

    index_names = ['zcta', 'date']

    zcta_data = pd.read_csv(main_dir+'/static/data/zcta_summary.csv', index_col=0)

    for disease, file in files.items:
        df = pd.read_csv(file)
        df.rename({'Zip code': 'zcta', 'Date': 'date'}, axis=1, inplace=True)
        
        zcta_data_reformatted = zcta_data.loc[df['zcta']]
        zcta_data_reformatted.index=pd.Index(range(df.shape[0]))

        df = df.assign(zcta_pop=zcta_data_reformatted['ZCTA_POP'], main_county=zcta_data_reformatted['County'], INTPTLON=zcta_data_reformatted['INTPTLON'], INTPTLAT=zcta_data_reformatted['INTPTLAT'])
        
        value_columns = df.columns.difference(index_names)
        df = pd.pivot_table(df, values = value_columns, index=index_names)

        zcta_hospitalizations_dict.data[disease] = df


