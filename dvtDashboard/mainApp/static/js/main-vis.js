// I want the svg to exist in the html file

function displayMap(mapType) {
    mapJSON = determineMap(mapType)
    jsSVG.innerHTML = ""
    d3.json(mapJSON).then(function(mapdata){
            
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
    
        var projection = d3.geoAlbers() //geoOrthographic() //geoMercator()
                            // .scale(14490.050394227457)
                            // .translate([-2541.520291685157, -655.8449762125149 ])
                            // .scale(8763.186773434889)
                            // .translate([ -1632.8583228988787, -238.08720204069493 ])
                            .fitExtent([[dimensions.margin.left,dimensions.margin.top],[width-dimensions.margin.right,height-dimensions.margin.bottom]], mapdata)
    
        var pathGenerator = d3.geoPath(projection)
    
        var area = mainSVG.append("g")
                        .selectAll("path")
                        .data(mapdata.features)
                        .enter()
                        .append("path")
                        .attr("class", "mapItems")
                        .attr("id", (d) => getSignifier(d))
                        .attr("d", d => pathGenerator(d))
                        .style("fill", "#999")
                        .on("click", (d) => {
                            tab = document.createElement("sl-tab")
                            tab.setAttribute("slot", "nav")
                            tab.setAttribute("closable", "")
                            tab.setAttribute("id", "minor_vis_tab:"+d.target.id)
                            // newVis = document.createElementNS("http://www.w3.org/2000/svg", "svg")
                            // newVis.setAttribute("id", "minor_"+d.target.id)
                            // tab.append(newVis)
                            minorVisResizer.append(tab)
                            newMinorVis(tab, d.target.id, "line")
                        })            
    })
}

function resizeMap(mapType) {
    mapJSON = determineMap(mapType)
    d3.json(mapJSON).then(function(mapdata){
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

        var projection = d3.geoAlbers() 
                            .fitExtent([[dimensions.margin.left,dimensions.margin.top],[width-dimensions.margin.right,height-dimensions.margin.bottom]], mapdata)

        var pathGenerator = d3.geoPath(projection)

        mapdata.features.forEach((areaData) => {
            d3.select("#" + getSignifier(areaData))
                .attr("d", pathGenerator(areaData))
        })           
    })
}

function clearVisualization() {
    mainSVG.selectAll("path")
        .transition()
        .duration(2000)    
        .style("fill", "#999")
}

function aggregatedVisualization() {
    let counties = mainSVG.selectAll(".mapItems")
    counties.each(d => calculateValue(d.properties.NAME.toLowerCase(), d))
}

function calculateValue(county, countyObject) {
    // some day I want to move this into python
    const colors = ["#2E1E30", "#331427", "#A20D32", "#FF073A"];
    type = null
    chosenColumn = 0
    countyPop = 1
    d3.csv("static/data/county/Counties daily cases/" + county + "_case_daily.csv").then((data) => {
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
        let fixedMaxYValue = 2500;
        let maxYValue = d3.max(data, (d) => d[chosenColumn]);
        const maxDataPoint = data.find((d) => d[chosenColumn] === maxYValue);
        let pointLabel = Math.round(maxYValue);
        let countyValue = aggregate;
        let lineFunc = function (val) { return val; };
        let countyTitle = "Total Cases";

        switch (type) {
            case "popAdjusted":
                quartiles = [0.0, 0.03, 0.2, 0.5];
                fixedMaxYValue = 0.006;
                maxYValue = d3.max(data, (d) => d[chosenColumn] / countyPop);
                pointLabel = maxYValue.toFixed(3);
                countyValue = (aggregate / countyPop).toFixed(3);
                lineFunc = function (val) { return val / countyPop; };
                countyTitle = "Pop Adjusted Cases";
                break;
            // in the event we have many different things, I'm using a switch statement the default is total, see above
        }

        var colorMap = d3.scaleLinear().domain(quartiles).range(colors)
        d3.select("#" + county)
            .transition()
            .duration(2000)
            .style("fill", colorMap(countyValue));
    })
}


