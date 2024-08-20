
mapAggregationSwitch.addEventListener("sl-change", (event) => {
    // when disease aggregation switch is changed, update the visualization
    displayMapAggregateChart()
    reset()
    mapSVG.select("#map-color-legend").transition().duration(750).style("opacity", +(mapAggregationSwitch.value == "aggregated")) // && hospitalizationsToggle.checked))
    mapSVG.select("#map-hospital-legend").transition().duration(750).style("opacity", +(mapAggregationSwitch.value != "aggregated")) // && hospitalizationsToggle.checked))
    highlightCounty(focusCounty)
    
    if(mapAggregationSwitch.value == "aggregated") {
        mapSVG.selectAll(".map-zcta").style('fill', function(d) { 
            zcta = d3.select(this)
            population = zcta.attr("population") ? zcta.attr("population") : 1
            population = population == 0 ? NaN : population
            return choroplethColorMap(zcta.attr("count") / (mapPopulationSwitch.value == "total" ? 1 : population))
        })
        d3.selectAll(".hospital-check")
            .style("display", "none")
    } else {
        mapSVG.selectAll(".map-zcta").style("fill", "var(--sl-color-gray-800)")
        d3.selectAll(".hospital-check")
            .style("display", "initial")
    }
})

mapPopulationSwitch.addEventListener("sl-change", (event) => {
    // when population aggregation switch is changed, update the visualization
    displayMapAggregateChart()
    aggregatedMax = d3.max(mapSVG.selectAll(".map-zcta"), d => {
        zcta = d3.select(d)
        population = zcta.attr("population") ? zcta.attr("population") : 1
        population = population == 0 ? NaN : population

       return zcta.attr("count") / (mapPopulationSwitch.value == "total" ? 1 : population)
    })
    individualMax = d3.max(mapSVG.selectAll(".hospital-bubble"), d => {
        zcta = d3.select(d).datum()
        population = zcta.ZCTA_POP
        population = population == 0 ? NaN : population
        return zcta.count / (mapPopulationSwitch.value == "total" ? 1 : population)
    })

    choroplethColorMap.domain([0, aggregatedMax]).nice()
    hospitalRadiusMap.domain([0, individualMax]).nice(9)

    updateMap()
})

hospitalIconsToggle.addEventListener("sl-change", () => {
    // toggle hospital icons
    if(hospitalIconsToggle.checked) {
        mapSVG.select("#map-hospitals").raise().style("opacity", 1)
        mapSVG.selectAll("#disease-data").raise()
        mapSVG.selectAll("#hospital-data").raise()
    } else {
        mapSVG.select("#map-hospitals").lower().style("opacity", 0)
    }
})

// allow zoom and panning of map
zoomer = d3.zoom().scaleExtent([1, 10])
mapZoom = zoomer.on("zoom", function(e) {
    zoom = e.transform.k
    xSkew = e.transform.x
    ySkew = e.transform.y

    mapSVG.select("#map-counties").attr("transform", e.transform)
    mapSVG.select("#map-zctas").attr("transform", e.transform)
    mapSVG.select("#map-color-legend").attr("transform", d3.zoomIdentity)

    hospSize = Math.max(16, Math.min(width, height) * 0.015)
    mapSVG.select("#map-hospitals").selectAll(".hospital").each(function(d) {
        coords = mapProjection(d.geometry.coordinates)
        d3.select(this)
            .attr("x", coords[0]*zoom + xSkew - hospSize/2)
            .attr("y", coords[1]*zoom + ySkew - hospSize/2)
    }) 

    mapSVG.selectAll(".hospital-bubble").each(function(d) {
        mapCoords = mapProjection([d.INTPTLON, d.INTPTLAT])
        newPos = skew(mapCoords, maxHospitalRadius/5, diseaseIndexing[d.disease], numDiseases)
        d3.select(this)
            .attr("cx", newPos[0]*zoom + xSkew)
            .attr("cy", newPos[1]*zoom + ySkew)
    })
})
mapSVG.call(mapZoom)

