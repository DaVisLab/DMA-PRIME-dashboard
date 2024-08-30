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
real_dict = {
    'city': {'coordinates': {}, 'stats': None, 'data': None}, # city level data
    'zcta': {'shape': {}, 'stats': None, 'data': None}, # zip code level data
    'county': {'shape': {}, 'stats': None, 'data': None}, # county level data
    'hospital': {'coordinates':{}, 'stats': None, 'usage': None}, # from individual hospitals
    'hospital-zcta': {'stats': None, 'data': None, 'zcta-stats': None, 'prediction': None, 'prediction-stats': None}, # from individual hospitals
}

def create_app(test_config=None):
    # create and configure the app
    app = Flask(__name__, instance_relative_config=True)
    # ^ app is refered to with the decorators. It can be named whatever you want but you then do @name instead of @app

    app.config.from_mapping(
        SECRET_KEY='***REMOVED***',
        # DATABASE=os.path.join(app.instance_path, 'flaskr.sqlite'),
    )

    app.wsgi_app = ProxyFix(
        app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1
    )

    if test_config is None:
        # load the instance config, if it exists, when not testing
        app.config.from_pyfile('config.py', silent=True)
    else:
        # load the test config if passed in
        app.config.from_mapping(test_config)

    # ensure the instance folder exists
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass


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
    
    @app.route('/model-exploration')
    def modelExploration():
        panels = [
            {
                'name': 'main',
                'displayName': 'DMA-PRIME',
            },
            {
                'name': 'grid',
                'displayName': 'Grid View',
                'active': True,
                'html': 'model-exploration/grid-panel.html'
            },
            {
                'name': 'map',
                'displayName': 'Map View',
                'html': 'model-exploration/map-panel.html'
            }, 
        ]
        return render_template('model-exploration.html', panels=panels)
    
    @app.route('/testing')
    def testing():
        return render_template('testing-vis.html')
    
    @app.route('/map-data/<mapType>')
    def mapData(mapType):
        if mapType == 'zcta_county_crosswalk':
            mapDataDict = json.load(open(f'{main_dir}/static/data/zcta_county_crosswalk.json'))
        elif mapType == 'hospitals':
            mapDataDict = json.load(open(f'{main_dir}/static/data/Hospitals.geojson'))
        else:
            mapDataDict = json.load(open(f'{main_dir}/static/data/tl_2023_sc_{mapType}_trimmed.json'))
        return mapDataDict

    @app.route('/hospital/<id>')
    def getHospitalHTML(id):
        return render_template('subtemplates/hospital.html', id=id)
    
    @app.route('/tooltip/<type>')
    def getTooltipHTML(type=None):
        return render_template('subtemplates/tooltip.html', type=type)
    
    @app.route('/get-prediction/<mapType>/<region>/<numberQuantiles>', methods=['POST', 'GET'])
    def getPrediction(mapType='county', region='all', numberQuantiles=1):
        # if we're showing all, get max day
        # if we're showing one specific region, show all values until max predicted day
        if region == 'all':
            if mapType == 'county':
                items = request.get_json()
                values = (np.random.rand(len(items)) - .5) * 20
                values_list = []
                for pair in zip(items, values):
                    values_list.append({'item':pair[0], 'value':pair[1]})
                quantiles = getQuantiles(numberQuantiles, values)
                response = jsonify({
                    'values': values_list,
                    'min': min(values),
                    'max': max(values),
                    'quantiles': quantiles,
                })
                return response
            if mapType == 'zip':
                return '0'

    @app.route('/get-county-disease-data', methods=['POST'])
    def returnCountyDiseaseData():
        variables = request.get_json()
        region = slice(None) if variables['region-name'] == 'all' else variables['region-name'].split(',')
        disease = slice(None) if variables['disease'] == 'all' else variables['disease'].split(',')
        date = slice(None) if variables['date'] == 'all' else max(real_dict['county']['data'].index.levels[2]) if variables['date'] == 'max' else variables['date'].split(',')

        result =  getCountyDiseaseData(region, disease, date, variables['data-type'])

        return_data = result['data'].rename({variables['data-type']: 'count'}, axis=1)
        return_data_dict = json.loads(return_data.to_json(orient='table', index=True))['data']
        return_stats_dict = json.loads(result['stats'].to_json(orient='table', index=True))['data'] if isinstance(result['stats'], pd.DataFrame) else result['stats'].to_dict()
        return jsonify({'data': return_data_dict, 'stats': return_stats_dict, 'metadata': result['metadata']})

    @app.route('/get-county-disease-tooltip', methods=['POST'])
    def getCountyDiseaseTooltip():
        variables = request.get_json()

        date = max(real_dict['county']['data'].index.levels[2]) if variables['date'] == 'max' else variables['date'].split(',')[0]
        dates = pd.date_range(end=date, periods=8, freq='7D').strftime('%Y-%m-%d').to_list()

        result =  getCountyDiseaseData(variables['county'].split(','), variables['disease'].split(','), dates, variables['data-type'])

        return_data = result['data'].rename({variables['data-type']: 'count'}, axis=1)['count']
        return_data.index = return_data.index.droplevel(0)
        return_data_dict = {}
        for disease in return_data.index.levels[0]:
            return_data_dict[disease] = return_data.xs(disease).to_dict()

        return_stats_dict = {'min': return_data.min(axis=None), 'max': return_data.max(axis=None)}

        return jsonify({'data': return_data_dict, 'stats': return_stats_dict, 'metadata': result['metadata']})

    @app.route('/get-hospital-zcta-data', methods=['POST'])
    def returnZCTAHospitalData():
        variables = request.get_json()
        base_data = real_dict['hospital-zcta']['data']

        # region = slice(None) if variables['region-name'] == 'all' else variables['region-name']
        # disease = slice(None) if variables['disease'] == 'all' else variables['disease']
        # date = [max(real_dict['hospital-zcta']['data'].index.levels[2])] if variables['date'] == 'max' else slice(None) if variables['date'] == 'all' else variables['date']
        
        region = slice(None)
        disease = slice(None)
        date = '2023-11' # [max(base_data.index.levels[3])]

        if not isinstance(region, slice):
            if isinstance(region, list):
                for i in range(len(region)):
                    region[i] = int(region[i])
            else:
                region = int(region)
            region = base_data.index.levels[0].intersection(region) # make sure region exists

        return_data = base_data.groupby(['zcta', 'disease', 'date']).agg({'INTPTLAT': 'max', 'INTPTLON': 'max', 'ZCTA_POP': 'max', 'count': 'sum', 'days': 'max'})
        return_data = return_data.loc[(region, disease, date), ['count', 'INTPTLON', 'INTPTLAT', 'ZCTA_POP']]

        returned_index = return_data.index.remove_unused_levels().set_names('date', level=2).set_names('region', level=0)
        return_data.index = returned_index

        stats = {}
        stats['max'] = return_data.groupby('disease').max()['count'].to_dict()
        stats['max']['aggregated'] = return_data.groupby('region').sum()['count'].max()
        stats['max']['all'] = return_data['count'].max()

        metadata = {
            'region': returned_index.levels[0].to_list(),
            'disease': returned_index.levels[1].to_list(),
            'date': returned_index.levels[2].to_list(),
            'zcta-population': real_dict['hospital-zcta']['zcta-stats']['ZCTA_POP'].dropna().to_dict(),
            'zcta-main-county': real_dict['hospital-zcta']['zcta-stats']['main-county'].dropna().to_dict(),
            'zcta-county-crosswalk': real_dict['hospital-zcta']['zcta-stats']['counties'].dropna().to_dict()
        }

        return jsonify({'data': json.loads(return_data.to_json(orient='table', index=True))['data'], 'stats': stats, 'metadata': metadata})


    @app.route('/get-hospital-zcta-data-by-county', methods=['POST'])
    def returnZCTAHospitalDataByCounty():
        variables = request.get_json()
        base_data = real_dict['hospital-zcta']['data']
        diseases = variables['disease']

        if isinstance(diseases, str): 
            if diseases == 'all': 
                diseases = slice(None)
            else:
                diseases = [diseases]
        
        if variables['pop-norm']:
            countyPops = pd.read_csv(main_dir+'/static/data/county/countyPopulations.csv')

        stats = {
            'county': {}, # max of all disease for plotting, max point (date, count) for each disease
            'max-cum': 0,
            'min-date': base_data.index.levels[3].min(),
            'max-date': base_data.index.levels[3].max(),
        }

        county_to_zcta = real_dict['hospital-zcta']['zcta-stats'].groupby(['zcta', 'main-county']).max().index.to_frame(index=False).groupby(['main-county']).apply(lambda x: list(x.zcta)).to_dict()

        return_data = {}
        
        for county, zctas in county_to_zcta.items():
            countyPop = 1
            if variables['pop-norm']:
                countyPop = countyPops.loc[countyPops['county'] == county, 'population'].values[0].item()

            if isinstance(zctas, list):
                for i in range(len(zctas)):
                    zctas[i] = int(zctas[i])
            else:
                zctas = int(zctas)
            zctas = base_data.index.levels[0].intersection(zctas) # make sure region exists
            result = base_data.loc[(zctas, diseases, slice(None), slice(None)), ['count']] 

            return_data[county] = {
                'aggregated': None,
                'individual': [],
            }

            temp1 = result.groupby(['disease', 'date']).sum()
            stats['county'][county] = {
                'individual': {}
            }

            for disease in diseases:
                temp2 = temp1.xs(disease) / countyPop
                stats['county'][county]['individual'][disease] = {
                    'date': temp2.idxmax().values[0],
                    'count': temp2.loc[temp2.idxmax()].values[0][0].item()
                }
                return_data[county]['individual'].append({'disease': disease, 'data': json.loads(temp2.to_json(orient='table', index=True))['data']})

            aggregate = result.groupby(['date']).sum() / countyPop
            # if aggregate.empty:
            #     continue
            return_data[county]['aggregated'] = [{'disease': 'aggregated', 'data': json.loads(aggregate.to_json(orient='table', index=True))['data']}] 
            stats['county'][county]['max'] = aggregate.max().values[0].item()
            stats['county'][county]['aggregated'] = {'aggregated':{
                'date': aggregate.idxmax().values[0],
                'count': aggregate.loc[aggregate.idxmax()].values[0][0].item()
            }}

            cumsummax = aggregate.cumsum().max().values[0].item()
            return_data[county]['cum-sum'] = cumsummax

            if stats['max-cum'] < cumsummax:
                stats['max-cum'] = cumsummax

        metadata = {
            'disease': result.index.levels[1]
        }

        return jsonify({'data': return_data, 'stats': stats})


    @app.route('/get-hospital-zcta-tooltip', methods=['POST'])
    def getHospitalZCTATooltip():
        variables = request.get_json()

        print(variables['aggregated'], variables['aggregated'] == True)

        variables['region-name'] = input_parser(variables['region-name'])
        if variables['aggregated']:
            variables['disease'] = slice(None)
        else:
            variables['disease'] = input_parser(variables['disease'])
        date = variables['date']
        if date == 'max':
            date = max(real_dict['hospital-zcta']['data'].index.levels[3])
        dates = pd.date_range(end=date, periods=12, freq='MS').strftime('%Y-%m').to_list()

        pred_dates = (pd.Timestamp(date) + pd.DateOffset(months=1)).strftime('%Y-%m')
        
        # TODO: TEMPORARY NOTES - make pred dates dynamic 
        pred_dates = pd.date_range(pd.to_datetime('11/20/2023'), periods=5, freq='7D').strftime('%Y-%m-%d').to_list()

        try:
            historical_result = getZCTAHospitalData(variables['region-name'], variables['disease'], dates)
            population = historical_result['data']['ZCTA_POP'].max()
        except KeyError:
            temp_index = pd.MultiIndex.from_product(
                [variables['region-name'], variables['disease'], ['temp'], dates],
                names=['zcta', 'disease', 'county', 'date'])
            temp_df = pd.DataFrame(index=temp_index, columns=['count'])
            temp_df.loc[(variables['region-name'], variables['disease'], slice(None), dates)] = 0
            historical_result = {'data': temp_df}
            historical_result['metadata'] = {name: vals.to_list() for (name, vals) in zip(temp_index.names, temp_index.levels)}
            population = 1
        historical_return_data = historical_result['data']['count']
        historical_return_data.index = historical_return_data.index.droplevel(0)
        historical_return_data_dict = {}

        if variables['aggregated']:
            historical_return_data_dict['aggregated'] = historical_return_data.groupby('date').sum().to_dict()
        else:
            for disease in historical_return_data.index.levels[0]:
                historical_return_data_dict[disease] = historical_return_data.xs(disease).groupby('date').sum().to_dict()


        predictive_return_data_dict = {}
        predictive_result = {'metadata': {'date': []}}
        p_mins = []
        p_maxs = []

        p_min = historical_return_data.min(axis=None)
        p_max = historical_return_data.max(axis=None)
        if not variables['aggregated']: 

            for disease in variables['disease']:
                    
                try:
                    # predictive_result = getZCTAHospitalData(variables['region-name'], variables['disease'], pred_dates)
                    predictive_result = getZCTAHospitalPredictionData(variables['region-name'], disease, pred_dates)
                    predictive_return_data = predictive_result['data']
                    predictive_return_data.index = predictive_return_data.index.droplevel(0) # drop region
                    predictive_return_data.index = predictive_return_data.index.droplevel(0) # drop disease since we know what it is
    
                    p_mins.append(predictive_return_data['min_prediction'].min(axis=None))
                    p_maxs.append(predictive_return_data['max_prediction'].max(axis=None))
                    predictive_return_data_dict[disease] = predictive_return_data.to_dict(orient='index')
                except KeyError:
                    predictive_return_data_dict[disease] = []
                    p_mins.append(historical_return_data.min(axis=None))
                    p_maxs.append(0)
                    continue

                # predictive_return_data = predictive_result['data']['count']
                # print(predictive_result['data'])
                # predictive_return_data = predictive_result['data']['prediction', 'max_prediction', 'min_prediction']
                # predictive_return_data.index = predictive_return_data.index.droplevel(0)
                # predictive_return_data_dict = {}
                # for disease in predictive_return_data.index.levels[0]:
                #     predictive_return_data_dict[disease] = predictive_return_data.xs(disease).groupby('date').sum().to_dict()

            p_min = min(p_mins)
            p_max = max(p_maxs)

        # return_stats_dict = {'min': min(historical_return_data.min(axis=None), predictive_return_data.min(axis=None)), 'max': max(historical_return_data.max(axis=None), predictive_return_data.max(axis=None))}
        return_stats_dict = {'min': min(historical_return_data.min(axis=None), p_min), 'max': max(historical_return_data.max(axis=None), p_max)}
        metadata = historical_result['metadata']
        metadata['date'] = {'historical': historical_result['metadata']['date'], 'predictive': predictive_result['metadata']['date']}
        metadata['population'] = population

        return_data = {'data': {'historical': historical_return_data_dict, 'predictive': predictive_return_data_dict}, 'stats': return_stats_dict, 'metadata': metadata}

        return jsonify(return_data)

    @app.route('/get-hospital-zcta-aggregation', methods=['POST'])
    def getHospitalZCTAAggregation():
        variables = request.get_json()

        result = getZCTAHospitalData(slice(None), slice(None), slice(None))

        to_group_by = ['date'] if variables['aggregate'] else ['disease', 'date'] 
        grouped_data = result['data'].groupby(to_group_by).agg({'count':'sum'})

        return_data = {}
        return_stats = {'max': None, 'date-min': None, 'date-max': None}
        
        if variables['aggregate']:
            return_stats['max'] = max(grouped_data['count'])
            return_stats['date-min'] = grouped_data.index.min()
            return_stats['date-max'] = grouped_data.index.max()
            return_data = json.loads(grouped_data.to_json(orient='table', index=True))['data']
        else:
            return_stats['max'] = {}
            return_stats['date-min'] = {}
            return_stats['date-max'] = {}
            for disease in grouped_data.index.levels[0]:
                data = grouped_data.loc[disease]
                return_stats['max'][disease] = max(data['count'])
                return_stats['date-min'][disease] = data.index.min()
                return_stats['date-max'][disease] = data.index.max()
                return_data[disease] = json.loads(data.to_json(orient='table', index=True))['data']

        return jsonify({'data':return_data, 'stats': return_stats})

    loadData()

    return app

