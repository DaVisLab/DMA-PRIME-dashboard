// I want the svg to exist in the html file

function displayMap(mapType) {
    mapJSON = determineMap(mapType)
    jsSVG.innerHTML = ""
    var dimensions = ({
        width: width, 
        height: height,
        margin: {
            top: 10,
            right: 10,
            bottom: 10,
            left: 10
        }
        })

    var width = jsSVG.width.baseVal.value
    var height = jsSVG.height.baseVal.value

    d3.json(mapJSON).then(function(mapdata){
    
        var projection = d3.geoAlbers()
                            .fitExtent([[dimensions.margin.left,dimensions.margin.top],[width-dimensions.margin.right,height-dimensions.margin.bottom]], mapdata)
    
        var pathGenerator = d3.geoPath(projection)
    
        var area = mainSVG.append("g")
                        .attr("id", "map-items")
                        .selectAll("path")
                        .data(mapdata.features)
                        .enter()
                        .append("path")
                        .attr("class", "map-item")
                        .attr("id", (d) => getSignifier(d))
                        .attr("d", d => pathGenerator(d))
                        .style("fill", "#999")
                        .on("click", (d) => {
                            tab = document.createElement("sl-tab")
                            tab.setAttribute("slot", "nav")
                            tab.setAttribute("closable", "")
                            tab.setAttribute("id", "minorvistab-"+d.target.id)
                            tab.addEventListener("sl-close", (details) => {
                                details.target.remove()
                            })
                            minorVisResizer.append(tab)
                            newMinorVis(tab, d.target.id, "line")
                        })
                                
    }).then(() => {
        predictionItems = mainSVG.append("g").attr("id", "prediction-items")
        predLength = Math.min(height, width) * 0.035
        if(mapType == "zip") {
            predLength *= 0.5
        }

        mapItems = document.getElementsByClassName("map-item")
        for(i = 0; i < mapItems.length; i++) {
            item = mapItems[i]
            boundingBox = item.getBBox()
            predictionItems
                .append("svg")
                .attr("class", "pred-vis")
                .attr("id", "predvis-" + item.id)
                .html(iconNeutal)
                .attr("width", predLength)
                .attr("height", predLength)
                .attr("x", boundingBox.x + (boundingBox.width - predLength)/2)
                .attr("y", boundingBox.y + (boundingBox.height - predLength)/2)
        }
   })
    
}

function updateMap(mapType) {
    mapJSON = determineMap(mapType)
    var dimensions = ({
        width: width, 
        height: height,
        margin: {
            top: 10,
            right: 10,
            bottom: 10,
            left: 10
        }
        })

    var width = jsSVG.width.baseVal.value
    var height = jsSVG.height.baseVal.value
    d3.json(mapJSON).then(function(mapdata){

        var projection = d3.geoAlbers() 
                            .fitExtent([[dimensions.margin.left,dimensions.margin.top],[width-dimensions.margin.right,height-dimensions.margin.bottom]], mapdata)

        var pathGenerator = d3.geoPath(projection)

        mapdata.features.forEach((areaData) => {
            d3.select("#" + getSignifier(areaData))
                .attr("d", pathGenerator(areaData))
        })           
    }).then(() => {
        predLength = Math.min(height, width) * 0.025
        if(mapType == "zip") {
            predLength *= 0.5
            console.log(predLength)
        }

        mapItems = document.getElementsByClassName("map-item")
        for(i = 0; i < mapItems.length; i++) {
            item = mapItems[i]
            boundingBox = item.getBBox()
            d3.select("#predvis-" + item.id)
                .attr("width", predLength)
                .attr("height", predLength)
                .attr("x", boundingBox.x + (boundingBox.width - predLength)/2)
                .attr("y", boundingBox.y + (boundingBox.height - predLength)/2)
        }
    })
}

function clearVisualization() {
    mainSVG.selectAll(".map-item")
        .transition()
        .duration(2000)    
        .style("fill", "#999")
}

function aggregatedVisualization() {
    let counties = mainSVG.selectAll(".map-item")
    counties.each(d => calculateValue(d.properties.NAME.toLowerCase()))
}

