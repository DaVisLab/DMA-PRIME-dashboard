import pandas as pd
import json
import geojson
import math
import os
import glob

from supporting_files.utility import *

# find all diseases
# find current and max date
 
# for every region
    # for every disease
        # read in csvs into one df
        # replace column headers
        # do state data
        # do health system data

# process state-cdc separately

date_format = "%Y-%m-%d"

region_geojson_identifiers = { # identifier key for geographic unit within the geojson file
    'state': 'Region',
    'region': 'Region', 
    'county': 'NAME', 
    'zcta': 'ZCTA'
}

state_label_dict = {
    # jiande/tanvir
    'Statewide hospitalizations': 'state-encounters-reported',
    'Projected Cases(train)': 'state-encounters-training', # model
    'Projected Cases(post training)': 'state-encounters-testing', #model
}

health_system_label_dict = {
    # jiande/tanvir
    'Health System hospitalizations': 'health-system-encounters', 

    # Md Sakhawat
    'Health System Positive Tests (reported)': 'health-system-positive-tests-reported', # reported
    'Health System Positive Tests (projected)': 'health-system-positive-tests-projected', # model
    'Effective Reproductive Number (estimated)': 'health-system-rt-estimated', # model
    'Effective Reproductive Number (projected)': 'health-system-rt-projected', # model
}

index_names = ['Region', 'date']
data_variables = ['encounters', 'positive-tests', 'rt']

diseases = {}
dataframes = {}
min_date = pd.Timestamp.today().normalize()
max_date = pd.to_datetime(0)
curr_date = pd.to_datetime(0)

for region_size in region_geojson_identifiers.keys():
    def fix_disease_dir(directory):
        disease = directory.split(',')[0]
        disease = disease.lower()
        disease = disease.split('(')[0]
        disease = disease.strip()
        disease = '-'.join(disease.split(' '))
        return disease
    diseases.update({fix_disease_dir(directory.name):directory.name for directory in filter(lambda entry: entry.is_dir() and not 'CDC' in entry.name, os.scandir(f'{aggregated_data_dir}/respiratory/'+region_size))})


print("Creating Dataframes")
for region_size, identifier_column in region_geojson_identifiers.items():
    print(region_size)
    dataframes[region_size] = {}
    files = {}

    for disease, dir_name in diseases.items():
        disease_files = glob.glob(f'{aggregated_data_dir}/respiratory/{region_size}/{dir_name}/*.csv')
        df = pd.DataFrame()
        # read in all dfs and rename columns 
        def add_df(path, df):
            path_lower = path.lower()
            temp = pd.read_csv(path, date_format=date_format, parse_dates=['Date'])
            temp['imputation'] = 'imputation' in path_lower or 'impute' in path_lower
            temp.rename({'Date': 'date'}, axis=1, inplace=True, errors='raise')
            temp.rename({**state_label_dict, **health_system_label_dict}, axis=1, inplace=True, errors='ignore')
            # change date to rep end of week instead of start
            temp['date'] = pd.to_datetime(temp['date'], format=date_format) + pd.DateOffset(days=6)
            df = pd.concat([df, temp])
            return df

        if isinstance(disease_files, str):
            df = add_df(disease_files, df)
        else:
            for disease_file in disease_files:
                try:
                    df = add_df(disease_file, df)
                except ValueError as e:
                    print(f'{disease_file} has incorrect date format')
                
        if df.empty:
            continue

        ##### These will be shown on the map ###

        # combining state encounter training/post training into one column
        if 'state-encounters-training' in df.columns and 'state-encounters-testing' in df.columns:
            df['state-encounters'] = df[['state-encounters-training','state-encounters-testing']].sum(axis=1,min_count=1)
        # combining health system positive tests reported/projected into one column
        if 'health-system-positive-tests-reported' in df.columns and 'health-system-positive-tests-projected' in df.columns:
            df['health-system-positive-tests'] = df[['health-system-positive-tests-reported','health-system-positive-tests-projected']].sum(axis=1,min_count=1)
        # combining health system reproductive number reported/projected into one column
        if 'health-system-rt-estimated' in df.columns and 'health-system-rt-projected' in df.columns:
            df['health-system-rt'] = df[['health-system-rt-estimated','health-system-rt-projected']].sum(axis=1,min_count=1)


        ########################################

        # update max and current dates
        min_date = min(min_date, df['date'].min())
        max_date = max(max_date, df['date'].max())
        if 'health-system-encounters' in df.columns:
            # health-system encounters end where projections start, so the last health-system entry is the current week
            curr_date = max(curr_date, df.loc[df['health-system-encounters'].notna()]['date'].max())
        if 'health-system-positive-tests' in df.columns:
            # health-system positive tests end where projections start, see above comment
            curr_date = max(curr_date, df.loc[df['health-system-positive-tests-reported'].notna()]['date'].max())
        
        if region_size == 'state':
            df['Region'] = 'state'

        # index on both region and date and save to df dict
        value_columns = df.columns.difference(index_names)
        df = pd.pivot_table(df, values=value_columns, index=index_names)
        dataframes[region_size][disease] = df
        
    curr_date = max(curr_date, max_date - pd.DateOffset(weeks=4))

