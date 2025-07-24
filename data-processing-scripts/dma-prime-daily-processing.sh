#!/bin/bash

#SBATCH --job-name DMA-PRIME-data-processing
#SBATCH --partition=dmaprime
#SBATCH --nodes 1
#SBATCH --ntasks 1
#SBATCH --cpus-per-task 1
#SBATCH --mem 4gb
#SBATCH --time 02:00:00
#SBATCH --output=/dev/null
#SBATCH --error=/dev/null

### Setup ###
cd /project/liorr/dmaprime/visualization_data/scripts

# setup logging
errors=0

log_file="logs/output_log_$(printf '%(%Y-%m-%d)T\n' -1).txt"
touch "$log_file"
echo "Logs from daily data processing on $(printf '%(%Y-%m-%d)T\n' -1)" > $log_file

updated_dashboards=0
lior_file="lior.txt"
touch "$lior_file"
echo "Report of data processing - $(printf '%(%Y-%m-%d)T\n' -1)" > $lior_file
echo "Visit dmaprime.clemson.edu/data-approval to preview and approve data." >> $lior_file
echo "Dashboards updated:" >> $lior_file

# write new key
/project/liorr/dmaprime/visualization_data/scripts/.venv/bin/python << EOF
import secrets
with open("/project/liorr/dmaprime/visualization_data/download/supplementary/encrypt_key.bin", "wb") as f:
    f.write(secrets.randbits(256).to_bytes(32, 'big'))
EOF

### process each dashboard ###
echo "---Processing Dashboards---" >> $log_file

