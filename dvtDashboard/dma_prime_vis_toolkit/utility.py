from base64 import b64decode
from io import StringIO
import json
import pickle
from pathlib import Path
import datetime

from Cryptodome.Cipher import AES
from flask import current_app, Response
from flask_login import current_user

PACKAGE_ROOT = Path(__file__).resolve().parent
main_dir = str(PACKAGE_ROOT)
ALLOWED_DATA_VERSIONS = {"current", "new", "previous"}

dashboard_translation = {
    # js to python
    "respiratory": "respiratory",
    "wastewater": "waste_water",
    "outbreak-detection": "other_infectious_diseases",
    "opioid-hcv-hiv": "opioid_hcv_hiv",
    "mobile-health-clinics": "mhc",
    # python to js
    "waste_water": "wastewater",
    "other_infectious_diseases": "outbreak-detection",
    "opioid_hcv_hiv": "opioid-hcv-hiv",
    "mhc": "mobile-health-clinics",
}


def decrypt(file_name, encrypt_key):
    """Decrypt an encrypted dashboard asset and return JSON, CSV, or HTML content."""
    user_email = getattr(current_user, "email", "anonymous")
    current_app.logger.info("%s accessed %s", user_email, file_name)

    with open(encrypt_key, "rb") as f:
        key = f.read()

    try:
        with open(file_name, "r") as f:
            encrypted_payload = json.load(f)

        keys = ["nonce", "header", "ciphertext", "tag"]
        values = {k: b64decode(encrypted_payload[k]) for k in keys}

        cipher = AES.new(key, AES.MODE_GCM, nonce=values["nonce"])
        cipher.update(values["header"])
        plaintext = cipher.decrypt_and_verify(values["ciphertext"], values["tag"])

        if values["header"] == b".csv":
            ioText = StringIO(plaintext.decode("utf-8"))
            return Response(ioText, mimetype="text/csv")

        if values["header"] == b".html":
            return plaintext.decode("utf-8")

        return json.loads(plaintext)

    except (ValueError, KeyError) as e:
        current_app.logger.exception("Incorrect decryption of %s", file_name)
        raise e


def get_data_version_from_request(request, current_user, error="silent"):
    """Return a whitelisted data version, limiting previews to data approvers."""
    data_version = request.args.get("data_version")

    if data_version is None:
        data_version = "current"

    if data_version not in ALLOWED_DATA_VERSIONS:
        current_app.logger.info(
            "%s requested invalid data version %s",
            getattr(current_user, "email", "anonymous"),
            data_version,
        )
        if error == "raise":
            raise ValueError(f"Invalid data version: {data_version}")
        data_version = "current"

    if data_version != "current" and not getattr(current_user, "data_approver", False):
        current_app.logger.info(
            "%s attempted to view a dashboard data preview page",
            getattr(current_user, "email", "anonymous"),
        )
        data_version = "current"

    return data_version


def get_later_date(date1, date2):
    """Compare dashboard timestamp strings while tolerating missing dates."""
    if not date1:
        return date2.strip() if date2 else None
    if not date2:
        return date1.strip()

    d1 = datetime.datetime.strptime(date1.strip(), "%Y-%m-%d %H:%M:%S")
    d2 = datetime.datetime.strptime(date2.strip(), "%Y-%m-%d %H:%M:%S")

    return date1.strip() if d1 > d2 else date2.strip()


def replace_date_in_file(file_path, old_value, new_value):
    """Replace a stored dashboard date only after the replacement value is known."""
    if not old_value or not new_value:
        return

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    content = content.replace(old_value, new_value)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)


def load_pickle(path):
    """Load trusted, bundled pickle assets such as the predefined knowledge graph."""
    with open(path, "rb") as f:
        return pickle.load(f)
