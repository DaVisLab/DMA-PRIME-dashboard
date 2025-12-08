import sys
import os
import io
import json

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from googleapiclient.errors import HttpError

import pandas as pd

from supporting_files.translate_addresses import *
from supporting_files.utility import *

# get credentials and refresh if need be
creds = None
if os.path.exists(f"{scripts_supporting_files_dir}/token.json"):
    creds = Credentials.from_authorized_user_file(f"{scripts_supporting_files_dir}/token.json", ["https://www.googleapis.com/auth/drive.readonly"])

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

    with open(get_file_descriptor(f'{aggregated_data_dir}/mhc/Clemson Rural Health Outreach.csv'), 'wb') as f:
        f.write(file.read())
        file.close()
    
except HttpError as error:
    # TODO(developer) - Handle errors from drive API.
    print(f"An error occurred: {error}")
    sys.exit("Could not process file")

# process file
df = pd.read_csv(f'{aggregated_data_dir}/mhc/Clemson Rural Health Outreach.csv')

# rename columns
df.rename({'Timestamp': 'form_entry_time', 'Date of Event': 'event_date', 
            'County': 'county', 'Organization Name': 'org_name', 
            'Organization Address': 'org_address', 'Type': 'type',
            'Point of Contact Name': 'POC_name', 'POC Contact Information': 'POC_contact_info',
            'Number of patients (documented in Epic)': 'num_epic_patients', 'Number of People Attended (non-clinical)': 'num_non-clinical_attendees',
            'Staff Members Present': 'staff_members_present', 'Site Address (If Different)': 'site_address',
            'Report Submitted By:': 'report_author', 'Notes': 'notes', 'DMA Prime offered?': 'DMAPRIME'}, axis=1, inplace=True)

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
            'num_non-clinical_attendees': 0, 'report_author': '', 'notes': '', 'DMAPRIME': 'no'}, inplace=True)
df.replace('na', None, inplace=True)
df = df.map(lambda x: clean_strings(x) if isinstance(x, str) else x)
df = df.assign(DMAPRIME = df['DMAPRIME'].map(lambda x: x in ['yes', 'y']))

# if there is no site address, fill with organization site
altSite = df['site_address'].notna()
orgSite = ~altSite
df.loc[orgSite, 'site_address'] = df.loc[orgSite, 'org_address']

# try to load address translation, or create if does not exist
try:
    address_translation = pd.read_csv(f'{scripts_supporting_files_dir}/mobile_health_clinic_address_translation.csv', index_col=0)
except OSError:
    address_translation = process_addresses(df['site_address'], df['county'])
address_translation.index = address_translation.index.astype(str)

# geocoded info for each event
df['site_osm_address'] = None
df['site_lat'] = None
df['site_lon'] = None

# add lat/lon for geocoded addresses, geocode unknown addresses and save new addresses to file
for addr, county in set(zip(df['site_address'].astype(str), df['county'].astype(str))):
    if addr not in address_translation.index:
        print(addr)
        address_translation.loc[addr] = geocode((addr, county))
    mask = (df['site_address'] == addr) & (df['county'] == county)
    if(address_translation.loc[addr].isna().any()):
        df.loc[mask, 'site_osm_address'] = 'null'
        df.loc[mask, 'site_lat'] = 'null'
        df.loc[mask, 'site_lon'] = 'null'
    else:
        df.loc[mask, 'site_osm_address'] = address_translation.loc[addr, 'display_name']
        df.loc[mask, 'site_lat'] = address_translation.loc[addr, 'lat']
        df.loc[mask, 'site_lon'] = address_translation.loc[addr, 'lon']

address_translation.to_csv(f'{scripts_supporting_files_dir}/mobile_health_clinic_address_translation.csv')
with open(get_file_descriptor(f'{processed_data_dir}/mhc/clemson_rural_health_event_data.json'), 'w') as f:
    json.dump(list(df.to_dict(orient='index').values()), f)