# data fetching
def getCountyDiseaseData(region, disease, date, data_type):

    base_data = real_dict['county']['data']
    base_stats = real_dict['county']['stats']
    return_data = base_data.loc[(region, disease, date), [data_type, 'INTPTLON', 'INTPTLAT']] 
    return_stats = base_stats.loc[(date, data_type), :]
    returned_index = return_data.index.remove_unused_levels().set_names('region', level=0)
    return_data.index = returned_index
    metadata = {name: vals.to_list() for (name, vals) in zip(returned_index.names, returned_index.levels)}
    return {'data': return_data, 'stats': return_stats, 'metadata': metadata}

def getZCTAHospitalData(region, disease, date): 
    base_data = real_dict['hospital-zcta']['data']
    base_stats = real_dict['hospital-zcta']['stats']
    if not isinstance(region, slice):
        if isinstance(region, str):
            region = [region]
        for i in range(len(region)):
            region[i] = int(region[i])
    return_data = base_data.loc[(region, disease, slice(None), date), ['count', 'INTPTLON', 'INTPTLAT', 'ZCTA_POP']] 
    return_stats = base_stats.loc[date, :]
    returned_index = return_data.index.remove_unused_levels().set_names('date', level=3).set_names('region', level=0)
    return_data.index = returned_index
    metadata = {name: vals.to_list() for (name, vals) in zip(returned_index.names, returned_index.levels)}
    return {'data': return_data, 'stats': return_stats, 'metadata': metadata}

