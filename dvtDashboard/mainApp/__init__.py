# This is where the main flask code should lie

from flask import Flask, jsonify, render_template, request
import os
import pandas as pd
import numpy as np
import pandas as pd
import glob

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
        print(variables)
        base_data = real_dict[variables['region-size']]['data']
        base_stats = real_dict[variables['region-size']]['stats']
        # cases 7-day averange,deaths 7-day averange
        region = slice(None) if variables['region-name'] == 'all' else variables['region-name'] 
        disease = slice(None) if variables['disease'] == 'all' else variables['disease'] 
        date = max(base_data.index.levels[2]) if variables['date'] == 'max' else variables['date']
        return_data = base_data.loc[(region, disease, date), variables['data-type']].to_json()
        return_stats = base_stats.loc[(date, variables['data-type'])].to_json()
        print({'data': return_data, 'stats': return_stats})
        return jsonify({'data': return_data, 'stats': return_stats})
    
    loadData()

    return app

def loadData():
    # county
    index = ['county', 'disease', 'date']

    df = pd.read_csv("C:/Users/***REMOVED***/Box/BoxPHI-PHMR Projects/Toolkit/Cleaned_Data/SC/Covid19/Case_Death_Counts.csv")
    df['disease'] = 'covid-19'
    value_columns = df.columns.difference(index)
    df_multi = pd.pivot_table(df, values=value_columns, index=index)

    # county stats
    columns=['min', 'q20', 'q25', 'q40', 'q50', 'q60', 'q75', 'q80', 'max']
    quantiles = [0, .2, .25, .4, .5, .6, .75, .8, 1]
    dates = df_multi.index.levels[2]
    data_type = df_multi.columns

    stats_index = pd.MultiIndex.from_product([dates, data_type], names=['date', 'data_type'])
    stats_df = pd.DataFrame(columns=columns, index=stats_index)
    stats_df.sort_index(inplace=True)
    for idx in stats_index:
        stats_df.loc[idx] = np.nanquantile(df_multi.loc[(slice(None), slice(None), idx[0]), idx[1]], quantiles)

    # saving to dict
    real_dict['county']['data'] = df_multi
    real_dict['county']['stats'] = stats_df

def getQuantiles(num_quantiles, data):
    quantiles = []
    for q in range(num_quantiles+1):
        quantiles.append(np.quantile(data, q/num_quantiles))
    return quantiles