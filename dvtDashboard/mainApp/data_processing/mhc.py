import sys
import os.path
import io
import json
import re
import time
import requests

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from googleapiclient.errors import HttpError

import pandas as pd


# getting the name of the directory where the this file is
current = os.path.dirname(os.path.realpath(__file__))

# Getting the parent directory name where the current directory is present
parent = os.path.dirname(current)

# adding the parent directory to the sys.path
sys.path.append(parent)
import utility

# get credentials and refresh if need be
creds = None
if os.path.exists("token.json"):
    creds = Credentials.from_authorized_user_file("token.json", ["https://www.googleapis.com/auth/drive.readonly"])

if creds and creds.expired and creds.refresh_token:
    creds.refresh(Request())
else:
    sys.exit("Cannot Authorize")

# download file
try:
    service = build("drive", "v3", credentials=creds)

    file_id = '13gehf2Z9rmNYKoo7SunOB_RHjS1Y-_ODVaA_XQp2kWA'
    request = service.files().export(fileId=file_id, mimeType="text/csv")
    file = io.BytesIO()
    downloader = MediaIoBaseDownload(file, request)
    done = False
    while done is False:
        status, done = downloader.next_chunk()
        print(f"Download {int(status.progress() * 100)}.")

    file.seek(0)

    with open(utility.main_dir+'/static/data/raw/Clemson Rural Health Outreach.csv', 'wb') as f:
        f.write(file.read())
        file.close()
    
except HttpError as error:
    # TODO(developer) - Handle errors from drive API.
    print(f"An error occurred: {error}")
    sys.exit("Could not process file")


# address geocoding
def geocode(addr_county):
    print(list(addr_county))
    # pre process address before using api
    address, county = addr_county
    new_addr = address
    if not bool(re.search('[0-9]{5}', address)):
        new_addr = f'{address} {county} sc'
    info = requests.get(f'https://geocode.maps.co/search?q=${new_addr}&api_key=***REMOVED***')
    while not info.ok:
        time.sleep(5)
        info = requests.get(f'https://geocode.maps.co/search?q=${new_addr}&api_key=***REMOVED***')
    time.sleep(1.1) # to stay within API usage rules
    infoJson = info.json()
    for entry in infoJson:
        if 'South Carolina' in entry['display_name'] or 'United States' in entry['display_name']:
            return entry
    return None

def process_addresses(addresses, counties):
        # given locations, geocode them all and append results to a file
    locations = map(geocode, zip(addresses, counties))
    data = dict(zip(addresses, locations))

    data = pd.DataFrame.from_dict(data).transpose()
    data.to_csv(utility.main_dir+'/static/data/mobile_health_clinic_address_translation.csv')
    # with open(utility.main_dir+'/static/data/mobile_health_clinic_address_translation.json', 'w') as f:
    #     json.dump(data, f)
    
    return data

# process file
df = pd.read_csv(utility.main_dir+'/static/data/raw/Clemson Rural Health Outreach.csv')

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
    # address_translation = pd.read_csv(utility.main_dir+'/static/data/mobile_health_clinic_address_translation.csv')
    with open(utility.main_dir+'/static/data/mobile_health_clinic_address_translation.json') as f:
        data = json.load(f)
        address_translation = pd.DataFrame.from_dict(data).transpose()
except OSError:
    address_translation = process_addresses(df['site_address'], df['county'])
    # data = process_addresses(df['site_address'], df['county'])

# geocoding each event
df['site_osm_address'] = None
df['site_lat'] = None
df['site_lon'] = None

for addr, county in set(zip(df['site_address'], df['county'])):
    print(addr, county)
    if addr in address_translation.index:
        mask = (df['site_address'] == addr) & (df['county'] == county)
        df.loc[mask, 'site_osm_address'] = address_translation.loc[addr, 'display_name']
        df.loc[mask, 'site_lat'] = address_translation.loc[addr, 'lat']
        df.loc[mask, 'site_lon'] = address_translation.loc[addr, 'lon']
    else:
        address_translation.loc[addr] = geocode((addr, county))

address_translation.to_csv("testing.csv")
with open('test.json', 'w') as f:
    json.dump(list(df.to_dict(orient='index').values()), f)

# df['site_osm_address'] = df['site_address'].apply(lambda addr: data[addr]['display_name'] if addr in data and data[addr] else None)
# df['site_lat'] = df['site_address'].apply(lambda addr: data[addr]['lat']  if addr in data and data[addr] else None)
# df['site_lon'] = df['site_address'].apply(lambda addr: data[addr]['lon']  if addr in data and data[addr] else None)

# with open(main_dir+'/static/data/clemson_rural_health_event_data.json', 'w') as f:
#     json.dump(list(df.to_dict(orient='index').values()), f)


