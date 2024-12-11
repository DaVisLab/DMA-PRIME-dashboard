
import pandas as pd
import numpy as np
import math
import json
import geojson
import requests
import time

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

@bp.route('/mobile-health-clinic-events', methods=['GET', 'POST'])
@login_required
def getMobileHealthClinicEvents():
    # hospitalization data based on disease
    return send_file(f'{main_dir}/static/data/clemson_rural_health_event_data.json')

def load_data():
    load_zcta_respiratory_hospitalizations()
    load_zcta_opioid()
    load_mobile_health_clinic_events()
    pass

def load_zcta_opioid():
    # read in opioid data
    df = pd.read_csv(f'{main_dir}/static/data/raw/opioid_data.csv')
    new_df = pd.DataFrame()

    # reshape 
    years = [2020, 2021, 2022, 2023, 2024, 2025]
    for year in years:
        temp = pd.DataFrame(df[['zcta', f'opioid_hosp_{year}', f'opioid_death_{year}']].rename({f'opioid_hosp_{year}': 'hospitalizations', f'opioid_death_{year}': 'deaths'}, axis=1))
        temp['year'] = year
        new_df = pd.concat([new_df, temp])

    pivot_df = pd.pivot_table(new_df, values=['hospitalizations', 'deaths'], index=['zcta', 'year'], dropna=False)

    zcta_data = pd.read_csv(main_dir+'/static/data/zcta_summary.csv', index_col=0)

    # read in sociodemographic data
    zcta_socio_demographics = pd.read_csv(main_dir+'/static/data/zcta_socio_demographics.csv', index_col=0)
    zcta_socio_demographics.rename({'prop.Uninsured': 'proportion_uninsured', 'Median.Income': 'median_income'}, axis=1, inplace=True)

    # shape into geojson with opioid and sociodemographic data stuck into properties.data section of each feature
    with open(f'{main_dir}/static/data/tl_2023_sc_zcta_trimmed_simplified_ogr2ogr_.001.json') as f:
        gj = geojson.load(f)

        for thing in gj.features:
            zcta = thing.properties['ZCTA5CE20']
            try:
                this_zcta_data = zcta_data.loc[int(zcta)]
                thing.properties['population'] = "NaN" if str(this_zcta_data['population']) == "nan" else str(this_zcta_data['population'])
                thing.properties['county'] = "NaN" if str(this_zcta_data['main_county']) == "nan" else str(this_zcta_data['main_county'])
            except KeyError:
                thing.properties['population'] = 'NaN'
                thing.properties['county'] = 'NaN'
            
            zcta_opioid_data = {}

            for col in ['hospitalizations', 'deaths']:
                zcta_opioid_data[col] = {'cumulative': 0}

                for year in years:
                    try:
                        value = float(pivot_df.loc[int(zcta), year][col])
                        if math.isnan(value): 
                            zcta_opioid_data[col][year] = 'NaN'
                        else:
                            zcta_opioid_data[col][year] = value
                            if (int(year) < 2023 or (col == 'hospitalizations' and int(year) == 2023)):
                                zcta_opioid_data[col]['cumulative'] += zcta_opioid_data[col][year]
                    except KeyError:
                        zcta_opioid_data[col][year] = 'NaN'

            for col in ['SVI', 'proportion_uninsured', 'median_income']:
                try:
                    value = float(zcta_socio_demographics.loc()[int(zcta), col])
                    if math.isnan(value):
                        zcta_opioid_data[col][year] = {year: 'NaN' for year in years}
                        zcta_opioid_data[col]['cumulative'] = 'NaN'
                    else:
                        zcta_opioid_data[col] = {year: value for year in years}
                        zcta_opioid_data[col]['cumulative'] = value
                except (KeyError, ValueError):
                    zcta_opioid_data[col] = {year: 'NaN' for year in years}
                    zcta_opioid_data[col]['cumulative'] = 'NaN'

            thing.properties['data'] = zcta_opioid_data

        with open(f'{main_dir}/static/data/opioid_zcta_hospitalization_data.json', 'w') as f:
            geojson.dump(gj, f)

