
mapRateSwitch.addEventListener("sl-change", (event) => {
    updateMapData()
})

mapDataSourceSelector.addEventListener("sl-change", (event) => {
    updateMapData()
})

mapDiseaseSelector.addEventListener("sl-change", (event) => {
    updateMapData()
})

hospitalIconsToggle.addEventListener("sl-change", () => {
    // toggle hospital icons
    mapSVG.select("#map-hospitals").style("display", hospitalIconsToggle.checked ? "initial" : "none")
})

resetButton.addEventListener("click", () => {
    // reset map's zoom and pan
    focusCounty = null
    mapUnzoom()
    mapClearCountyHighlight()
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
})
mapSVG.call(mapZoom)

function mapUnzoom() {
    mapSVG.transition().duration(750).call(mapZoom.transform, d3.zoomIdentity.translate(0, 0).scale(1))
}

function mapHighlightCounty(county) {

    // zoom and pan to focus on county
    countyData = county.datum()
    center = mapProjection([countyData.properties.INTPTLON, countyData.properties.INTPTLAT])        
    dims = county.node().getBBox()

    countyWidth = dims.width
    countyHeight = dims.height
    scale = Math.min(4, Math.min(width/countyWidth, height/countyHeight)-1.25)

    mapSVG.transition().duration(750).call(zoomer.transform, new d3.ZoomTransform(scale, width/2 - center[0]*scale, height/2 - center[1]*scale))

    // highlight  county (grey out other counties and zctas in those counties)
    mapSVG.selectAll(".map-county").transition().duration(750).style("fill-opacity", .5)
    county.transition().duration(750).style("fill-opacity", .0)
}

function mapClearCountyHighlight() {
    mapSVG.selectAll(".map-county").transition().duration(750).style("fill-opacity", 0)
}