def getZCTAHospitalPredictionData(region, disease, date): 
    base_data = real_dict['hospital-zcta']['prediction']
    base_stats = real_dict['hospital-zcta']['prediction-stats']
    if not isinstance(region, slice):
        if isinstance(region, str):
            region = [region]
        for i in range(len(region)):
            region[i] = int(region[i])
    return_data = base_data.loc[(region, disease, date), ['prediction', 'max_prediction', 'min_prediction']] 

    return_stats = {
        'prediction': {'min': 0, 'max': 0},
        'min_prediction': {'min': 0, 'max': 0},
        'max_prediction': {'min': 0, 'max': 0},
    }

    # return_stats = base_stats.loc[date, :]
    returned_index = return_data.index.remove_unused_levels().set_names('date', level=2).set_names('region', level=0)
    return_data.index = returned_index
    metadata = {name: vals.to_list() for (name, vals) in zip(returned_index.names, returned_index.levels)}

    return {'data': return_data, 'stats': return_stats, 'metadata': metadata}


# data loading

def loadData():
    loadCountyData()
    loadZCTAData2()

def getQuantiles(num_quantiles, data):
    quantiles = []
    for q in range(num_quantiles+1):
        quantiles.append(np.quantile(data, q/num_quantiles))
    return quantiles

