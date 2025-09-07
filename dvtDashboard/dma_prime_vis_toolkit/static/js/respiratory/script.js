
export { zctaData, 
    populationColorMap, dataSourceColorMap, gridLineStyle, unknownColor,
    outcomeVariableStringCrosswalk,
    gridItemDataSources, 
    getDataAsArray, getBoundsOfCoords, getCenter,
    drawTooltip }


// data
const zctaData = await d3.json(`/data/respiratory/zcta/covid_19?data_version=${metadata.data_version}&${parseInt(Math.random()*9999999999)}`)
await Promise.allSettled([ // wait for following to be defined/load in
    customElements.whenDefined('sl-select'),
    customElements.whenDefined('sl-option'),
])

// visualization variables
var formatInt = d3.format(".0f")
var formatDate = d3.timeFormat("%b %d, %Y")

let dataVersion = 0

var gridItemDataSources = ["state_encounters_historical", "health-system_encounters_historical"]

var unknownColor = d3.hsl("#CCCCCC")

var dataSourceColorMap = {
    "health_system": "#648FFF",
    "RFA": "#785EF0",
    // "RFA-projected": "#382EA0", //this doesn't make sense with our current system but I wanted to save the color as it goes with the above
}

var populationColorMap = {
    "general_population": {"historical": "#FFB000", "projected": "#FE6100"},
    "health_system": {"historical": "#648FFF", "projected": "#345FAF"},
}

// lior nixed this :c
// var outcomeVariableColorMap = {
//     "encounters": "#FFB000",
//     "encounters-projected": "#FE6100",
//     "positive-tests": "#648FFF",
//     "positive-tests-projected": "#785EF0",
//     "rt": "#AA4499",
//     "rt-projected": "#882255",
// }

var outcomeVariableStringCrosswalk = {
    "encounters": "Encounters",
    "inpatient_hospitalizations": "Inpatient Hospitalizations",
    "emergency_department_visits": "Emergency Department Visits",
    "positive_tests": "Positive Tests",
    "rate_of_transmission": "Transmission",
}

