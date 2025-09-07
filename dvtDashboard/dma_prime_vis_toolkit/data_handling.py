import functools

from .utility import * 
from flask import (
    Blueprint, flash, send_file, redirect, url_for, current_app, request
)
import os
import shutil

bp = Blueprint('data', __name__, url_prefix='/data')
from flask_login import login_required

# Fetching
@bp.route('/map/<type>', methods=['GET'])
@login_required
def map_data(type):
    return send_file(f"{main_dir}/static/assets/GeoJSON/tl_2024_sc_{type}_simplified.json")


@bp.route('/health-care-facility', methods=['GET'])
@login_required
def health_care_facility():
    file = os.path.join(current_app.config['DATADIR'], 'supplementary', 'Health Care Facilities', 'hospital-cdap_mhc_partners.csv')
    decrypt_key = os.path.join(current_app.config['DATADIR'], 'supplementary', 'Health Care Facilities', 'encrypt_key.bin')
    return decrypt(file, decrypt_key)


@bp.route('/respiratory/<region_size>/<disease>', methods=['GET'])
@login_required
def get_respiratory_hospitalizations(region_size='zcta', disease='covid-19'):
    # hospitalization data based on disease
    data_version = get_data_version_from_request(request, current_user)
    file = os.path.join(current_app.config['DATADIR'], 'processed', data_version, 'respiratory', region_size, f'{disease}.json')
    decrypt_key = os.path.join(current_app.config['DATADIR'], 'processed', data_version, 'respiratory', 'encrypt_key.bin')
    return decrypt(file, decrypt_key)

@bp.route('/respiratory/<region_size>/<disease>/extended', methods=['GET'])
@login_required
def get_all_respiratory_hospitalizations(region_size='zcta', disease='covid-19'):
    # hospitalization data based on disease
    data_version = get_data_version_from_request(request, current_user)
    file = os.path.join(current_app.config['DATADIR'], 'processed', data_version, 'respiratory', region_size, f'{disease}.extended.json')
    decrypt_key = os.path.join(current_app.config['DATADIR'], 'processed', data_version, 'respiratory', 'encrypt_key.bin')
    return decrypt(file, decrypt_key)

@bp.route('/respiratory/model/<disease>/<geographic_unit>/<population>/<outcome_variable>/<location>', methods=['GET'])
@login_required
def get_respiratory_model(region_id, region_size='zcta', disease='covid-19', outcome_variable='encounters', population='state'):
    # model information for given combo of option selections
    data_version = get_data_version_from_request(request, current_user)
    file = os.path.join(current_app.config['DATADIR'], 'processed', data_version, 'respiratory', 'metrics', region_size, disease, outcome_variable, population, f'{region_id}.html')
    decrypt_key = os.path.join(current_app.config['DATADIR'], 'processed', data_version, 'respiratory', 'encrypt_key.bin')
    return decrypt(file, decrypt_key)

@bp.route('/opioid-hcv-hiv/<disease>', methods=['GET'])
@login_required
def get_opioid_hcv_hiv(disease='opioid'):
    data_version = get_data_version_from_request(request, current_user)
    file = os.path.join(current_app.config['DATADIR'], 'processed', data_version, 'opioid_hcv_hiv', f'{disease}_zcta_hospitalization_data.json')
    decrypt_key = os.path.join(current_app.config['DATADIR'], 'processed', data_version, 'opioid_hcv_hiv', 'encrypt_key.bin')
    return decrypt(file, decrypt_key)

@bp.route('/outbreak-detection/<region_size>/<column>', methods=['GET'])
@login_required
def get_state_disease_hospitalizations(region_size='region', column='encounters'):
    data_version = get_data_version_from_request(request, current_user)
    file = os.path.join(current_app.config['DATADIR'], 'processed', data_version, 'other_infectious_diseases',region_size, f'{column}_data.json')
    decrypt_key = os.path.join(current_app.config['DATADIR'], 'processed', data_version, 'other_infectious_diseases', 'encrypt_key.bin')
    return decrypt(file, decrypt_key)

@bp.route('/waste-water/<site>', methods=['GET'])
@login_required
def get_wastewater_data(site):
    data_version = get_data_version_from_request(request, current_user)
    file = os.path.join(current_app.config['DATADIR'], 'processed', data_version, 'waste_water', f'{site}.json')
    decrypt_key = os.path.join(current_app.config['DATADIR'], 'processed', data_version, 'waste_water', 'encrypt_key.bin')
    return decrypt(file, decrypt_key)

@bp.route('/mobile-health-clinic-events', methods=['GET'])
@login_required
def get_mobile_health_clinic_events():
    data_version = get_data_version_from_request(request, current_user)
    file = os.path.join(current_app.config['DATADIR'], 'processed', data_version, 'mhc', 'clemson_rural_health_event_data.json')
    decrypt_key = os.path.join(current_app.config['DATADIR'], 'processed', data_version, 'mhc', 'encrypt_key.bin')
    return decrypt(file, decrypt_key)


