import sys
from Cryptodome.Cipher import AES
from base64 import b64decode
from io import StringIO
import json

from flask import current_app, Response
from flask_login import current_user

main_dir = "/".join(__file__.split("\\")[:-1])

def decrypt(file_name):
    current_app.logger.info(f'{current_user.email} accessed {file_name}')

    with open(f'{current_app.config['DATADIR']}/supplementary/encrypt_key.bin', 'rb') as f:
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


        return json.loads(plaintext)
        
    except (ValueError, KeyError) as e:
        current_app.logger.error("Incorrect decryption of ", file_name)
        raise e