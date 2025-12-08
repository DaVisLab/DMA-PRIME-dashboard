import pandas as pd
import geojson
import math
import json

import os
import glob

from supporting_files.utility import *

dirs = os.listdir(f'{aggregated_data_dir}/opioid_hcv_hiv')

disease_dict = {}
years = set()

for dir in dirs:
    csvs = glob.glob(f'{aggregated_data_dir}/opioid_hcv_hiv/{dir}/*.csv')
    if len(csvs) == 0:
        continue
        
    file = csvs[0]
    disease = dir.lower()
    df = pd.read_csv(file)
    disease_dict[disease] = df

    these_years = []
    for column in df:
        try:
            these_years.append(int(column.split('_')[-1]))
        except:
            pass

    years.update(these_years)

# read in sociodemographic data
zcta_socio_demographics = pd.read_csv(f'{scripts_supporting_files_dir}/zcta_socio_demographics.csv', index_col=0)
zcta_socio_demographics.rename({'prop.Uninsured': 'proportion_uninsured', 'Median.Income': 'median_income'}, axis=1, inplace=True)

for disease, df in disease_dict.items():
    new_df = pd.DataFrame()
    for year in years:
        temp = pd.DataFrame(df[['zcta', f'{disease}_hosp_{year}', f'{disease}_death_{year}']].rename({f'{disease}_hosp_{year}': 'hospitalizations', f'{disease}_death_{year}': 'deaths'}, axis=1))
        temp['year'] = year
        new_df = pd.concat([new_df, temp])

    pivot_df = pd.pivot_table(new_df, values=['hospitalizations', 'deaths'], index=['zcta', 'year'], dropna=False)

    # shape into geojson with disease and sociodemographic data stuck into properties.data section of each feature
    with open(f'{scripts_supporting_files_dir}/sc_zcta_population_simplified.json', 'r') as f:
        gj = geojson.load(f)

        for thing in gj.features:
            zcta = thing.properties['ZCTA']
            zcta_disease_data = {}

            for col in ['hospitalizations', 'deaths']:
                zcta_disease_data[col] = {'cumulative': 0}
                cumulative_is_nan = True

                for year in years:
                    try:
                        value = float(pivot_df.loc[int(zcta), year][col])
                        if math.isnan(value): 
                            zcta_disease_data[col][year] = 'NaN'
                        else:
                            cumulative_is_nan = False
                            zcta_disease_data[col][year] = value
                            if (int(year) < 2023 or (col == 'hospitalizations' and int(year) == 2023)):
                                zcta_disease_data[col]['cumulative'] += zcta_disease_data[col][year]
                    except KeyError:
                        zcta_disease_data[col][year] = 'NaN'

                if (cumulative_is_nan):
                    zcta_disease_data[col]['cumulative'] = 'NaN'

            for col in ['SVI', 'proportion_uninsured', 'median_income']:
                try:
                    value = float(zcta_socio_demographics.loc()[int(zcta), col])
                    if math.isnan(value):
                        zcta_disease_data[col][year] = {year: 'NaN' for year in years}
                        zcta_disease_data[col]['cumulative'] = 'NaN'
                    else:
                        zcta_disease_data[col] = {year: value for year in years}
                        zcta_disease_data[col]['cumulative'] = value
                except (KeyError, ValueError):
                    zcta_disease_data[col] = {year: 'NaN' for year in years}
                    zcta_disease_data[col]['cumulative'] = 'NaN'

            thing.properties['data'] = zcta_disease_data

        with open(get_file_descriptor(f'{processed_data_dir}/opioid_hcv_hiv/{disease}_zcta_hospitalization_data.json'), 'w') as f:
            geojson.dump(gj, f)


with open(get_file_descriptor(f'{processed_data_dir}/opioid_hcv_hiv/metadata.json'), 'w') as f:
    metadata = {
        'diseases': {d[0]: d[1] for d in zip(disease_dict.keys(), dirs)},
        'years': list(years),
        'variables': {
            'hospitalizations': 'Hospitalizations',
            'deaths': 'Deaths',
            'SVI': 'Social Vulnerability Index',
            'proportion_uninsured': 'Proportion Uninsured',
            'median_income': 'Median Income',
        }
    }
    json.dump(metadata, f)