def loadCountyData():
    # county
    index_names = ['county', 'disease', 'date']

    df_multi = pd.DataFrame()

    files = [
    # 'C:/Users/***REMOVED***/Box/BoxPHI-PHMR Projects/Toolkit/Cleaned_Data/SC/Covid19/Case_Death_Counts.csv',
    main_dir+'/static/data/covid_case_death_counts.csv',
    main_dir+'/static/data/dummy_flu.csv',
    main_dir+'/static/data/dummy_opioid.csv',
    ]

    for f_path in files:
        df = pd.read_csv(f_path)
        value_columns = df.columns.difference(index_names)
        temp_df = pd.pivot_table(df, values=value_columns, index=index_names)
        df_multi = pd.concat([df_multi, temp_df])
    df_multi.sort_index(inplace=True)

    # county stats
    columns=['min', 'q20', 'q25', 'q40', 'q50', 'q60', 'q75', 'q80', 'max']
    quantiles = [0, .2, .25, .4, .5, .6, .75, .8, 1]
    dates = df_multi.index.levels[2]
    data_type = ['cases 7-day average', 'deaths 7-day average']

    stats_index = pd.MultiIndex.from_product([dates, data_type], names=['date', 'data_type'])
    stats_df = pd.DataFrame(columns=columns, index=stats_index)
    stats_df.sort_index(inplace=True)
    for idx in stats_index:
        stats_df.loc[idx, :] = np.nanquantile(df_multi.loc[(slice(None), slice(None), idx[0]), idx[1]], quantiles)

    # saving to dict
    real_dict['county']['data'] = df_multi
    real_dict['county']['stats'] = stats_df

