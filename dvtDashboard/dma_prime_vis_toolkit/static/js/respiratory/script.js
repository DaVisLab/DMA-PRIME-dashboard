
export { zctaData, 
    startDate, currentWeek, endDate, historicalDates, allHistoricalDates, predictionDates, 
    dataSourceColorMap, dataVariableColorMap, gridLineStyle, unknownColor,
    gridItemDataSources, 
    parseDate, getDataAsArray, getBoundsOfCoords, getCenter,
    drawTooltip }


// data
var currentWeek = parseDate(metadata.current_week)

var startDate = parseDate(metadata.start_date)
var historicalDates = d3.timeDay.range(startDate, d3.timeDay.offset(currentWeek, 1), 7)

var minDate = parseDate(metadata.min_date)
var allHistoricalDates = d3.timeDay.range(minDate, d3.timeDay.offset(currentWeek, 1), 7)

var endDate = parseDate(metadata.end_date)
var predictionDates = d3.timeDay.range(currentWeek, d3.timeDay.offset(endDate, 1), 7)

const zctaData = await d3.json(`/data/respiratory/zcta/covid-19?data_version=${metadata.data_version}&${parseInt(Math.random()*9999999999)}`)
await Promise.allSettled([ // wait for following to be defined/load in
    customElements.whenDefined('sl-select'),
    customElements.whenDefined('sl-option'),
])

// visualization variables
var formatInt = d3.format(".0f")

let dataVersion = 0

var gridItemDataSources = ["state_encounters_historical", "health-system_encounters_historical"]

var unknownColor = d3.hsl("#CCCCCC")

var dataSourceColorMap = {
    "state": "#FFB000",
    "state-projected": "#FE6100",
    "health-system": "#648FFF",
    "health-system-projected": "#345FAF",
    "extra": "#785EF0",
    "extra-projected": "#382EA0",
}

var dataVariableColorMap = {
    "encounters": "#FFB000",
    "encounters-projected": "#FE6100",
    "positive-tests": "#648FFF",
    "positive-tests-projected": "#785EF0",
    "rt": "#AA4499",
    "rt-projected": "#882255",
}

var dataVariableStringMap = {
    "encounters": "Encounters",
    "positive-tests": "Positive Tests",
    "rt": "Transmission",
}

var gridLineStyle = {
    "health-system_encounters_historical": null,
    "state_encounters_historical": "5,5",
}

var dataSourceDisplayName = {
    'extra': {'state-encounters-reported': "State Reported Encounters"}
}

var ttpHistoryWidthPercentage = 3/4

var styleSheet = new CSSStyleSheet()

d3.selectAll('sl-tooltip').nodes().forEach((n, i) => {
    d3.select(n.shadowRoot).select("div[part='body']")
    .style('background-color', `hsla(${getComputedStyle(document.head).getPropertyValue("--sl-color-neutral-1000").replace("hsl(", "").replace(")", "")}, 0.925)`)
})

window.addEventListener("keydown", (event) => {
    if (event.key == "m") {
        function waitForChange() {
            if(changed != true) {
                window.setTimeout(waitForChange, 10);
            } else {
                styleSheet.deleteRule(0)
                styleSheet.insertRule(`
                    .tooltip-div {
                        /* tooltip's containing div */
                        background-color: hsla(${getComputedStyle(document.head).getPropertyValue("--sl-color-neutral-0").replace("hsl(", "").replace(")", "")}, 0.925);
                    }`
                    ,0)
                changed = false
            }
        }
        waitForChange()
    }
});

document.adoptedStyleSheets = [styleSheet]

// data fetching
function getDataAsArray(data, dataSource, dataVariable, histOrProj, rate, imputations=true) {
    var arr = data.features.map((d) => {
        var thisData = d.properties.data[dataSource][dataVariable][histOrProj]
        
        if (imputations || !d.properties.data.imputation) {
            if (rate) {
                return (parseFloat(thisData.at(-1)) || 0) * 1000 / d.properties.population
            } else {
                return parseFloat(thisData.at(-1)) || 1
            }
        }
    })

    return arr
}

// helper functions
function parseDate(dateString) {
    return dayjs(dateString, "YYYY-MM-DD").toDate()
}