resetButton.addEventListener("click", () => {
    // reset map's zoom and pan
    focusCounty = null
    mapSVG.transition().duration(750).call(mapZoom.transform, d3.zoomIdentity.translate(0, 0).scale(1))
    reset()
})

// allow click on zcta region to zoom to corresponding county
function zoomToCounty(zcta, data) {
    zcta.on('click', function(event) {
        reset()
        countyName = getClickedCounty(event, zcta)
        county = d3.select("#map-"+countyName)
        countyData = county.data()[0]

        if (focusCounty == countyName) {
            resetButton.click()
            focusCounty = null
            d3.select(mapTooltip)
                .style("display", "none")
                .style("z-index", -1)
        } else {
            focusCounty = countyName

            center = mapProjection([countyData.properties.INTPTLON, countyData.properties.INTPTLAT])        
            dims = county.node().getBBox()
    
            countyWidth = dims.width
            countyHeight = dims.height
            scale = Math.min(4, Math.min(width/countyWidth, height/countyHeight)-1.25)
    
            mapSVG.transition().duration(750).call(zoomer.transform, new d3.ZoomTransform(scale, width/2 - center[0]*scale, height/2 - center[1]*scale))
    
            highlightCounty(focusCounty)
        }
    })
}

function highlightCounty(county) {
    // highlight certain county (grey out other counties and zctas in those counties)
    if (focusCounty == null) {
        reset()
    } else {
        mapSVG.selectAll(".map-county").transition().duration(750).style("fill-opacity", .5)
        mapSVG.select("#map-"+county).transition().duration(750).style("fill-opacity", .0)
        mapSVG.select("#map-legends").raise()
        if (mapAggregationSwitch.value != "aggregated") {
            mapSVG.selectAll(".hospital-bubble").transition().duration(750)
                .style("fill", "var(--sl-color-gray-300)")
                .style("stroke", "var(--sl-color-gray-300)")
            mapSVG.selectAll(`.hospital-bubble[main-county=${focusCounty}]`)
                .transition().duration(750)
                .style("opacity", 1)
                .style("fill", (d) => diseaseColorMap(d.disease))
                .style("stroke", (d) => diseaseColorMap(d.disease))
        }
    }
}

function getClickedCounty(event, zcta) {
    // approximate if you click on a zcta, which county is selected
    counties =  zcta.datum().properties['counties']

    x = event.pageX - mapDiv.offsetLeft
    y = event.pageY - mapDiv.offsetTop
    
    numPointSamples = 100
    county = counties ? counties.filter((countyName) => {
        path = document.getElementById(`map-${countyName}`)
        len = path.getTotalLength()
        points = []
        for (i=0; i < numPointSamples; i++) {
            point = path.getPointAtLength(i/(numPointSamples-1) * len)
            points.push([point.x, point.y])
        }
        return d3.polygonContains(points, [(x-xSkew)/zoom, (y-ySkew)/zoom])
    })[0] : zcta.attr("county")

    return county
}

function reset() {
    // reset so no county is selected
    mapSVG.selectAll(".map-county").transition().duration(750).style("fill-opacity", 0)
    mapSVG.selectAll(".hospital-bubble").transition().duration(750)
        .style("opacity", +(mapAggregationSwitch.value != "aggregated"))
        .style("fill", (d) => diseaseColorMap(d.disease))
        .style("stroke", (d) => diseaseColorMap(d.disease))
}

// tooltip stuff
function removeTooltip(element) {
    // make a element not react to pointer events
    element.on("pointermove", null)
    element.on("pointerleave", null)
    element.on("pointerenter", null)
}

