import json
from base64 import b64decode
from Cryptodome.Cipher import AES

with open("test_key.bin", "rb") as f:
    key = f.read()

try:
    with open("encoded2.json", "r") as f:
        b64 = json.load(f)
        json_k = [ 'nonce' , 'ciphertext', 'tag' ]
        jv = {k:b64decode(b64[k]) for k in json_k}
        cipher = AES.new(key, AES.MODE_GCM, nonce=jv['nonce'])
        plaintext = cipher.decrypt_and_verify(jv['ciphertext'], jv['tag'])
    
    with open("metadata_decrypted.json", "w+") as f:
        json.dump(json.loads(plaintext), f)
        
        print("The message was: " + plaintext.decode('utf-8'))
         
except (ValueError, KeyError):
    print("Incorrect decryption")
