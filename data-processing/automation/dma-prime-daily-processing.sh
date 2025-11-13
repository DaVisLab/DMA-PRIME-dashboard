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
visualization_data_dir="/project/liorr/dmaprime/visualization_data"

cd $visualization_data_dir/scripts/automation

# setup logging
errors=0

log_file="$visualization_data_dir/scripts/logs/output_log_$(printf '%(%Y-%m-%d %H:%M)T\n' -1).txt"
touch "$log_file"
echo "Logs from data processing on $(printf '%(%Y-%m-%d %H:%M)T\n' -1)" > "$log_file"

updated_dashboards=0
lior_file="lior.txt"
touch "$lior_file"
echo "Report of data processing - $(printf '%(%Y-%m-%d %H:%M)T\n' -1)" > $lior_file
echo "Visit dmaprime.clemson.edu/data-approval to preview and approve data." >> $lior_file
echo "Dashboards updated:" >> $lior_file

# write new key
$visualization_data_dir/scripts/.venv/bin/python << EOF
import secrets
with open("$visualization_data_dir/download/supplementary/encrypt_key.bin", "wb") as f:
    f.write(secrets.randbits(256).to_bytes(32, 'big'))
EOF

### process each dashboard ###
echo "---Processing Dashboards---" >> "$log_file"

