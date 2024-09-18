# This is where the main flask code should lie

from flask import Flask, jsonify, render_template, request
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.security import check_password_hash, generate_password_hash

import os
import pandas as pd
import numpy as np
import pandas as pd
import json
import math

from .utility import * 
from .auth import login_required

# TODO: update below
# Data:
#    map, county, zip code
#        past, current, prediction
#            prediction history vs actual

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

    from . import db
    db.init_app(app)
    
    # ensure the instance folder exists
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    load_data()

    # # # routes # # #

    from . import auth
    app.register_blueprint(auth.bp)

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
    @login_required
    def testing():
        return render_template('testing-vis.html')
    
    @app.route('/map-data/<mapType>', methods=['GET', 'POST'])
    @login_required
    def mapData(mapType):
        if mapType == 'zcta_county_crosswalk':
            mapDataDict = json.load(open(f'{main_dir}/static/data/zcta_county_crosswalk.json'))
        elif mapType == 'hospitals':
            mapDataDict = json.load(open(f'{main_dir}/static/data/Hospitals.geojson'))
        else:
            if mapType == 'zcta':
                mapDataDict = json.load(open(f'{main_dir}/static/data/tl_2023_sc_{mapType}_trimmed_simplified_ogr2ogr_.001.json'))
                # mapDataDict = json.load(open(f'{main_dir}/static/data/tl_2023_sc_{mapType}_trimmed_simplified.json'))
            else:
                mapDataDict = json.load(open(f'{main_dir}/static/data/tl_2023_sc_{mapType}_trimmed_simplified_ogr2ogr_.001.json'))
        return mapDataDict

    @app.route('/hospitalization-grid/<disease>', methods=['GET', 'POST'])
    @login_required
    def getHospitalizations(disease='covid-19'):
        return json.load(open(f'{main_dir}/static/data/{disease}_zcta_hospitalization_data.json'))

    return app


def load_data():
    load_zcta_hospitalization()

def load_zcta_hospitalization():
    files = {
        # 'covid-19': main_dir+'/static/data/covid_cdc_site_visit.csv',
        'covid-19': [main_dir+'/static/data/Data file for CDC site visit v1.csv', main_dir+'/static/data/Data file for CDC site visit_TA.csv'],
    }
    index_names = ['zcta', 'date']

    label_dict = {
            'health-system-data': 'Health System hospitalizations', 
            'state-training': 'Projected Cases(train)', 
            'state-testing': 'Projected Cases(post training)',
            'state-data': 'Statewide hospitalizations',
            }

    date = pd.Timestamp(year=2024, month=9, day=9) # pd.Timestamp.now().round(freq='d')

    start_date = date - pd.DateOffset(months=18)
    historical_dates = pd.date_range(end=date, start=start_date, freq='W-MON')
    historical_dates = historical_dates.to_list()

    end_date = date + pd.DateOffset(weeks=5)
    pred_dates = pd.date_range(start=date, end=end_date, freq='W-MON', inclusive='both')
    pred_dates = pred_dates.to_list()


    zcta_data = pd.read_csv(main_dir+'/static/data/zcta_summary.csv', index_col=0)

    for disease, file in files.items():
        
        # grid view
        df = pd.DataFrame()
        if isinstance(file, list):
            for f in file:
                df = pd.concat([df, pd.read_csv(f)])
        else:
            df = pd.read_csv(file)

        df.rename({'Zip code': 'zcta', 'Date': 'date'}, axis=1, inplace=True)
        df['date'] = pd.to_datetime(df['date'])
        df['Health System hospitalizations'] = df['Health System hospitalizations'].fillna(value=0)
        value_columns = df.columns.difference(index_names)
        df = pd.pivot_table(df, values=value_columns, index=index_names)

        zctas = zcta_data['zcta'].unique()

        zcta_list = []

        for zcta in zctas:
            zcta_dict = {
                'zcta': int(zcta),
                'population': str(zcta_data.loc[zcta, 'population']),
                'county': str(zcta_data.loc[zcta, 'main_county'])
            }
            for name, column in label_dict.items():
                try:
                    data = df.xs(zcta, axis=0)[column].reindex(historical_dates).dropna() # df.xs(zcta, axis=0).loc[historical_dates, column].dropna()
                    zcta_dict[name] = {
                            'start-date': data.index[0].strftime("%Y-%m-%d"),
                            'data': data.to_list(),
                        }
                except IndexError:
                    zcta_dict[name] = {
                            'start-date': date.strftime("%Y-%m-%d"),
                            'data': [],
                        }
                except KeyError:
                    zcta_dict[name] = {
                            'start-date': date.strftime("%Y-%m-%d"),
                            'data': [],
                        }
            try:
                data = df.xs(zcta, axis=0).loc[pred_dates, 'Projected Cases(post training)'].dropna()
                zcta_dict['state-prediction'] = {
                        'start-date': data.index[0].strftime("%Y-%m-%d"),
                        'data': data.to_list(),
                    }
            except KeyError:
                zcta_dict['state-prediction'] = {
                        'start-date': date.strftime("%Y-%m-%d"),
                        'data': [],
                    } 

            if len(zcta_dict['state-testing']['data']) > 0:
                zcta_dict['state-training']['data'].append(zcta_dict['state-testing']['data'][0])
            
            zcta_list.append(zcta_dict)
            with open( main_dir+'/static/data/'+disease+'_zcta_hospitalization_data.json', 'w') as f:
                json.dump(zcta_list, f)