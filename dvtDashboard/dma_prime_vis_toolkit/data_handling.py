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

@bp.route('/mobile-health-clinic-events', methods=['GET', 'POST'])
@login_required
def getMobileHealthClinicEvents():
    # hospitalization data based on disease
    return send_file(f'{current_app.config['DATADIR']}/processed/clemson_rural_health_event_data.json')

@bp.route('/icon-pack/<type>', methods=['GET', 'POST'])
def iconData(type):
    # icon csv files
    return send_file(f'{main_dir}/static/assets/Icons/icon-pack.{type}')