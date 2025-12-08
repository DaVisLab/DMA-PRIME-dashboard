import sys
from Cryptodome.Cipher import AES
from base64 import b64decode
import json

from supporting_files.utility import * 

if len(sys.argv) != 4:

    print("Usage: python3 encrypt.py <secret_key_file> <input_file> <output_file>")

    sys.exit(1)

with open(sys.argv[1], 'rb') as f:
    key = f.read()

try:

    with open(sys.argv[2], 'r') as f:
        input = json.load(f)

    keys = [ 'nonce', 'header', 'ciphertext', 'tag' ]
    values = {k:b64decode(input[k]) for k in keys}

    cipher = AES.new(key, AES.MODE_GCM, nonce=values['nonce'])
    cipher.update(values['header'])
    plaintext = cipher.decrypt_and_verify(values['ciphertext'], values['tag'])

    with open(get_file_descriptor(sys.argv[3]), 'w') as f:
        json.dump(json.loads(plaintext), f)

except (ValueError, KeyError) as e:

    print("Incorrect decryption")
    print(e)
