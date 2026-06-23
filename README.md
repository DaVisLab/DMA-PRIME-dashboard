# DMA-PRIME-dashboard
DMA-PRIME (Disease Monitoring, Analytics, and Prediction Infrastructure for Public Health Response and Emergency Management) is an integrated public health surveillance platform designed to support infectious disease monitoring, outbreak detection, and forecasting across South Carolina.
* Access: https://dmaprime.clemson.edu/
  
** As DMA-PRIME contains HIPAA-compliant healthcare data and predictive analytics results, access is restricted to authorized users.
  
<img width="1326" height="786" alt="dmaprime-login-page" src="https://github.com/user-attachments/assets/49d81dae-46f7-42ca-bdef-e729166c2db5" />

## DMA-PRIME Modules
<img width="1328" height="760" alt="dmaprime-overview-page" src="https://github.com/user-attachments/assets/d4afbd7e-4720-4c8d-8294-5e5cca522a43" />

Currently, DMA-PRIME provides the following dashboard modules.

* **Respiratory Prediction Dashboard**: Provides weekly monitoring, nowcasting, and forecasting for major respiratory diseases including COVID-19, Influenza, and RSV.
* **Outbreak Detection Dashboard**: Supports geographic surveillance and hotspot detection for a wide range of infectious diseases across South Carolina.
* **Maternal and Child Health Dashboard**: Monitors maternal and child health outcomes and supports the identification of regional health disparities.
* **Wastewater Monitoring**: Tracks wastewater surveillance indicators to provide early warning signals for disease activity at the community level.

* **Opioid Overdose, HCV, and HIV Hospitalizations Dashboard**: Enables analysis of opioid overdose events and HCV/HIV-related hospitalizations alongside demographic and socioeconomic factors.

* **Mobile Health Clinic Tracking Dashboard**: Tracks mobile health clinic activities, service locations, patient encounters, and healthcare accessibility across the state.

## Respiratory Prediction Dashboard
The Respiratory Virus Forecasting Dashboard is designed to support both nowcasting and forecasting of respiratory disease activity.

<img width="1037" height="659" alt="dmaprime-respiratory-page" src="https://github.com/user-attachments/assets/69b43aa3-ffbd-4c43-95da-41f3495797cf" />

The dashboard helps public health professionals:

* Monitor current disease burden
* Identify geographic hotspots
* Anticipate future disease trends
* Support healthcare resource planning
* Evaluate regional disease risk

The dashboard focuses on:

* COVID-19
* Influenza
* Respiratory Syncytial Virus (RSV)
* Combined respiratory disease activity

Key Features
* Historical observations, Forecast, and nowcast projections
* Comparison of disease activity across regions
* Integration of hospital and healthcare resource locations
* Access to prediction model details through the Model Exploration page

## Outbreak Detection Dashboard
The Outbreak Detection Dashboard is designed to identify and monitor potential infectious disease outbreaks through interactive spatial analysis. The dashboard enables users to explore disease activity at multiple geographic and temporal scales and quickly identify areas experiencing elevated disease burden.

<img width="2000" height="1039" alt="dmaprime-outbreak-page" src="https://github.com/user-attachments/assets/d846d4f9-8629-427f-9b41-203e82725146" />

Key Features
* Support for more than 20 infectious diseases
* Multiple surveillance indicators, including: Diagnoses, Positive Tests, Encounters, etc
* Integration of hospital and healthcare resource locations

## Development Guide
dvtDashboard contains the code for the DMA-PRIME visualization toolkit. The flask app is found in dma_prime_vis_toolkit directory. The python code for the backend is found in the top level of this directory. The templates directory contains the html files for the toolkit. The static directory contains the css and js files. Within templates, static/css, and static/js there are corresponding directories that are responsible for each dashboard within the toolkit. For example, the respiratory dashboard's html/css/js files are founding templates/respiratory, static/css/respiratory, and static/js/respiratory. Additionally, the files tend to be separated by panel in each dashboard. The respiratory dashboard has a map and grid panel and therefore has a html, css, and js file for each. Furthermore, the js for each dashboard's panel is roughly separated into a file for visualization and another for interactions. 