function setZctaInteractions(zcta) {
    // click
    zcta.on("click", function(event) {
        mapClearCountyHighlight()

        countyName = zcta.attr("county")
        county = d3.select("#map-"+countyName)

        if (focusCounty == countyName) {
            resetButton.click()
            d3.select(mapTooltip)
                .style("display", "none")
                .style("z-index", -1)
        } else {
            focusCounty = countyName
            mapHighlightCounty(county)
        }
    })

    // tooltip
    zcta.on("pointermove", function(e) {
        // move tooltip on pointer move
        if((e.clientY + mapTooltipHeight + 2*em) < mapDiv.clientHeight) {
            mapTooltip.style.top = (e.clientY + 2*em) + "px"
        } else {
            mapTooltip.style.top = (e.clientY - mapTooltipHeight - 4*em) + "px"
        }
        if ((e.clientX + mapTooltipWidth) < (mapDiv.clientWidth + mapDiv.offsetLeft - 1*em)) {
            mapTooltip.style.left = e.clientX +"px"
        } else {
            mapTooltip.style.left = (mapDiv.clientWidth + mapDiv.offsetLeft - 1*em) - mapTooltipWidth + "px"
        }

        // visualize it
        county = zcta.attr("county")
        if(focusCounty == county) {
            d3.select(mapTooltip).style("display", "block").style("z-index", 1)
        }
    })

    zcta.on("pointerleave", function(e) {
        // hide tooltip on pointer leave
        d3.select(mapTooltip)
            .style("display", "none")
            .style("z-index", -1)
    })

    zcta.on("pointerenter", function(e) {
        // make sure this is in the shown county
        county = zcta.attr("county")
        if(focusCounty != county) {
            return
        }

        // draw the stuff 
        zctaName = zcta.datum().properties.ZCTA5CE20

        d3.json(`/hospitalization-history/${mapDiseaseSelector.value}`, {
            "method": "POST",
            "headers": {"Content-Type": "application/json"},
            "body": JSON.stringify({
                "region": zctaName,
                "date": new Date(2024, 5, 24), // 5 is for month 6 - june
                "rate": mapRateSwitch.value == "rate"
            })}).then((result) => {
                mapTooltipWidth = Math.max(400, width * .1)
                mapTooltipHeight = mapTooltipWidth * .65

                ttp = d3.select(mapTooltip)
                ttp.style("display", "block").style("z-index", 1)
                ttpSVG = ttp.select("#map-tooltip-svg")
                    .attr("height", mapTooltipHeight)
                    .attr("width", mapTooltipWidth)

                // reset tooltip contents for new data
                ttp.select("p.tooltip").node().innerHTML = `${county[0].toUpperCase() + county.slice(1)}<br>ZCTA: ${zctaName}`
                ttpSVG.node().innerHTML = ""

                data = result.data
                stats = result.stats

                stats.date.min = dayjs.tz(stats.date.min, "America/New_York").toDate()
                stats.date.max = dayjs.tz(stats.date.max, "America/New_York").toDate()

                // create y axis scaling (counts of hospitalizations)
                yScale = d3.scaleLinear()
                            .domain([stats.count.min, stats.count.max])        
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
                xScale = d3.scaleUtc([stats.date.min, stats.date.max], [ttpMargins.left, mapTooltipWidth - ttpMargins.right]) 
                yScale.range([mapTooltipHeight - ttpMargins.bottom, ttpMargins.top])

                // line generator
                line = d3.line()
                    .x((d) => xScale(d.date))
                    .y((d) => yScale(d.count))
                    .curve(d3.curveMonotoneX)

                // line to delineate prediction and historical data
                ttpSVG.append("line").attr("id", "tooltip-prediction-separator")
                
                // holds lines of linechart
                graphSVG = ttpSVG.append("svg")
                    .attr("id", "graph-svg")
                    .attr("height", mapTooltipHeight)
                    .attr("width", mapTooltipWidth)

                color = d3.scaleOrdinal(d3.schemeAccent).domain(Object.keys(data.historical))

                Object.entries(data.historical).forEach(function([dataSource, values]) {
                    // for each data source
                    historicalData = []
                    Object.entries(values).forEach(function([date, count]) {
                        date = dayjs.tz(date, "America/New_York").toDate()
                        historicalData.push({"date": date, "count": count})
                    })

                    // draw historical line chart
                    historicalGroup = graphSVG.append("g")
                    historicalGroup.append("path")
                        .attr("d", line(historicalData))
                        .attr("stroke", color(dataSource))
                        .attr("fill", "none")
                        .attr("stroke-width", 2)
    
                    // marks each datapoint on historical line
                    historicalGroup.selectAll("circle").data(historicalData)
                        .enter()
                        .append("circle")
                        .attr("r", 3)
                        .attr("cx", (d) => xScale(d.date))
                        .attr("cy", (d) => yScale(d.count))
                        .attr("stroke", color(dataSource))

                })

                Object.entries(data.prediction).forEach(function([dataSource, values]) {
                    // for each data source
                    predictiveData = []
                    Object.entries(values).forEach(function([date, count]) {
                        date = dayjs.tz(date, "America/New_York").toDate()
                        predictiveData.push({"date": date, "count": count})
                    })

                    // draw historical line chart
                    predictiveGroup = graphSVG.append("g")
                    predictiveGroup.append("path")
                        .attr("d", line(predictiveData))
                        .attr("stroke", color(dataSource))
                        .attr("fill", "none")
                        .attr("stroke-width", 2)
    
                    // marks each datapoint on prediction line
                    predictiveGroup.selectAll("circle").data(predictiveData)
                        .enter()
                        .append("circle")
                        .attr("r", 3)
                        .attr("cx", (d) => xScale(d.date))
                        .attr("cy", (d) => yScale(d.count))
                        .attr("stroke", color(dataSource))

                })

                // // Show confidence interval
                // predictiveGroup.append("path")
                //     .attr("class", "prediction-background")
                //     .datum(predictiveData)
                //     .style("fill", diseaseColorMap(disease))
                //     .style("opacity", 0.25)
                //     .attr("stroke", "none")
                //     .attr("d", d3.area()
                //         .x(function(d) { return xScale(d.date) })
                //         .y0(function(d, i) { return yScale(i == 0 ? d.count : d["min-prediction"]) })
                //         .y1(function(d, i) { return yScale(i == 0 ? d.count : d["max-prediction"]) })
                //         .curve(d3.curveMonotoneX)
                //     )

                if (predictiveData.length){
                    // highlights predictive data
                    graphSVG.append("rect")
                        .attr("id", "tooltip-prediction-highlighter")
                        .attr("x", xScale(predictiveData[0].date))
                        .attr("y", ttpMargins.top)
                        .attr("width", xScale(predictiveData[predictiveData.length - 1].date) - xScale(predictiveData[0].date))
                        .attr("height", mapTooltipHeight - ttpMargins.bottom - ttpMargins.top)

                    // place line separating historical and prediction data
                    ttpSVG.select("#tooltip-prediction-separator")
                        .attr("x1", xScale(predictiveData[0].date))
                        .attr("y1", ttpMargins.top)
                        .attr("x2", xScale(predictiveData[0].date))
                        .attr("y2", mapTooltipHeight - ttpMargins.bottom)
                }

                // display x-axis on the bottom
                ttpSVG.append("g")
                    .attr("transform", `translate(0,${mapTooltipHeight - ttpMargins.bottom})`)
                    .call(d3.axisBottom(xScale).tickSize(4).tickFormat(d3.timeFormat("%d %b %Y")))
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