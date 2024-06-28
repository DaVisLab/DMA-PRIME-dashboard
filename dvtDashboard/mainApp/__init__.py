# This is where the main flask code should lie

from flask import Flask, jsonify, render_template, request
import os
import pandas as pd
import numpy as np
import pandas as pd
import glob
import json

from .utility import counties 

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
    'hospital-zcta': {'stats': None, 'data': None}, # from individual hospitals
}

def create_app(test_config=None):
    # create and configure the app
    app = Flask(__name__, instance_relative_config=True)
    # ^ app is refered to with the decorators. It can be named whatever you want but you then do @name instead of @app

    app.config.from_mapping(
        SECRET_KEY='dev',
        # DATABASE=os.path.join(app.instance_path, 'flaskr.sqlite'),
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


    # a simple page that says hello
    @app.route('/')
    def index():
        return render_template("index.html")
    
    @app.route('/hospital/<id>')
    def getHospitalHTML(id):
        return render_template("subtemplates/hospital.html", id=id)
    
    @app.route('/tooltip/<type>')
    def getTooltipHTML(type=None):
        return render_template("subtemplates/tooltip.html", type=type)
    
    @app.route('/get-prediction/<mapType>/<region>/<numberQuantiles>', methods=['POST', 'GET'])
    def getPrediction(mapType="county", region="all", numberQuantiles=1):
        # if we're showing all, get max day
        # if we're showing one specific region, show all values until max predicted day
        if region == "all":
            if mapType == "county":
                items = request.get_json()
                values = (np.random.rand(len(items)) - .5) * 20
                values_list = []
                for pair in zip(items, values):
                    values_list.append({"item":pair[0], "value":pair[1]})
                quantiles = getQuantiles(numberQuantiles, values)
                response = jsonify({
                    "values": values_list,
                    "min": min(values),
                    "max": max(values),
                    "quantiles": quantiles,
                })
                return response
            if mapType == "zip":
                return "0"

    @app.route('/get-county-disease-data', methods=['POST'])
    def returnCountyDiseaseData():
        variables = request.get_json()
        region = slice(None) if variables['region-name'] == 'all' else variables['region-name'].split(',')
        disease = slice(None) if variables['disease'] == 'all' else variables['disease'].split(',')
        date = slice(None) if variables['date'] == 'all' else max(real_dict['county']['data'].index.levels[2]) if variables['date'] == 'max' else variables['date'].split(',')

        result =  getCountyDiseaseData(region, disease, date, variables['data-type'])

        return_data = result['data'].rename({variables['data-type']: 'count'}, axis=1)
        return_data_dict = json.loads(return_data.to_json(orient="table", index=True))['data']
        return_stats_dict = json.loads(result['stats'].to_json(orient="table", index=True))['data'] if isinstance(result['stats'], pd.DataFrame) else result['stats'].to_dict()
        return jsonify({'data': return_data_dict, 'stats': return_stats_dict, 'metadata': result['metadata']})

    @app.route('/get-county-disease-tooltip', methods=['POST'])
    def getCountyDiseaseTooltip():
        variables = request.get_json()

        date = max(real_dict['county']['data'].index.levels[2]) if variables['date'] == 'max' else variables['date'].split(',')[0]
        dates = pd.date_range(end=date, periods=8, freq='7D').strftime("%Y-%m-%d").to_list()

        result =  getCountyDiseaseData(variables['county'].split(','), slice(None), dates, variables['data-type'])

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
        region = slice(None) if variables['region-name'] == 'all' else variables['region-name'].split('-')
        disease = slice(None) if variables['disease'] == 'all' else variables['disease'].split('-') 
        date = max(real_dict['hospital-zcta']['data'].index.levels[2]) if variables['date'] == 'max' else variables['date'].split('-')
        
        result =  getZCTAHospitalData(region, disease, date)

        return jsonify({'data': json.loads(result['data'].to_json(orient="table", index=True))['data'], 'stats': result['stats'].to_dict(), 'metadata': result['metadata']})

    @app.route('/get-hospital-zcta-tooltip', methods=['POST'])
    def getHospitalZCTATooltip():
        variables = request.get_json()

        date = max(real_dict['hospital-zcta']['data'].index.levels[2]) if variables['date'] == 'max' else variables['date'].split(',')[0]
        dates = pd.date_range(end=date, periods=8, freq='7D').strftime("%Y-%m").to_list()

        result =  getZCTAHospitalData(variables['region-name'].split(','), slice(None), dates)

        return_data = result['data']['count']
        return_data.index = return_data.index.droplevel(0)
        return_data_dict = {}
        for disease in return_data.index.levels[0]:
            return_data_dict[disease] = return_data.xs(disease).to_dict()

        return_stats_dict = {'min': return_data.min(axis=None), 'max': return_data.max(axis=None)}

        return jsonify({'data': return_data_dict, 'stats': return_stats_dict, 'metadata': result['metadata']})


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
        for i in range(len(region)):
            region[i] = int(region[i])
    return_data = base_data.loc[(region, disease, date), ['count', 'INTPTLON', 'INTPTLAT']] 
    return_stats = base_stats.loc[date, :]
    returned_index = return_data.index.remove_unused_levels().set_names('date', level=2).set_names('region', level=0)
    return_data.index = returned_index
    metadata = {name: vals.to_list() for (name, vals) in zip(returned_index.names, returned_index.levels)}
    return {'data': return_data, 'stats': return_stats, 'metadata': metadata}

# data loading

def loadData():
    loadCountyData()
    loadZCTAData()

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
    # "C:/Users/***REMOVED***/Box/BoxPHI-PHMR Projects/Toolkit/Cleaned_Data/SC/Covid19/Case_Death_Counts.csv",
    "mainApp/static/data/covid_case_death_counts.csv",
    "mainApp/static/data/dummy_flu.csv",
    "mainApp/static/data/dummy_opioid.csv",
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
    "mainApp/static/data/covid_hospital_zcta.csv",
    "mainApp/static/data/flu_hospital_zcta.csv",
    ]

    for f_path in files:
        df = pd.read_csv(f_path)
        value_columns = df.columns.difference(index_names)
        temp_df = pd.pivot_table(df, values=value_columns, index=index_names)
        df_multi = pd.concat([df_multi, temp_df])

    df_multi['count'] /= df_multi['days']

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


    