# creating new indices for historical and predicted dates
day_of_week = pd.to_datetime(curr_date).day_name()
start_date = curr_date - pd.DateOffset(weeks=78) # roughly 18 months
historical_dates = pd.date_range(end=curr_date, start=start_date, freq=f'W-{day_of_week[:3].upper()}')
historical_dates = historical_dates.to_list()
all_historical_dates = pd.date_range(end=curr_date, start=min_date, freq=f'W-{day_of_week[:3].upper()}').to_list()
end_date = max_date
pred_dates = pd.date_range(start=curr_date, end=end_date, freq=f'W-{day_of_week[:3].upper()}', inclusive='both')
pred_dates = pred_dates.to_list()

print("Create GeoJSONs")

for region_size, identifier_column in region_geojson_identifiers.items():
    print(region_size)
    with open(f'{scripts_supporting_files_dir}/sc_{region_size}_population_simplified.json') as f:
        gj = geojson.load(f)
        
        # add universal id key
        for feature in gj.features:
            try:
                identifier = int(feature.properties[identifier_column])
            except ValueError:
                identifier = feature.properties[identifier_column]

            feature.properties['id'] = identifier
            
        for disease, df in dataframes[region_size].items():
            extended_historical_data = {}
            # reshape data
            for feature in gj.features:
                try:
                    identifier = int(feature.properties[identifier_column])
                except ValueError:
                    identifier = feature.properties[identifier_column]

                disease_data = {
                    'state': {var:{'historical': [], 'projected': []} for var in data_variables},                        
                    'health-system': {var:{'historical': [], 'projected': []} for var in data_variables},
                    'extra': {'state-encounters-reported': {'historical': [], 'projected': []}},
                    'imputation': 0
                }

                all_hist = {
                    'state': {var:{'historical': [], 'projected': []} for var in data_variables},                        
                    'health-system': {var:{'historical': [], 'projected': []} for var in data_variables},
                    'extra': {'state-encounters-reported': {'historical': [], 'projected': []}},
                    'imputation': 0
                }

                data = None

                # grab data for this region
                try:
                    data = df.xs(identifier, axis=0)
                    disease_data['imputation'] = int(data['imputation'].any())
                    all_hist['imputation'] = int(data['imputation'].any())

                except:
                    # no data in this region - disease combo
                    pass
                    # print(identifier, disease)

                for data_source in ['state', 'health-system']:
                    for var in data_variables:
                        try:
                            var_data = data[f'{data_source}-{var}']
                            try:
                                all_historical_data = var_data.reindex(all_historical_dates)
                                all_hist[data_source][var]['historical'] = [None if math.isnan(x) else x for x in all_historical_data.to_list()]
                                historical_data = var_data.reindex(historical_dates)
                                disease_data[data_source][var]['historical'] = [None if math.isnan(x) else x for x in historical_data.to_list()]
                            except:
                                pass
                                # print(identifier, disease, var, 'historical')

                            try:
                                projected_data = var_data.reindex(pred_dates)
                                disease_data[data_source][var]['projected'] = [None if math.isnan(x) else x for x in projected_data.to_list()]
                                all_hist[data_source][var]['projected'] = disease_data[data_source][var]['projected']
                            except: 
                                pass
                                # print(identifier, disease, var, 'projected')
                        except: # this column doesn't exist
                            pass 
                        
                # process extra and save
                try:
                    var_data = data['state-encounters-reported'] 
                    try:
                        all_historical_data = var_data.reindex(all_historical_dates)
                        all_hist['extra']['state-encounters-reported']['historical'] = [None if math.isnan(x) else x for x in all_historical_data.to_list()]
                        historical_data = var_data.reindex(historical_dates)
                        disease_data['extra']['state-encounters-reported']['historical'] = [None if math.isnan(x) else x for x in historical_data.to_list()]
                    except:
                        pass
                    try:
                        projected_data = var_data.reindex(pred_dates)
                        disease_data['extra']['state-encounters-reported']['projected'] = [None if math.isnan(x) else x for x in projected_data.to_list()]
                        all_hist['extra']['state-encounters-reported']['projected'] = disease_data['extra']['state-encounters-reported']['projected']
                    except: 
                        pass
                except:
                    pass

                # add disease data to this feature
                feature.properties['data'] = disease_data
                extended_historical_data[identifier] = all_hist

                
            # create dirs if needed and save off file
            out_path = f'{processed_data_dir}/respiratory/{region_size}/{disease}.json'
            os.makedirs(os.path.dirname(out_path), exist_ok=True)
            with open(out_path, 'w') as f:
                geojson.dump(gj, f)

            out_path = f'{processed_data_dir}/respiratory/{region_size}/{disease}.extended.json'
            with open(out_path, 'w') as f:
                json.dump(extended_historical_data, f)


