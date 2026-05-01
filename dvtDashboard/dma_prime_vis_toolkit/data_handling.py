import functools
import os
import shutil
from datetime import datetime
from pathlib import Path

from flask import (
    Blueprint,
    abort,
    flash,
    current_app,
    redirect,
    render_template,
    request,
    send_file,
    url_for,
)
from flask_login import current_user, login_required

from .utility import (
    ALLOWED_DATA_VERSIONS,
    dashboard_translation,
    decrypt,
    get_data_version_from_request,
    get_later_date,
    main_dir,
    replace_date_in_file,
)

bp = Blueprint("data", __name__, url_prefix="/data")

GEOJSON_FILES = {
    "state": "sc_state_population_simplified.json",
    "county": "tl_2024_sc_county_simplified.json",
    "zcta": "tl_2024_sc_zcta_simplified.json",
}
SPATIAL_UNITS = {"state", "region", "county", "zcta"}
DATA_DASHBOARDS = [
    "respiratory",
    "waste_water",
    "other_infectious_diseases",
    "opioid_hcv_hiv",
    "mhc",
]
UI_TO_DATA_DASHBOARD = {
    "respiratory": "respiratory",
    "wastewater": "waste_water",
    "outbreak-detection": "other_infectious_diseases",
    "opioid-hcv-hiv": "opioid_hcv_hiv",
    "mobile-health-clinics": "mhc",
}


def _dashboard_folder(dashboard):
    """Normalize UI dashboard names to the data directory names."""
    return UI_TO_DATA_DASHBOARD.get(dashboard) or (
        dashboard if dashboard in DATA_DASHBOARDS else None
    )


def _dashboard_ui_code(dashboard_folder):
    return dashboard_translation.get(dashboard_folder, dashboard_folder)


# Fetching
@bp.route("/map/<geographic_unit>", methods=["GET"])
@login_required
def map_data(geographic_unit):
    """Serve only the bundled GeoJSON boundaries used by the front end."""
    filename = GEOJSON_FILES.get(geographic_unit)
    if filename is None:
        abort(404)

    return send_file(
        os.path.join(current_app.root_path, "static", "assets", "GeoJSON", filename)
    )


@bp.route("/health-care-facility", methods=["GET"])
@login_required
def health_care_facility():
    file = os.path.join(
        current_app.config["DATADIR"],
        "supplementary",
        "Health Care Facilities",
        "hospital-cdap_mhc_partners.csv",
    )
    decrypt_key = os.path.join(
        current_app.config["DATADIR"],
        "supplementary",
        "Health Care Facilities",
        "encrypt_key.bin",
    )
    return decrypt(file, decrypt_key)


@bp.route("/respiratory/<region_size>/<disease>", methods=["GET"])
@login_required
def get_respiratory_hospitalizations(region_size="zcta", disease="covid-19"):
    # hospitalization data based on disease
    if region_size not in SPATIAL_UNITS:
        abort(404)

    data_version = get_data_version_from_request(request, current_user)
    file = os.path.join(
        current_app.config["DATADIR"],
        "processed",
        data_version,
        "respiratory",
        region_size,
        f"{disease}.json",
    )
    decrypt_key = os.path.join(
        current_app.config["DATADIR"],
        "processed",
        data_version,
        "respiratory",
        "encrypt_key.bin",
    )
    return decrypt(file, decrypt_key)


@bp.route("/respiratory/<region_size>/<disease>/extended", methods=["GET"])
@login_required
def get_all_respiratory_hospitalizations(region_size="zcta", disease="covid-19"):
    # hospitalization data based on disease
    if region_size not in SPATIAL_UNITS:
        abort(404)

    data_version = get_data_version_from_request(request, current_user)
    file = os.path.join(
        current_app.config["DATADIR"],
        "processed",
        data_version,
        "respiratory",
        region_size,
        f"{disease}.extended.json",
    )
    decrypt_key = os.path.join(
        current_app.config["DATADIR"],
        "processed",
        data_version,
        "respiratory",
        "encrypt_key.bin",
    )
    return decrypt(file, decrypt_key)


