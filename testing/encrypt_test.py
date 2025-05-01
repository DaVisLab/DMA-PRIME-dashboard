import json
from base64 import b64encode
from Cryptodome.Cipher import AES
from Cryptodome.Random import get_random_bytes

with open("c:/Users/Grace/Documents/CDC Project/download/processed/respiratory/metadata.json", "rb") as f:
    data = f.read()
# header = b"header"
# data = b"secret"
key = get_random_bytes(16)
with open("test_key.bin", "wb") as f:
    f.write(key)

cipher = AES.new(key, AES.MODE_GCM)
# cipher.update(header)
ciphertext, tag = cipher.encrypt_and_digest(data)

json_k = [ 'nonce' , 'ciphertext', 'tag' ]
json_v = [ b64encode(x).decode('utf-8') for x in (cipher.nonce, ciphertext, tag) ]
with open("encoded.json", "w+") as f:
    result = json.dump(dict(zip(json_k, json_v)), f)