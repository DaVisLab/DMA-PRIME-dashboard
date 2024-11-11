
import pandas as pd
import numpy as np
import json

from .utility import * 

from flask import Blueprint, url_for, send_file

bp = Blueprint('data', __name__, url_prefix='/data')

from .auth import login_required

    
@bp.route('/map/<type>', methods=['GET', 'POST'])
@login_required
def mapData(type):
    # map geojson files
    return send_file(f'{main_dir}/static/data/tl_2023_sc_{type}_trimmed_simplified_ogr2ogr_.001.json')

@bp.route('/icon/<type>', methods=['GET', 'POST'])
@login_required
def iconData(type):
    # icon csv files
    return send_file(f'{main_dir}/static/data/{type}.csv')

@bp.route('/hospitalizations/<disease>', methods=['GET', 'POST'])
@login_required
def getHospitalizations(disease='covid-19'):
    # hospitalization data based on disease
    return send_file(f'{main_dir}/static/data/{disease}_zcta_hospitalization_data.json')

def load_data():
    load_zcta_hospitalization()
    pass

def load_zcta_hospitalization():
    index_names = ['zcta', 'date']

    label_dict = {
            'health-system-data': 'Health System hospitalizations', 
            'state-training': 'Projected Cases(train)', 
            'state-testing': 'Projected Cases(post training)',
            'state-data': 'Statewide hospitalizations',
            }

    dataframes = {}
    max_date = pd.to_datetime(0)

    # load data files, combine and mark imputed if necessary
    # find max date across all diseases
    for disease, file in files.items():
        
        # grid view
        df = pd.DataFrame()
        if isinstance(file, list):
            for f in file:
                temp = pd.read_csv(f['file'])
                temp['imputation'] = f['imputation']
                df = pd.concat([df, temp])
        else:
            df = pd.read_csv(file)
            df['imputation'] = False

        df.rename({'Zip code': 'zcta', 'Date': 'date'}, axis=1, inplace=True)
        df['date'] = pd.to_datetime(df['date']) + pd.Timedelta(days=7)
        max_date = max(max_date, df['date'].max())

        df['Health System hospitalizations'] = df['Health System hospitalizations'] #.fillna(value=0)
        value_columns = df.columns.difference(index_names)
        dataframes[disease] = pd.pivot_table(df, values=value_columns, index=index_names)

    # find display date and date arrays for historical and prediction data
    date = max_date - pd.DateOffset(weeks=5)

    start_date = date - pd.DateOffset(months=18)
    historical_dates = pd.date_range(end=date, start=start_date, freq='W-SAT')
    historical_dates = historical_dates.to_list()

    end_date = max_date
    pred_dates = pd.date_range(start=date, end=end_date, freq='W-SAT', inclusive='both')
    pred_dates = pred_dates.to_list()

    # get zcta data
    zcta_data = pd.read_csv(main_dir+'/static/data/zcta_summary.csv', index_col=0)
    zctas = zcta_data['zcta'].unique()

    shaped_data = {}

    # reshape data
    for disease, df in dataframes.items():
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
                # if data doesn't exist then add data source with empty array
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
                data = df.xs(zcta, axis=0)['Projected Cases(post training)'].reindex(pred_dates).dropna()
                zcta_dict['state-prediction'] = {
                        'start-date': data.index[0].strftime("%Y-%m-%d"),
                        'data': data.to_list(),
                    }
            except KeyError:
                zcta_dict['state-prediction'] = {
                    'start-date': date.strftime("%Y-%m-%d"),
                    'data': [],
                } 
                
            try:
                zcta_dict['imputation'] = int(df.xs(zcta, axis=0)['imputation'].any())
            except KeyError:
                zcta_dict['imputation'] = 0

            # makes state testing and training look pretty and connect when plotted
            if len(zcta_dict['state-testing']['data']) > 0:
                zcta_dict['state-training']['data'].append(zcta_dict['state-testing']['data'][0])
            
            zcta_list.append(zcta_dict)
        
        shaped_data[disease] = zcta_list

    # add date information and save to respective files
    for disease, zcta_list in shaped_data.items():
        data = {
            'metadata': {
                'start_date': start_date.strftime("%Y-%m-%d"),
                'current_monday': date.strftime("%Y-%m-%d"),
                'end_date': end_date.strftime("%Y-%m-%d")},
            'data': zcta_list
        }

        with open( main_dir+'/static/data/'+disease+'_zcta_hospitalization_data.json', 'w') as f:
            json.dump(data, f)