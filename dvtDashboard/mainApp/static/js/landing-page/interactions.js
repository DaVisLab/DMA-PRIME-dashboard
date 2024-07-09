
navBar.addEventListener("sl-tab-show", (event) => {
    if (event.detail.name == "main") {
        navBar.show("map")
    }
})

mapAggregationSwitch.addEventListener("sl-change", (event) => {
    if(mapAggregationSwitch.value == "aggregated") {
        reset()
        mapSVG.selectAll(".zcta").transition().duration(750).style('fill', function(d) { return heatmapColorMap(d3.select(this).attr('count')) })
        mapSVG.selectAll("#color-legend").style("opacity", 1)
        highlightCounty(focusCounty)
    } else {
        reset()
        mapSVG.selectAll(".zcta").transition().duration(750).style("fill", "var(--sl-color-gray-800)")
        mapSVG.selectAll("#color-legend").style("opacity", 0)
        highlightCounty(focusCounty)
    }
})

zoomer = d3.zoom().scaleExtent([1, 10])
mapZoom = zoomer.on("zoom", function(e) {
    zoom = e.transform.k
    xSkew = e.transform.x
    ySkew = e.transform.y

    mapSVG.select("#counties").attr("transform", e.transform)
    mapSVG.select("#zctas").attr("transform", e.transform)
    mapSVG.select("#color-legend").attr("transform", d3.zoomIdentity)

    hospSize = Math.max(16, Math.min(width, height) * 0.015)
    mapSVG.select("#hospitals").selectAll(".hospital").each(function(d) {
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

mapResizer.addEventListener("sl-resize", () => {
    if (document.body.clientWidth * 20 / 100 < 220) {
        mainContent.setAttribute("position", 220 * 100 / document.body.clientWidth)
    } else {
        mainContent.setAttribute("position", 20)
    }
    resizeMap()
})

resetButton.addEventListener("click", () => {
    mapSVG.transition().duration(750).call(mapZoom.transform, d3.zoomIdentity.translate(0, 0).scale(1))
})

hospitalToggle.addEventListener("sl-change", () => {
    if(hospitalToggle.checked) {
        mapSVG.selectAll("#hospital-data").raise().style("opacity", 1)
        mapSVG.selectAll("#hospital-legend").style("opacity", 1)
    } else {
        mapSVG.selectAll("#hospital-legend").style("opacity", 0)
        mapSVG.selectAll("#hospital-data").lower().style("opacity", 0)
    }
})

showHospitalIcons.addEventListener("sl-change", () => {
    if(showHospitalIcons.checked) {
        mapSVG.select("#hospitals").raise().style("opacity", 1)
        mapSVG.selectAll("#disease-data").raise()
        mapSVG.selectAll("#hospital-data").raise()
    } else {
        mapSVG.select("#hospitals").lower().style("opacity", 0)
    }
})


function zoomToCounty(dom, data) {
    d3.select(dom).on('click', function(event) {
        reset()
        zcta = d3.select(this)
        county = d3.select("#"+zcta.attr("county"))
        countyData = county.data()[0]

        if (focusCounty == zcta.attr("county")) {
            resetButton.click()
            focusCounty = null
        } else {
            focusCounty = zcta.attr("county")

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
    if (focusCounty == null) {
        reset()
    } else {
        mapSVG.selectAll(".county").transition().duration(750).style("fill-opacity", .5)
        mapSVG.select("#"+county).transition().duration(750).style("fill-opacity", .0)
        mapSVG.select("#legends").raise()
        if (mapAggregationSwitch.value != "aggregated") {
            mapSVG.selectAll(".hospital-bubble").transition().duration(750)
                .style("fill", "var(--sl-color-gray-300)")
                .style("stroke", "var(--sl-color-gray-300)")
            mapSVG.selectAll(".hospital-bubble."+zcta.attr("county")).transition().duration(750)
                .style("opacity", 1)
                .style("fill", (d) => diseaseColorMap(d.disease))
                .style("stroke", (d) => diseaseColorMap(d.disease))
        }
    }
}

function reset() {
    mapSVG.selectAll(".county").transition().duration(750).style("fill-opacity", 0)
    mapSVG.selectAll(".hospital-bubble")
        .style("opacity", +(mapAggregationSwitch.value != "aggregated"))
        .style("fill", (d) => diseaseColorMap(d.disease))
        .style("stroke", (d) => diseaseColorMap(d.disease))
    mapSVG.select("#hospital-legend").style("opacity", +(mapAggregationSwitch.value != "aggregated"))
}

function removeTooltip(element) {
    element.on("pointermove", null)
    element.on("pointerleave", null)
    element.on("pointerenter", null)
}

function hospitalTooltip(element) {
    var tooltipWidth = 200
    var tooltipHeight = 130
    d3.select(tooltip).style("opacity", 0).style("z-index", -1)
    element.on("pointermove", function(e) {
        if((e.layerY + tooltipHeight + 1.5*em) < mapDiv.clientHeight) {
            tooltip.style.top = (e.layerY + 1.5*em) + "px"
        } else {
            tooltip.style.top = (e.layerY - tooltipHeight - 2.5*em) + "px"
        }
        if ((e.layerX + tooltipWidth) < mapDiv.clientWidth) {
            tooltip.style.left = e.layerX +"px"
        } else {
            tooltip.style.left = mapDiv.clientWidth - tooltipWidth + "px"
        }
    })
    element.on("pointerleave", function(e) {
        d3.select(tooltip)
            .style("opacity", 0)
            .style("z-index", -1)
    })

    element.on("pointerenter", function(e) {

        if(focusCounty != element.attr("county")) {
            return
        }
        
        tooltipWidth = Math.max(400, width * .1)
        tooltipHeight = tooltipWidth * .65

        ttp = d3.select(tooltip)
        ttp.style("opacity", 1).style("z-index", 1)
        ttpSVG = ttp.select("#tooltip-svg")
            .attr("height", tooltipHeight)
            .attr("width", tooltipWidth)

        data = element.data()[0]

        ttp.select("p.tooltip").node().innerHTML = `${element.attr("county")[0].toUpperCase() + element.attr("county").slice(1)}<br>ZCTA: ${data.properties.ZCTA5CE20}`
        ttpSVG.node().innerHTML = ""

        d3.json("/get-hospital-zcta-tooltip", { // hospital zcta data
            "method": "POST",
            "headers": {"Content-Type": "application/json"},
            "body": JSON.stringify({
                "region-name": data.properties.ZCTA5CE20,
                "disease": getVisibleHospitalDiseases().join(","),
                "date": hospitalMetadata.date[0]
            })}).then((result) => { 
                historicalTimeDomain = []
                result.metadata.date.historical.forEach(function(date) {
                    historicalTimeDomain.push(dayjs.tz(date, "America/New_York").toDate())
                })
                predictiveTimeDomain = []
                result.metadata.date.predictive.forEach(function(date) {
                    predictiveTimeDomain.push(dayjs.tz(date, "America/New_York").toDate())
                })
                fullTimeDomain = historicalTimeDomain.concat(predictiveTimeDomain)

                yScale = d3.scaleLinear()
                            .domain([result.stats.min, result.stats.max])        
                            .nice()

                temp = ttpSVG.append("text").text(yScale.domain()[1]).attr("x", 0).attr("y", 0)
                margins = {
                    "top": em, 
                    "bottom": 2.5*em,
                    "left": temp.node().getBBox().width + em,
                    "right": em,
                }
                temp.remove()

                yScale.range([tooltipHeight - margins.bottom, margins.top])
                xScale = d3.scaleUtc([fullTimeDomain[0], fullTimeDomain[fullTimeDomain.length - 1]], [margins.left, tooltipWidth - margins.right]) 
                line = d3.line()
                    .x((d) => xScale(d.date))
                    .y((d) => yScale(d.count))

                ttpSVG.append("line").attr("id", "tooltip-prediction-separator")
                
                graphSVG = ttpSVG.append("svg")
                    .attr("id", "graph-svg")
                    .attr("height", tooltipHeight)
                    .attr("width", tooltipWidth)

                Object.entries(result.data.historical).forEach(function([disease, values]) {
                    hospitalMetadata.date[0]
                    data = []
                    Object.entries(values).forEach(function([date, count]) {
                        date = dayjs.tz(date, "YYYY-MM", "America/New_York").toDate()
                        data.push({"date": date, "count": count})
                    })
                    diseaseGroup = graphSVG.append("g")
                    historicalGroup = diseaseGroup.append("g")
                    historicalGroup.append("path")
                        .attr("d", line(data))
                        .attr("stroke", diseaseColorMap(disease))
                        .attr("fill", "none")
    
                    historicalGroup.selectAll("circle").data(data)
                    .enter()
                    .append("circle")
                    .attr("r", 3)
                    .attr("cx", (d) => xScale(d.date))
                    .attr("cy", (d) => yScale(d.count))
                    .attr("fill", diseaseColorMap(disease))

                    predictiveData = [{
                        "date": dayjs.tz(hospitalMetadata.date[0], "YYYY-MM", "America/New_York").toDate(), 
                        "count": values[hospitalMetadata.date[0]]}]
                    Object.entries(result.data.predictive[disease]).forEach(function([date, count]) {
                        date = dayjs.tz(date, "YYYY-MM", "America/New_York").toDate()
                        predictiveData.push({"date": date, "count": count})
                    })

                    predictiveGroup = diseaseGroup.append("g")
                    predictiveGroup.append("path")
                        .attr("d", line(predictiveData))
                        .attr("stroke", diseaseColorMap(disease))
                        .attr("stroke-dasharray", "5,5")
                        .attr("fill", "none")
    
                    predictiveGroup.selectAll("circle").data(predictiveData.slice(1))
                    .enter()
                    .append("circle")
                    .attr("r", 3)
                    .attr("cx", (d) => xScale(d.date))
                    .attr("cy", (d) => yScale(d.count))
                    .attr("fill", diseaseColorMap(disease))

                })

                graphSVG.append("rect")
                    .attr("id", "tooltip-prediction-highlighter")
                    .attr("x", xScale(predictiveData[0].date))
                    .attr("y", margins.top)
                    .attr("width", xScale(predictiveData[predictiveData.length - 1].date) - xScale(predictiveData[0].date))
                    .attr("height", tooltipHeight - margins.bottom - margins.top)

                ttpSVG.select("#tooltip-prediction-separator")
                    .attr("x1", xScale(predictiveData[0].date))
                    .attr("y1", margins.top)
                    .attr("x2", xScale(predictiveData[0].date))
                    .attr("y2", tooltipHeight - margins.bottom)

                ttpSVG.append("g")
                .attr("transform", `translate(0,${tooltipHeight - margins.bottom})`)
                .call(d3.axisBottom(xScale).tickValues(fullTimeDomain).tickSize(4).tickFormat(d3.timeFormat("%b %Y")))
                .selectAll("text")  
                .style("text-anchor", "end")
                .attr("transform", "rotate(-30)");
    
                ttpSVG.append("g")
                .attr("transform", `translate(${margins.left},0)`)
                .call(d3.axisLeft(yScale).ticks(5).tickSize(4));
            })
    })
}

function generalTooltip(element) {
    var tooltipWidth = 0
    var tooltipHeight = 0
    element.on("pointerenter", function(e) {
        tooltip.innerHTML = ""
        data = element.data()[0]
        ttp = d3.select(tooltip)
        ttp.style("opacity", 1).style("z-index", 1).style("background")
        d3.selectAll(`.${element.attr("bubble-type")}-bubble.${data.region}.${data.date}`)
            .each(function(d) {
                p = ttp.append("p")
                .attr("class", "tooltip text")
                .text(`${d.disease}: ${f(d.count)}`)
            })
        tooltipWidth = ttp.node().scrollWidth
        tooltipHeight = ttp.node().clientHeight
    })
        
    element.on("pointermove", function(e) {
        if((e.layerY + tooltipHeight + 25) < mapDiv.clientHeight) {
            tooltip.style.top = (e.layerY + 25) + "px"
        } else {
            tooltip.style.top = (e.layerY - tooltipHeight - 10) + "px"
        }
        if ((e.layerX + tooltipWidth) < mapDiv.clientWidth) {
            tooltip.style.left = e.layerX +"px"
        } else {
            tooltip.style.left = mapDiv.clientWidth - tooltipWidth + "px"
        }
    })
    element.on("pointerleave", function(e) {
        d3.select(tooltip)
            .style("opacity", 0)
            .style("z-index", -1)
    })
}