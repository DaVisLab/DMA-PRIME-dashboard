import pandas as pd
import numpy as np
import glob
import json

from supporting_files.utility import *

def clean_string(string):
    new_string = string.replace(u"\xc2", u'')
    new_string = string.replace(u"\xa0", u'')
    return new_string

disease_names = {
    "InfA": "Influenza A",
    "SARS": "SARS-CoV-2",
    "RSV": "RSV"
}

with open(f'{aggregated_data_dir}/waste_water/site_info.json') as f:
    site_info = json.load(f)

    files = glob.glob(f'{aggregated_data_dir}/waste_water/*.xlsx')
    df = pd.DataFrame()
    for file in files:
        temp = pd.read_excel(file)
        df = pd.concat([df, temp])
    df['Date'] = pd.to_datetime(df['Date'], format="%m/%d/%y")

    for site in site_info.keys():
        df = df.replace(site_info[site]["excel_name"], site)
        
    df = df.applymap(lambda x: clean_string(x) if isinstance(x, str) else x)
    df = df.replace("", np.nan)
    df = df.dropna(subset=['GC/L WW AVG'])
    
    min_date = df['Date'].min()
    max_date = df['Date'].max()
    diseases_tracked = df['Target'].unique()

    pivot = pd.pivot_table(df, values=['GC/L WW AVG'], index=['Site', 'Target', 'Date'])    

    for site, info in site_info.items():
        if site not in df['Site']:
            continue
        data_dict = {}
        for disease in diseases_tracked:
            temp = pivot.xs((site, disease), level=['Site', 'Target'])
            temp.index = temp.index.strftime('%Y-%m-%d')
            data_dict[disease] = temp.to_dict(orient='dict')['GC/L WW AVG']
        
        with open(f'{processed_data_dir}/waste_water/{site}.json', 'w') as f:
            json.dump(data_dict, f)

    with open(f'{processed_data_dir}/waste_water/metadata.json', 'w') as f:
        metadata = {
            'site_info': site_info,
            'diseases': disease_names,
            'min_date': min_date.strftime('%Y-%m-%d'),
            'max_date': max_date.strftime('%Y-%m-%d'),
            'min_display_date': min_date.strftime('%A, %B %d, %Y'),
            'max_display_date': max_date.strftime('%A, %B %d, %Y'),
        }
        json.dump(metadata, f)
