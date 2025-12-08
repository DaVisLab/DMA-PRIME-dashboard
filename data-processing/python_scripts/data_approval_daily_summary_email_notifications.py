from datetime import datetime
import subprocess
import sys

from supporting_files.utility import *


if len(sys.argv) != 2:
    print("Usage: python3 data_approval_daily_summary_email_notifications.py file")
    sys.exit(1)

file = sys.argv[1]
from_address = "Palmetto 2 no-reply@clemson.edu"

current_datetime = datetime.now()

recipients = [
    'liorr@clemson.edu',
    'gausten@g.clemson.edu',
    'ambleic@clemson.edu',
    'eserman@clemson.edu'
]

# only send email on weekends
if current_datetime.weekday() < 5:
    dashboards = set()

    # daily recap sent out @ 4pm
    if current_datetime.hour == 16:
        try:
            with open(file, 'r') as f:
                for line in f:
                    dashboards.add(line.strip())

            if len(dashboards):
                message = '\n'.join([f'Report of data processing - {current_datetime.strftime("%b %d, %Y")}\n',
                'Dashboards with new data today:\n'])
                for dash in dashboards:
                    message += f'{dash}\n'
                for email in recipients:
                    subprocess.run([f'{scripts_dir}/.venv/bin/python', 
                                    f'{scripts_dir}/python_scripts/sendmail.py', 
                                    email, 
                                    'DMA-PRIME Data Processing Report', 
                                    message],
                                    stderr = subprocess.STDOUT) 
        except Exception as e:
            print("error", e)
            sys.exit(1)
            
    else:
        sys.exit(1)

else:
    sys.exit(1)