@bp.route(
    "/respiratory/model/<disease>/<geographic_unit>/<population>/<outcome_variable>/<location>/<data_version>",
    methods=["GET"],
)
@login_required
def get_respiratory_model(
    location,
    data_version,
    disease="covid_19",
    geographic_unit="region",
    population="state",
    outcome_variable="all_hospitalizations",
):
    """Return the pre-rendered model report for a selected option combination."""
    if data_version not in ALLOWED_DATA_VERSIONS:
        abort(404)

    outcome_variable_crosswalk = {
        "all_encounters": "Weekly_Encounters",
        "inpatient_hospitalizations": "Weekly_Inpatient_Hospitalizations",
        "emergency_department_visits": "Weekly_ED_Visits",
        "positive_tests": "Weekly_Positive_Tests",
        "rate_of_transmission": "rt",
        "all_hospitalizations": "Weekly_Hospitalizations",
        "attributable_ed_visits": "Weekly_Percent_ED",
    }
    model_outcome = outcome_variable_crosswalk.get(outcome_variable)
    if model_outcome is None:
        abort(404)

    file = os.path.join(
        current_app.config["DATADIR"],
        "processed",
        data_version,
        "model_reports",
        # "metrics",
        # geographic_unit,
        # "-".join(disease.upper().split("_")),
        f"{geographic_unit}-{disease}-{model_outcome}-{population}_{location}.html",
    )

    if not os.path.isfile(file):
        return render_template("respiratory/no-report.html"), 404

    return send_file(file)


@bp.route("/opioid-hcv-hiv/<disease>", methods=["GET"])
@login_required
def get_opioid_hcv_hiv(disease="opioid"):
    data_version = get_data_version_from_request(request, current_user)
    file = os.path.join(
        current_app.config["DATADIR"],
        "processed",
        data_version,
        "opioid_hcv_hiv",
        f"{disease}_zcta_hospitalization_data.json",
    )
    decrypt_key = os.path.join(
        current_app.config["DATADIR"],
        "processed",
        data_version,
        "opioid_hcv_hiv",
        "encrypt_key.bin",
    )

    return decrypt(file, decrypt_key)


@bp.route("/outbreak-detection/<region_size>/<column>", methods=["GET"])
@login_required
# def get_state_disease_hospitalizations(region_size='region', column='encounters'):
def get_state_disease_hospitalizations(
    region_size="region", column="all_hospitalizations"
):
    if region_size not in SPATIAL_UNITS:
        abort(404)

    data_version = get_data_version_from_request(request, current_user)
    file = os.path.join(
        current_app.config["DATADIR"],
        "processed",
        data_version,
        "other_infectious_diseases",
        region_size,
        f"{column}_data.json",
    )
    decrypt_key = os.path.join(
        current_app.config["DATADIR"],
        "processed",
        data_version,
        "other_infectious_diseases",
        "encrypt_key.bin",
    )
    return decrypt(file, decrypt_key)


@bp.route("/waste-water/<site>", methods=["GET"])
@login_required
def get_wastewater_data(site):

    data_version = get_data_version_from_request(request, current_user)
    file = os.path.join(
        current_app.config["DATADIR"],
        "processed",
        data_version,
        "waste_water",
        f"{site}.json",
    )
    decrypt_key = os.path.join(
        current_app.config["DATADIR"],
        "processed",
        data_version,
        "waste_water",
        "encrypt_key.bin",
    )
    return decrypt(file, decrypt_key)


@bp.route("/mobile-health-clinic-events", methods=["GET"])
@login_required
def get_mobile_health_clinic_events():
    data_version = get_data_version_from_request(request, current_user)
    file = os.path.join(
        current_app.config["DATADIR"],
        "processed",
        data_version,
        "mhc",
        "clemson_rural_health_event_data.json",
    )
    decrypt_key = os.path.join(
        current_app.config["DATADIR"],
        "processed",
        data_version,
        "mhc",
        "encrypt_key.bin",
    )
    return decrypt(file, decrypt_key)


