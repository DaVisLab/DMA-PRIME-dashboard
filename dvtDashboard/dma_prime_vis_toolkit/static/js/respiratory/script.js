
export { zctaData, 
    populationColorMap, dataSourceColorMap, unknownColor,
    outcomeVariableStringCrosswalk, 
    getFeatureValue, getAllValuesFromFeature, getAllFeaturesValue, getBoundsOfCoords, getCenter,
    drawTooltip, drawStateHospitalizations, drawLargeStateHospitalizations }


// data
const zctaData = await d3.json(`/data/respiratory/zcta/covid_19?data_version=${metadata.data_version}&${parseInt(Math.random()*9999999999)}`)
await Promise.allSettled([ // wait for following to be defined/load in
    customElements.whenDefined('sl-select'),
    customElements.whenDefined('sl-option'),
])

// visualization variables
var formatInt = d3.format(".0f")
var formatDate = d3.timeFormat("%b %d, %Y")

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
    "all_encounters": "All Encounters",
    "inpatient_hospitalizations": "Inpatient Hospitalizations",
    "emergency_department_visits": "Emergency Department Visits",
    "positive_tests": "Positive Tests",
    "rate_of_transmission": "Transmission",
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

function getFeatureValue(feature, population, outcomeVariable, panelType, imputations) {
    let thisData = feature.properties.data[population][outcomeVariable]["projected"]

    if (!imputations && thisData.imputed) {
        if (panelType == "percentDifference") {
            return [NaN,NaN,NaN]
        }
        return NaN
    }

    var dateIndex = dayjs(currentDate).diff(thisData.start_date, 'week')
    var thisWeekDatum = parseFloat(thisData.values.at(dateIndex))

    if (panelType == "rate") {
        thisWeekDatum = thisWeekDatum / feature.properties.population * 1000
    }

    if (panelType == "percentDifference") {
        var lastWeekDatum
        if (dateIndex == 0) {
            lastWeekDatum = parseFloat(feature.properties.data[population][outcomeVariable]["historical"].values.at(expectedShortHistoryDataPoints-1))
        } else {
            lastWeekDatum = parseFloat(thisData.values.at(dateIndex-1))
        }
        var percentDifference = undefined
        if (isNaN(thisWeekDatum) || lastWeekDatum) {
            percentDifference = (thisWeekDatum - lastWeekDatum) / Math.abs(lastWeekDatum) * 100
        }
        return [lastWeekDatum, thisWeekDatum, percentDifference]
    } else {
        return thisWeekDatum
    }
}

function getAllValuesFromFeature(featureProperties, population, outcomeVariable, panelType, timeFrame) {
    let thisData = featureProperties.data[population][outcomeVariable][timeFrame]
    let newData = []
    for (let i = 0; i < thisData.values.length; i++) {
        var value = NaN
        try {
            if (panelType == "percentDifference") {
                var thisWeekDatum = parseFloat(thisData.values[i])
                var lastWeekDatum = parseFloat(thisData.values[i-1])
                if (isNaN(thisWeekDatum) || lastWeekDatum) {
                    value = (thisWeekDatum - lastWeekDatum) / Math.abs(lastWeekDatum) * 100
                }
            } else {
                if (panelType == "rate") {
                    value = thisData.values[i] / feature.properties.population * 1000
                } else {
                    value = thisData.values[i]
                }
            }

        } catch {
            pass
        }
        newData.push(value)
    }
    if (timeFrame == "projected" && panelType == "percentDifference" && newData.length > 0) {
        // first projected
        let lastWeekDatum = featureProperties.data[population][outcomeVariable]["historical"].values.at(-1)
        let thisWeekDatum = thisData.values[0] 
        if (isNaN(thisWeekDatum) || lastWeekDatum) {
            newData[0] = (thisWeekDatum - lastWeekDatum) / Math.abs(lastWeekDatum) * 100
        }
    }
    return newData
}