@bp.route('/icon-pack/<type>', methods=['GET'])
def icon_data(type):
    # Validate allowed types
    if type not in ['png', 'json', 'svg']:
        return "Unsupported file type", 400

    file_path = os.path.join(main_dir, "static", "assets", "Icons", f"icon-pack.{type}")
    if not os.path.exists(file_path):
        return f"File not found: {file_path}", 404

    return send_file(file_path)


@bp.route('/icon/<type>', methods=['GET'])
def icon(type):
    file_path = os.path.join(main_dir, "static", "assets", "Icons", f"{type}.svg")
    if not os.path.exists(file_path):
        return f"Icon not found: {file_path}", 404

    return send_file(file_path)

### Data Approval ###
def data_approver_required(view):
    @functools.wraps(view)
    def wrapped_view(**kwargs):
        if not current_user.data_approver:
            current_app.logger.info(f'{current_user.email} attempted to view admin page')
            flash("Access Denied: Data approval access required")
            return redirect(url_for('index'))

        return view(**kwargs)

    return wrapped_view

@bp.route('/change-version', methods=['PUT'])
def change_version():
    if not current_user.data_approver:
        current_app.logger.info(f'{current_user.email} attempted to retrieve data date')
        return 'Need data approval access', 401
    
    change = request.json['change']
    dashboard = request.json['dashboard']

    dash_path = os.path.join(current_app.config['DATADIR'], "processed", 'current', dashboard_translation[dashboard])

    if os.path.isdir(dash_path):
        previous_path = os.path.join(current_app.config['DATADIR'], "processed", 'previous', dashboard_translation[dashboard])
        if change == 'new':
            new_path = os.path.join(current_app.config['DATADIR'], "processed", 'new', dashboard_translation[dashboard])
            shutil.copytree(dash_path, previous_path, dirs_exist_ok=True)
            shutil.copytree(new_path, dash_path, dirs_exist_ok=True)
            current_app.logger.info(f'{current_user.email} approved new data for {dashboard}')

        if change == 'previous':
            shutil.copytree(previous_path, dash_path, dirs_exist_ok=True)
            current_app.logger.info(f'{current_user.email} reverted data for {dashboard}')
    else:
        current_app.logger.info(f'{current_user.email} attempted data change with invalid dashboard')
        return '', 409

    return '', 200


@bp.route('/get-date/<data_version>/<dashboard>', methods=['GET'])
def send_data_date(data_version, dashboard):

    if not current_user.data_approver:
        current_app.logger.info(f'{current_user.email} attempted to retrieve data date')
        return 'Need data approval access', 401
    
    date_s = get_data_date(data_version, dashboard)

    if date_s is None:
        return f"Date(s) not found for {dashboard} dashboard and {data_version} data version", 404
    
    return date_s

@bp.route('/respiratory/changed_files', methods=['GET'])
def send_respiratory_file_changes():
    def find_path(line):
        parts = line.split('and')
        path = parts[0]

        parts = path.split('/')
        index = parts.index('respiratory')
        path = '/'.join(parts[index+1:])

        return path

    file = os.path.join(current_app.config['DATADIR'], 'processed', 'new', 'respiratory', 'respiratory_changes.txt')
    with open(file, 'r') as f:
        changes = f.readlines()
        additions = []
        deletions = []
        changed_files = []
        for line in changes:            
            if line.startswith('Only in'):
                if 'backup' in line:
                    deletions.append(find_path(line))
                else:
                    additions.append(find_path(line))
            elif line.startswith('Files'):
                changed_files.append(find_path(line))
    return {'Changed Files': changed_files, 'New Files': additions, 'Deleted Files': deletions}

def get_data_date(data_version, dashboard):
    all_data_versions = ['new', 'current', 'previous']
    all_dashboards = ['respiratory', 'waste_water', 'other_infectious_diseases', 'opioid_hcv_hiv', 'mhc']

    output = {}
    
    try:
        if data_version == 'all':
            if dashboard == 'all':
                for dash in all_dashboards:
                    output[dashboard_translation[dash]] = {}
                    for ver in all_data_versions:
                        file_path = os.path.join(current_app.config['DATADIR'], "processed", ver, dash, 'date.txt')
                        with open(file_path) as f:
                            output[dashboard_translation[dash]][ver] = f.read()
            else:
                output[dashboard] = {}
                for ver in all_data_versions:
                    file_path = os.path.join(current_app.config['DATADIR'], "processed", ver, dashboard_translation[dashboard], 'date.txt')
                    with open(file_path) as f:
                        output[dashboard][ver] = f.read()
        elif dashboard == 'all':
            for dash in all_dashboards:
                file_path = os.path.join(current_app.config['DATADIR'], "processed", data_version, dashboard_translation[dash], 'date.txt')
                with open(file_path) as f:
                    output[dash] = {[data_version]: f.read()}
        else:
            file_path = os.path.join(current_app.config['DATADIR'], "processed", data_version, dashboard_translation[dashboard], 'date.txt')
            if os.path.exists(file_path):
                with open(file_path) as f:
                    output[dashboard] = {[data_version]: f.read()}

    except: # something broke so send none and error will get passed along
        output = None

    return output

