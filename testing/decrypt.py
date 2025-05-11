import sys
from Cryptodome.Cipher import AES
from base64 import b64decode
import json

if len(sys.argv) != 4:

    print("Usage: python3 encrypt.py <secret_key_file> <input_file> <output_file>")

    sys.exit(1)

with open(sys.argv[1], 'rb') as f:
    key = f.read()

try:
    with open(sys.argv[2], 'r') as f:
        input = json.load(f)

    keys = [ 'nonce' , 'ciphertext', 'tag' ]
    values = {k:b64decode(input[k]) for k in keys}

    cipher = AES.new(key, AES.MODE_GCM, nonce=values['nonce'])
    plaintext = cipher.decrypt_and_verify(values['ciphertext'], values['tag'])

    with open(sys.argv[3], 'w+') as f:
        json.dump(json.loads(plaintext), f)
    
except (ValueError, KeyError):
    print("Incorrect decryption")