function getAllFeaturesValue(features, population, outcomeVariable, panelType, imputations) {
    var arr = features.map((feature) => {
        return getFeatureValue(feature, population, outcomeVariable, panelType, imputations)
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

function drawTooltip(d, ttpSVG, header, footer, population, outcomeVariable, panelType, grid=false, allDates=false, extraSources=[]) {
// The beginning bits
    var geographicUnit
    if (grid) {
        geographicUnit = gridGeographicUnitSelector.value
    } else {
        geographicUnit = mapGeographicUnitSelector.value
    }

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
        if (geographicUnit != "state") {
            regionInfo.append("p").attr("class", "ttp-location-name").html(`${metadata.region_sizes[geographicUnit]}: ${identifier}`)
        } else {
            regionInfo.append("p").attr("class", "ttp-location-name").html("South Carolina")
        }
    if (geographicUnit == "zcta") {
        // TODO: Make county names display correctly (e.g. McCormick instead of Mccormick)
        regionInfo.append("p").html(`County: ${featureData.county[0].toUpperCase()+featureData.county.substring(1)}`)
    }
    if (geographicUnit == "facility") {
        regionInfo.select(".ttp-location-name").html(`${metadata.region_sizes[geographicUnit]}: ${featureData.display_name} (${featureData.facility_type})`)
        regionInfo.append("p").html(`Health System: ${featureData.system}`)
    }

    var dataInfo = header.select(".tooltip-data-info")
    dataInfo.node().innerHTML = ""
    if (panelType == "rate") {
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
        var tooltipString = `Projected ${outcomeVariableString} from ${formatDate(d3.timeDay.offset(data.projected.start_date, -6))} to ${formatDate(thisProjectedEndDate)}`
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
                    if (panelType == "percentDifference") {
                        text = `Percent Change of ${text}`
                    } else {
                        text += " (projected)"
                    }
                } else {
                    if (outcomeVariable == "all_encounters") {
                        text = "All Historical Encounters"
                    } else {
                        text = "Historical " + text
                    }
                    if (panelType == "percentDifference") {
                        text = `Percent Change of ${text}`
                    } else {
                        text += data[e_p].reported ? " (reported)" : " (estimated)"
                    }
                }
                return text})
    })

    if (panelType == "percentDifference") {
        ttpLegendGroup = ttpLegend.append("div").attr("class", "tooltip-legend-group")
        var ttpLegendGroupItem = ttpLegendGroup.append("div")
            .attr("class", `tooltip-legend-group-item percent-change`)
        ttpLegendGroupItem.append("sl-icon")
            .attr("name", "dash-lg")
            .style("color","#cccccc")
        ttpLegendGroupItem.append("p")
            .attr("class", "tooltip-label")
            .attr("font-size", "var(--sl-font-size-small)")
            .attr("color", "black")
            .text(() => {
                var text = outcomeVariableString
                if (outcomeVariable == "all_encounters") {
                    text = "All Historical Encounters"
                } else {
                    text = "Historical " + text
                }
                text += data["historical"].reported ? ' (reported)' : ' (estimated)'
                return text})

        ttpLegendGroupItem = ttpLegendGroup.append("div")
            .attr("class", `tooltip-legend-group-item percent-change`)
        ttpLegendGroupItem.append("sl-icon")
            .attr("name", "dash-lg")
            .style("color","#666666")
        ttpLegendGroupItem.append("p")
            .attr("class", "tooltip-label")
            .attr("font-size", "var(--sl-font-size-small)")
            .attr("color", "black")
            .text(() => {
                var text = outcomeVariableString
                if (outcomeVariable == "all_encounters") {
                    text = "All Historical Encounters"
                } else {
                    text = "Historical " + text
                }
                text += " (projected)"
                return text})
    }

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
                    allExtendedData = await d3.json(`/data/respiratory/${gridGeographicUnitSelector.value}/${gridDiseaseSelector.value}/extended?data_version=${metadata.data_version}&${parseInt(Math.random() * 9999999999)}`)
                } else {
                    allExtendedData = await d3.json(`/data/respiratory/${mapGeographicUnitSelector.value}/${mapDiseaseSelector.value}/extended?data_version=${metadata.data_version}&${parseInt(Math.random() * 9999999999)}`)
                }
                var ttpData = {
                    "id": identifier,
                    "display_name": data.display_name,
                    "county": data.county,
                    "data": allExtendedData[identifier],
                    "facility_type": data.facility_type,
                    "system": data.system,
                }

                drawTooltip(ttpData,
                        largeTtp.select(".tooltip-outer-svg"), largeTtp.select(".tooltip-header"), largeTtp.select(".tooltip-footer"),
                        population, outcomeVariable,
                        panelType, grid, true, [])
            })
        })
    }

    if (['all_encounters', 'inpatient_hospitalizations', 'emergency_department_visits'].includes(outcomeVariable)) {
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
                panelType, grid, allDates, extraSources)
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
        .style("pointer-events", "none")

    var yAxis = ttpSVG.append("g")
        .attr("class", "y-axis")
    var xAxisHistorical = ttpSVG.append("g")
        .attr("class", "x-axis-historical")
    var xAxisPrediction = ttpSVG.append("g")
        .attr("class", "x-axis-prediction")
    
    var dataPointTTP = ttpSVG.append("g").attr("class", "data-point-ttp")
