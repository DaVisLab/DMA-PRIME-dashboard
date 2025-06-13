from .utility import * 
from flask import (
    Blueprint, send_file, current_app, request, abort
)
import os

bp = Blueprint('data', __name__, url_prefix='/data')
from flask_login import login_required


@bp.route('/map/<type>', methods=['GET'])
@login_required
def map_data(type):
    return send_file(f"{main_dir}/static/assets/GeoJSON/tl_2024_sc_{type}_simplified.json")


@bp.route('/health-care-facility', methods=['GET'])
@login_required
def health_care_facility():
    return decrypt(f"{current_app.config['DATADIR']}/supplementary/Health Care Facilities/hospital-cdap_mhc_partners.csv")


@bp.route('/deckgl-respiratory/<region_size>', methods=['GET', 'POST'])
@login_required
def getRespiratoryHospitalizations(region_size='zcta'):
    return decrypt(f"{current_app.config['DATADIR']}/processed/respiratory/respiratory_{region_size}_hospitalization_data.json")


@bp.route('/opioid-hcv-hiv/<disease>', methods=['GET', 'POST'])
@login_required
def getOpioidHcvHiv(disease='opioid'):
    return decrypt(f"{current_app.config['DATADIR']}/processed/opioid_hcv_hiv/{disease}_zcta_hospitalization_data.json")


@bp.route('/outbreak-detection/<region_size>/<column>', methods=['GET', 'POST'])
@login_required
def getStateDiseaseHospitalizations(region_size='region', column='encounters'):
    return decrypt(f"{current_app.config['DATADIR']}/processed/other_infectious_diseases/{region_size}/{column}_data.json")


@bp.route('/waste-water/<site>', methods=['GET', 'POST'])
@login_required
def getWasteWaterData(site):
    return decrypt(f"{current_app.config['DATADIR']}/processed/waste_water/{site}.json")


@bp.route('/mobile-health-clinic-events', methods=['GET', 'POST'])
@login_required
def getMobileHealthClinicEvents():
    return decrypt(f"{current_app.config['DATADIR']}/processed/mhc/clemson_rural_health_event_data.json")


@bp.route('/icon-pack/<type>', methods=['GET', 'POST'])
def iconData(type):
    # Validate allowed types
    if type not in ['png', 'json', 'svg']:
        return "Unsupported file type", 400

    file_path = os.path.join(main_dir, "static", "assets", "Icons", f"icon-pack.{type}")
    if not os.path.exists(file_path):
        return f"File not found: {file_path}", 404

    return send_file(file_path)


@bp.route('/icon/<type>', methods=['GET', 'POST'])
def icon(type):
    file_path = os.path.join(main_dir, "static", "assets", "Icons", f"{type}.svg")
    if not os.path.exists(file_path):
        return f"Icon not found: {file_path}", 404

    return send_file(file_path)