var gridLineStyle = {
    "health-system_encounters_historical": null,
    "state_encounters_historical": "5,5",
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
function getDataAsArray(data, population, outcomeVariable, histOrProj, rate, imputations=true) {
    var arr = data.features.map((d) => {
        var thisData = d.properties.data[population][outcomeVariable][histOrProj]
        
        if (imputations || !thisData.imputed) {
            if (rate) {
                return (parseFloat(thisData.values.at(expectedShortHistoryDataPoints-1)) || 0) * 1000 / d.properties.population
            } else {
                return parseFloat(thisData.values.at(expectedShortHistoryDataPoints-1)) || 1
            }
        }
    })

    return arr
}

// helper functions
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

function drawTooltip(d, ttpSVG, header, footer, population, outcomeVariable, rate=false, grid=false, allDates=false, extraSources=[]) {
    
// The beginning bits
    var historicalDatesArray = allDates ? allHistoricalDates : shortHistoryDates
    var featureData = JSON.parse(JSON.stringify(d))

    var identifier = featureData.id
    var data = featureData.data[population][outcomeVariable]
    data.projected.start_date = parseDate(data.projected.start_date)

    // get dimensions
    var ttpHeight = ttpSVG.node().clientHeight
    var ttpWidth = ttpSVG.node().clientWidth

    // to use later
    ttpSVG.datum({"extraSources": extraSources})

// create titles/subtitles
    var outcomeVariableString = outcomeVariableStringCrosswalk[outcomeVariable]
    
    var regionInfo = header.select(".tooltip-region-info")
    regionInfo.node().innerHTML = ""
    if (grid) {
        regionInfo.append("p").html(`ZCTA: ${identifier}`)
    } else {
        if (mapRegionSelector.value != "state") {
            regionInfo.append("p").html(`${metadata.region_sizes[mapRegionSelector.value]}: ${identifier}`)
        } else {
            regionInfo.append("p").html("South Carolina")
        }
    }
    if (mapRegionSelector.value == "zcta" || grid) {
        // TODO: Make county names display correctly (e.g. McCormick instead of Mccormick)
        regionInfo.append("p").html(`County: ${featureData.county[0].toUpperCase()+featureData.county.substring(1)}`)
    }

    var dataInfo = header.select(".tooltip-data-info")
    dataInfo.node().innerHTML = ""
    if (rate) {
        dataInfo.append("p").html(`Rate of ${outcomeVariableString} (per 1000 people)`)
    } else {
        dataInfo.append("p").html(`Count of ${outcomeVariableString}`)
    }
    if (data.historical.values.length) {
        var tooltipString = `${data["historical"].reported ? "Reported" : ""} ${outcomeVariableString} from ${formatDate(historicalDatesArray[0])} to ${formatDate(historicalDatesArray.at(-1))}`
        dataInfo.append("p").html(tooltipString)
    }
    if (data.projected.values.length) {
        let thisProjectedEndDate = d3.timeDay.offset(data.projected.start_date, 7*(data.projected.values.length-1))
        var tooltipString = `Projected ${outcomeVariableString} from ${formatDate(data.projected.start_date)} to ${formatDate(thisProjectedEndDate)}`
        dataInfo.append("p").html(tooltipString)  
    }

// add buttons and legends
    var ttpLegend = footer.select(".tooltip-legend").html("")
    var ttpOptions = footer.select(".tooltip-options").html("")

    var ttpLegendGroup = ttpLegend.append("div").attr("class", "tooltip-legend-group")

    Array("historical", "projected").forEach(function(e_p) {
        var ttpLegendGroupItem = ttpLegendGroup.append("div")
            .attr("class", `tooltip-legend-group-item ${e_p}`)
        ttpLegendGroupItem.append("sl-icon")
            .attr("name", "square-fill")
            .style("color", populationColorMap[population][e_p])
        ttpLegendGroupItem.append("p")
            .attr("class", "tooltip-label")
            .attr("font-size", "var(--sl-font-size-small)")
            .attr("color", populationColorMap[population][e_p])
            .text(() => {
                var text = outcomeVariableString
                if (e_p == "projected") {
                    text += ' (projected)'
                } else {
                    text += data[e_p].reported ? ' (reported)' : ' (estimated)'
                }
                return text})
    })

    if (!allDates) { // add button to expand to large ttp
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
                    "id": identifier,
                    "county": data.county,
                    "data": allExtendedData[identifier]
                }
                if (grid) {
                    var [gridDataSource, gridDataVariable, _] = gridDataSourceSortSelector.value.split('_')
                    drawTooltip(ttpData,
                        largeTtp.select(".tooltip-outer-svg"), largeTtp.select(".tooltip-header"), largeTtp.select(".tooltip-footer"),
                        gridDataSource, gridDataVariable,
                        gridRateSwitch.value == "rate", grid, true, [])
                } else {
                    drawTooltip(ttpData,
                        largeTtp.select(".tooltip-outer-svg"), largeTtp.select(".tooltip-header"), largeTtp.select(".tooltip-footer"),
                        mapPopulationSelector.value, mapOutcomeVariableSelector.value,
                        mapTypeSwitch.value == "rate", grid, true, [])
                }
            })
        })
    }

    if (['encounters', 'inpatient_hospitalizations', 'emergency_department_visits'].includes(outcomeVariable)) {
        function ttpOptionsHandler(extraSources, dataSource) {
            // toggle data source-var combo
            if (extraSources.includes(dataSource)) {
                extraSources.splice(extraSources.indexOf(dataSource), 1)
            } else {
                extraSources.push(dataSource)
            }
            drawTooltip(d, 
                ttpSVG, header, footer, 
                population, outcomeVariable, 
                rate, grid, allDates, extraSources)
        }
        
        Object.entries({
            'health_system': 'Health System',
            'RFA': 'RFA',
        }).entries().forEach(function(entry) {
            var ds = entry[1][0]
            var dsS = entry[1][1]
            
            var buttonText = `${dsS} ${outcomeVariableString}`
            if (extraSources.includes(ds)) {

                var ttpLegendGroup = ttpLegend.append("div").attr("class", "tooltip-legend-group")
                var ttpLegendGroupItem = ttpLegendGroup.append("div")
                    .attr("class", `tooltip-legend-group-item historical`)
                ttpLegendGroupItem.append("sl-icon")
                    .attr("name", "square-fill")
                    .style("color", dataSourceColorMap[ds])
                ttpLegendGroupItem.append("p")
                    .attr("class", "tooltip-label")
                    .attr("font-size", "var(--sl-font-size-small)")
                    .attr("color", dataSourceColorMap[ds])
                    .text(() => `${buttonText} (reported)`)
                buttonText = "Remove " + buttonText
            } else {
                buttonText = "Add " + buttonText
            }

            var button = ttpOptions.append("sl-button")
                .html(buttonText)
                .attr("size", "small")

            button.node().updateComplete.then(() => {
                var buttonBase = d3.select(button.node().shadowRoot).select("[part=base]")
                    .style("background-color", "white")
                    .style("border-color", dataSourceColorMap[ds])
                    .style("color", dataSourceColorMap[ds])
            })

            var icon = button.append("sl-icon")
                .attr("slot", "prefix")
                .attr("name", "graph-up")

            if (data.extra[ds] && data.extra[ds].length) {
                button.on("click", () => {ttpOptionsHandler(extraSources, ds)})
                icon.style("color", dataSourceColorMap[ds])
            } else {
                button.attr("disabled", true)
                icon.style("color", "var(--sl-color-gray-500)")
            }

        })
    }

