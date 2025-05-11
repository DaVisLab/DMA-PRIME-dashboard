import sys
from pathlib import Path
from Cryptodome.Cipher import AES
from base64 import b64encode
import json

if len(sys.argv) != 4:

    print("Usage: python3 encrypt.py <secret_key_file> <input_dir> <output_dir>")

    sys.exit(1)

with open(sys.argv[1], 'rb') as f:
    key = f.read()

p = Path(sys.argv[2])

for file in list(p.glob('**/*.*')):
    with open(file, 'rb') as f:
        input = f.read()

    header = file.suffix.encode("utf-8")
    if file.suffix != ".json":
        print(file)

    cipher = AES.new(key, AES.MODE_GCM)
    cipher.update(header)
    ciphertext, tag = cipher.encrypt_and_digest(input)

    output_keys = [ 'nonce', 'header', 'ciphertext', 'tag' ]
    output_values = [ b64encode(x).decode('utf-8') for x in (cipher.nonce, header, ciphertext, tag) ]

    out_file = Path(sys.argv[3]) / file.relative_to(p)
    out_file.parent.mkdir(parents=True, exist_ok=True)
    with open(out_file, 'w+') as f:
        json.dump(dict(zip(output_keys, output_values)), f)

# with open(sys.argv[2], 'rb') as f:
#     input = f.read()

# cipher = AES.new(key, AES.MODE_GCM)
# ciphertext, tag = cipher.encrypt_and_digest(input)

# output_keys = [ 'nonce' , 'ciphertext', 'tag' ]
# output_values = [ b64encode(x).decode('utf-8') for x in (cipher.nonce, ciphertext, tag) ]

# with open(sys.argv[3], 'w+') as f:
#     json.dump(dict(zip(output_keys, output_values)), f)