def loadZCTAData():
    # zcta
    index_names = ['zcta', 'disease', 'year-month']

    df_multi = pd.DataFrame()

    files = [
    main_dir+'/static/data/covid_hospital_zcta.csv',
    main_dir+'/static/data/flu_hospital_zcta.csv',
    ]

    for f_path in files:
        df = pd.read_csv(f_path)
        value_columns = df.columns.difference(index_names)
        temp_df = pd.pivot_table(df, values=value_columns, index=index_names)
        df_multi = pd.concat([df_multi, temp_df])
    df_multi.sort_index(inplace=True)
    
    df_multi['county'] = ''
    zcta_county_crosswalk = pd.read_csv(main_dir+'/static/data/zcta_county_weights.csv').fillna(0)
    one_to_one_crosswalk = zcta_county_crosswalk.groupby('GEOID_ZCTA5_20').apply(lambda zcta: zcta.loc[zcta['WEIGHT'].idxmax()])
    for zcta in temp_df.index.levels[0]:
        county = one_to_one_crosswalk.loc[zcta, 'County'].split(' County')[0].lower()
        df_multi.loc[zcta, 'county'] = county

    df_multi['count'] #/= df_multi['days']

    # zcta stats
    columns=['min', 'q20', 'q25', 'q40', 'q50', 'q60', 'q75', 'q80', 'max']
    quantiles = [0, .2, .25, .4, .5, .6, .75, .8, 1]
    dates = df_multi.index.levels[2]

    stats_df = pd.DataFrame(columns=columns, index=dates)
    stats_df.sort_index(inplace=True)
    for idx in dates:    
        stats_df.loc[idx, :] = np.nanquantile(df_multi.loc[(slice(None), slice(None), idx), 'count'], quantiles)

    # saving to dict
    real_dict['hospital-zcta']['data'] = df_multi
    real_dict['hospital-zcta']['stats'] = stats_df