@bp.route("/icon-pack/<type>", methods=["GET"])
def icon_data(type):
    if type not in ["png", "json", "svg"]:
        return "Unsupported file type", 400

    file_path = Path(main_dir) / "static" / "assets" / "Icons" / f"icon-pack.{type}"
    if not file_path.exists():
        return f"File not found: {file_path}", 404

    return send_file(file_path)


@bp.route("/icon/<type>", methods=["GET"])
def icon(type):
    icons_dir = Path(main_dir) / "static" / "assets" / "Icons"
    file_path = (icons_dir / f"{type}.svg").resolve()
    if icons_dir.resolve() not in file_path.parents or not file_path.exists():
        return f"Icon not found: {file_path}", 404

    return send_file(file_path)


### Data Approval ###
def data_approver_required(view):
    @functools.wraps(view)
    def wrapped_view(**kwargs):
        if not getattr(current_user, "data_approver", False):
            current_app.logger.info(
                f"{getattr(current_user, 'email', 'anonymous')} attempted to view admin page"
            )
            flash("Access Denied: Data approval access required")
            return redirect(url_for("index"))

        return view(**kwargs)

    return wrapped_view


def revert_respiratory_forecasting_report():
    dash_path = os.path.join(
        current_app.config["DATADIR"],
        "processed",
        "current",
        "model_reports",
    )

    previous_path = os.path.join(
        current_app.config["DATADIR"],
        "processed",
        "previous",
        "model_reports",
    )

    shutil.copytree(previous_path, dash_path, dirs_exist_ok=True)


def update_respiratory_forecasting_report():
    new_path = os.path.join(
        current_app.config["DATADIR"],
        "processed",
        "new",
        "model_reports",
    )

    dash_path = os.path.join(
        current_app.config["DATADIR"],
        "processed",
        "current",
        "model_reports",
    )

    previous_path = os.path.join(
        current_app.config["DATADIR"],
        "processed",
        "previous",
        "model_reports",
    )

    shutil.copytree(dash_path, previous_path, dirs_exist_ok=True)
    shutil.copytree(new_path, dash_path, dirs_exist_ok=True)


def get_date_respiratory_forecasting_report():
    forecasting_report_folder = (
        Path(current_app.config["DATADIR"]) / "processed" / "new" / "model_reports"
    )
    if not forecasting_report_folder.exists():
        return None

    # get latest file by creation time
    latest_file = max(
        (f for f in forecasting_report_folder.iterdir() if f.is_file()),
        key=lambda f: f.stat().st_mtime,
        default=None,
    )

    if latest_file is None:
        return None

    return datetime.fromtimestamp(latest_file.stat().st_mtime).strftime(
        "%Y-%m-%d %H:%M:%S"
    )


def get_update_data_date_by_version_dashboard(version, dashboard):
    if version not in ALLOWED_DATA_VERSIONS:
        return None

    forecasting_report_folder = (
        Path(current_app.config["DATADIR"]) / "processed" / version / dashboard
    )
    if not forecasting_report_folder.exists():
        return None

    # get latest file by creation time
    latest_file = max(
        (f for f in forecasting_report_folder.iterdir() if f.is_file()),
        key=lambda f: f.stat().st_mtime,
        default=None,
    )

    if latest_file is None:
        return None

    return datetime.fromtimestamp(latest_file.stat().st_mtime).strftime(
        "%Y-%m-%d %H:%M:%S"
    )


