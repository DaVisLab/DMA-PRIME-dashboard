import pandas as pd
import json
import geojson
import math
import os
import glob
from collections import OrderedDict

from supporting_files.utility import *

# Guide to this file (assume it's slightly outdated)
# 1) Define variables for names of things/columns of incoming data etc
# 2) Get all forecast files and prepare df
    # a) find all forecast csvs (do not include state cdc)
    # b) read and smoosh into df
    # c) find first, current, last dates
    # d) create historical, all historical, and forecast dates
    # e) pivot df
# 3) Add data to each geojson file
# 4) Process state cdc file
# 5) Write to metadata

######## 1 ########

# outcome variables = Variable: Display Name
outcome_variables = {
    'encounters_all': 'All Encounters',
    'Weekly_Encounters': 'All Encounters',
    'Weekly_Inpatient_Hospitalizations': 'Inpatient Hospitalizations',
    'Weekly_ED_Visits': 'Emergency Department Visits',
    'Weekly_Positive_Tests': 'Positive Tests',
    'rt': 'Rate of Transmission',
}

outcome_variables_code_friendly = {k:'_'.join(v.lower().split()) for k, v in list(OrderedDict.fromkeys(outcome_variables.items()))}

# data sources
data_sources = {
    'HS': 'health_system',
    'RFA': 'RFA',
}

# estimate_projected_report crosswalk
e_p_r_crosswalk = {0: 'estimated', 1: 'projected', 2: 'reported'}

# outcome variable crosswalk
o_v_crosswalk = {
    1: 'rt', 
    2: 'Weekly_Encounters', 
    3: 'Weekly_Inpatient_Hospitalizations', 
    4: 'Weekly_ED_Visits',
    5: 'Weekly_Outpatient',
    6: 'Weekly_Positive_Tests', 
}

# populations
populations = ['general_population', 'health_system']

# population to data source
ds_to_pop = {
    'general_population': 'RFA',
    'health_system': 'HS'
}

# diseases
diseases = {
    'covid_19': 'COVID-19',
    'influenza': 'Influenza (Flu)',
    'RSV': 'Respiratory Syncytial Virus (RSV)',
    'respiratory_diseases': 'Respiratory Diseases (COVID-19, Flu, RSV)'
}

# Name of location key in each geojson file
region_geojson_identifiers = { # identifier key for geographic unit within the geojson file
    'state': 'Region', # state in csv will be SC, will be state in geojson 
    'region': 'Region', # region in csv will match exactly region in geojson
    'county': 'NAME', # county in csv will match exactly county in geojson
    'zcta': 'ZCTA' # zcta in csv will match exactly zcta in geojson
}

date_format = "%Y-%m-%d"

# for df pivot
index_columns = ['population', 'location', 'disease', 'estimate_projected_report', 'data_source', 'outcome_measure', 'target_end_date']
value_columns = ['value', 'imputed']

# useful to have in one place, to be saved to a file at the end
metadata = {
    'diseases': diseases,

    'region_sizes': {
        'state': 'State',
        'region': 'Region',
        'county': 'County',
        'zcta': 'Zip-Code Tabulation Area (ZCTA)',
        'facility': 'Facility',
    },

    'populations': {
        'general_population': 'General Population',
        'health_system': 'Health System (Prisma/MUSC)'
    },
    'populations_tooltips': {
        'general_population': 'All South Carolina residents in the selected geography',
        'health_system': 'South Carolina residents in the selected geography served by the Prisma or MUSC health system'
    },

    'outcome_variables': {outcome_variables_code_friendly[k]:v for k, v in outcome_variables.items()},
    'outcome_variables_tooltips': {outcome_variables_code_friendly[k]:v[0]+v[1:].lower() for k, v in outcome_variables.items()},

    'available_models': {
        'covid_19': {
            'region': {
                'general_population': ['all_encounters'],
                'health_system': ['positive_tests', 'rate_of_transmission'] },
            'county': {
                'general_population': ['all_encounters'],
                'health_system': ['positive_tests', 'rate_of_transmission'] },
            'zcta': {
                'general_population': ['all_encounters'],
                'health_system': ['positive_tests', 'rate_of_transmission'] },
            'facility': {
                'health_system': ['positive_tests', 'rate_of_transmission'] },
        },
        'influenza': {
            'region': {
                'general_population': ['all_encounters'],
                'health_system': ['positive_tests', 'rate_of_transmission'] },
            'county': {
                'general_population': ['all_encounters'],
                'health_system': ['positive_tests', 'rate_of_transmission'] },
            'zcta': {
                'general_population': ['all_encounters'],
                'health_system': ['positive_tests', 'rate_of_transmission'] },
            'facility': {
                'health_system': ['positive_tests', 'rate_of_transmission'] },
        },
        'RSV': {
            'region': {
                'general_population': ['all_encounters'] },

        },
        'respiratory_diseases': {
            'region': {
                'general_population': ['all_encounters'] },
            'county': {
                'general_population': ['all_encounters'] },
            'zcta': {
                'general_population': ['all_encounters'] },
        },

    }


    # need list of state, regions, counties, zctas
    # need current, first, start_short_historical, and last dates
    # need array of all historical dates, short list of historical dates, and prediction dates 

}

