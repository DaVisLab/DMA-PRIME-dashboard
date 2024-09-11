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
    'data': {}
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
    def testing():
        return render_template('testing-vis.html')
    
    @app.route('/map-data/<mapType>', methods=['GET', 'POST'])
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
    
    @app.route('/hospitalizations/<disease>/<dataSource>', methods=['GET', 'POST'])
    def getHospitalizations(disease='covid-19', dataSource='state'):
        variables = request.get_json()

        region = input_parser(variables['region'])
        date = input_parser(variables['date'])

        data = fetchHospitalizationData(disease, region, date, dataSource)

        if variables['rate']:
            data['count'] /= (data['zcta_pop'] / 1000)

        stats = {
            'count':{'min': data['count'].min(axis=None),
                'max': data['count'].max(axis=None)},
            'date': {'min': data.index.levels[1].min(axis=None),
                'max': data.index.levels[1].max(axis=None)}
        }
        return jsonify({'data': json.loads(data.to_json(orient='table', index=True))['data'], 'stats': stats})
    
    @app.route('/hospitalization-grid/<disease>', methods=['GET', 'POST'])
    def getHospitalizationGrid(disease='covid-19'):
        variables = request.get_json()

        region = input_parser(variables['region'])
        date = parse_date(variables['date'])

        # if variables['rate']:
        start_date = date - pd.DateOffset(months=18)
        historical_dates = pd.date_range(end=date, start=start_date, freq='W')

        end_date = date + pd.DateOffset(weeks=6)
        pred_dates = pd.date_range(start=date, end=end_date, freq='W', inclusive='both')

        if historical_dates[-1] < date:
            historical_dates = historical_dates.union([date])

        historical_dates = historical_dates.insert(-1, date - pd.DateOffset(weeks=1))

        if pred_dates[0] > date:
            pred_dates = pred_dates.insert(0, date)

        historical_dates = historical_dates.strftime("%Y-%m-%d").to_list()
        pred_dates = pred_dates.strftime("%Y-%m-%d").to_list()

        historical_return_data_dict = {}

        h_mins = []
        h_maxs = []
        for data_source in ['state-model', 'health-system']:

            try:
                historical_data = fetchHospitalizationData(disease, region, historical_dates, data_source)
                if variables['rate']:
                    historical_data['count'] /= (historical_data['zcta_pop'] / 1000)
                historical_data.index = historical_data.index.droplevel(0)

            except KeyError:
                historical_data = pd.DataFrame(index=historical_dates, columns=['count'])
                historical_data['count'] = 0

            historical_data.index = historical_data.index.astype(str)
            historical_return_data_dict[data_source] = historical_data['count'].to_dict()
            h_mins.append(historical_data['count'].min(axis=None))
            h_maxs.append(historical_data['count'].max(axis=None))

        prediction_return_data_dict = {}

        try:
            predictive_data = fetchHospitalizationData(disease, region, pred_dates, 'state-model')
            if variables['rate']:
                    predictive_data['count'] /= (predictive_data['zcta_pop'] / 1000)
            predictive_data.index = predictive_data.index.droplevel(0)
            predictive_data.index = predictive_data.index.astype(str)
        except KeyError:
            predictive_data = pd.DataFrame(columns=['count'])

        prediction_return_data_dict['state-model'] = predictive_data['count'].to_dict()

        data = {
            'historical': historical_return_data_dict,
            'prediction': prediction_return_data_dict,
        }

        stats = {
            'count': {'min': float(min(*h_mins)),
                'max': float(max(*h_maxs))},
            'date': {'min': historical_dates[0], 'max': historical_dates[-1]}
        }

        return_data = {'data': data, 'stats': stats}

        return jsonify(return_data)

    @app.route('/hospitalization-history/<disease>', methods=['GET', 'POST'])
    def getHospitalizationHistory(disease='covid-19'):
        variables = request.get_json()

        region = input_parser(variables['region'])
        date = parse_date(variables['date'])

        start_date = date - pd.DateOffset(months=18)
        historical_dates = pd.date_range(end=date, start=start_date, freq='W')

        end_date = date + pd.DateOffset(weeks=6)
        pred_dates = pd.date_range(start=date, end=end_date, freq='W', inclusive='both')

        if historical_dates[-1] < date:
            historical_dates = historical_dates.union([date])

        historical_dates = historical_dates.insert(-1, date - pd.DateOffset(weeks=1))

        if pred_dates[0] > date:
            pred_dates = pred_dates.insert(0, date)

        historical_dates = historical_dates.strftime("%Y-%m-%d").to_list()
        pred_dates = pred_dates.strftime("%Y-%m-%d").to_list()

        historical_return_data_dict = {}

        h_mins = []
        h_maxs = []
        for data_source in ['state-data', 'state-train', 'state-post-train', 'health-system']:

            try:
                historical_data = fetchHospitalizationData(disease, region, historical_dates, data_source)
                if variables['rate']:
                    historical_data['count'] /= (historical_data['zcta_pop'] / 1000)
                historical_data.index = historical_data.index.droplevel(0)

            except KeyError:
                historical_data = pd.DataFrame(index=historical_dates, columns=['count'])
                historical_data['count'] = 0

            historical_data.index = historical_data.index.astype(str)
            historical_return_data_dict[data_source] = historical_data['count'].to_dict()
            h_mins.append(historical_data['count'].min(axis=None))
            h_maxs.append(historical_data['count'].max(axis=None))


        prediction_return_data_dict = {}

        try:
            predictive_data = fetchHospitalizationData(disease, region, pred_dates, 'state-model')
            if variables['rate']:
                    predictive_data['count'] /= (predictive_data['zcta_pop'] / 1000)
            predictive_data.index = predictive_data.index.droplevel(0)
            predictive_data.index = predictive_data.index.astype(str)
        except KeyError:
            predictive_data = pd.DataFrame(columns=['count'])

        prediction_return_data_dict['state-model'] = predictive_data['count'].to_dict()

        data = {
            'historical': historical_return_data_dict,
            'prediction': prediction_return_data_dict,
        }

        stats = {
            'count': {'min': min(*h_mins, predictive_data['count'].min(axis=None)),
                'max': max(*h_maxs, predictive_data['count'].max(axis=None))},
            'date': {'min': historical_dates[0], 'max': pred_dates[-1],
                'historical': {'min': historical_dates[0], 'max': historical_dates[-1]},
                'prediction': {'min': pred_dates[0], 'max': pred_dates[-1]}
                     },
        }

        return_data = {'data': data, 'stats': stats}

        return jsonify(return_data)


    return app