// Reset svg and get it ready for new viz
    ttpSVG.node().innerHTML = ""
    var graphSVG = ttpSVG.append("svg")
        .attr("class", "tooltip-graph-svg")
        .attr("height", ttpHeight)
        .attr("width", ttpWidth)
    ttpSVG.append("line")
        .attr("class", "tooltip-prediction-separator")

    var yAxis = ttpSVG.append("g")
        .attr("class", "y-axis")
    var xAxisHistorical = ttpSVG.append("g")
        .attr("class", "x-axis-historical")
    var xAxisPrediction = ttpSVG.append("g")
        .attr("class", "x-axis-prediction")
    
    var dataPointTTP = ttpSVG.append("g").attr("class", "data-point-ttp")
// create scales
    // apply rate if necessaryand figure find max y value
    var countMax = rate ? 1/d.population : 1 // so y scale is never 0-0

    Array("historical", "projected").forEach(e_p => {
        if (rate) {
            data[e_p]["values"] = data[e_p]["values"].map(d => d === null ? null : d/featureData.population * 1000)
        }
        countMax = d3.max([...data[e_p]["values"], countMax])
    })

    extraSources.forEach(ds => {
        if (rate) {
            data["extra"][ds] = data["extra"][ds].map(d => d === null ? null : d/featureData.population * 1000)
        }
        countMax = d3.max([...data["extra"][ds], countMax])
    })
    
    // figure out how much space is needed for the y-axis text
    var temp = ttpSVG.append("text").text(d3.format(".2r")(countMax)).attr("x", 0).attr("y", 0)
    var ttpMargins = {
        "top": 1*em, 
        "bottom": 2.5*em,
        "left": Math.max(20, temp.node().getBBox().width) + 2*em,
        "right": em,
    }
    var ttpGraphWidth = ttpWidth - ttpMargins.right - ttpMargins.left

    // define scales
    var yScale = d3.scaleLinear()
        .domain([0, countMax])        
        .nice()
        .range([ttpHeight-ttpMargins.bottom, ttpMargins.top])

    var xScaleHistorical = d3.scaleTime()
    if (allDates) {
        xScaleHistorical.domain([d3.timeDay.offset(firstDate, -7), allHistoricalDates[expectedAllHistoricalDataPoints-1]])
                        .range([ttpMargins.left, ttpMargins.left + ttpGraphWidth*ttpHistoryWidthPercentage]) 
    } else {
        xScaleHistorical.domain([d3.timeDay.offset(startShortHistory, -7), shortHistoryDates[expectedShortHistoryDataPoints-1]])
                        .range([ttpMargins.left + 1, ttpMargins.left + ttpGraphWidth*ttpHistoryWidthPercentage]) 
    }
    var xScaleForwardProjection = d3.scaleTime()
        .domain([d3.timeDay.offset(currentDate, -7), lastDate])
        .range([ttpMargins.left + ttpGraphWidth*ttpHistoryWidthPercentage, ttpWidth - ttpMargins.right]) 

    var xScale = function(date) {
        if (dayjs(date).isBefore(d3.timeDay.offset(currentDate, -7))) {
            return xScaleHistorical(date)
        } else {
            return xScaleForwardProjection(date)
        }
    }

// for data point tooltips (gives date and value)
    function createDataPointTooltip(event, date, value, x, y) {
        dataPointTTP.html("")
        let dateStr = formatDate(date)
        let countStr = rate ? `${value.toFixed(2)} per 1000` : value.toString()
        
        dataPointTTP.append("text").text(`Date: ${dateStr}`)
        dataPointTTP.append("text").text(`Count: ${countStr}`)
            .attr("transform", `translate(0, ${.75*em})`)

        let dataShapeBBox = event.target.getBBox()

        dataPointTTP.attr("transform", `translate(${dataShapeBBox.x + dataShapeBBox.width/2}, ${dataShapeBBox.y})`)
    }

