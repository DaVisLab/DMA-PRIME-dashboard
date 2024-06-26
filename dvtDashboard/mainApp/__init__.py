# This is where the main flask code should lie

from flask import Flask, jsonify, render_template, request
import os
import pandas as pd
import numpy as np
import pandas as pd
import glob
import json

from .definitions import counties

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

    @app.route('/get-real-disease-data', methods=['POST'])
    def getRealDiseaseData():
        variables = request.get_json()
        base_data = real_dict[variables['region-size']]['data']
        base_stats = real_dict[variables['region-size']]['stats']
        # cases 7-day average,deaths 7-day average
        region = slice(None) if variables['region-name'] == 'all' else variables['region-name'] 
        disease = slice(None) if variables['disease'] == 'all' else variables['disease'] 
        date = max(base_data.index.levels[2]) if variables['date'] == 'max' else variables['date']
        return_data = base_data.rename({variables['data-type']: 'count'}, axis=1).loc[(region, disease, date), ('count', 'INTPTLON', 'INTPTLAT')] 
        return_stats = base_stats.loc[(date, variables['data-type'])]
        returned_index = return_data.index.remove_unused_levels().set_names('region', level=0)
        return_data.index = returned_index
        metadata = {name: vals.to_list() for (name, vals) in zip(returned_index.names, returned_index.levels)}
        print(return_data)
        return jsonify({'data': json.loads(return_data.to_json(orient="table", index=True))['data'], 'stats': return_stats.to_json(), 'metadata': json.dumps(metadata)})
    
    @app.route('/get-hospital-zcta-data', methods=['POST'])
    def getZCTAHospitalData():
        variables = request.get_json()
        base_data = real_dict['hospital-zcta']['data']
        base_stats = real_dict['hospital-zcta']['stats']
        # cases 7-day average,deaths 7-day average
        region = slice(None) if variables['region-name'] == 'all' else variables['region-name'] 
        disease = slice(None) if variables['disease'] == 'all' else variables['disease'] 
        date = max(base_data.index.levels[2]) if variables['date'] == 'max' else variables['date']
        return_data = base_data.loc[(region, disease, date), ('count', 'INTPTLON', 'INTPTLAT')]
        return_stats = base_stats.loc[date]
        returned_index = return_data.index.remove_unused_levels().set_names('date', level=2).set_names('region', level=0)
        return_data.index = returned_index
        metadata = {name: vals.to_list() for (name, vals) in zip(returned_index.names, returned_index.levels)}
        return jsonify({'data': json.loads(return_data.to_json(orient="table", index=True))['data'], 'stats': return_stats.to_json(), 'metadata': json.dumps(metadata)})


    loadData()

    return app

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

    # county stats
    columns=['min', 'q20', 'q25', 'q40', 'q50', 'q60', 'q75', 'q80', 'max']
    quantiles = [0, .2, .25, .4, .5, .6, .75, .8, 1]
    dates = df_multi.index.levels[2]
    data_type = ['cases 7-day average', 'deaths 7-day average']

    stats_index = pd.MultiIndex.from_product([dates, data_type], names=['date', 'data_type'])
    stats_df = pd.DataFrame(columns=columns, index=stats_index)
    stats_df.sort_index(inplace=True)
    for idx in stats_index:
        stats_df.loc[idx] = np.nanquantile(df_multi.loc[(slice(None), slice(None), idx[0]), idx[1]], quantiles)

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
        stats_df.loc[idx] = np.nanquantile(df_multi.loc[(slice(None), slice(None), idx), 'count'], quantiles)

    # saving to dict
    real_dict['hospital-zcta']['data'] = df_multi
    real_dict['hospital-zcta']['stats'] = stats_df