# most recent backup
latest_backup=$(ls -td ../backup/* | head -1)

# Mobile Health Clinics
echo "Mobile Health Clinics" >> $log_file
# must process data first because this is how new data is pulled down to compare to
# process data
/project/liorr/dmaprime/visualization_data/scripts/.venv/bin/python /project/liorr/dmaprime/visualization_data/scripts/process_mhc.py &>> $log_file
if [ $? -ne 0 ]; then # error during processing
    ((errors++))
else # successful processing, see if new data
    diff -r --brief $latest_backup/aggregated/mhc ../aggregated/mhc # compare
    if [[ $? -ne 0 ]]; then # new data!
        # encrypt
        /project/liorr/dmaprime/visualization_data/scripts/.venv/bin/python encrypt.py "/project/liorr/dmaprime/visualization_data/download/supplementary/encrypt_key.bin" "/project/liorr/dmaprime/visualization_data/processed/mhc" "/project/liorr/dmaprime/visualization_data/download/processed/mhc" &>> $log_file
        # copy encryption key
        cp /project/liorr/dmaprime/visualization_data/download/supplementary/encrypt_key.bin /project/liorr/dmaprime/visualization_data/download/processed/mhc/
        # update date of last change file
        printf '%(%Y-%m-%d)T\n' -1 > /project/liorr/dmaprime/visualization_data/download/processed/mhc/date.txt
        
        # logging
        echo "Success" >> $log_file
        
        ((updated_dashboards++))
        echo "Mobile Health Clinics" >> $lior_file
    else
        echo "No changes in Mobile Health Clinics" >> $log_file
    fi
fi
echo >> $log_file

# Opioid, HCV, HIV
echo "Opioid, HCV, HIV" >> $log_file
diff -r --brief $latest_backup/aggregated/opioid_hcv_hiv ../aggregated/opioid_hcv_hiv
if [[ $? -ne 0 ]]; then # new data!
    # process data
    /project/liorr/dmaprime/visualization_data/scripts/.venv/bin/python /project/liorr/dmaprime/visualization_data/scripts/process_opioid_hcv_hiv.py &>> $log_file
    if [ $? -ne 0 ]; then # error during processing
        ((errors++))
    else # successful processing
        # encrypt
        /project/liorr/dmaprime/visualization_data/scripts/.venv/bin/python encrypt.py "/project/liorr/dmaprime/visualization_data/download/supplementary/encrypt_key.bin" "/project/liorr/dmaprime/visualization_data/processed/opioid_hcv_hiv" "/project/liorr/dmaprime/visualization_data/download/processed/opioid_hcv_hiv" &>> $log_file
        # copy encryption key
        cp /project/liorr/dmaprime/visualization_data/download/supplementary/encrypt_key.bin /project/liorr/dmaprime/visualization_data/download/processed/opioid_hcv_hiv/
        # update date of last change file
        printf '%(%Y-%m-%d)T\n' -1 > /project/liorr/dmaprime/visualization_data/download/processed/opioid_hcv_hiv/date.txt
        
        # logging
        echo "Success" >> $log_file
        
        ((updated_dashboards++))
        echo "Opioid, HCV, HIV" >> $lior_file
    fi
else
    echo "No changes in Opioid, HCV, HIV" >> $log_file
fi
echo >> $log_file


# Disease Outbreak (Other Infectious Diseases)
echo "Disease Outbreak" >> $log_file
diff -r --brief $latest_backup/aggregated/other_diseases ../aggregated/other_diseases
if [[ $? -ne 0 ]]; then # new data!
    # process data
    /project/liorr/dmaprime/visualization_data/scripts/.venv/bin/python /project/liorr/dmaprime/visualization_data/scripts/process_other_infectious_diseases_data.py &>> $log_file
    if [ $? -ne 0 ]; then # error during processing
        ((errors++))
    else # successful processing
        # encrypt
        /project/liorr/dmaprime/visualization_data/scripts/.venv/bin/python encrypt.py "/project/liorr/dmaprime/visualization_data/download/supplementary/encrypt_key.bin" "/project/liorr/dmaprime/visualization_data/processed/other_infectious_diseases" "/project/liorr/dmaprime/visualization_data/download/processed/other_infectious_diseases" &>> $log_file
        # copy encryption key
        cp /project/liorr/dmaprime/visualization_data/download/supplementary/encrypt_key.bin /project/liorr/dmaprime/visualization_data/download/processed/other_infectious_diseases/
        # update date of last change file
        printf '%(%Y-%m-%d)T\n' -1 > /project/liorr/dmaprime/visualization_data/download/processed/other_infectious_diseases/date.txt
        
        # logging
        echo "Success" >> $log_file
        
        ((updated_dashboards++))
        echo "Disease Outbreak" >> $lior_file
    fi
else
    echo "No changes in disease outbreak" >> $log_file
fi
echo >> $log_file


# Respiratory
echo "Respiratory" >> $log_file
diff -r --brief $latest_backup/aggregated/respiratory ../aggregated/respiratory
if [[ $? -ne 0 ]]; then # new data!
    # process data
    /project/liorr/dmaprime/visualization_data/scripts/.venv/bin/python /project/liorr/dmaprime/visualization_data/scripts/process_respiratory_hospitalizations.py &>> $log_file
    if [ $? -ne 0 ]; then # error during processing
        ((errors++))
    else # successful processing
        # encrypt
        /project/liorr/dmaprime/visualization_data/scripts/.venv/bin/python encrypt.py "/project/liorr/dmaprime/visualization_data/download/supplementary/encrypt_key.bin" "/project/liorr/dmaprime/visualization_data/processed/respiratory" "/project/liorr/dmaprime/visualization_data/download/processed/respiratory" &>> $log_file
        # copy encryption key
        cp /project/liorr/dmaprime/visualization_data/download/supplementary/encrypt_key.bin /project/liorr/dmaprime/visualization_data/download/processed/respiratory/
        # update date of last change file
        printf '%(%Y-%m-%d)T\n' -1 > /project/liorr/dmaprime/visualization_data/download/processed/respiratory/date.txt
        
        # logging
        echo "Success" >> $log_file
        
        ((updated_dashboards++))
        echo "Respiratory" >> $lior_file
    fi
else
    echo "No changes in respiratory" >> $log_file
fi
echo >> $log_file


# Wastewater
echo "Wastewater" >> $log_file
echo "Getting waste water data from box" >> $log_file
./globus-http-linux-amd64-0.1.2 -config "supporting_files/config.toml" download "https://g-471022.581c1.0ec8.data.globus.org/CDC_running_data_4plot.xlsx" ../aggregated/waste_water/CDC_running_data_4plot.xlsx &>> $log_file
if [ $? -ne 0 ]; then
    ((errors++))
    echo "error downloading wastewater data"
fi
diff -r --brief $latest_backup/aggregated/waste_water ../aggregated/waste_water
if [[ $? -ne 0 ]]; then # new data!
    # process data
    /project/liorr/dmaprime/visualization_data/scripts/.venv/bin/python /project/liorr/dmaprime/visualization_data/scripts/process_waste_water_data.py &>> $log_file
    if [ $? -ne 0 ]; then # error during processing
        ((errors++))
    else # successful processing
        # encrypt
        /project/liorr/dmaprime/visualization_data/scripts/.venv/bin/python encrypt.py "/project/liorr/dmaprime/visualization_data/download/supplementary/encrypt_key.bin" "/project/liorr/dmaprime/visualization_data/processed/waste_water" "/project/liorr/dmaprime/visualization_data/download/processed/waste_water" &>> $log_file
        # copy encryption key
        cp /project/liorr/dmaprime/visualization_data/download/supplementary/encrypt_key.bin /project/liorr/dmaprime/visualization_data/download/processed/waste_water/
        # update date of last change file
        printf '%(%Y-%m-%d)T\n' -1 > /project/liorr/dmaprime/visualization_data/download/processed/waste_water/date.txt

        # logging
        echo "Success" >> $log_file
        
        ((updated_dashboards++))
        echo "Wastewater" >> $lior_file
    fi
else
    echo "No changes in wastewater" >> $log_file
fi
echo >> $log_file


### backup ###
echo "Backing Up" >> $log_file
backup_dir="/project/liorr/dmaprime/visualization_data/backup/$(printf '%(%Y-%m-%d)T\n' -1)"

mkdir $backup_dir

cp -rp "/project/liorr/dmaprime/visualization_data/raw" $backup_dir &>> $log_file
cp -rp "/project/liorr/dmaprime/visualization_data/aggregated" $backup_dir &>> $log_file

#mkdir -p "$backup_dir/aggregated/waste_water"
#cp -rp "/project/liorr/dmaprime/visualization_data/aggregated/waste_water/CDC_running_data_4plot.xlsx" "$backup_dir/aggregated/waste_water/CDC_running_data_4plot.xlsx" &>> $log_file

#cp -rp "/project/liorr/dmaprime/visualization_data/aggregated/other_diseases" "$backup_dir/aggregated/" &>> $log_file

#cp -rp "/project/liorr/dmaprime/visualization_data/aggregated/respiratory" "$backup_dir/aggregated/" &>> $log_file


### Email Results ###
echo "Num errors: $errors" >> $log_file
# if [[ $errors -gt 0 ]]; then
    python3 sendmail.py gausten@clemson.edu "DMA-PRIME Data Processing Log" "$(cat $log_file)"
# fi

if [[ $updated_dashboards -gt 0 ]]; then
    python3 sendmail.py liorr@clemson.edu "DMA-PRIME Data Processing Report" "$(cat $lior_file)"
fi