// create scales
    // apply rate if necessaryand figure find max y value
    var countMax = panelType == "rate" ? 1/d.population : 1 // so y scale is never 0-0

    Array("historical", "projected").forEach(e_p => {
        if (panelType == "rate") {
            data[e_p]["values"] = data[e_p]["values"].map(d => isNaN(d) ? NaN : d/featureData.population * 1000)
        }
        countMax = d3.max([...data[e_p]["values"], countMax])
    })

    extraSources.forEach(ds => {
        if (panelType == "rate") {
            data["extra"][ds] = data["extra"][ds].map(d => isNaN(d) ? NaN : d/featureData.population * 1000)
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

    if (panelType == "percentDifference") {
        var percentDifferenceHistoricalValues = getAllValuesFromFeature(featureData, population, outcomeVariable, panelType, "historical")
        var percentDifferenceProjectedValues = getAllValuesFromFeature(featureData, population, outcomeVariable, panelType, "projected")
        let pdMax = d3.max([...percentDifferenceHistoricalValues, ...percentDifferenceProjectedValues])
        let pdMin = d3.min([...percentDifferenceHistoricalValues, ...percentDifferenceProjectedValues])
        pdMax = Math.min(pdMax, 500)

        temp.text(d3.format(".2r")("-100")).attr("x", 0).attr("y", 0)

        ttpMargins.right = ttpMargins.right + em + Math.max(20, temp.node().getBBox().width)
        
        var yScale2 = d3.scaleLinear()
            .domain([pdMin, pdMax])        
            .nice()
            .range([ttpHeight-ttpMargins.bottom, ttpMargins.top])
        
        yScale.domain([yScale.domain()[1]*(yScale2.domain()[0]/yScale2.domain()[1]), yScale.domain()[1]])
    }

    var xScaleHistorical = d3.scaleTime()
    if (allDates) {
        xScaleHistorical.domain([d3.timeDay.offset(firstDate, -7), allHistoricalDates[expectedAllHistoricalDataPoints-1]])
                        .range([ttpMargins.left, ttpMargins.left + ttpGraphWidth*ttpHistoryWidthPercentage]) 
    } else {
        xScaleHistorical.domain([d3.timeDay.offset(startShortHistory, -7), shortHistoryDates[expectedShortHistoryDataPoints-1]])
                        .range([ttpMargins.left + 1, ttpMargins.left + ttpGraphWidth*ttpHistoryWidthPercentage]) 
    }
    var xScaleForwardProjection = d3.scaleTime()
        .domain([d3.timeDay.offset(currentDate, -6), lastDate])
        .range([ttpMargins.left + ttpGraphWidth*ttpHistoryWidthPercentage, ttpWidth - ttpMargins.right]) 

    var xScale = function(date) {
        if (dayjs(date).isBefore(d3.timeDay.offset(currentDate, -6))) {
            return xScaleHistorical(date)
        } else {
            return xScaleForwardProjection(date)
        }
    }

// for data point tooltips (gives date and value)
    function createDataPointTooltip(event, groupStartDate) {
        dataPointTTP.html("")

        let tooltipDateFormat = d3.timeFormat("%b %d")

        let thisDataPointShape = event.target
        let dataShapeBBox = thisDataPointShape.getBBox()

        let date = d3.timeDay.offset(groupStartDate, 7*(d3.select(thisDataPointShape.parentNode).selectAll('.ttp-data-point').nodes().indexOf(thisDataPointShape)))
        let dateStr = `${tooltipDateFormat(d3.timeDay.offset(date, -6))} - ${tooltipDateFormat(date)}`

        let value = d3.select(thisDataPointShape).datum() 
        let valueStr = panelType == "rate" ? `${value.toFixed(2)} per 1000` : value.toFixed(2).toString()

        let valueTypeStr
        switch (panelType) {
            case "count": 
                valueTypeStr = "Count"
                break;
            case "rate":
                valueTypeStr = "Rate"
                break;
            case "percentDifference":
                valueTypeStr = "Percent Change"
                break;
            default:
                valueTypeStr = "Count"
                break;
        } 
        
        dataPointTTP.append("text").text(dateStr)
        dataPointTTP.append("text").text(`${valueTypeStr}: ${valueStr}`)
            .attr("transform", `translate(0, ${.75*em})`)

        dataPointTTP.attr("transform", `translate(${dataShapeBBox.x + dataShapeBBox.width/2}, ${dataShapeBBox.y-.75*em})`)
    }

// visualize historical
    var historicalGroup = graphSVG.append("g")
        .attr("class", "historical-group")

    if (allDates) {
        historicalGroup.append("path")
            .attr("d", d3.area()
                        .x((_, i) => xScale(historicalDatesArray[i]))
                        .y0(panelType == "percentDifference" ? yScale2(0) : yScale(0))
                        .y1(d => panelType == "percentDifference" ? yScale2(d) : yScale(d))
                        .defined(d => d || d == 0)
                        (panelType == "percentDifference" ? percentDifferenceHistoricalValues : data.historical.values)
            )
            .attr("fill", populationColorMap[population]["historical"])
    } else {
        var historicalBarWidth = Math.ceil(ttpGraphWidth*ttpHistoryWidthPercentage / historicalDatesArray.length)
        historicalGroup.append("g")
            .selectAll("rect")
            .data(panelType == "percentDifference" ? percentDifferenceHistoricalValues : data.historical.values)
            .enter()
            .append("rect")
            .attr("class", "ttp-data-point")
            .attr("x", (_, i) => {return xScale(historicalDatesArray[i])})
            .attr("y", d => panelType == "percentDifference" ? (d > 0 ? yScale2(d) : yScale2(0)) : yScale(d))
            .attr("height", d => panelType == "percentDifference" ? Math.abs(yScale2(0) - yScale2(d)) : yScale(0) - yScale(d))
            .attr("width", historicalBarWidth)
            .attr("fill", populationColorMap[population]["historical"])
            .attr("transform", `translate(-${historicalBarWidth}, 0)`)
            .on("mouseover", function(event, d) {
                if (!isNaN(d)) {
                    createDataPointTooltip(event, historicalDatesArray[0])
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
            .attr("class", "ttp-data-point")
            .attr("d", (_, i1) => 
                        d3.area()
                        .x((_, i2) => xScale(d3.timeDay.offset(data.projected.start_date, 7*(i1+i2-1))))
                        .y0(panelType == "percentDifference" ? yScale2(0) : yScale(0))
                        .y1(d => panelType == "percentDifference" ? yScale2(d) : yScale(d))
                        .defined(d => d || d == 0)
                        (panelType == "percentDifference" ? percentDifferenceProjectedValues.slice(i1, i1+2) : projectedValues.slice(i1, i1+2))
            )
            .attr("fill", populationColorMap[population]["projected"])
            .on("mouseover", function(event, d) {
                if (!isNaN(d)) {
                    createDataPointTooltip(event, data.projected.start_date)
                }
            })
            .on("mouseout", function() {
                dataPointTTP.html("")
            })

        // // marker for each datapoint on prediction line
        predictiveGroup.append("g")
            .selectAll("circle")
            .data(panelType == "percentDifference" ? percentDifferenceProjectedValues : data.projected.values)
            .enter()
            .append("circle")
            .attr("class", "ttp-data-point")
            .attr("r", 3)
            .attr("cx", (_, i) => xScale(d3.timeDay.offset(data.projected.start_date, 7*(i-1))))
            .attr("cy", d => panelType == "percentDifference" ? yScale2(d) : yScale(d))
            .style("opacity", d => isNaN(d) ? 0 : 1)
            .attr("stroke", populationColorMap[population]["projected"])
            .on("mouseover", function(event, d) {
                if (!isNaN(d)) {
                    createDataPointTooltip(event, d3.timeDay.offset(data.projected.start_date, -7))
                }
            })
            .on("mouseout", function() {
                dataPointTTP.html("")
            })
    }

    if (panelType == "percentDifference") {
        graphSVG.append("path")
            .attr("d", d3.line()
                .defined(d => d || d == 0)
                .x((_, i) => xScale(historicalDatesArray[i]))
                .y((d, i) => yScale(d))
                .curve(d3.curveMonotoneX)(data.historical.values)
            )
            .attr("class", "historical-path-percent-diff-type")
            .attr("stroke", "#cccccc")
            .attr("fill", "none")
            .attr("stroke-width", 2)

        graphSVG.append("path")
            .attr("d", d3.line()
                .defined(d => d || d == 0)
                .x((_, i) => xScale(d3.timeDay.offset(predictionDates[i], -7)))
                .y((d, i) => yScale(d))
                .curve(d3.curveMonotoneX)(data.projected.values)
            )
            .attr("class", "projected-path-percent-diff-type")
            .attr("stroke", "#666666")
            .attr("fill", "none")
            .attr("stroke-width", 2)
    }

// draw extra if selected
    extraSources.forEach(ds => {
        // draw historical line chart
        historicalGroup.append("path")
            .attr("d", d3.line()
                .x((_, i) => xScale(historicalDatesArray[i]))
                .y((d, i) => yScale(d))
                .defined(d => d || d == 0)
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

    if (panelType == "percentDifference") {
        yAxis.html("")

        let mainYAxis = yAxis.append("g")
        let lesserYAxis = yAxis.append("g")

        mainYAxis.append("text")
            .attr("transform", `translate(${1.25*em},${yScale(d3.mean(yScale.domain()))})rotate(-90)`)
            .attr("text-anchor", "middle")
            .style("fill", populationColorMap[population]["historical"])
            .attr("font-size", "var(--sl-font-size-small)")
            .text("Percent Change")
        mainYAxis.append("g")
            .attr("transform", `translate(${ttpMargins.left},0)`)
            .call(d3.axisLeft(yScale2).ticks(5).tickSize(4))
            .selectAll("text")
            .attr("class", "tooltip-label")
            .style("fill", populationColorMap[population]["historical"])
        mainYAxis.selectAll("path, line")
            .style("stroke", populationColorMap[population]["historical"])


        lesserYAxis.append("text")
            .attr("transform", `translate(${ttpWidth-(1.25*em)},${yScale(d3.mean(yScale.domain()))})rotate(-90)`)
            .attr("text-anchor", "middle")
            .attr("fill", "var(--sl-color-neutral-1000)")
            .attr("font-size", "var(--sl-font-size-small)")
            .text(outcomeVariableString)

        lesserYAxis.append("g")
            .attr("transform", `translate(${ttpWidth-ttpMargins.right},0)`)
            .call(d3.axisRight(yScale).ticks(5).tickSize(4))
            .selectAll("text")
            .attr("class", "tooltip-label")
            .attr("fill", "var(--sl-color-neutral-1000)")
        lesserYAxis.selectAll("path, line")
            .attr("stroke", "var(--sl-color-neutral-1000)")

    }

    temp.remove()
    
}

function drawStateHospitalizations(disease, panelType, stateSvg, stateSubtitle) {
    var stateMargins = {
        "top": 1*em, 
        "bottom": 3.25*em,
        "left": 1.25*em,
        "right": 1*em,
        "axis-thickness": 1,
    }

    function yAxisDisplayFunc(svg, stateYScale, stateWidth, stateHeight, stateMargins, diseaseDisplayNames) {
        svg.select(".y-axis").append("text")
        .attr("class", "state-hospitalizations-yaxis-title")
        .attr("transform", `translate(${1*em},${d3.mean(stateYScale.range())})rotate(-90)`)
        .text(diseaseDisplayNames[disease])
        
        svg.select(".y-axis").append("g")
            .attr("transform", `translate(${stateMargins.left - stateMargins["axis-thickness"]},0)`)
            .call(d3.axisLeft(stateYScale).ticks(5).tickSize(4))
            .selectAll("text")
            .attr("class", "tooltip-label")
    }

    function xAxisDisplayFunc(svg, stateXScale, stateWidth, stateHeight, stateMargins, diseaseDisplayNames) {
        svg.select(".x-axis").call(d3.axisBottom(stateXScale).tickArguments([d3.timeMonth.every(1), d3.timeFormat("%b %Y")]))
            .attr("transform", `translate(0, ${stateHeight - stateMargins.bottom})`)  
            .selectAll("text")
            .style("text-anchor", "end")
            .attr("transform", `translate(-12, 6) rotate(-90)`)
    }
    drawStateBarChart(disease, panelType, stateSvg, stateSubtitle, stateMargins, yAxisDisplayFunc, xAxisDisplayFunc)
    
}

function drawLargeStateHospitalizations(disease, panelType, stateSvg, stateSubtitle) {
    var stateMargins = {
        "top": .5*em, 
        "bottom": 3.5*em,
        "left": 1.75*em,
        "right": 2*em,
        "axis-thickness": 3,
    }

    function yAxisDisplayFunc(svg, stateYScale, stateWidth, stateHeight, stateMargins, diseaseDisplayNames) {
        svg.select(".y-axis").append("text")
            .attr("id", "map-state-hospitalizations-large-yaxis-title")
            .attr("transform", `translate(${1*em},${d3.mean(stateYScale.range())})rotate(-90)`)
            .attr("text-anchor", "middle")
            .text(diseaseDisplayNames[disease])
            
        var svgYAxis = svg.select(".y-axis").append("g")
            .attr("transform", `translate(${stateMargins.left - stateMargins["axis-thickness"]},0)`)
            .call(d3.axisLeft(stateYScale).ticks(5).tickSize(4))
            
        svgYAxis.select("path")
            .attr("stroke-width", 3)
        svgYAxis.selectAll("g.tick line")
            .attr("x2", -8)
            .attr("stroke-width", 3)
        svgYAxis.selectAll("text")
            .attr("class", "tooltip-label")
            .attr("transform", `translate(-4, 0)`)
    }

    function xAxisDisplayFunc(svg, stateXScale, stateWidth, stateHeight, stateMargins, diseaseDisplayNames) {
        var allWeeks = [d3.timeDay.offset(startShortHistory, -7)].concat(shortHistoryDates)
        var xAxis = svg.select(".x-axis")
        var svgMajorXAxis = xAxis.append("g")
            .attr("class", "state-hospitalizations-large-major-xaxis")
            .call(d3.axisBottom(stateXScale)
                .tickValues(allWeeks.filter(d => d.getDate() <= 7))
                .tickFormat(d3.timeFormat("")))
            .attr("transform", `translate(0, ${stateHeight - stateMargins.bottom})`)  
        
        svgMajorXAxis.selectAll("path")
            .attr("stroke-width", 3)
        svgMajorXAxis.selectAll("g.tick line")
            .attr("y2", (_,i) => 28)
            .attr("stroke-width", 3)
        svgMajorXAxis.selectAll("text").each(function(d, i, a) {
            var thisText = d3.select(this)
            thisText.append("tspan")
                .style("text-anchor", "middle")
                .attr("x", i < a.length-1 ? (stateXScale(a[i+1].__data__)-stateXScale(d))/2 : (stateXScale.range()[1]-stateXScale(d))/2)
                .html(d3.timeFormat("%b")(d))

            thisText.append("tspan")
                .style("text-anchor", "middle")
                .attr("dy", 12)
                .attr("x", i < a.length-1 ? (stateXScale(a[i+1].__data__)-stateXScale(d))/2 : (stateXScale.range()[1]-stateXScale(d))/2)
                .html(d3.timeFormat("%Y")(d))
        })

        xAxis.append("g")
            .attr("class", "state-hospitalizations-large-minor-xaxis")
            .call(d3.axisBottom(stateXScale).tickArguments([d3.timeDay.every(7), d3.timeFormat("")]))
            .attr("transform", `translate(0, ${stateHeight - stateMargins.bottom})`)

    }
    drawStateBarChart(disease, panelType, stateSvg, stateSubtitle, stateMargins, yAxisDisplayFunc, xAxisDisplayFunc)
}

async function drawStateBarChart(disease, panelType, svgDOM, subtitleDOM, stateMargins, yAxisDisplayFunc, xAxisDisplayFunc) {
    var diseaseDisplayNames = {
        "covid_19": "COVID-19",
        "influenza": "Influenza",
        "RSV": "RSV", 
        "respiratory_diseases": "COVID-19, Flu, RSV",
    }
    
    svgDOM.innerHTML = ""
    var stateHeight = svgDOM.clientHeight
    var stateWidth = svgDOM.clientWidth
    
    var svg = d3.select(svgDOM)
    var yAxis = svg.append("g")
        .attr("class", "y-axis")
    var xAxis = svg.append("g")
        .attr("class", "x-axis")

    var stateData
    try {
        stateData = await d3.json(`/data/respiratory/state/state-cdc?data_version=${metadata.data_version}&${parseInt(Math.random()*9999999999)}`) 
        stateData = Object.entries(stateData[disease]).map(d => {
            temp = {"Date": parseDate(d[0]), "count": d[1]}
            if (panelType == "rate") {
                temp["count"] /= (scPopulation / 1000)
            }
            return temp
        })
        let stateDates = stateData.map(d => d.Date)
        subtitleDOM.innerHTML = `Data from ${d3.timeFormat("%b %d, %Y")(d3.min(stateDates))} to ${d3.timeFormat("%b %d, %Y")(d3.max(stateDates))}`
    } catch (error) {
        stateData = [{"Date": parseDate("2020-01-01"), "count": 1}]
        subtitleDOM.innerHTML = "N/A"
    }
    
    var maxVal = d3.max(stateData.map(d => d.count)) || 1

    var temp = svg.append("text").text(d3.format(".2r")(maxVal)).attr("x", 0).attr("y", 0)
    stateMargins.left += Math.max(20, temp.node().getBBox().width) + stateMargins["axis-thickness"]

    var stateXScale = d3.scaleTime()
                .domain([d3.timeDay.offset(startShortHistory, -7), shortHistoryDates[expectedShortHistoryDataPoints-1]]).range([stateMargins.left, stateWidth - stateMargins.right])    

    var stateYScale = d3.scaleLinear()
        .domain([0, maxVal])
        .nice()
        .range([stateHeight-stateMargins.bottom, stateMargins.top])

    var barWidth = (stateWidth - (stateMargins.left + stateMargins.right)) / stateData.length
    svg.append("g")
        .selectAll("rect")
        .data(stateData)
        .enter()
        .append("rect")
        .attr("x", (d) => stateXScale(d["Date"]))
        .attr("y", d => stateYScale(d["count"]))
        .attr("height", d => stateYScale(0) - stateYScale(d["count"]))
        .attr("width", barWidth)
        .attr("stroke", "var(--sl-color-neutral-1000)")
        .attr("stroke-width", 1)
        .attr("fill", "var(--sl-color-neutral-100)")
        .attr("transform", `translate(-${barWidth}, 0)`)
        .on("mouseover", function(event, d) {
            let tooltipDateFormat = d3.timeFormat("%b %d")
            let date = d["Date"]
            let dateStr = `${tooltipDateFormat(d3.timeDay.offset(date, -6))} - ${tooltipDateFormat(date)}`
            var countStr = panelType == "rate" ? `${d["count"].toFixed(2)} per 1000` : d["count"].toString()
            
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
            
            tooltip.append("div").text(dateStr)
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
        })
        .on("mouseout", function() {
            d3.selectAll(".chart-tooltip").remove()
        })

    yAxisDisplayFunc(svg, stateYScale, stateWidth, stateHeight, stateMargins, diseaseDisplayNames)
    xAxisDisplayFunc(svg, stateXScale, stateWidth, stateHeight, stateMargins, diseaseDisplayNames)
    
    temp.remove()
}