// visualize historical
    var historicalGroup = graphSVG.append("g")

    if (allDates) {
        historicalGroup.append("path")
            .attr("d", d3.area()
                        .x((_, i) => xScale(historicalDatesArray[i]))
                        .y0(yScale(0))
                        .y1(d => yScale(d))
                        .defined(d => d !== null)
                        (data.historical.values)
            )
            .attr("fill", populationColorMap[population]["historical"])
    } else {
        var historicalBarWidth = Math.ceil(ttpGraphWidth*ttpHistoryWidthPercentage / historicalDatesArray.length)
        historicalGroup.append("g")
            .selectAll("rect")
            .data(data.historical.values)
            .enter()
            .append("rect")
            .attr("x", (_, i) => {return xScale(historicalDatesArray[i])})
            .attr("y", d => {return yScale(d)})
            .attr("height", d => yScale(0) - yScale(d))
            .attr("width", historicalBarWidth)
            .attr("fill", populationColorMap[population]["historical"])
            .attr("transform", `translate(-${historicalBarWidth}, 0)`)
            .on("mouseover", function(event, d) {
                if (d !== null) {
                    var thisPointDate = historicalDatesArray[data.historical.values.indexOf(d)]
                    var thisPointX = xScale(thisPointDate) - (historicalBarWidth/2)
                    createDataPointTooltip(event, thisPointDate, d, thisPointX, yScale(d))
                }
            })
            .on("mouseout", function() {
                dataPointTTP.html("")
            })
    }

// draw line and box for future projections
    ttpSVG.select(".tooltip-prediction-separator")
        .attr("x1", xScaleForwardProjection.range()[0])
        .attr("y1", ttpMargins.top)
        .attr("x2", xScaleForwardProjection.range()[0])
        .attr("y2", ttpHeight - ttpMargins.bottom)

    graphSVG.append("rect")
        .attr("class", "tooltip-prediction-highlighter")
        .attr("x", xScaleForwardProjection.range()[0])
        .attr("y", ttpMargins.top)
        .attr("width", xScaleForwardProjection.range()[1] - xScaleForwardProjection.range()[0])
        .attr("height", ttpHeight - ttpMargins.bottom - ttpMargins.top)
        
// visualize projected
    // area chart
    var predictiveGroup = graphSVG.append("g")
        .attr("class", "predictive-group")

    let lastHistoricalValueIndex = data.historical.values.findLastIndex(d => !isNaN(parseFloat(d)))
    let projectedValues = data.projected.values
    if (projectedValues.length) {
        if (dayjs(historicalDatesArray.at(lastHistoricalValueIndex)).isSame(d3.timeDay.offset(data.projected.start_date, -7))) {
            // last historical date is week before projected start date
            projectedValues.splice(0, 0, data.historical.values[lastHistoricalValueIndex])
        } else {
            projectedValues.splice(0, 0, projectedValues[0])
        }
        predictiveGroup.selectAll("path")
            .data(projectedValues.slice(1))
            .enter()
            .append("path")
            .attr("d", (_, i1) => 
                        d3.area()
                        .x((_, i2) => xScale(d3.timeDay.offset(data.projected.start_date, 7*(i1+i2-1))))
                        .y0(yScale(0))
                        .y1(d => yScale(d))
                        .defined(d => d !== null)
                        (projectedValues.slice(i1, i1+2))
            )
            .attr("fill", populationColorMap[population]["projected"])
            .on("mouseover", function(event, d, a, b) {
                if (d !== null) {
                    var thisPointDate = d3.timeDay.offset(data.projected.start_date, 7*data.projected.values.indexOf(d))
                    var thisPointX = (xScale(thisPointDate)+xScale(d3.timeDay.offset(thisPointDate, -7)))/2
                    createDataPointTooltip(event, thisPointDate, d, thisPointX, yScale(d))
                }
            })
            .on("mouseout", function() {
                dataPointTTP.html("")
            })
    }  

    // // marker for each datapoint on prediction line
    predictiveGroup.append("g")
        .selectAll("circle")
        .data(data.projected.values)
        .enter()
        .append("circle")
        .attr("r", 3)
        .attr("cx", (_, i) => xScale(d3.timeDay.offset(data.projected.start_date, 7*(i-1))))
        .attr("cy", d => yScale(d))
        .style("opacity", d => d === null ? 0 : 1)
        .attr("stroke", populationColorMap[population]["projected"])

// draw extra if selected
    extraSources.forEach(ds => {
        // draw historical line chart
        historicalGroup.append("path")
            .attr("d", d3.line()
                .x((_, i) => xScale(historicalDatesArray[i]))
                .y((d, i) => yScale(d))
                .curve(d3.curveMonotoneX)(data.extra[ds])
            )
            .attr("stroke", dataSourceColorMap[ds])
            .attr("fill", "none")
            .attr("stroke-width", 3)
    })

// draw axes
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
        .call(d3.axisBottom(xScaleForwardProjection).tickValues([xScaleForwardProjection.domain()[0], ...predictionDates]).tickSize(4).tickFormat(d3.timeFormat("%d %b")))
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
        .text(outcomeVariableString)

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
