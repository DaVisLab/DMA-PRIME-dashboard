from .utility import * 

from flask import (
    Blueprint, send_file, current_app
)

bp = Blueprint('data', __name__, url_prefix='/data')

from flask_login import login_required


@bp.route('/map/<type>', methods=['GET'])
@login_required
def map_data(type):
    # map geojson files
    return send_file(f'{main_dir}/static/assets/GeoJSON/tl_2024_sc_{type}_simplified.json')

@bp.route('/health-care-facility', methods=['GET'])
@login_required
def health_care_facility():
    # health care facilities - hospitals, center for drug and alcohol programs, mobile health clinics, community partners
    return decrypt(f'{current_app.config['DATADIR']}/supplementary/Health Care Facilities/hospital-cdap_mhc_partners.csv')

@bp.route('/deckgl-respiratory/<region_size>', methods=['GET', 'POST'])
@login_required
def getRespiratoryHospitalizations(region_size='zcta'):
    # hospitalization data based on disease
    return decrypt(f'{current_app.config['DATADIR']}/processed/respiratory/respiratory_{region_size}_hospitalization_data.json')

@bp.route('/opioid-hcv-hiv/<disease>', methods=['GET', 'POST'])
@login_required
def getOpioidHcvHiv(disease='opioid'):
    # hospitalization data based on disease
    return decrypt(f"{current_app.config['DATADIR']}/processed/opioid_hcv_hiv/{disease}_zcta_hospitalization_data.json")

@bp.route('/other-infectious-diseases/<region_size>/<column>', methods=['GET', 'POST'])
@login_required
def getStateDiseaseHospitalizations(region_size='region',column='encounters'):
    # hospitalization data based on disease
    return decrypt(f'{current_app.config['DATADIR']}/processed/other_infectious_diseases/{region_size}/{column}_data.json')

@bp.route('/waste-water/<site>', methods=['GET', 'POST'])
@login_required
def getWasteWaterData(site):
    # hospitalization data based on disease
    return decrypt(f"{current_app.config['DATADIR']}/processed/waste_water/{site}.json")


@bp.route('/mobile-health-clinic-events', methods=['GET', 'POST'])
@login_required
def getMobileHealthClinicEvents():
    # hospitalization data based on disease
    return decrypt(f'{current_app.config['DATADIR']}/processed/mhc/clemson_rural_health_event_data.json')

@bp.route('/icon-pack/<type>', methods=['GET', 'POST'])
def iconData(type):
    # icon csv files
    return send_file(f'{main_dir}/static/assets/Icons/icon-pack.{type}')

@bp.route('/icon/<type>', methods=['GET', 'POST'])
def icon(type):
    # icon csv files
    return send_file(f'{main_dir}/static/assets/Icons/{type}.svg')