######## 2 ########
print("Creating Dataframes")

df = pd.DataFrame()
#### a ####
# get forecast files
forecast_files = glob.glob(f'{aggregated_data_dir}/respiratory/**/*.csv', recursive=True)

#### b ####
for file in forecast_files: # read and smoosh
    temp = pd.read_csv(file)
    if 'Week.Ending.Date' in temp.columns:
        continue
    df = pd.concat([df, temp])

df['estimate_projected_report'] = df['estimate_projected_report'].map(e_p_r_crosswalk)
df['outcome_measure'] = df['outcome_measure'].replace(o_v_crosswalk)
df = df.replace(outcome_variables_code_friendly)

df = df.fillna({'data_source': 'N/A'})

#### c ####

# fix dates
df['reference_date'] = pd.to_datetime(df['reference_date'], format='mixed')
df['target_end_date'] = pd.to_datetime(df['target_end_date'], format='mixed')

# find current, start, and end date
current_date = df['reference_date'].max()
first_date = df['target_end_date'].min()
last_date = df['target_end_date'].max()

#### d ####

# tooltip only uses 18 months of historical data
start_short_history = current_date - pd.DateOffset(weeks=78) # roughly 18 months

# create historical, full historical, and prediction dates
day_of_week = pd.to_datetime(current_date).day_name()
all_historical_dates = pd.date_range(end=current_date, start=first_date, freq=f'W-{day_of_week[:3].upper()}', inclusive='left').to_series()
short_history_dates = pd.date_range(end=current_date, start=start_short_history, freq=f'W-{day_of_week[:3].upper()}', inclusive='left').to_series()
pred_dates = pd.date_range(start=current_date, end=last_date, freq=f'W-{day_of_week[:3].upper()}', inclusive='both').to_series()

#### e ####
# pivot df so we can use index
pivoted_df = pd.pivot_table(df, values=value_columns, index=index_columns)

######## 3 ########
print("Creating GeoJSONs")

def pandas_to_json_safe_list(series):
    return [None if math.isnan(x) else x for x in series.to_list()]

def process_disease_location(data, disease_data, disease_data_all):
    for population in populations: # for general and hs
        for outcome_variable in outcome_variables_code_friendly.values(): # for each encounter/inpatient/pos test/rt
            data_by_value_type = {}
            for value_type in e_p_r_crosswalk.values():
                try:
                    data_by_value_type[value_type] = data.xs((population, outcome_variable, value_type), axis=0, level=['population', 'outcome_measure', 'estimate_projected_report'], drop_level=True)
                except:
                    data_by_value_type[value_type] = None
            
            if data_by_value_type['estimated'] is None or data_by_value_type['estimated']['value'].isna().all():
                # no estimated, then reported -> historical
                
                if data_by_value_type['reported'] is not None:
                    try:
                        temp_data_values = data_by_value_type['reported']['value'].xs(ds_to_pop[population], axis=0, drop_level=True)
                    except KeyError:
                        temp_data_values = pd.Series()
                        
                    # short history
                    disease_data[population][outcome_variable]['historical']['values'] = pandas_to_json_safe_list(temp_data_values.reindex(short_history_dates))
                    disease_data[population][outcome_variable]['historical']['reported'] = True

                    # all history
                    disease_data_all[population][outcome_variable]['historical']['values'] = pandas_to_json_safe_list(temp_data_values.reindex(all_historical_dates))
                    disease_data_all[population][outcome_variable]['historical']['reported'] = True

            else:
                # yes estimated -> historical
                temp_data_values = data_by_value_type['estimated']['value'].droplevel('data_source')
                temp_data_imputations = data_by_value_type['estimated']['imputed'].droplevel('data_source')

                # short history
                disease_data[population][outcome_variable]['historical']['values'] = pandas_to_json_safe_list(temp_data_values.reindex(short_history_dates, level='target_end_date'))
                disease_data[population][outcome_variable]['historical']['imputed'] = bool(temp_data_imputations.reindex(short_history_dates, level='target_end_date').any())

                # all history
                disease_data_all[population][outcome_variable]['historical']['values'] = pandas_to_json_safe_list(temp_data_values.reindex(all_historical_dates, level='target_end_date'))
                disease_data_all[population][outcome_variable]['historical']['imputed'] = bool(temp_data_imputations.reindex(all_historical_dates, level='target_end_date').any())
                
                if outcome_variable in ['all_encounters', 'inpatient_hospitalizations', 'emergency_department_visits']:
                    # yes estimated, then HS/RFA is extra (button names come from data source)
                    for data_source, data_source_code_friendly in data_sources.items():
                        try:
                            extra_data = data_by_value_type['reported']['value'].xs(data_source, axis=0, level='data_source')
                            if extra_data.reindex(short_history_dates, level='target_end_date').notna().any():
                                # short history
                                disease_data[population][outcome_variable]['extra'][data_source_code_friendly] = pandas_to_json_safe_list(extra_data.reindex(short_history_dates, level='target_end_date'))
                            
                            if extra_data.reindex(all_historical_dates, level='target_end_date').notna().any():
                                # all history
                                disease_data_all[population][outcome_variable]['extra'][data_source_code_friendly] = pandas_to_json_safe_list(extra_data.reindex(all_historical_dates, level='target_end_date'))
                        except:
                            # couldn't find extra data
                            pass
                        
            # projected
            if data_by_value_type['projected'] is not None and data_by_value_type['projected']['value'].notna().any():
                disease_data[population][outcome_variable]['projected']['imputed'] = bool(data_by_value_type['projected']['imputed'].any())
                disease_data[population][outcome_variable]['projected']['start_date'] = data_by_value_type['projected']['value'].index.get_level_values('target_end_date').min().strftime('%Y-%m-%d')
                disease_data[population][outcome_variable]['projected']['values'] = pandas_to_json_safe_list(data_by_value_type['projected']['value'])

                disease_data_all[population][outcome_variable]['projected']['imputed'] = bool(data_by_value_type['projected']['imputed'].any())
                disease_data_all[population][outcome_variable]['projected']['start_date'] = data_by_value_type['projected']['value'].index.get_level_values('target_end_date').min().strftime('%Y-%m-%d')
                disease_data_all[population][outcome_variable]['projected']['values'] = pandas_to_json_safe_list(data_by_value_type['projected']['value'])