function hospitalTooltip(element) {
    // draw tooltip and move it based on pointer placement

    var tooltipWidth = 200
    var tooltipHeight = 130
    d3.select(mapTooltip).style("display", "none").style("z-index", -1)
    
    element.on("pointermove", function(e) {
        // move tooltip on pointer move
        if((e.clientY + tooltipHeight + 2*em) < mapDiv.clientHeight) {
            mapTooltip.style.top = (e.clientY + 2*em) + "px"
        } else {
            mapTooltip.style.top = (e.clientY - tooltipHeight - 4*em) + "px"
        }
        if ((e.clientX + tooltipWidth) < (mapDiv.clientWidth + mapDiv.offsetLeft - 1*em)) {
            mapTooltip.style.left = e.clientX +"px"
        } else {
            mapTooltip.style.left = (mapDiv.clientWidth + mapDiv.offsetLeft - 1*em) - tooltipWidth + "px"
        }
    })

    element.on("pointerleave", function(e) {
        // hide tooltip on pointer leave
        d3.select(mapTooltip)
            .style("display", none)
            .style("z-index", -1)
    })

    element.on("pointerenter", function(e) {
        // draw tooltip
        county = getClickedCounty(e, element)

        if(focusCounty != county) {
            return
        }
        
        tooltipWidth = Math.max(400, width * .1)
        tooltipHeight = tooltipWidth * .65

        // make tooltip visible and render on top
        ttp = d3.select(mapTooltip)
        ttp.style("display", "block").style("z-index", 1)
        ttpSVG = ttp.select("#map-tooltip-svg")
            .attr("height", tooltipHeight)
            .attr("width", tooltipWidth)

        data = element.data()[0]

        // reset tooltip contents for new data
        ttp.select("p.tooltip").node().innerHTML = `${county[0].toUpperCase() + county.slice(1)}<br>ZCTA: ${data.properties.ZCTA5CE20}`
        ttpSVG.node().innerHTML = ""

        d3.json("/get-hospital-zcta-tooltip", { // hospital zcta data
            "method": "POST",
            "headers": {"Content-Type": "application/json"},
            "body": JSON.stringify({
                "region-name": data.properties.ZCTA5CE20,
                "disease": getVisibleDiseases("hospital"),
                "date": hospitalMetadata.date[0]
            })}).then((result) => { 
                // fix dates
                historicalTimeDomain = []
                result.metadata.date.historical.forEach(function(date) {
                    historicalTimeDomain.push(dayjs.tz(date, "America/New_York").toDate())
                })
                predictiveTimeDomain = []
                result.metadata.date.predictive.forEach(function(date) {
                    predictiveTimeDomain.push(dayjs.tz(date, "America/New_York").toDate())
                })
                fullTimeDomain = historicalTimeDomain.concat(predictiveTimeDomain)

                // create y axis scaling (counts of hospitalizations)
                yScale = d3.scaleLinear()
                            .domain([mapPopulationSwitch.value == "total" ? result.stats.min : result.stats.min/result.metadata.population, 
                                mapPopulationSwitch.value == "total" ? result.stats.max : result.stats.max/result.metadata.population])        
                            .nice()

                // figure out how much space is needed for the y-axis text
                temp = ttpSVG.append("text").text(yScale.domain()[1]).attr("x", 0).attr("y", 0)
                ttpMargins = {
                    "top": em, 
                    "bottom": 2.5*em,
                    "left": temp.node().getBBox().width + em,
                    "right": em,
                }
                temp.remove()

                // finish creating both x and y scales
                xScale = d3.scaleUtc([fullTimeDomain[0], fullTimeDomain[fullTimeDomain.length - 1]], [ttpMargins.left, tooltipWidth - ttpMargins.right]) 
                yScale.range([tooltipHeight - ttpMargins.bottom, ttpMargins.top])
                
                // line generator
                line = d3.line()
                    .x((d) => xScale(d.date))
                    .y((d) => yScale(mapPopulationSwitch.value == "total" ? d.count : d.count/result.metadata.population))
                    .curve(d3.curveMonotoneX)

                // line to delineate prediction and historical data
                ttpSVG.append("line").attr("id", "tooltip-prediction-separator")
                
                // holds lines of linechart
                graphSVG = ttpSVG.append("svg")
                    .attr("id", "graph-svg")
                    .attr("height", tooltipHeight)
                    .attr("width", tooltipWidth)

                Object.entries(result.data.historical).forEach(function([disease, values]) {
                    // for each disease
                    
                    hospitalMetadata.date[0]
                    data = []
                    Object.entries(values).forEach(function([date, count]) {
                        date = dayjs.tz(date, "YYYY-MM", "America/New_York").toDate()
                        data.push({"date": date, "count": count})
                    })

                    // draw historical line chart
                    diseaseGroup = graphSVG.append("g")
                    historicalGroup = diseaseGroup.append("g")
                    historicalGroup.append("path")
                        .attr("d", line(data))
                        .attr("stroke", diseaseColorMap(disease))
                        .attr("fill", "none")
                        .attr("stroke-width", 2)
    
                    // marks each datapoint on historical line
                    historicalGroup.selectAll("circle").data(data)
                        .enter()
                        .append("circle")
                        .attr("r", 3)
                        .attr("cx", (d) => xScale(d.date))
                        .attr("cy", (d) => yScale(mapPopulationSwitch.value == "total" ? d.count : d.count/result.metadata.population))
                        .attr("fill", diseaseColorMap(disease))

                    predictiveData = [{
                        "date": dayjs.tz(hospitalMetadata.date[0], "YYYY-MM", "America/New_York").toDate(), 
                        "count": values[hospitalMetadata.date[0]]}]
                    Object.entries(result.data.predictive[disease]).forEach(function([date, count]) {
                        date = dayjs.tz(date, "YYYY-MM", "America/New_York").toDate()
                        predictiveData.push({"date": date, "count": count})
                    })

                    // draw predictive data line chart
                    predictiveGroup = diseaseGroup.append("g")
                    predictiveGroup.append("path")
                        .attr("d", line(predictiveData))
                        .attr("stroke", diseaseColorMap(disease))
                        .attr("stroke-dasharray", "5,5")
                        .attr("fill", "none")
                        .attr("stroke-width", 2)
    
                    // marks each datapoint on historical line
                    predictiveGroup.selectAll("circle").data(predictiveData.slice(1))
                        .enter()
                        .append("circle")
                        .attr("r", 3)
                        .attr("cx", (d) => xScale(d.date))
                        .attr("cy", (d) => yScale(d.count))
                        .attr("fill", diseaseColorMap(disease))

                    // Show confidence interval
                    predictiveGroup.append("path")
                        .attr("class", "prediction-background")
                        .datum(predictiveData)
                        .style("fill", diseaseColorMap(disease))
                        .style("opacity", 0.25)
                        .attr("stroke", "none")
                        .attr("d", d3.area()
                            .x(function(d) { return xScale(d.date) })
                            .y0(function(d, i) { return yScale(i == 0 ? d.count : d.count/1.25) })
                            .y1(function(d, i) { return yScale(i == 0 ? d.count : d.count*1.25) })
                            .curve(d3.curveMonotoneX)
                        )

                })

                // highlights predictive data
                graphSVG.append("rect")
                    .attr("id", "tooltip-prediction-highlighter")
                    .attr("x", xScale(predictiveData[0].date))
                    .attr("y", ttpMargins.top)
                    .attr("width", xScale(predictiveData[predictiveData.length - 1].date) - xScale(predictiveData[0].date))
                    .attr("height", tooltipHeight - ttpMargins.bottom - ttpMargins.top)

                // place line separating historical and prediction data
                ttpSVG.select("#tooltip-prediction-separator")
                    .attr("x1", xScale(predictiveData[0].date))
                    .attr("y1", ttpMargins.top)
                    .attr("x2", xScale(predictiveData[0].date))
                    .attr("y2", tooltipHeight - ttpMargins.bottom)

                // display x-axis on the bottom
                ttpSVG.append("g")
                .attr("transform", `translate(0,${tooltipHeight - ttpMargins.bottom})`)
                .call(d3.axisBottom(xScale).tickValues(fullTimeDomain).tickSize(4).tickFormat(d3.timeFormat("%b %Y")))
                .selectAll("text")  
                .style("text-anchor", "end")
                .attr("transform", "rotate(-30)");
    
                // display y-axis on the left
                ttpSVG.append("g")
                .attr("transform", `translate(${ttpMargins.left},0)`)
                .call(d3.axisLeft(yScale).ticks(5).tickSize(4));
            })
    })
}