function dailyVisualization() {
    let counties = mainSVG.selectAll(".map-item")
    counties.each(d => dailyValue(d.properties.NAME.toLowerCase()))
}

function calculateValue(county) {
    // some day I want to move this into python
    const colors = ["#2E1E30", "#331427", "#A20D32", "#FF073A"];

    d3.csv("static/data/county/countyPopulations.csv").then((pops) => {
        
        d3.csv("static/data/county/Counties daily cases/" + county + "_case_daily.csv").then((data) => {
            countyPop = 1
            pops.forEach((d) => {
                if(d.county == county) {
                    countyPop = d.population
                }
            })
            // Parse the date
            var parseDate = d3.timeParse("%Y-%m-%d");
            data.forEach(function (d) {
                d.date = parseDate(d.date);
                d[chosenColumn] = +d[chosenColumn];
            });
    
            const aggregate = Math.round(
                data.reduce((total, d) => total + d[chosenColumn], 0)
            );
    
            // information to display total values
            // may be redefined in the switch if we are not displaying total
            let quartiles = [0, 4000, 40000, 180000];
            let countyValue = aggregate;
            let lineFunc = function (val) { return val; };
    
            if (populationNormalized) {
                quartiles = [0.0, 0.03, 0.2, 0.5];
                countyValue = (aggregate / countyPop).toFixed(3);
                lineFunc = function (val) { return val / countyPop; };
            }
    
            var colorMap = d3.scaleLinear().domain(quartiles).range(colors)
            d3.select("#" + county)
                .transition()
                .duration(2000)
                .style("fill", colorMap(countyValue));
        })
    })
}

function dailyValue(county) {
    // some day I want to move this into python
    const colors = ["#2E1E30", "#331427", "#A20D32", "#FF073A"];

    d3.csv("static/data/county/countyPopulations.csv").then((pops) => {
        d3.csv("static/data/county/Counties daily cases/" + county + "_case_daily.csv").then((data) => {
            countyPop = 1
            pops.forEach((d) => {
                if(d.county == county) {
                    countyPop = d.population
                }
            })
            
            // Parse the date
            let countyValue = 0;
            
            var parseDate = d3.timeParse("%Y-%m-%d");
            data.some(function (d) {
                dataDate = new Date(d.date)
                if(dataDate.getTime() == chosenDate.getTime()) {
                    countyValue = d[chosenColumn]
                }
                d.date = parseDate(d.date);
                d[chosenColumn] = +d[chosenColumn];
            });
    
            let quartiles = [0, 100, 500, 2500];
            let lineFunc = function (val) { return val; };
    
            if (populationNormalized) {
                quartiles = [0.0, 0.0003, 0.002, 0.005];
                countyValue = (countyValue / countyPop).toFixed(3);
                lineFunc = function (val) { return val / countyPop; };
            }
    
            var colorMap = d3.scaleLinear().domain(quartiles).range(colors)
            d3.select("#" + county)
                .transition()
                .duration(1000)
                .style("fill", colorMap(countyValue));
        })
    })
    
}


function changePrediction() {
    // TODO
    predictionIcons = [iconDoubleDown, iconDown, iconNeutal, iconUp, iconDoubleUp]
    items = []
    mapItemsD3 = mainSVG.selectAll(".map-item")
    mapItemsD3.each((item) => items.push(getSignifier(item)))
    url = "/get-prediction/" + mapType + "/all" + predictionIcons.length
        
    d3.json(url, {
        "method": "POST",
        "headers": {"Content-Type": "application/json"},
        "body": JSON.stringify(items)
    }).then((data) => {
        quantiles = data.quantiles
        console.log(d3.interpolatePiYG)
        colorMap = d3.scaleLinear().domain(quantiles).range(d3.schemePiYG[predictionIcons.length])
        iconMap = d3.scaleOrdinal().domain(quantiles).range(predictionIcons)
        colorMap.clamp(true)
        predItemsD3 = mainSVG.selectAll(".pred-vis")
            .data(data.values, function(d) {
                return d ? "predvis-"+d.item : this.id;
            })
            .style("color", d => colorMap(d.value))
            .html(d => iconMap(d.value))
    })


    
}