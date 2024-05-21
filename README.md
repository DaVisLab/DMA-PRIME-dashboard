# DMA-PRIME-dashboard

dashboardOverview is the original dashboard. `county-vis.html` was reduced and the css and js moved to countyStyle.css and countyScript.js respectively. The js in `script.js` was reworked to be smaller and is in a file named `script_new.js`. The original js from script.js is preserved in `script_old.js`.

flaskDashboard contains the reworked dashboard from dashboardOverview but structured so it runs using Flask as the server. The flask app is contained in the flaskr directory and the flask portion is in `__init__.py`. To run it, run `flask --app flaskr run` in the command line. Currently I'm running flask using an anaconda environment on my personal computer. I will create a requirements file to recreate this at a later time.

dvtDashboard is the newest iteration of the DMA-PRIME dashboard. It will also be a flask app. It should contain a d3 map of SC at the zipcode level. It will also have a line chart somewhere, some menu items, and a scrollbar. To run this, I believe you should run `flask --app mainApp run` in the command line. 