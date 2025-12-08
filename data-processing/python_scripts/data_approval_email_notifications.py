from datetime import datetime
import subprocess
import sys

from supporting_files.utility import *


if len(sys.argv) != 3:
    print("Usage: python3 data_approval_email_notifications.py datetime checkpoint_file")
    sys.exit(1)

bash_datetime = sys.argv[1]
file = sys.argv[2]
from_address = "Palmetto 2 no-reply@clemson.edu"

current_datetime = datetime.now()

recipients = [
    'ambleic@clemson.edu',
    'eserman@clemson.edu'
]

# only send email on weekends
if current_datetime.weekday() < 5:
    dashboards = set()

    # checkpoint emails - run at 9, 12, and 3
    if current_datetime.hour in [9, 12, 15]:
        try:
            with open(file, 'r') as f:
                for line in f:
                    dashboards.add(line.strip())

            if len(dashboards):
                message = '\n'.join([f'Report of data processing - {bash_datetime}',
                'Visit dmaprime.clemson.edu/data-approval to preview and approve data. Note that data transfer may take up to one hour to complete.\n',
                'Dashboards updated:\n'])
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