def fetchHospitalizationData(disease, region, date, dataSource):
    base_data = zcta_hospitalizations_dict['data'][disease]

    result = None

    if not isinstance(region, slice):
        for i in range(len(region)):
            region[i] = int(region[i])

    if not isinstance(date, slice):
        for i in range(len(date)):
            date[i] = parse_date(date[i])
    if dataSource == 'health-system':
        result = base_data.loc[(region, date), ['Health System hospitalizations', 'zcta_pop']]
        result = result.rename({'Health System hospitalizations': 'count'}, axis=1)
        result = result.fillna(value=0)

    elif dataSource == 'state':
        result = base_data.loc[(region, date), ['Statewide hospitalizations', 'zcta_pop']]
        result = result.rename({'Statewide hospitalizations': 'count'}, axis=1)

        if result['count'].isna().any():
            # replace any state data with state model data
            supplemental_data = base_data.loc[(region, date), ['Projected Cases', 'zcta_pop']]
            supplemental_data = supplemental_data.rename({'Projected Cases': 'count'}, axis=1)

            result.loc[result['count'].isna()] = supplemental_data.loc[result['count'].isna()]
    
    elif dataSource == 'state-data':
        result = base_data.loc[(region, date), ['Statewide hospitalizations', 'zcta_pop']]
        result = result.rename({'Statewide hospitalizations': 'count'}, axis=1)
        result = result.dropna()

    elif dataSource == 'state-model':
        result = base_data.loc[(region, date), ['Projected Cases', 'zcta_pop']]
        result = result.rename({'Projected Cases': 'count'}, axis=1)
        result = result.dropna()

    elif dataSource == 'state-train':
        result = base_data.loc[(region, date), ['Projected Cases(train)', 'zcta_pop']]
        result = result.rename({'Projected Cases(train)': 'count'}, axis=1)
        result = result.dropna()

    elif dataSource == 'state-post-train':
        result = base_data.loc[(region, date), ['Projected Cases(post training)', 'zcta_pop']]
        result = result.rename({'Projected Cases(post training)': 'count'}, axis=1)
        result = result.dropna()

    return result