# most recent backup
function get_latest_backup() {
    echo $(find $visualization_data_dir/backup/* -maxdepth 0 -type d ! -newer $visualization_data_dir/download/processed/$1/date.txt -print0 | xargs -0 ls -td | head -1)
}

# Mobile Health Clinics
echo "Mobile Health Clinics" >> "$log_file"
# must process data first because this is how new data is pulled down to compare to
# process data
$visualization_data_dir/scripts/.venv/bin/python $visualization_data_dir/scripts/python_scripts/process_mhc.py &>> "$log_file"
if [ $? -ne 0 ]; then # error during processing
    ((errors++))
else # successful processing, see if new data
    diff -r --brief "$(get_latest_backup mhc)"/aggregated/mhc $visualization_data_dir/aggregated/mhc # compare
    if [[ $? -ne 0 ]]; then # new data!
        # encrypt
        $visualization_data_dir/scripts/.venv/bin/python $visualization_data_dir/scripts/python_scripts/encrypt.py "$visualization_data_dir/download/supplementary/encrypt_key.bin" "$visualization_data_dir/processed/mhc" "$visualization_data_dir/download/processed/mhc" &>> "$log_file"
        # copy encryption key
        cp $visualization_data_dir/download/supplementary/encrypt_key.bin $visualization_data_dir/download/processed/mhc/
        # update date of last change file
        printf '%(%Y-%m-%d %H:%M)T\n' -1 > $visualization_data_dir/download/processed/mhc/date.txt
        
        # logging
        echo "Success" >> "$log_file"
        
        ((updated_dashboards++))
        echo "Mobile Health Clinics" >> $lior_file
    else
        echo "No changes in Mobile Health Clinics" >> "$log_file"
    fi
fi
echo >> "$log_file"

# Opioid, HCV, HIV
echo "Opioid, HCV, HIV" >> "$log_file"
diff -r --brief "$(get_latest_backup opioid_hcv_hiv)"/aggregated/opioid_hcv_hiv $visualization_data_dir/aggregated/opioid_hcv_hiv
if [[ $? -ne 0 ]]; then # new data!
    # process data
    $visualization_data_dir/scripts/.venv/bin/python $visualization_data_dir/scripts/python_scripts/process_opioid_hcv_hiv.py &>> "$log_file"
    if [ $? -ne 0 ]; then # error during processing
        ((errors++))
    else # successful processing
        # encrypt
        $visualization_data_dir/scripts/.venv/bin/python $visualization_data_dir/scripts/python_scripts/encrypt.py "$visualization_data_dir/download/supplementary/encrypt_key.bin" "$visualization_data_dir/processed/opioid_hcv_hiv" "$visualization_data_dir/download/processed/opioid_hcv_hiv" &>> "$log_file"
        # copy encryption key
        cp $visualization_data_dir/download/supplementary/encrypt_key.bin $visualization_data_dir/download/processed/opioid_hcv_hiv/
        # update date of last change file
        printf '%(%Y-%m-%d %H:%M)T\n' -1 > $visualization_data_dir/download/processed/opioid_hcv_hiv/date.txt
        
        # logging
        echo "Success" >> "$log_file"
        
        ((updated_dashboards++))
        echo "Opioid, HCV, HIV" >> $lior_file
    fi
else
    echo "No changes in Opioid, HCV, HIV" >> "$log_file"
fi
echo >> "$log_file"


# Disease Outbreak (Other Infectious Diseases)
echo "Disease Outbreak" >> "$log_file"
diff -r --brief "$(get_latest_backup other_infectious_diseases)"/aggregated/other_diseases $visualization_data_dir/aggregated/other_diseases
if [[ $? -ne 0 ]]; then # new data!
    # process data
    $visualization_data_dir/scripts/.venv/bin/python $visualization_data_dir/scripts/python_scripts/process_other_infectious_diseases_data.py &>> "$log_file"
    if [ $? -ne 0 ]; then # error during processing
        ((errors++))
    else # successful processing
        # encrypt
        $visualization_data_dir/scripts/.venv/bin/python $visualization_data_dir/scripts/python_scripts/encrypt.py "$visualization_data_dir/download/supplementary/encrypt_key.bin" "$visualization_data_dir/processed/other_infectious_diseases" "$visualization_data_dir/download/processed/other_infectious_diseases" &>> "$log_file"
        # copy encryption key
        cp $visualization_data_dir/download/supplementary/encrypt_key.bin $visualization_data_dir/download/processed/other_infectious_diseases/
        # update date of last change file
        printf '%(%Y-%m-%d %H:%M)T\n' -1 > $visualization_data_dir/download/processed/other_infectious_diseases/date.txt
        
        # logging
        echo "Success" >> "$log_file"
        
        ((updated_dashboards++))
        echo "Disease Outbreak" >> $lior_file
    fi
else
    echo "No changes in disease outbreak" >> "$log_file"
fi
echo >> "$log_file"


# Respiratory
echo "Respiratory" >> "$log_file"
diff -r --brief "$(get_latest_backup respiratory)"/aggregated/respiratory $visualization_data_dir/aggregated/respiratory &> respiratory_changes.txt
if [[ $? -ne 0 ]]; then # new data!
    # process data
    $visualization_data_dir/scripts/.venv/bin/python $visualization_data_dir/scripts/python_scripts/process_respiratory_hospitalizations.py &>> "$log_file"
    if [ $? -ne 0 ]; then # error during processing
        ((errors++))
    else # successful processing
        # encrypt
        $visualization_data_dir/scripts/.venv/bin/python $visualization_data_dir/scripts/python_scripts/encrypt.py "$visualization_data_dir/download/supplementary/encrypt_key.bin" "$visualization_data_dir/processed/respiratory" "$visualization_data_dir/download/processed/respiratory" &>> "$log_file"
        # copy encryption key
        cp $visualization_data_dir/download/supplementary/encrypt_key.bin $visualization_data_dir/download/processed/respiratory/
        # update date of last change file
        printf '%(%Y-%m-%d %H:%M)T\n' -1 > $visualization_data_dir/download/processed/respiratory/date.txt
        # move list of files changed
        mv respiratory_changes.txt $visualization_data_dir/download/processed/respiratory/respiratory_changes.txt
        
        # logging
        echo "Success" >> "$log_file"
        
        ((updated_dashboards++))
        echo "Respiratory" >> $lior_file
    fi
else
    echo "No changes in respiratory" >> "$log_file"
fi
echo >> "$log_file"


# Wastewater
echo "Wastewater" >> "$log_file"
echo "Getting waste water data from box" >> "$log_file"
./globus-http-linux-amd64-0.1.2 -config "$visualization_data_dir/scripts/python_scripts/supporting_files/config.toml" download "https://g-471022.581c1.0ec8.data.globus.org/CDC_running_data_4plot.xlsx" $visualization_data_dir/aggregated/waste_water/CDC_running_data_4plot.xlsx &>> "$log_file"
./globus-http-linux-amd64-0.1.2 -config "$visualization_data_dir/scripts/python_scripts/supporting_files/config.toml" download "https://g-471022.581c1.0ec8.data.globus.org/CDC_Running_Data_REDDI.xlsx" $visualization_data_dir/aggregated/waste_water/CDC_Running_Data_REDDI.xlsx &>> "$log_file"
if [ $? -ne 0 ]; then
    ((errors++))
    echo "error downloading wastewater data"
fi
diff -r --brief "$(get_latest_backup waste_water)"/aggregated/waste_water $visualization_data_dir/aggregated/waste_water
if [[ $? -ne 0 ]]; then # new data!
    # process data
    $visualization_data_dir/scripts/.venv/bin/python $visualization_data_dir/scripts/python_scripts/process_waste_water_data.py &>> "$log_file"
    if [ $? -ne 0 ]; then # error during processing
        ((errors++))
    else # successful processing
        # encrypt
        $visualization_data_dir/scripts/.venv/bin/python $visualization_data_dir/scripts/python_scripts/encrypt.py "$visualization_data_dir/download/supplementary/encrypt_key.bin" "$visualization_data_dir/processed/waste_water" "$visualization_data_dir/download/processed/waste_water" &>> "$log_file"
        # copy encryption key
        cp $visualization_data_dir/download/supplementary/encrypt_key.bin $visualization_data_dir/download/processed/waste_water/
        # update date of last change file
        printf '%(%Y-%m-%d %H:%M)T\n' -1 > $visualization_data_dir/download/processed/waste_water/date.txt

        # logging
        echo "Success" >> "$log_file"
        
        ((updated_dashboards++))
        echo "Wastewater" >> $lior_file
    fi
else
    echo "No changes in wastewater" >> "$log_file"
fi
echo >> "$log_file"


### backup ###
echo "Backing Up" >> "$log_file"
backup_dir="$visualization_data_dir/backup/$(printf '%(%Y-%m-%d %H:%M)T\n' -1)"

mkdir "$backup_dir"

cp -rp "$visualization_data_dir/raw" "$backup_dir" &>> "$log_file"
cp -rp "$visualization_data_dir/aggregated" "$backup_dir" &>> "$log_file"

### Email Results ###
echo "Num errors: $errors" >> "$log_file"
# if [[ $errors -gt 0 ]]; then
    $visualization_data_dir/scripts/.venv/bin/python $visualization_data_dir/scripts/python_scripts/sendmail.py gausten@clemson.edu "DMA-PRIME Data Processing Log" "$(cat ""$log_file"")"
# fi

if [[ $updated_dashboards -gt 0 ]]; then
    $visualization_data_dir/scripts/.venv/bin/python $visualization_data_dir/scripts/python_scripts/sendmail.py liorr@clemson.edu "DMA-PRIME Data Processing Report" "$(cat $lior_file)"
    $visualization_data_dir/scripts/.venv/bin/python $visualization_data_dir/scripts/python_scripts/sendmail.py ambleic@clemson.edu "DMA-PRIME Data Processing Report" "$(cat $lior_file)"
    $visualization_data_dir/scripts/.venv/bin/python $visualization_data_dir/scripts/python_scripts/sendmail.py eserman@clemson.edu "DMA-PRIME Data Processing Report" "$(cat $lior_file)"
fi

rm respiratory_changes.txt
