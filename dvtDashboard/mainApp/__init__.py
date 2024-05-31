# This is where the main flask code should lie

from flask import Flask, jsonify, render_template
import os
import pandas as pd
import numpy as np
import pandas as pd
import glob

from .definitions import counties

county_dict = {}

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
    
    loadData()
    # print(county_dict)

    return app

def loadData():
    for county in counties:
        temp = {}
        daily_path = glob.glob("**/static/data/county/Counties daily cases/" + county +"_case_daily.csv", recursive=True)[0]
        real_path = glob.glob("**/static/data/county/Counties daily cases/" + county +"_case_daily.csv", recursive=True)[0]

        temp["daily"] = pd.read_csv(daily_path)
        temp["real"] = pd.read_csv(real_path)
        county_dict["county"] = temp