def load_data():
    load_zcta_hospitalization()

def load_zcta_hospitalization():
    files = {
        'covid-19': main_dir+'/static/data/Data file for CDC site visit.csv'
        # 'covid-19': main_dir+'/static/data/covid-19 hospitalization (CDC visit TEMPORARY) v2.csv'
    }

    index_names = ['zcta', 'date']

    label_dict = {
            'health-system-data': 'Health System hospitalizations', 
            'state-training': 'Projected Cases(train)', 
            'state-testing': 'Projected Cases(post training)',
            'state-data': 'Statewide hospitalizations',
            }

    date = pd.Timestamp(year=2024, month=8, day=26) # pd.Timestamp.now().round(freq='d')

    start_date = date - pd.DateOffset(months=18)
    historical_dates = pd.date_range(end=date, start=start_date, freq='W-MON')
    historical_dates = historical_dates.to_list()

    end_date = date + pd.DateOffset(weeks=5)
    pred_dates = pd.date_range(start=date, end=end_date, freq='W-MON', inclusive='both')
    pred_dates = pred_dates.to_list()


    zcta_data = pd.read_csv(main_dir+'/static/data/zcta_summary.csv', index_col=0)

    for disease, file in files.items():

        # grid view
        df = pd.read_csv(file)
        df.rename({'Zip code': 'zcta', 'Date': 'date'}, axis=1, inplace=True)
        df['date'] = pd.to_datetime(df['date'])
        value_columns = df.columns.difference(index_names)
        df = pd.pivot_table(df, values=value_columns, index=index_names)
        zcta_data = pd.read_csv(main_dir+'/static/data/zcta_summary.csv', index_col=0)

        zctas = zcta_data['zcta'].unique()

        zcta_list = []

        for zcta in zctas:
            zcta_dict = {
                'zcta': int(zcta),
                'population': float(zcta_data.loc[zcta, 'population']),
                'county': zcta_data.loc[zcta, 'main_county']
            }
            for name, column in label_dict.items():
                try:
                    data = df.xs(zcta, axis=0).loc[historical_dates, column].fillna(value=0)
                    zcta_dict[name] = {
                            'start-date': data.index[0].strftime("%Y-%m-%d"),
                            'data': data.to_list(),
                        }
                except KeyError:
                    zcta_dict[name] = {
                            'start-date': date.strftime("%Y-%m-%d"),
                            'data': [],
                        }
            try:
                data = df.xs(zcta, axis=0).loc[pred_dates, 'Projected Cases(post training)']
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
                zcta_dict['state-training']['data'].append(zcta_dict['state-testing']['data'][-1])
            
            zcta_list.append(zcta_dict)
            with open( main_dir+'/static/data/'+disease+'_zcta_hospitalization_data.json', 'w') as f:
                json.dump(zcta_list, f)

        # map view
        df = pd.read_csv(file)
        df.rename({'Zip code': 'zcta', 'Date': 'date'}, axis=1, inplace=True)

        df['Projected Cases'] = df['Projected Cases(train)'].fillna(value=0) + df['Projected Cases(post training)'].fillna(value=0)
        # print(df['date'])
        # df['date'] = df['date'].apply(lambda x: '{0:>02s}-{1:>02s}-{2:04s}'.format(*x.split('-')))
        df['date'] = pd.to_datetime(df['date'], format='%Y-%m-%d')

        value_columns = df.columns.difference(index_names)
        df = pd.pivot_table(df, values=value_columns, index=index_names)

        zcta_data_reformatted = zcta_data.loc[df.index.get_level_values(0)]
        zcta_data_reformatted.index=pd.Index(range(df.shape[0]))

        df = df.assign(zcta_pop=zcta_data_reformatted['population'].values, main_county=zcta_data_reformatted['main_county'].values, 
                       INTPTLON=zcta_data_reformatted['INTPTLON'].values, INTPTLAT=zcta_data_reformatted['INTPTLAT'].values)

        zcta_hospitalizations_dict['data'][disease] = df


