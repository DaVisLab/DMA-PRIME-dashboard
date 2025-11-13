import sys
from Cryptodome.Cipher import AES
from base64 import b64decode
from io import StringIO
import json

from flask import current_app, Response
from flask_login import current_user

main_dir = "/".join(__file__.split("\\")[:-1])

dashboard_translation = {
        # js to python
        'respiratory': 'respiratory',
        'wastewater': 'waste_water',
        'outbreak-detection': 'other_infectious_diseases',
        'opioid-hcv-hiv': 'opioid_hcv_hiv',
        'mobile-health-clinics': 'mhc',

        # python to js
        'waste_water': 'wastewater',
        'other_infectious_diseases': 'outbreak-detection',
        'opioid_hcv_hiv': 'opioid-hcv-hiv',
        'mhc': 'mobile-health-clinics',
    }

def decrypt(file_name, encrypt_key):
    current_app.logger.info(f'{current_user.email} accessed {file_name}')

    with open(encrypt_key, 'rb') as f:
        key = f.read()

    try:
        with open(file_name, 'r') as f:
            input = json.load(f)

        keys = [ 'nonce', 'header', 'ciphertext', 'tag' ]
        values = {k:b64decode(input[k]) for k in keys}

        cipher = AES.new(key, AES.MODE_GCM, nonce=values['nonce'])
        cipher.update(values['header'])
        plaintext = cipher.decrypt_and_verify(values['ciphertext'], values['tag'])

        if values['header'] == b'.csv':
            ioText = StringIO(plaintext.decode('utf-8'))
            return Response(ioText, mimetype='text/csv')
        
        if values['header'] == b'.html':
            return plaintext.decode('utf-8')

        return json.loads(plaintext)
        
    except (ValueError, KeyError) as e:
        current_app.logger.error("Incorrect decryption of ", file_name)
        raise e
    
def get_data_version_from_request(request, current_user, error='silent'):
    data_version = request.args.get('data_version')

    if data_version is None:
        data_version = 'current'

    if data_version is not 'current' and not current_user.data_approver:
        current_app.logger.info(f'{current_user.email} attempted to view a dashboard data preview page')
        data_version = 'current'

    return data_version
