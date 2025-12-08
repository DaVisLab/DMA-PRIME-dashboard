import pandas as pd
import json
import numpy as np
import glob
import os
import geojson
import math

from supporting_files.utility import *

dirs = os.listdir(f'{aggregated_data_dir}/other_diseases')

other_column = {
    'encounters': None,
    'inpatient_hospitalizations': None,
    'emergency_department_visits': None,
    'positive_tests': 'tests',
    'diagnoses': None,
}

region_file_identifiers = {'state': 'State', 'county': 'County', 'region': 'Region', 'zcta': 'ZCTA'}
region_geojson_identifiers = {'state': 'Region', 'county': 'NAME', 'region': 'Region', 'zcta': 'ZCTA'}

diseases = []


for directory in dirs:
    disease_display_name = directory.split(',')[0]
    disease = disease_display_name.split(',')[0]
    disease = disease.lower()
    disease = disease.split('(')[0]
    disease = disease.strip()
    disease = '-'.join(disease.split(' '))
    diseases.append({'display-name': disease_display_name, 'disease-name': disease})

with open(get_file_descriptor(f'{processed_data_dir}/other_infectious_diseases/metadata.json'), 'w') as f:
    json.dump(diseases, f)

for region_size, file_region_size in region_file_identifiers.items():
    print(region_size)

    for column in other_column.keys():

        with open(f'{scripts_supporting_files_dir}/sc_{region_size}_population_simplified.json', 'r') as f:
            state_central_point = geojson.Point((-81, 33.65))
            state_properties = {
                'identifier': 'state',
                'population': 0,
                'data': {},
                'other': {}
            }

            state_aggregation = geojson.Feature(geometry=state_central_point, properties=state_properties)

            gj = geojson.load(f)
            for feature in gj.features:
                try:
                    identifier = int(feature.properties[region_geojson_identifiers[region_size]])
                except ValueError:
                    identifier = feature.properties[region_geojson_identifiers[region_size]]
                    
                if region_size == 'state':
                    identifier = 'SC'

                feature.properties['identifier'] = identifier

                feature.properties['data'] = {} 
                feature.properties['other'] = {} 
                try:
                    pop = float(feature.properties['population'])
                    if not np.isnan(pop):
                        state_aggregation.properties['population'] += pop
                except ValueError:
                    pass

            for disease_dir in dirs:
                disease = disease_dir.split(',')[0]
                disease = disease.lower()
                disease = disease.split('(')[0]
                disease = disease.strip()
                disease = '-'.join(disease.split(' '))

                file = glob.glob(f'{aggregated_data_dir}/other_diseases/{disease_dir}/*{file_region_size}*.csv')[0]

                df = pd.read_csv(file).rename({file_region_size: region_size, 
                                            'Week': 'date', 
                                            'Weekly_Diagnoses': 'diagnoses', 
                                            'Weekly_Inpatient_Hospitalizations': 'inpatient_hospitalizations',
                                            'Weekly_ED_Visits': 'emergency_department_visits',
                                            'Weekly_Positive_Tests': 'positive_tests',
                                            'Weekly_Tests': 'tests',
                                            'Weekly_Encounters': 'encounters'}, axis=1)
                
                df['date'] = pd.to_datetime(df['date'])
                start_date = df['date'].min().strftime('%Y-%m-%d')
                end_date = df['date'].max().strftime('%Y-%m-%d')
                dates = pd.date_range(end=end_date, start=start_date, freq=f'W-{pd.to_datetime(start_date).day_name()[:3].upper()}')

                if other_column[column]:
                    df = pd.pivot_table(df, values=[column, other_column[column]], index=[region_size, 'date'])
                else:
                    df = pd.pivot_table(df, values=[column], index=[region_size, 'date'])
                    
                months = math.ceil(len(dates)/4)
                years = math.ceil(len(dates)/52)

                state_aggregation.properties['data'][disease] = {
                    'weekly': pd.Series(data=0, index=dates),
                    'monthly': pd.Series(data=[0] * months),
                    'yearly': pd.Series(data=[0] * years)
                }

                state_aggregation.properties['other'][disease] = {
                    'weekly': pd.Series(data=0, index=dates),
                    'monthly': pd.Series(data=[0] * months),
                    'yearly': pd.Series(data=[0] * years)
                }

                gj['metadata'] = {
                    'start_date': start_date,
                    'end_date': end_date}

                for feature in gj.features:
                    try:
                        identifier = int(feature.properties['identifier'])
                    except ValueError:
                        identifier = feature.properties['identifier']

                    try:
                        feature_disease_data = pd.Series(data=df.xs(identifier, axis=0)[column], index=dates).fillna(0)
                        feature.properties['data'][disease] = {
                            'weekly': feature_disease_data.to_numpy().tolist(),
                            'monthly': [],
                            'yearly': []
                        }
                        
                        # Pad, Reshape, and sum
                        reversed_data = feature_disease_data[::-1]
                        padding = (-len(reversed_data)) % 4
                        if padding:
                            reversed_data = pd.concat([reversed_data, pd.Series([np.nan] * padding)])
                        grouped = reversed_data.values.reshape(-1, 4)
                        sums = np.nansum(grouped, axis=1)
                        
                        # Convert to Series and reverse, save
                        result = pd.Series(sums[::-1])
                        feature.properties['data'][disease]['monthly'] = result.to_numpy().tolist()
                        
                        # Pad, Reshape, and sum
                        reversed_data = feature_disease_data[::-1]
                        padding = (-len(reversed_data)) % 52
                        if padding:
                            reversed_data = pd.concat([reversed_data, pd.Series([np.nan] * padding)])
                        grouped = reversed_data.values.reshape(-1, 52)
                        sums = np.nansum(grouped, axis=1)
                        
                        # Convert to Series and reverse, save
                        result = pd.Series(sums[::-1])
                        feature.properties['data'][disease]['yearly'] = result.to_numpy().tolist()
                        
                        state_aggregation.properties['data'][disease]['weekly'] += feature_disease_data
                        state_aggregation.properties['data'][disease]['monthly'] += feature.properties['data'][disease]['monthly']
                        state_aggregation.properties['data'][disease]['yearly'] += feature.properties['data'][disease]['yearly']
                        
                    # if data doesn't exist then add data source with empty array
                    except (IndexError, KeyError):
                        feature.properties['data'][disease] = {
                            'weekly': [],
                            'monthly': [],
                            'yearly': []
                        }

                    try:
                        feature_disease_other = pd.Series(data=df.xs(identifier, axis=0)[other_column[column]], index=dates).fillna(0)
                        feature.properties['other'][disease] = {
                            'weekly': feature_disease_other.to_numpy().tolist(),
                            'monthly': [feature_disease_other[-4:].sum().item()],
                            'yearly': [feature_disease_other[-52:].sum().item()],
                        }
                        
                        # Pad, Reshape, and sum
                        reversed_data = feature_disease_other[::-1]
                        padding = (-len(reversed_data)) % 4
                        if padding:
                            reversed_data = pd.concat([reversed_data, pd.Series([np.nan] * padding)])
                        grouped = reversed_data.values.reshape(-1, 4)
                        sums = np.nansum(grouped, axis=1)
                        
                        # Convert to Series and reverse, save
                        result = pd.Series(sums[::-1])
                        feature.properties['other'][disease]['monthly'] = result.to_numpy().tolist()
                        
                        # Pad, Reshape, and sum
                        reversed_data = feature_disease_other[::-1]
                        padding = (-len(reversed_data)) % 52
                        if padding:
                            reversed_data = pd.concat([reversed_data, pd.Series([np.nan] * padding)])
                        grouped = reversed_data.values.reshape(-1, 52)
                        sums = np.nansum(grouped, axis=1)
                        
                        # Convert to Series and reverse, save
                        result = pd.Series(sums[::-1])
                        feature.properties['other'][disease]['yearly'] = result.to_numpy().tolist()
                        
                        state_aggregation.properties['other'][disease]['weekly'] += feature_disease_other
                        state_aggregation.properties['other'][disease]['monthly'] += feature.properties['other'][disease]['monthly']
                        state_aggregation.properties['other'][disease]['yearly'] += feature.properties['other'][disease]['yearly']
                        
                    # if data doesn't exist then add data source with empty array
                    except (IndexError, KeyError):
                        feature.properties['other'][disease] = {
                            'weekly': [],
                            'monthly': [],
                            'yearly': []
                        }

                state_aggregation.properties['data'][disease]['weekly'] = state_aggregation['properties']['data'][disease]['weekly'].fillna(0).to_numpy().tolist()
                state_aggregation.properties['other'][disease]['weekly'] = state_aggregation['properties']['other'][disease]['weekly'].fillna(0).to_numpy().tolist()
                state_aggregation.properties['data'][disease]['monthly'] = state_aggregation['properties']['data'][disease]['monthly'].fillna(0).to_numpy().tolist()
                state_aggregation.properties['other'][disease]['monthly'] = state_aggregation['properties']['other'][disease]['monthly'].fillna(0).to_numpy().tolist()
                state_aggregation.properties['data'][disease]['yearly'] = state_aggregation['properties']['data'][disease]['yearly'].fillna(0).to_numpy().tolist()
                state_aggregation.properties['other'][disease]['yearly'] = state_aggregation['properties']['other'][disease]['yearly'].fillna(0).to_numpy().tolist()

            gj.features.append(state_aggregation)
            
            out_path = f'{processed_data_dir}/other_infectious_diseases/{region_size}/{column}_data.json'

            with open(get_file_descriptor(out_path), 'w') as f:
                json.dump(gj, f)

