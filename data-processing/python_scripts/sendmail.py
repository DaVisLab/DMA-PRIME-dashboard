# Script provided by Doug Dawson

import datetime
import sys
from smtplib import SMTP

if len(sys.argv) != 4:
    print("Usage: python3 sendmail.py <to_address> <subject> <body>")
    sys.exit(1)

to_address = sys.argv[1]
subject = sys.argv[2]
body = sys.argv[3]
from_address = "Palmetto 2 no-reply@clemson.edu"


smtp = SMTP()
smtp.connect("smtp-out.clemson.edu", 25)

message = f"From: {from_address}\nTo: {to_address}\nSubject: {subject}\n\n{body}"

smtp.sendmail(from_address, to_address, message)
smtp.quit()
