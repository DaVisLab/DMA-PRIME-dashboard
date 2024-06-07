# DMA-PRIME-dashboard

dashboardOverview is the original dashboard. `county-vis.html` was reduced and the css and js moved to countyStyle.css and countyScript.js respectively. The js in `script.js` was reworked to be smaller and is in a file named `script_new.js`. The original js from script.js is preserved in `script_old.js`.

flaskDashboard contains the reworked dashboard from dashboardOverview but structured so it runs using Flask as the server. The flask app is contained in the flaskr directory and the flask portion is in `__init__.py`. To run it, run `flask --app flaskr run` in the command line. Currently I'm running flask using an anaconda environment on my personal computer. I will create a requirements file to recreate this at a later time.

dvtDashboard is the newest iteration of the DMA-PRIME dashboard. It will also be a flask app. It should contain a d3 map of SC at the zipcode level. It will also have a line chart somewhere, some menu items, and a scrollbar. To run this, I believe you should run `flask --app mainApp run` in the command line.
The json for the maps are generated using gdal and shape files found on https://www.census.gov/cgi-bin/geo/shapefiles/index.php. 

You need to download the proper data from the link above, unzip the folder, then run the gdal command, using -where [sql command here] to filter, e.g. STATEFP='45' and "CAST(ZCTA5CE20 AS SMALLINT) BETWEEN 29000 AND 29999" (the former for counties, and the latter for zip code). 


gdal command: ogr2ogr -f GeoJSON [path to dest file] [path to .shp file]

which zip codes belong to sc: https://www.irs.gov/pub/irs-utl/zip_code_and_state_abbreviations.pdf

hospital data: https://sc-department-of-health-and-environmental-control-gis-sc-dhec.hub.arcgis.com/datasets/c6ffe3d1ca2947d3a935f797d2f0d6ec

To fill page with content: https://dev.to/lennythedev/css-gotcha-how-to-fill-page-with-a-div-270j

Prediction icons from boostrap:
https://icons.getbootstrap.com/icons/
(chevron-double-down, chevron-down, dash-lg, chevron-up, chevron-double-up)

To automatically reload flask applications on changes, run it with the --debug flag :) (p.s. don't put it at the end, I put it before --app - `flask --debug --app mainApp run`)