def loadZCTAData2():
    # zcta
    # index_names = ['zcta', 'disease', 'year-month']
    index_names = ['zcta', 'disease', 'county', 'date']
    # zcta,county,date,count,disease,days,INTPTLON,INTPTLAT,PARTIAL_POP,ZCTA_POP

    df_multi = pd.DataFrame()
    pred_multi = pd.DataFrame()

    files = [
    main_dir+'/static/data/covid_hospital_zcta_new.csv', # 'mainApp/static/data/covid_hospital_zcta.csv',
    main_dir+'/static/data/influenza_hospital_zcta_new.csv', #'mainApp/static/data/flu_hospital_zcta.csv',
    main_dir+'/static/data/rsv_hospital_zcta_new.csv',
    ]

    pred_files = [
        main_dir+'/static/data/covid_hospital_prediction_zcta.csv',
    ]

    for f_path in files:
        df = pd.read_csv(f_path)
        value_columns = df.columns.difference(index_names)
        temp_df = pd.pivot_table(df, values=value_columns, index=index_names)
        df_multi = pd.concat([df_multi, temp_df])
    df_multi.sort_index(inplace=True)

    for f_path in pred_files:
        df = pd.read_csv(f_path)
        value_columns = df.columns.difference(index_names)
        temp_df = pd.pivot_table(df, values=value_columns, index=['zcta', 'disease', 'date'])
        pred_multi = pd.concat([pred_multi, temp_df])
    pred_multi.sort_index(inplace=True)

    # zcta stats
    columns=['min', 'q20', 'q25', 'q40', 'q50', 'q60', 'q75', 'q80', 'max']
    quantiles = [0, .2, .25, .4, .5, .6, .75, .8, 1]
    dates = df_multi.index.levels[3]

    stats_df = pd.DataFrame(columns=columns, index=dates)
    stats_df.sort_index(inplace=True)
    for idx in dates:    
        stats_df.loc[idx, :] = np.nanquantile(df_multi.loc[(slice(None), slice(None), slice(None), idx), ['count']], quantiles)

    population_df = pd.read_csv(main_dir+'/static/data/zcta_county_weights.csv')
    zcta_population = population_df.groupby(['GEOID_ZCTA5_20']).max()['ZCTA_POP']
    zcta_main_county_df = pd.read_json(main_dir+'/static/data/zcta_county_crosswalk.json', typ='series')
    zcta_counties_df = df_multi.groupby(['zcta', 'county']).max().index.to_frame(index=False).groupby(['zcta']).apply(lambda x: list(x.county))
    zcta_stats = pd.concat([zcta_population, zcta_main_county_df, zcta_counties_df], axis=1).rename({0: 'main-county', 1: 'counties'}, axis=1)
    zcta_stats.index.set_names(['zcta'], inplace=True)

    # saving to dict
    real_dict['hospital-zcta']['data'] = df_multi
    real_dict['hospital-zcta']['zcta-stats'] = zcta_stats
    real_dict['hospital-zcta']['stats'] = stats_df

    real_dict['hospital-zcta']['prediction'] = pred_multi

