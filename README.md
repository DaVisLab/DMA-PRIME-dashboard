# DMA-PRIME-dashboard


dvtDashboard contains the code for the DMA-PRIME dashboard. The flask app is found in mainApp directory. To run this flask app, navigate to the dvtDashboard directory and run `flask --app mainApp run` in the command line. Then, open the link localhost:5000 in any browser. This will bring you to the always on current data visualization. 

If you don't have Flask downloaded, you can use an anaconda environment: conda create --name test pandas numpy flask. Activate the environment before running the app as specified above.

Web components courtesy of [Shoelace](https://shoelace.style/) 

Note: To automatically reload flask applications on changes, run it with the --debug flag :) (p.s. don't put it at the end, I put it before --app - `flask --debug --app mainApp run`)

# Data Sources
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

# References
- GDAL: https://gdal.org/index.html
- To fill page with content: https://dev.to/lennythedev/css-gotcha-how-to-fill-page-with-a-div-270j
- D3: https://d3js.org/api
- HTML/CSS/JS: https://developer.mozilla.org/en-US/docs/Web
- Shoelace: https://shoelace.style/
- Flask: https://flask.palletsprojects.com/en/2.3.x/
- Jinja: https://jinja.palletsprojects.com/en/3.0.x/api/
- Pandas: https://pandas.pydata.org/docs/index.html
- Numpy: https://numpy.org/doc/stable/index.html


update.cmd: 
 - https://devblogs.microsoft.com/oldnewthing/20120801-00/?p=6993