def get_facility_data(facility, extended_historical_data):
    
    identifier = facility['name']
    point_coords = geojson.Point((facility['long'], facility['lat']))
    properties = {
        'id': identifier,
        'system': facility['system'],
        'facility_type': facility['facility_type'],
        'display_name': facility['display_name'],
        'data': None,
    }
    
    disease_data = {
        population: {var: {'historical': {'imputed': 0, 'reported': 0, 'values': []}, 
                           'projected': {'imputed': 0, 'start_date': current_date.strftime('%Y-%m-%d'), 'values': []}, 
                           'extra': {}
                           } for var in outcome_variables_code_friendly.values()}
        for population in populations
    }
    
    disease_data_all = {
        population: {var: {'historical': {'imputed': 0, 'reported': 0, 'values': []}, 
                           'projected': {'imputed': 0, 'start_date': current_date.strftime('%Y-%m-%d'), 'values': []}, 
                           'extra': {}
                           } for var in outcome_variables_code_friendly.values()}
        for population in populations
    }
    
    data = None
    
    try:
        data = pivoted_df.xs((identifier, disease), axis=0, level=['location', 'disease'], drop_level=True)
    except:
        pass
    
    process_disease_location(data, disease_data, disease_data_all)
    
    # add disease data to this feature
    properties['data'] = disease_data
    extended_historical_data[identifier] = disease_data_all
    
    feature = geojson.Feature(geometry=point_coords, properties=properties)    
    return feature

# feature.properties.data
    # general
        # encounters
            # historical
            # projected
            # other
        # inpatient hospitalizations
        # positive tests
        # rt
    # health-system
        # encounters
        # inpatient hospitalizations
        # positive tests
        # rt

facility_info = pd.read_csv(f'{scripts_supporting_files_dir}/Cross-WALK-LOCATIONS-temp.csv')
extended_historical_data = {}

print('facility')
for disease in diseases.keys():
    all_disease_data = geojson.FeatureCollection(facility_info.apply(get_facility_data, args=[extended_historical_data], axis=1).to_list())
    # create dirs if needed and save off file
    out_path = f'{processed_data_dir}/respiratory/facility/{disease}.json'
    with open(get_file_descriptor(out_path), 'w') as f:
        geojson.dump(all_disease_data, f)

    out_path = f'{processed_data_dir}/respiratory/facility/{disease}.extended.json'
    with open(get_file_descriptor(out_path), 'w') as f:
        json.dump(extended_historical_data, f)