function getBoundsOfCoords(coordinates) {
    var bounds = new maplibregl.LngLatBounds()
    function addCoordToBounds(bounds, arr) {
        if (Array.isArray(arr[0])) {
            arr.forEach(a => {
                addCoordToBounds(bounds, a)
            })
        } else {
            bounds.extend(arr)
            return
        }
    }
    addCoordToBounds(bounds, coordinates)
    return bounds
}

function getCenter(feature) {
    var coordinates = [feature.properties.INTPTLON, feature.properties.INTPTLAT]

    if (!(coordinates[0] && coordinates[1])) {
        coordinates = getBoundsOfCoords(feature.geometry.coordinates).getCenter()
        coordinates = [coordinates.lng, coordinates.lat]
    } else {
        coordinates[0] = fixCoord(coordinates[0])
        coordinates[1] = fixCoord(coordinates[1])    
    }
    return coordinates
}

function fixCoord(coord) {
    while (coord[1] == "0") {
        coord = coord[0] + coord.slice(2)
    }
    return parseFloat(coord)
}

function drawTooltip(d, ttpSVG, header, footer, dataSource, dataVariable, rate=false, grid=false, allDates=false, extraSourcesAndVariables={}) {
    // handy
    var historicalDatesArray = allDates ? allHistoricalDates : historicalDates
    var mainDataSrc = dataSource
    var mainDataVar = dataVariable

    var data = JSON.parse(JSON.stringify(d)) // don't want to mess up og data
    var mainData = data.data[dataSource][dataVariable]

    function drawMainHistoricalGraph(g, data, historicalDates, dataSrc, allDates, xScale, yScale, rate) {
        if (allDates){
            g.append("path")
                .attr("d", d3.area()
                            .x((_, i) => xScale(historicalDates[i]))
                            .y0(yScale(0))
                            .y1((d) => yScale(d))
                            .defined(d => d !== null)
                            // .curve(d3.curveMonotoneX)
                            (data)
                )
                .attr("fill", dataSourceColorMap[dataSrc])
        } else {
            var historicalBarWidth = Math.ceil(ttpGraphWidth*ttpHistoryWidthPercentage / historicalDates.length)
            g.append("g")
                .selectAll("rect")
                .data(data)
                .enter()
                .append("rect")
                .attr("x", (_, i) => {return xScale(historicalDates[i])})
                .attr("y", d => {return yScale(d)})
                .attr("height", d => yScale(0) - yScale(d))
                .attr("width", historicalBarWidth)
                .attr("fill", dataSourceColorMap[dataSrc])
                .attr("transform", `translate(-${historicalBarWidth}, 0)`)
                .on("mouseover", function(event, d) {
                    if (d !== null) {
                        var formatDate = d3.timeFormat("%b %d, %Y")
                        var dateStr = formatDate(historicalDates[data.indexOf(d)])
                        var countStr = rate ? `${d.toFixed(2)} per 1000` : d.toString()
                        
                        // Create tooltip element
                        var tooltip = d3.select("body").append("div")
                            .attr("class", "chart-tooltip")
                            .style("position", "absolute")
                            .style("background", "rgba(0, 0, 0, 0.8)")
                            .style("color", "white")
                            .style("padding", "8px 12px")
                            .style("border-radius", "4px")
                            .style("font-size", "12px")
                            .style("pointer-events", "none")
                            .style("z-index", "1000")
                        
                        tooltip.append("div").text(`Date: ${dateStr}`)
                        tooltip.append("div").text(`Count: ${countStr}`)
                        
                        // Position tooltip
                        var tooltipWidth = tooltip.node().getBoundingClientRect().width
                        var tooltipHeight = tooltip.node().getBoundingClientRect().height
                        var x = event.pageX + 10
                        var y = event.pageY - tooltipHeight - 10
                        
                        // Adjust if tooltip goes off screen
                        if (x + tooltipWidth > window.innerWidth) {
                            x = event.pageX - tooltipWidth - 10
                        }
                        if (y < 0) {
                            y = event.pageY + 10
                        }
                        
                        tooltip.style("left", x + "px")
                            .style("top", y + "px")
                    }
                })
                .on("mouseout", function() {
                    d3.selectAll(".chart-tooltip").remove()
                })
        }
    }
    
    // get dimensions
    var ttpHeight = ttpSVG.node().clientHeight
    var ttpWidth = ttpSVG.node().clientWidth

    // to use later
    ttpSVG.datum({"extraSourcesAndVariables": extraSourcesAndVariables})

    // create titles/subtitles
    var dataVarString = dataVariableStringMap[dataVariable]
    var regionInfo = header.select(".tooltip-region-info")
    regionInfo.node().innerHTML = ""
    if (grid) {
        regionInfo.append("p").html(`ZCTA: ${data.id}`)
    } else {
        if (mapRegionSelector.value != "state") {
            regionInfo.append("p").html(`${metadata.region_sizes[mapRegionSelector.value]}: ${data.id}`)
        } else {
            regionInfo.append("p").html("State")
        }
    }
    if (mapRegionSelector.value == "zcta" || grid) {
        regionInfo.append("p").html(`County: ${data.county[0].toUpperCase()+data.county.substring(1)}`)
    }

    var dataInfo = header.select(".tooltip-data-info")
    dataInfo.node().innerHTML = ""
    if (rate) {
        dataInfo.append("p").html(`Rate of ${dataVarString} (per 1000 people)`)
    } else {
        dataInfo.append("p").html(`Count of ${dataVarString}`)
    }
    if (mainData.historical.length) {
        let tempDate = parseDate(metadata['start_date'])
        let tempEndDate = parseDate(metadata['current_week'])
        var formatDate = d3.timeFormat("%b %d, %Y")
        var tooltipString = `${dataSource == "state" ? "Estimated" : ""} ${dataVarString} from ${formatDate(tempDate)} to ${formatDate(tempEndDate)}`
        dataInfo.append("p").html(tooltipString)
        if (mainData.projected.length) {
            tempDate = parseDate(metadata['current_week'])
            tempEndDate = parseDate(metadata['end_date'])
            tooltipString = `Projected ${dataVarString} from ${formatDate(tempDate)} to ${formatDate(tempEndDate)}`
            dataInfo.append("p").html(tooltipString)  
        }
    }

    var ttpOptions = footer.select(".tooltip-options").html("")

    if (!allDates) {
        var expandPopupButton = ttpOptions.append("sl-button")
            .attr("size", "small")
            .attr("variant", "default")
            .html("Expand Graph")

        expandPopupButton.on("click", () => {
            var largeTtp = d3.select(tooltipLarge)
            tooltipLarge.show().then(async () => {
                var allExtendedData
                if (grid) {
                    allExtendedData = await d3.json(`/data/respiratory/zcta/${gridDiseaseSelector.value}/extended?data_version=${metadata.data_version}&${parseInt(Math.random() * 9999999999)}`)
                } else {
                    allExtendedData = await d3.json(`/data/respiratory/${mapRegionSelector.value}/${mapDiseaseSelector.value}/extended?data_version=${metadata.data_version}&${parseInt(Math.random() * 9999999999)}`)
                }
                var ttpData = {
                    "id": data.id,
                    "county": data.county,
                    "data": allExtendedData[data.id]
                }
                if (grid) {
                    var [gridDataSource, gridDataVariable, _] = gridDataSourceSortSelector.value.split('_')
                    drawTooltip(ttpData,
                        largeTtp.select(".tooltip-outer-svg"), largeTtp.select(".tooltip-header"), largeTtp.select(".tooltip-footer"),
                        gridDataSource, gridDataVariable,
                        gridRateSwitch.value == "rate", grid, true, {})
                } else {
                    drawTooltip(ttpData,
                        largeTtp.select(".tooltip-outer-svg"), largeTtp.select(".tooltip-header"), largeTtp.select(".tooltip-footer"),
                        mapDataSourceSelector.value, mapDataVariableSelector.value,
                        mapTypeSwitch.value == "rate", grid, true, {})
                }
            })
        })
    }

    if (dataSource == "state") {
        Object.entries({
            // "extra": ["state-encounters-reported"],
            "health-system": ["encounters"],
        }).forEach(function([ds, dvs], i) {
            dvs.forEach(function(dv) {
                // Check if health system data exists
                var hasData = data.data[ds] && 
                             data.data[ds][dv] && 
                             data.data[ds][dv].historical && 
                             data.data[ds][dv].historical.length > 0

                var buttonText
                try {
                    buttonText = `${d3.select(mapDataSourceSelector).select(`*[value=${ds}]`).html()} ${d3.select(mapDataVariableSelector).select(`*[value=${dv}]`).html()}`
                } catch{
                    buttonText = dataSourceDisplayName[ds][dv]
                }

                if (extraSourcesAndVariables[ds] !== undefined && extraSourcesAndVariables[ds].includes(dv)) {
                    buttonText = "Remove " + buttonText
                } else {
                    buttonText = "Add " + buttonText
                }

                var button = ttpOptions.append("sl-button")
                    .html(buttonText)
                    .attr("size", "small")

                // Disable button if no data exists
                if (!hasData) {
                    button.attr("disabled", true)
                }

                button.node().updateComplete.then(() => {
                    var buttonBase = d3.select(button.node().shadowRoot).select("[part=base]")
                    if (hasData) {
                        buttonBase
                            .style("background-color", "white")
                            .style("border-color", dataSourceColorMap[ds])
                            .style("color", dataSourceColorMap[ds])
                    } else {
                        buttonBase
                            .style("background-color", "var(--sl-color-gray-100)")
                            .style("border-color", "var(--sl-color-gray-300)")
                            .style("color", "var(--sl-color-gray-500)")
                    }
                })

                function ttpOptionsHandler(extraSourcesAndVariables, dataSource, dataVariable) {
                    // toggle data source-var combo
                    if (extraSourcesAndVariables[dataSource] !== undefined) {
                        if (extraSourcesAndVariables[dataSource].includes(dataVariable)) {
                            extraSourcesAndVariables[dataSource].splice(extraSourcesAndVariables[dataSource].indexOf(dataVariable), 1)
                        } else {
                            extraSourcesAndVariables[dataSource].push(dataVariable)
                        }
                    } else {
                        extraSourcesAndVariables[dataSource] = [dataVariable]
                    }
                    drawTooltip(d, 
                        ttpSVG, header, footer, 
                        mainDataSrc, mainDataVar, 
                        rate, grid, allDates, extraSourcesAndVariables)
                }
                
                // Only add click handler if data exists
                if (hasData) {
                    button.on("click", () => {ttpOptionsHandler(extraSourcesAndVariables, ds, dv)})
                }

                var icon = button.append("sl-icon")
                    .attr("slot", "prefix")
                    .attr("name", "graph-up")
                    .style("color", hasData ? dataSourceColorMap[ds] : "var(--sl-color-gray-500)")

            })
            
        })

    }
    
    // Add State Encounters button for expanded tooltip only
    if (allDates && dataSource == "state") {
        var hasStateEncountersData = data.data.extra && 
                                     data.data.extra["state-encounters-reported"] && 
                                     data.data.extra["state-encounters-reported"].historical && 
                                     data.data.extra["state-encounters-reported"].historical.length > 0

        var stateEncountersButtonText = "State Encounters"
        if (extraSourcesAndVariables["extra"] !== undefined && extraSourcesAndVariables["extra"].includes("state-encounters-reported")) {
            stateEncountersButtonText = "Remove " + stateEncountersButtonText
        } else {
            stateEncountersButtonText = "Add " + stateEncountersButtonText
        }

        var stateEncountersButton = ttpOptions.append("sl-button")
            .html(stateEncountersButtonText)
            .attr("size", "small")

        // Disable button if no data exists
        if (!hasStateEncountersData) {
            stateEncountersButton.attr("disabled", true)
        }

        stateEncountersButton.node().updateComplete.then(() => {
            var buttonBase = d3.select(stateEncountersButton.node().shadowRoot).select("[part=base]")
            if (hasStateEncountersData) {
                buttonBase
                    .style("background-color", "white")
                    .style("border-color", dataSourceColorMap["extra"])
                    .style("color", dataSourceColorMap["extra"])
            } else {
                buttonBase
                    .style("background-color", "var(--sl-color-gray-100)")
                    .style("border-color", "var(--sl-color-gray-300)")
                    .style("color", "var(--sl-color-gray-500)")
            }
        })

        function stateEncountersHandler(extraSourcesAndVariables) {
            // toggle state encounters
            if (extraSourcesAndVariables["extra"] !== undefined) {
                if (extraSourcesAndVariables["extra"].includes("state-encounters-reported")) {
                    extraSourcesAndVariables["extra"].splice(extraSourcesAndVariables["extra"].indexOf("state-encounters-reported"), 1)
                } else {
                    extraSourcesAndVariables["extra"].push("state-encounters-reported")
                }
            } else {
                extraSourcesAndVariables["extra"] = ["state-encounters-reported"]
            }
            drawTooltip(d, 
                ttpSVG, header, footer, 
                mainDataSrc, mainDataVar, 
                rate, grid, allDates, extraSourcesAndVariables)
        }
        
        // Only add click handler if data exists
        if (hasStateEncountersData) {
            stateEncountersButton.on("click", () => {stateEncountersHandler(extraSourcesAndVariables)})
        }

        var stateEncountersIcon = stateEncountersButton.append("sl-icon")
            .attr("slot", "prefix")
            .attr("name", "graph-up")
            .style("color", hasStateEncountersData ? dataSourceColorMap["extra"] : "var(--sl-color-gray-500)")
    }

    /* Draw Graph */
    // reset tooltip contents for new data
    ttpSVG.node().innerHTML = ""
    var graphSVG = ttpSVG.append("svg")
        .attr("class", "tooltip-graph-svg")
        .attr("height", ttpHeight)
        .attr("width", ttpWidth)
    graphSVG.append("line")
        .attr("class", "tooltip-prediction-separator")

    var yAxis = ttpSVG.append("g")
        .attr("class", "y-axis")
    var xAxisHistorical = ttpSVG.append("g")
        .attr("class", "x-axis-historical")
    var xAxisPrediction = ttpSVG.append("g")
        .attr("class", "x-axis-prediction")
    var ttpLegend = ttpSVG.append("g").attr("class", "tooltip-legend")

    // apply rate if necessaryand figure out axes scaling
    var countMax = rate ? 1/d.population : 1 // so y scale is never 0-0

    for (let [dataSrc, dataVars] of [...Object.entries(extraSourcesAndVariables), [dataSource, [dataVariable]]]) {
        for (let dataVar of dataVars) {
            if (rate) {
                data.data[dataSrc][dataVar].historical = data.data[dataSrc][dataVar].historical.map(function(item) { return item === null ? null : item/d.population * 1000})
                data.data[dataSrc][dataVar].projected = data.data[dataSrc][dataVar].projected.map(function(item) { return item === null ? null : item/d.population * 1000})
            }
            if (data.data[dataSrc][dataVar].historical.length && data.data[dataSrc][dataVar].projected.length) {
                countMax = d3.max([...data.data[dataSrc][dataVar].historical, ...data.data[dataSrc][dataVar].projected, countMax])
            }
        }
    }

    // figure out how much space is needed for the y-axis text
    var temp = ttpSVG.append("text").text(d3.format(".2r")(countMax)).attr("x", 0).attr("y", 0)
    var ttpMargins = {
        "top": 1*em, 
        "bottom": 2.5*em,
        "left": Math.max(20, temp.node().getBBox().width) + 2*em,
        "right": em,
    }
    var ttpGraphWidth = ttpWidth - ttpMargins.right - ttpMargins.left

    var yScale = d3.scaleLinear()
        .domain([0, countMax])        
        .nice()
        .range([ttpHeight-ttpMargins.bottom, ttpMargins.top])

    var xScaleHistorical = d3.scaleTime()
    var xScalePrediction = d3.scaleTime()
        .domain(d3.extent(predictionDates))
        .range([ttpMargins.left + ttpGraphWidth*ttpHistoryWidthPercentage, ttpWidth - ttpMargins.right]) 

    if (allDates) {
        xScaleHistorical.domain(d3.extent(historicalDatesArray))
                        .range([ttpMargins.left, ttpMargins.left + ttpGraphWidth*ttpHistoryWidthPercentage]) 
    } else {
        xScaleHistorical.domain([d3.timeDay.offset(startDate, -7), currentWeek])
                        .range([ttpMargins.left + 1, ttpMargins.left + ttpGraphWidth*ttpHistoryWidthPercentage]) 
    }

    // draw historical data for selected data var
    var historicalGroup = graphSVG.append("g")
    drawMainHistoricalGraph(historicalGroup, mainData.historical, historicalDatesArray, mainDataSrc, allDates, xScaleHistorical, yScale, rate)

    // draw projected data for selected data var
    var stateCurrentLabelPositionAbove = null
    
    if (mainData.projected.length > 1) {
        // highlights predictive data  
        graphSVG.append("rect")
            .attr("class", "tooltip-prediction-highlighter")
            .attr("x", xScalePrediction.range()[0])
            .attr("y", ttpMargins.top)
            .attr("width", xScalePrediction.range()[1] - xScalePrediction.range()[0])
            .attr("height", ttpHeight - ttpMargins.bottom - ttpMargins.top)
        
            // draw predictive line chart
        var predictiveGroup = graphSVG.append("g")
        predictiveGroup.append("path")
            .attr("d", d3.area()
                        .x((_, i) => xScalePrediction(predictionDates[i]))
                        .y0(yScale(0))
                        .y1((d) => yScale(d))
                        .defined(d => d !== null)
                        .curve(d3.curveMonotoneX)(mainData.projected)
            )
            .attr("fill", dataSourceColorMap[`${mainDataSrc}-projected`])

        // marks each datapoint on prediction line
        predictiveGroup.selectAll("circle").data(mainData.projected)
            .enter()
            .append("circle")
            .attr("r", 3)
            .attr("cx", (_, i) =>  xScalePrediction(predictionDates[i]))
            .attr("cy", (d) => yScale(d))
            .style("opacity", (d) => {return d === null ? 0 : 1})
            .attr("stroke", dataSourceColorMap[`${mainDataSrc}-projected`])
            .on("mouseover", function(event, d) {
                if (d !== null) {
                    var formatDate = d3.timeFormat("%b %d, %Y")
                    var dateStr = formatDate(predictionDates[mainData.projected.indexOf(d)])
                    var countStr = rate ? `${d.toFixed(2)} per 1000` : d.toString()
                    
                    // Create tooltip element
                    var tooltip = d3.select("body").append("div")
                        .attr("class", "chart-tooltip")
                        .style("position", "absolute")
                        .style("background", "rgba(0, 0, 0, 0.8)")
                        .style("color", "white")
                        .style("padding", "8px 12px")
                        .style("border-radius", "4px")
                        .style("font-size", "12px")
                        .style("pointer-events", "none")
                        .style("z-index", "1000")
                    
                    tooltip.append("div").text(`Date: ${dateStr}`)
                    tooltip.append("div").text(`Count: ${countStr}`)
                    
                    // Position tooltip
                    var tooltipWidth = tooltip.node().getBoundingClientRect().width
                    var tooltipHeight = tooltip.node().getBoundingClientRect().height
                    var x = event.pageX + 10
                    var y = event.pageY - tooltipHeight - 10
                    
                    // Adjust if tooltip goes off screen
                    if (x + tooltipWidth > window.innerWidth) {
                        x = event.pageX - tooltipWidth - 10
                    }
                    if (y < 0) {
                        y = event.pageY + 10
                    }
                    
                    tooltip.style("left", x + "px")
                        .style("top", y + "px")
                }
            })
            .on("mouseout", function() {
                d3.selectAll(".chart-tooltip").remove()
            })

        // place line separating historical and prediction data
        ttpSVG.select(".tooltip-prediction-separator")
            .attr("x1", xScalePrediction.range()[0])
            .attr("y1", ttpMargins.top)
            .attr("x2", xScalePrediction.range()[0])
            .attr("y2", ttpHeight - ttpMargins.bottom)

        stateCurrentLabelPositionAbove = mainData.projected[0] > mainData.projected[1]
    }

    // Draw extra data sources/vars
    Object.entries(extraSourcesAndVariables).forEach(function([ds, dvs]) {
        dvs.forEach(function(dv) {
            var thisData = data.data[ds][dv]

            // draw historical line chart
            historicalGroup.append("path")
                .attr("d", d3.line()
                    .x((_, i) => xScaleHistorical(historicalDatesArray[i]))
                    .y((d, i) => yScale(d))
                    .curve(d3.curveMonotoneX)(thisData.historical)
                )
                .attr("stroke", dataSourceColorMap[ds])
                .attr("fill", "none")
                .attr("stroke-width", 3)

            // draw historical line chart
            predictiveGroup.append("path")
                .attr("d", d3.line()
                    .x((_, i) => xScalePrediction(predictionDates[i]))
                    .y((d, i) => yScale(d))
                    .curve(d3.curveMonotoneX)(thisData.projected)
                )
                .attr("stroke", dataSourceColorMap[`${ds}-projected`])
                .attr("fill", "none")
                .attr("stroke-width", 3)
            
        })
        
    })

    // draw legend
    var ttpLegend = footer.select(".tooltip-legend").html("")

    // Add main data source to legend items
    var ttpLegendGroup = ttpLegend.append("div").attr("class", "tooltip-legend-group")
    Array(mainDataSrc, `${mainDataSrc}-projected`).forEach(function(dataSrc, i) {
        var ttpLegendGroupItem = ttpLegendGroup.append("div")
            .attr("class", `tooltip-legend-group-item ${dataSrc}`)
        ttpLegendGroupItem.append("sl-icon")
            .attr("name", "square-fill")
            .style("color", dataSourceColorMap[dataSrc])
        ttpLegendGroupItem.append("p")
            .attr("class", "tooltip-label")
            .attr("font-size", "var(--sl-font-size-small)")
            .attr("color", dataSourceColorMap[dataSrc])
            .text(() => {
                var text = dataVarString
                if (i == 0 && mainDataSrc == "state") {
                    text += ' (estimated)'
                }
                if (i == 1) {
                    text += ' (projected)'
                }
                return text})
    })

    Object.entries(extraSourcesAndVariables).forEach(function([ds, dvs]) {
        dvs.forEach(function(dv) {
            ttpLegendGroup = ttpLegend.append("div").attr("class", "tooltip-legend-group")
            Array(ds, `${ds}-projected`).forEach(function(dataSrc, i) {
                var ttpLegendGroupItem = ttpLegendGroup.append("div")
                    .attr("class", `tooltip-legend-group-item ${dataSrc}`)
                ttpLegendGroupItem.append("sl-icon")
                    .attr("name", "square-fill")
                    .style("color", dataSourceColorMap[dataSrc])
                ttpLegendGroupItem.append("p")
                    .attr("class", "tooltip-label")
                    .attr("font-size", "var(--sl-font-size-small)")
                    .attr("color", dataSourceColorMap[dataSrc])
                    .text(() => {
                        var text = dataVarString
                        if (i == 0 && mainDataSrc == "state") {
                            text += ' (estimated)'
                        }
                        if (i == 1) {
                            text += ' (projected)'
                        }
                        return text})
            })
        })
    })

    // display x-axis on the bottom
    xAxisHistorical // historical
        .attr("transform", `translate(0,${ttpHeight - ttpMargins.bottom})`)
        .call(d3.axisBottom(xScaleHistorical)
            .tickSize(4)
            .tickFormat((d, i) => xScaleHistorical.range()[1] - xScaleHistorical(d) > 2*em ? d3.timeFormat("%b %Y")(d) : ""))
        .selectAll("text") 
        .attr("class", "tooltip-label")
        .style("text-anchor", "end")
        .attr("fill", "var(--sl-color-neutral-1000)")
        .attr("transform", "rotate(-40)");
    xAxisHistorical.selectAll("path, line")
        .attr("stroke", "var(--sl-color-neutral-1000)")

    xAxisPrediction //prediction
        .attr("transform", `translate(0,${ttpHeight - ttpMargins.bottom})`)
        .call(d3.axisBottom(xScalePrediction).tickValues(predictionDates).tickSize(4).tickFormat(d3.timeFormat("%d %b")))
        .selectAll("text")  
        .attr("class", "tooltip-label")
        .style("text-anchor", "end")
        .attr("fill", "var(--sl-color-neutral-1000)")
        .attr("transform", "rotate(-40)");
    xAxisPrediction.selectAll("path, line")
        .attr("stroke", "var(--sl-color-neutral-1000)")

    // display y-axis on the left
    yAxis.append("text")
        .attr("transform", `translate(${1.25*em},${yScale(d3.mean(yScale.domain()))})rotate(-90)`)
        .attr("text-anchor", "middle")
        .attr("fill", "var(--sl-color-neutral-1000)")
        .attr("font-size", "var(--sl-font-size-small)")
        .text(dataVarString)

    yAxis.append("g")
        .attr("transform", `translate(${ttpMargins.left},0)`)
        .call(d3.axisLeft(yScale).ticks(5).tickSize(4))
        .selectAll("text")
        .attr("class", "tooltip-label")
        .attr("fill", "var(--sl-color-neutral-1000)")
    yAxis.selectAll("path, line")
        .attr("stroke", "var(--sl-color-neutral-1000)")

    temp.remove()

}