def load_mobile_health_clinic_events():
    def process_addresses(addresses, counties):
        def geocode(addr_county):
            # pre process address before using api
            address, county = addr_county
            new_addr = address
            info = requests.get(f'https://geocode.maps.co/search?q=${new_addr}&api_key=***REMOVED***')
            while not info.ok:
                time.sleep(5)
                info = requests.get(f'https://geocode.maps.co/search?q=${new_addr}&api_key=***REMOVED***')
            time.sleep(1.1) # to stay within API usage rules
            infoJson = info.json()
            for entry in infoJson:
                if 'South Carolina' in entry['display_name']:
                    return entry
            return None

        # given locations, geocode them all and append results to a file
        locations = map(geocode, zip(addresses, counties))
        data = dict(zip(addresses, locations))

        with open(main_dir+'/static/data/mobile_health_clinic_address_translation.json', 'w') as f:
            json.dump(data, f)
        
        return data
    
    # read in mobile health clinic data
    # df = pd.read_excel(main_dir+'/static/data/Clemson Rural Health Outreach.xlsx')
    df = pd.read_csv(main_dir+'/static/data/out.csv')
    
    # rename columns
    df.rename({'Timestamp': 'form_entry_time', 'Date of Event': 'event_date', 
               'County': 'county', 'Organization Name': 'org_name', 
               'Organization Address': 'org_address', 'Type': 'type',
               'Point of Contact Name': 'POC_name', 'POC Contact Information': 'POC_contact_info',
               'Number of patients (documented in Epic)': 'num_epic_patients', 'Number of People Attended (non-clinical)': 'num_non-clinical_attendees',
               'Staff Members Present': 'staff_members_present', 'Site Address (If Different)': 'site_address',
               'Report Submitted By:': 'report_author', 'Notes': 'notes'}, axis=1, inplace=True)
    
    def clean_strings(string):
        # remove various characters from string
        new_string = string.replace(u'\xa0', u' ')
        new_string = new_string.replace(u'\u00b7', u' ')
        new_string = new_string.replace(u'\u00a0', u' ')
        new_string = new_string.replace(u'\u00e1', u'a')
        new_string = new_string.strip()
        return new_string

    # convert types, fill na, clean strings
    df['form_entry_time'] = df['form_entry_time'].astype(str)
    df['event_date'] = df['event_date'].astype(str)
    df.fillna({'org_address': '', 'POC_name': '', 'POC_contact_info': '', 
               'num_epic_patients': 0, 'staff_members_present': '', 
               'num_non-clinical_attendees': 0, 'report_author': '', 'notes': ''}, inplace=True)
    df.replace('na', None, inplace=True)
    df = df.map(lambda x: clean_strings(x) if isinstance(x, str) else x)

    # if there is no site address, fill with organization site
    altSite = df['site_address'].notna()
    orgSite = ~altSite
    df.loc[orgSite, 'site_address'] = df.loc[orgSite, 'org_address']

    # add lat/lon for successfully geocoded addresses and save file
    try:
        with open(main_dir+'/static/data/mobile_health_clinic_address_translation.json') as f:
            data = json.load(f)
    except OSError:
        data = process_addresses(df['site_address'])

    df['site_osm_address'] = df['site_address'].apply(lambda addr: data[addr]['display_name'] if addr in data and data[addr] else None)
    df['site_lat'] = df['site_address'].apply(lambda addr: data[addr]['lat']  if addr in data and data[addr] else None)
    df['site_lon'] = df['site_address'].apply(lambda addr: data[addr]['lon']  if addr in data and data[addr] else None)

    with open(main_dir+'/static/data/clemson_rural_health_event_data.json', 'w') as f:
        json.dump(list(df.to_dict(orient='index').values()), f)

def load_zcta_respiratory_hospitalizations():
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
                temp = pd.read_csv(f['file'], date_format=f['date_format'], parse_dates=['Date'])
                temp['imputation'] = f['imputation']
                temp.rename({'Zip code': 'zcta', 'Date': 'date'}, axis=1, inplace=True)
                temp['date'] = pd.to_datetime(temp['date'], format=f['date_format']) + pd.Timedelta(days=7)
                df = pd.concat([df, temp])
        else:
            df = pd.read_csv(file)
            df['imputation'] = False

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
                            'start-date': data.index[0].strftime('%Y-%m-%d'),
                            'data': data.to_list(),
                        }
                # if data doesn't exist then add data source with empty array
                except IndexError:
                    zcta_dict[name] = {
                            'start-date': date.strftime('%Y-%m-%d'),
                            'data': [],
                        }
                except KeyError:
                    zcta_dict[name] = {
                            'start-date': date.strftime('%Y-%m-%d'),
                            'data': [],
                        }
            try:
                data = df.xs(zcta, axis=0)['Projected Cases(post training)'].reindex(pred_dates).dropna()
                zcta_dict['state-prediction'] = {
                        'start-date': data.index[0].strftime('%Y-%m-%d'),
                        'data': data.to_list(),
                    }
            except KeyError:
                zcta_dict['state-prediction'] = {
                    'start-date': date.strftime('%Y-%m-%d'),
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
                'start_date': start_date.strftime('%Y-%m-%d'),
                'current_monday': date.strftime('%Y-%m-%d'),
                'end_date': end_date.strftime('%Y-%m-%d')},
            'data': zcta_list
        }

        with open( main_dir+'/static/data/'+disease+'_zcta_hospitalization_data.json', 'w') as f:
            json.dump(data, f)


def concatAllIcons():
    df = pd.read_csv("All Health Facilities.csv")
    df = df.rename({"X": "longitude", "Y": "latitude"}, axis=1)

    hospitalMask = df["Permit Type"] == "HL- Hospital or Institutional General Infirmary"
    cdapIn = df["Permit Type"] == "HL- CDAP Inpatient"
    cdapOut = df["Permit Type"] == "HL- CDAP Outpatient"

    df = df.loc[hospitalMask | cdapIn | cdapOut]
    df["type"] = ""
    df["type"] = ""
    df.loc[hospitalMask, "type"] = "hospital"
    df.loc[cdapIn | cdapOut, "type"] = "CDAP"

    df2 = pd.read_csv("all_community_partners.csv")
    df2["type"] = "community_partner"
    df3 = pd.read_csv("mobile_health_clinics.csv")
    df3["type"] = "mobile_health_clinic"

    pd.concat([df, df2, df3]).to_csv("hospital-cdap_mhc_partners.csv")