To further develop the toolkit:
1. Use one of the requirements.txt files to create a virtual environment. 
1. Create a cfg file. Mine I named secrets.cfg and it's at the top of the git repo (DMA-PRIME-dashboard/secrets.cfg). This is already in the gitignore. Use the following configurations:
    - SECRET_KEY (32 byte bytes object)
    - DB_NAME
    - DB_USERNAME
    - DB_PASSWORD
    - SQLALCHEMY_DATABASE_URI (I just use "sqlite:///project.db" for local stuff)
1. Set the environment variable named DMAPRIME_CONFIG to the full path of your cfg file.
1. Download the data directories from Palmetto Indigo store. **DO NOT COMMIT THEM TO THE GITHUB**. Make sure they are in the same directory. I used the testing directory in this git repo as testing/processed and testing/supplementary are already included in the gitignore. Data directories:
    - /project/liorr/dmaprime/visualization_data/download/processed
    - /project/liorr/dmaprime/visualization_data/download/supplementary
1. Navigate to the dvtDashboard directory
1. Run the following command: `flask --debug --app "dma_prime_vis_toolkit:create_app(True, 'full path to directory containing processed and supplementary directories')" run`

Notes:
- The first parameter in the above command runs this app in development mode which clears the db and creates two users:
    - user
        - password
    - admin
        - password
- The website will be at localhost:5000. It works in chrome, edge, or firefox. It's broken in safari for reasons I cannot discern, lacking a mac
- If you're having import issues, the requirements files may be old, sorry. dvtdashboard/pyproject.toml should pretty much always be up to date.

Web components courtesy of [Shoelace](https://shoelace.style/) 

## Data Sources
- SC county map and SC zip code map
    - data: https://www.census.gov/cgi-bin/geo/shapefiles/index.php (2023 counties and equivalent and 2023 zip code tabulation areas) - national data as shape files
    - processing: download data, unzip the folder, enter folder. Use gdal to transform the shape files to geojson files using the command `ogr2ogr -f GeoJSON [path to dest] [path to .shp file]. Use -where to filter to state level. Use -where STATEFP='45' for county and -where "CAST(ZCTA5CE20 AS SMALLINT) BETWEEN 29000 AND 29999" for zip code.
        - Using the generated JSON files, select only the necessary fields using `ogr2ogr -f GeoJSON -select "[field1],[field2],[field_n]" [path to dest] [path to input]`. For county, select NAME, INTPTLAT, and INTPTLON. For ZCTA, select ZCTA5CE20, INTPTLAT20, and INTPTLON20. 
    - post processing sc zip code map using simplify so the file is under 5MB: ogr2ogr -f GeoJSON output.json input.json -simplify 0.0001
    - notes: It is important to be in the unzipped directory as the files accompanying the .shp file contain attribute data that is useful for visualization purposes.
- State-zip code correlation for filtration: https://www.irs.gov/pub/irs-utl/zip_code_and_state_abbreviations.pdf
- Hospital information https://sc-department-of-health-and-environmental-control-gis-sc-dhec.hub.arcgis.com/datasets/c6ffe3d1ca2947d3a935f797d2f0d6ec (you can download the GeoJSON directly)
- Prediction icons: https://icons.getbootstrap.com/icons/ (chevron-double-down, chevron-down, dash-lg, chevron-up, chevron-double-up)
- Hospital icons: https://icons.getbootstrap.com/icons/ (hospital, hospital-fill)

## References
- GDAL: https://gdal.org/index.html
- To fill page with content: https://dev.to/lennythedev/css-gotcha-how-to-fill-page-with-a-div-270j
- D3: https://d3js.org/api
- HTML/CSS/JS: https://developer.mozilla.org/en-US/docs/Web
- Shoelace: https://shoelace.style/
- Flask: https://flask.palletsprojects.com/en/2.3.x/
- Jinja: https://jinja.palletsprojects.com/en/3.0.x/api/
- Pandas: https://pandas.pydata.org/docs/index.html
- Numpy: https://numpy.org/doc/stable/index.html