for region_size, identifier_column in region_geojson_identifiers.items():
    # for each region size (location_general)
    print(region_size)

    metadata[region_size] = []

    with open(f'{scripts_supporting_files_dir}/sc_{region_size}_population_simplified.json', 'r') as f:
        gj = geojson.load(f)

        # add universal id key
        for feature in gj.features:
            try:
                identifier = int(feature.properties[identifier_column])
            except ValueError:
                identifier = feature.properties[identifier_column]

            feature.properties['id'] = identifier
            metadata[region_size].append(identifier)

        if region_size == 'state': # fixing for state or won't be able to grab data from df
            gj.features[0].properties['id'] = 'SC'

        # one geojson file per disease/location_general combo
        for disease in diseases.keys():
            extended_historical_data = {}

            for feature in gj.features:
                identifier = feature.properties['id']

                disease_data = {
                    population: {var: {'historical': {'imputed': 0, 'reported': 0, 'values': []}, 
                                       'projected': {'imputed': 0, 'start_date': current_date.strftime('%Y-%m-%d'), 'values': []}, 
                                       'extra': {}
                                       } for var in outcome_variables_code_friendly.values()}
                    for population in populations
                }

                disease_data_all = {
                    population: {var: {'historical': {'imputed': 0, 'reported': 0, 'values': []}, 
                                       'projected': {'imputed': 0, 'start_date': current_date.strftime('%Y-%m-%d'), 'values': []}, 
                                       'extra': {}
                                       } for var in outcome_variables_code_friendly.values()}
                    for population in populations
                }

                data = None

                # grab data for this region
                try:
                    data = pivoted_df.xs((identifier, disease), axis=0, level=['location', 'disease'], drop_level=True)
                except:
                    pass

                process_disease_location(data, disease_data, disease_data_all)

                # add disease data to this feature
                feature.properties['data'] = disease_data
                extended_historical_data[identifier] = disease_data_all

            # create dirs if needed and save off file
            out_path = f'{processed_data_dir}/respiratory/{region_size}/{disease}.json'
            with open(get_file_descriptor(out_path), 'w') as f:
                geojson.dump(gj, f)

            out_path = f'{processed_data_dir}/respiratory/{region_size}/{disease}.extended.json'
            with open(get_file_descriptor(out_path), 'w') as f:
                json.dump(extended_historical_data, f)
            
######## 4 ########
print("State CDC Hospitalizations")

# read in cdc hosp data and reformat
csvs = glob.glob(f'{aggregated_data_dir}/respiratory/state/CDC_hospitalization/*.csv')
state_csv = max(csvs, key=os.path.getctime)
if len(csvs) > 0:
    state_cdc = pd.read_csv(state_csv)
    state_cdc['Week.Ending.Date'] = pd.to_datetime(state_cdc['Week.Ending.Date'], format=date_format)
    
    state_cdc = state_cdc[(start_short_history <= state_cdc['Week.Ending.Date']) & (state_cdc['Week.Ending.Date'] <= current_date)]
    state_cdc.index = state_cdc['Week.Ending.Date']
    
    # create df that will hold the data
    df = pd.DataFrame(columns=['Date'])
    df['Date'] = state_cdc['Week.Ending.Date']
    df.index = df['Date']
    for disease in diseases.keys():
        # add cdc data to df
        column = list(filter(lambda x: f'total.{".".join(disease.lower().split("_"))}.admissions' == x.lower(), state_cdc.columns))
        if len(column) == 1:
            df[disease] = state_cdc[column[0]]
    
    # save df to json file
    df = df.drop('Date', axis=1)
    df.index = df.index.strftime(date_format)
else:
    df = pd.DataFrame()

out_path = f'{processed_data_dir}/respiratory/state/state-cdc.json'
os.makedirs(os.path.dirname(out_path), exist_ok=True)
df.to_json(out_path, orient='columns')

######## 5 ########
with open(get_file_descriptor(f'{processed_data_dir}/respiratory/metadata.json'), 'w') as f:

    metadata['outcome_variables_tooltips']['all_encounters'] = 'Inpatient and outpatient hospitalizations and emergency department visits'
    metadata['outcome_variables_tooltips']['rate_of_transmission'] = 'Average effective reproductive number'

    metadata['current_date'] = current_date.strftime('%Y-%m-%d')
    metadata['first_date'] = first_date.strftime('%Y-%m-%d')
    metadata['all_historical_dates'] = all_historical_dates.dt.strftime('%Y-%m-%d').to_list()
    metadata['start_short_history'] = start_short_history.strftime('%Y-%m-%d')
    metadata['short_history_dates'] = short_history_dates.dt.strftime('%Y-%m-%d').to_list()
    metadata['last_date'] = last_date.strftime('%Y-%m-%d')
    metadata['prediction_dates'] = pred_dates.dt.strftime('%Y-%m-%d').to_list()

    json.dump(metadata, f)