with open(f'{processed_data_dir}/respiratory/metadata.json', 'w') as f:
    metadata = {
        'diseases': diseases,
        'region_sizes': {
            'state': 'State',
            'region': 'Region',
            'county': 'County',
            'zcta': 'Zip-Code Tabulation Area (ZCTA)',
        },
        'min_date': min_date.strftime('%Y-%m-%d'),
        'start_date': start_date.strftime('%Y-%m-%d'),
        'current_week': curr_date.strftime('%Y-%m-%d'),
        'end_date': end_date.strftime('%Y-%m-%d')
    }
    json.dump(metadata, f)

# create state CDC hospitalization json file
print("State CDC Hospitalizations")

# read in cdc hosp data and reformat
csvs = glob.glob(f'{aggregated_data_dir}/respiratory/state/CDC_hospitalization/*.csv')
state_csv = max(csvs, key=os.path.getctime)
if len(csvs) > 0:
    state_cdc = pd.read_csv(state_csv)
    state_cdc['Week.Ending.Date'] = pd.to_datetime(state_cdc['Week.Ending.Date'], format=date_format)
    
    # =========================== delete me ===============================
    temp_state_dow = state_cdc['Week.Ending.Date'][0].day_of_week
    temp_ref_dow = pd.to_datetime(curr_date).day_of_week
    if temp_state_dow != temp_ref_dow:
        if abs(temp_ref_dow - temp_state_dow) < temp_ref_dow - temp_state_dow + 7:
            state_cdc['Week.Ending.Date'] = state_cdc['Week.Ending.Date'] + pd.DateOffset(days=temp_ref_dow - temp_state_dow)
        else:
            state_cdc['Week.Ending.Date'] = state_cdc['Week.Ending.Date'] + pd.DateOffset(days=temp_ref_dow - temp_state_dow + 7)
    # =====================================================================
    
    state_cdc = state_cdc[(start_date <= state_cdc['Week.Ending.Date']) & (state_cdc['Week.Ending.Date'] <= curr_date)]
    state_cdc.index = state_cdc['Week.Ending.Date']
    
    # create df that will hold the data
    df = pd.DataFrame(columns=['Date'])
    df['Date'] = state_cdc['Week.Ending.Date']
    df.index = df['Date']
    for disease in diseases.keys():
        # add cdc data to df
        column = list(filter(lambda x: f'total.{".".join(disease.split("-"))}.admissions' == x.lower(), state_cdc.columns))
        if disease == 'respiratory-syncytial-virus':
            column = list(filter(lambda x: f'total.rsv.admissions' == x.lower(), state_cdc.columns))
        if len(column) == 1:
            df[disease] = state_cdc[column[0]]
    
    # save df to json file
    df = df.drop('Date', axis=1)
    df.index = df.index.strftime(date_format)
else:
    df = pd.DataFrame()

df.to_json(f'{processed_data_dir}/respiratory/state/state-cdc.json', orient='columns')