@bp.route("/change-version", methods=["PUT"])
@login_required
@data_approver_required
def change_version():
    payload = request.get_json(silent=True) or {}
    change = payload.get("change")
    dashboard = payload.get("dashboard")

    if change not in {"new", "previous"}:
        return "Unsupported version change", 400

    dashboard_folder = _dashboard_folder(dashboard)
    if dashboard_folder is None:
        current_app.logger.info(
            f"{current_user.email} attempted data change with invalid dashboard"
        )
        return "", 409

    dash_path = os.path.join(
        current_app.config["DATADIR"],
        "processed",
        "current",
        dashboard_folder,
    )

    if os.path.isdir(dash_path):
        previous_path = os.path.join(
            current_app.config["DATADIR"],
            "processed",
            "previous",
            dashboard_folder,
        )

        if change == "new":
            new_path = os.path.join(
                current_app.config["DATADIR"],
                "processed",
                "new",
                dashboard_folder,
            )
            if not os.path.isdir(new_path):
                return "", 409

            shutil.copytree(dash_path, previous_path, dirs_exist_ok=True)
            shutil.copytree(new_path, dash_path, dirs_exist_ok=True)

            current_app.logger.info(
                f"{current_user.email} approved new data for {dashboard}"
            )

            if dashboard_folder == "respiratory":
                update_respiratory_forecasting_report()

        if change == "previous":
            if not os.path.isdir(previous_path):
                return "", 409

            shutil.copytree(previous_path, dash_path, dirs_exist_ok=True)

            if dashboard_folder == "respiratory":
                revert_respiratory_forecasting_report()

            current_app.logger.info(
                f"{current_user.email} reverted data for {dashboard}"
            )
    else:
        current_app.logger.info(
            f"{current_user.email} attempted data change with invalid dashboard"
        )
        return "", 409

    return "", 200


@bp.route("/get-date/<data_version>/<dashboard>", methods=["GET"])
@login_required
@data_approver_required
def send_data_date(data_version, dashboard):
    date_s = get_data_date(data_version, dashboard)

    if date_s is None:
        return (
            f"Date(s) not found for {dashboard} dashboard and {data_version} data version",
            404,
        )

    return date_s


@bp.route("/respiratory/changed_files", methods=["GET"])
@login_required
@data_approver_required
def send_respiratory_file_changes():
    def find_path(line):
        path = line.split(" and ")[0].strip()
        path = path.removeprefix("Only in ").removeprefix("Files ")

        parts = path.split("/")
        if "respiratory" not in parts:
            return path

        index = parts.index("respiratory")
        return "/".join(parts[index + 1 :])

    file = os.path.join(
        current_app.config["DATADIR"],
        "processed",
        "new",
        "respiratory",
        "respiratory_changes.txt",
    )

    if not os.path.exists(file):
        return {"Changed Files": [], "New Files": [], "Deleted Files": []}

    with open(file, "r", encoding="utf-8") as f:
        changes = f.readlines()
        additions = []
        deletions = []
        changed_files = []
        for line in changes:
            if line.startswith("Only in"):
                if "backup" in line:
                    deletions.append(find_path(line))
                else:
                    additions.append(find_path(line))
            elif line.startswith("Files"):
                changed_files.append(find_path(line))
    return {
        "Changed Files": changed_files,
        "New Files": additions,
        "Deleted Files": deletions,
    }


def get_data_date(data_version, dashboard):
    """Return update timestamps for one or more dashboard data folders."""
    all_data_versions = ["new", "current", "previous"]

    if data_version != "all" and data_version not in ALLOWED_DATA_VERSIONS:
        return None
    if dashboard != "all" and _dashboard_folder(dashboard) is None:
        return None

    versions = all_data_versions if data_version == "all" else [data_version]
    dashboards = (
        DATA_DASHBOARDS if dashboard == "all" else [_dashboard_folder(dashboard)]
    )

    output = {}
    for dash in dashboards:
        ui_code = _dashboard_ui_code(dash)
        output[ui_code] = {
            ver: get_update_data_date_by_version_dashboard(ver, dash)
            for ver in versions
        }

    respiratory_dates = output.get("respiratory")
    if respiratory_dates and "new" in respiratory_dates:
        respiratory_forcasting_update_date = get_date_respiratory_forecasting_report()
        new_date = get_later_date(
            respiratory_forcasting_update_date, respiratory_dates["new"]
        )

        if (
            new_date
            and respiratory_dates["new"]
            and respiratory_dates["new"].strip() != new_date
        ):
            replace_date_in_file(
                os.path.join(
                    current_app.config["DATADIR"],
                    "processed",
                    "new",
                    "respiratory",
                    "date.txt",
                ),
                respiratory_dates["new"],
                new_date,
            )
            respiratory_dates["new"] = new_date
        else:
            respiratory_dates["new"] = new_date

    return output
