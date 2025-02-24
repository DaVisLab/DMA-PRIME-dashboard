from .utility import * 

from flask import (
    Blueprint, send_file, current_app
)

bp = Blueprint('data', __name__, url_prefix='/data')

from .authenticate import login_required


@bp.route('/map/<type>', methods=['GET'])
@login_required
def map_data(type):
    # map geojson files
    return send_file(f'{main_dir}/static/assets/GeoJSON/tl_2024_sc_{type}_simplified.json')

@bp.route('/health-care-facility/<type>', methods=['GET'])
@login_required
def health_care_facility(type):
    # health care facilities - hospitals, center for drug and alcohol programs, mobile health clinics, community partners
    if type == "all":
        return send_file(f'{main_dir}/static/assets/Health Care Facilities/hospital-cdap_mhc_partners.csv')
    else:
        return send_file(f'{main_dir}/static/assets/temp/{type}.csv')
# def health_care_facility(type):
#     return send_file(f'{main_dir}/static/assets/Health Care Facilities/hospital-cdap_mhc_partners.csv')
    
@bp.route('/hospitalizations/<disease>', methods=['GET', 'POST'])
@login_required
def getHospitalizations(disease='covid-19'):
    # hospitalization data based on disease
    return send_file(f'{current_app.config['DATADIR']}/processed/{disease}_zcta_hospitalization_data.json')

@bp.route('/hospitalizations/state', methods=['GET', 'POST'])
@login_required
def getHospitalizationsState():
    # hospitalization data based on disease
    return send_file(f'{current_app.config['DATADIR']}/raw/respiratory/Weekly_Hospital_Respiratory_Data.csv')

@bp.route('/deckgl-respiratory', methods=['GET', 'POST'])
@login_required
def getRespiratoryHospitalizations(disease='covid-19'):
    # hospitalization data based on disease
    return send_file(f'{current_app.config['DATADIR']}/processed/respiratory/respiratory_zcta_hospitalization_data.json')

@bp.route('/opioid-hcv-hiv/<disease>', methods=['GET', 'POST'])
@login_required
def getOpioidHcvHiv(disease='opioid'):
    # hospitalization data based on disease
    return send_file(f'{current_app.config['DATADIR']}/processed/opioid_hcv_hiv/{disease}_zcta_hospitalization_data.json')

@bp.route('/other-infectious-diseases/<column>', methods=['GET', 'POST'])
@login_required
def getStateDiseaseHospitalizations(column='encounters'):
    # hospitalization data based on disease
    return send_file(f'{current_app.config['DATADIR']}/processed/other_infectious_diseases_{column}_data.json')

@bp.route('/waste-water/<site>', methods=['GET', 'POST'])
@login_required
def getWasteWaterData(site):
    # hospitalization data based on disease
    return send_file(f'{current_app.config['DATADIR']}/processed/waste_water/{site}.json')


@bp.route('/mobile-health-clinic-events', methods=['GET', 'POST'])
@login_required
def getMobileHealthClinicEvents():
    # hospitalization data based on disease
    return send_file(f'{current_app.config['DATADIR']}/processed/clemson_rural_health_event_data.json')

@bp.route('/icon-pack/<type>', methods=['GET', 'POST'])
def iconData(type):
    # icon csv files
    return send_file(f'{main_dir}/static/assets/Icons/icon-pack.{type}')

@bp.route('/icon/<type>', methods=['GET', 'POST'])
def icon(type):
    # icon csv files
    return send_file(f'{main_dir}/static/assets/Icons/{type}.svg')