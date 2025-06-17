
export { zctaData, 
    startDate, currentWeek, endDate, historicalDates, predictionDates, 
    dataSourceColorMap, dataSourceLineStyle, unknownColor,
    gridItemDataSources, 
    parseDate, getDataAsArray, getBoundsOfCoords, getCenter,
    drawTooltip }


// data
var currentWeek = parseDate(metadata.current_week)

var startDate = parseDate(metadata.start_date)
var historicalDates = d3.timeDay.range(startDate, new Date(currentWeek).setDate(currentWeek.getDate()+1), 7)

var endDate = parseDate(metadata.end_date)
var predictionDates = d3.timeDay.range(currentWeek, new Date(endDate).setDate(endDate.getDate()+1), 7)


const zctaData = await d3.json(`/data/deckgl-respiratory/zcta?${parseInt(Math.random()*9999999999)}`)
await Promise.allSettled([ // wait for following to be defined/load in
    customElements.whenDefined('sl-select'),
    customElements.whenDefined('sl-option'),
])

// visualization variables
var formatInt = d3.format(".0f")

let dataVersion = 0

var gridItemDataSources = ["health-system-data", "state-training", "state-testing"]

var unknownColor = d3.hsl("#CCCCCC")

var dataSourceColorMap = {
    "health-system-data": "#648FFF",
    "state-data": "#785EF0",
    "state-training": "#FFB000",
    "state-testing": "#FFB000",
    "state-estimation": "#FFB000",
    "state-prediction": "#FE6100",
}

var dataSourceDisplayName = {
    "health-system-data": "Health System Data",
    "state-data": "State Data",
    "state-training": "Prediction (training)",
    "state-testing": "Prediction (test)",
    "state-estimation": "Estimated",
    "state-prediction": "Projected",
}

var dataSourceLineStyle = {
    "health-system-data": null,
    "state-data": null,
    "state-training": "5,5",
    "state-testing": "5,5",
    
    "health-system-data-tooltip": null,
    "state-data-tooltip": null,
    "state-training-tooltip": "5,5",
    "state-testing-tooltip": null,
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
function getDataAsArray(data, disease, dataSource, rate, imputations=true) {
    var arr = data.features.map((d) => {
        var data = d.properties.data[disease]
        if (data[dataSource].data.length > 0 && (imputations || !data.imputation)) {
            if (rate) {
                return data[dataSource].data.at(-1) / d.population * 1000
            } else {
                return data[dataSource].data.at(-1)
            }
        } else {
            return 0
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

function drawTooltip(d, ttpSVG, header, footer, rate=false, grid=false, extraDataSources=[]) {
    var ttpHeight = ttpSVG.node().clientHeight
    var ttpWidth = ttpSVG.node().clientWidth
    
    var data = JSON.parse(JSON.stringify(d))
    ttpSVG.datum({"extraDataSources": extraDataSources})

    // creating titles/subtitles
    var regionInfo = header.select(".tooltip-region-info")
    regionInfo.node().innerHTML = ""
    if (grid) {
        regionInfo.append("p").html(`Zip Code: ${data.zcta}`)
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
        dataInfo.append("p").html(`Rate of Hospitalizations (per 1000 people)`)
    } else {
        dataInfo.append("p").html(`Count of Hospitalizations`)
    }
    if (data['state-testing'].data.length > 0) {
        let tempDate = parseDate(data['state-testing']['start-date'])
        let tempEndDate = d3.timeDay.offset(tempDate, (data['state-testing'].data.length-1)*7)
        var formatDate = d3.timeFormat("%b %d, %Y")
        var tooltipString = `Estimated Hospitalizations from ${formatDate(tempDate)} to ${formatDate(tempEndDate)}`
        dataInfo.append("p").html(tooltipString)
        if (data["state-prediction"].data.length) {
            tempDate = parseDate(data['state-prediction']['start-date'])
            tempEndDate = d3.timeDay.offset(tempDate, (data['state-prediction'].data.length-1)*7)
            tooltipString = `Projected Hospitalizations from ${formatDate(tempDate)} to ${formatDate(tempEndDate)}`
            dataInfo.append("p").html(tooltipString)  
        }
    }

    // adding data source inclusion buttions
    var ttpOptions = footer.select(".tooltip-options").html("")
    Array("health-system-data", "state-data").forEach(function(dataSource, i) {
        var buttonText = dataSourceDisplayName[dataSource]
        if (extraDataSources.includes(dataSource)) {
            buttonText = "Remove " + buttonText
        } else {
            buttonText = "Add " + buttonText
        }

        var button = ttpOptions.append("sl-button")
            .html(buttonText)
            .attr("size", "small")

        button.node().updateComplete.then(() => {
            d3.select(button.node().shadowRoot).select("[part=base]")
                .style("background-color", "white")
                .style("border-color", dataSourceColorMap[dataSource])
                .style("color", dataSourceColorMap[dataSource])
        })

        function ttpOptionsHandler(extraDataSources, dataSource) {
            if (extraDataSources.includes(dataSource)) {
                extraDataSources.splice(extraDataSources.indexOf(dataSource), 1)
            } else {
                extraDataSources.push(dataSource)
            }
            drawTooltip(d, ttpSVG, header, footer, rate, grid, extraDataSources)
        }
        button.on("click", () => {ttpOptionsHandler(extraDataSources, dataSource)})

        var icon = button.append("sl-icon")
            .attr("slot", "prefix")
            .attr("name", "graph-up")
            .style("color", dataSourceColorMap[dataSource])

    })

    // draw graph
    var ttpLegendTop = ttpHeight - 1*em

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

    var countMax = rate ? 1/d.population : 1

    Array("state-training", "state-testing", "state-prediction", ...extraDataSources).forEach(function(dataSource) {
        if (rate) {
            data[dataSource].data = d[dataSource].data.map(function(item) { return item/d.population * 1000} )
        }
        if (data[dataSource].data.length) {
            countMax = Math.max(d3.max(data[dataSource].data), countMax)
        }
    })
    
    var predictionData = JSON.parse(JSON.stringify(data["state-prediction"]))
    if (rate) {
        predictionData.data = d["state-prediction"].data.map(function(item) { return item/d.population * 1000} )
    }
    if (predictionData.data.length) {
        countMax = Math.max(d3.max(predictionData.data), countMax)
    }

    // figure out how much space is needed for the y-axis text
    var temp = ttpSVG.append("text").text(d3.format(".2r")(countMax)).attr("x", 0).attr("y", 0)
    var ttpMargins = {
        "top": 1*em, 
        "bottom": 1*em + 2*em + 1*em,
        "left": Math.max(20, temp.node().getBBox().width) + 2*em,
        "right": em,
    }
    var ttpGraphWidth = ttpWidth - ttpMargins.right - ttpMargins.left

    var yScale = d3.scaleLinear()
        .domain([0, countMax])        
        .nice()
        .range([ttpHeight-ttpMargins.bottom, ttpMargins.top])

    var xScaleHistorical = d3.scaleTime()
        .domain(d3.extent(historicalDates))
        .range([ttpMargins.left, ttpMargins.left + ttpGraphWidth*ttpHistoryWidthPercentage]) 
    var xScalePrediction = d3.scaleTime()
        .domain(d3.extent(predictionDates))
        .range([ttpMargins.left + ttpGraphWidth*ttpHistoryWidthPercentage, ttpWidth - ttpMargins.right]) 

    var historicalGroup = graphSVG.append("g")
    var historicalBarWidth = Math.ceil(ttpGraphWidth*ttpHistoryWidthPercentage / historicalDates.length)

    Array("state-training", "state-testing").forEach(function(dataSource, i) {
        var thisData = data[dataSource]
        var thisStartDate = parseDate(thisData["start-date"])
        var startIndex = historicalDates.findIndex((d) => d.getTime() == thisStartDate.getTime())

        historicalGroup.append("g")
            .selectAll("rect")
            .data(thisData.data)
            .enter()
            .append("rect")
            .attr("x", (_, i) => {return xScaleHistorical(historicalDates[i+startIndex])})
            .attr("y", d => {return yScale(d)})
            .attr("height", d => yScale(0) - yScale(d))
            .attr("width", historicalBarWidth)
            .attr("fill", dataSourceColorMap[dataSource])
    })

    var stateCurrentLabelPositionAbove = null
    if (predictionData.data.length) {     
        graphSVG.append("rect")
            .attr("class", "tooltip-prediction-highlighter")

        // draw predictive line chart
        var predictiveGroup = graphSVG.append("g")
        predictiveGroup.append("path")
            .attr("d", ttpAreaFunction(predictionData, predictionDates, xScalePrediction, yScale))
            .attr("fill", dataSourceColorMap["state-prediction"])

        // marks each datapoint on prediction line
        predictiveGroup.selectAll("circle").data(predictionData.data)
            .enter()
            .append("circle")
            .attr("r", 3)
            .attr("cx", (_, i) =>  xScalePrediction(predictionDates[i]))
            .attr("cy", (d) => yScale(d))
            .attr("stroke", dataSourceColorMap["state-prediction"])

        // highlights predictive data
        graphSVG.select(".tooltip-prediction-highlighter")
            .attr("x", xScalePrediction.range()[0])
            .attr("y", ttpMargins.top)
            .attr("width", xScalePrediction.range()[1] - xScalePrediction.range()[0])
            .attr("height", ttpHeight - ttpMargins.bottom - ttpMargins.top)

        // place line separating historical and prediction data
        ttpSVG.select(".tooltip-prediction-separator")
            .attr("x1", xScalePrediction.range()[0])
            .attr("y1", ttpMargins.top)
            .attr("x2", xScalePrediction.range()[0])
            .attr("y2", ttpHeight - ttpMargins.bottom)

        stateCurrentLabelPositionAbove = predictionData.data[0] > predictionData.data[1]
    }

    Array("state-estimation", "state-prediction").forEach(function(dataSource, i) {
        var labelGroup = ttpLegend.append("g")
            .attr("class", "tooltip-label-group")
        labelGroup.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("height", .5*em)
            .attr("width", .5*em)
            .attr("fill", dataSourceColorMap[dataSource])
        var labelText = labelGroup.append("text")
            .attr("class", "tooltip-label")
            .attr("x", 1*em)
            .attr("y", .25*em)
            .attr("fill", dataSourceColorMap[dataSource])
            .attr("font-size", "var(--sl-font-size-small)")
            .style("dominant-baseline", "middle")
            .text(dataSourceDisplayName[dataSource])

        var bbox = labelGroup.node().getBBox()
        labelGroup.attr("transform", `translate(${1*em + ((ttpWidth-2*em)*(i+1)/3) - bbox.width/2}, ${ttpLegendTop})`)

    })
        

    extraDataSources.forEach(function(dataSource) {
        var thisData = data[dataSource]

        // draw historical line chart
        historicalGroup.append("path")
            .attr("d", ttpLineFunction(thisData, historicalDates, xScaleHistorical, yScale))
            .attr("stroke", dataSourceColorMap[dataSource])
            .attr("fill", "none")
            .attr("stroke-width", 3)
            .style("stroke-dasharray", dataSourceLineStyle[`${dataSource}-tooltip`])
        
        var historicalLabels = graphSVG.append("g")

        var thisStartDate = parseDate(thisData["start-date"])
        var thisEndDate = new Date(thisStartDate);
        thisEndDate.setDate(thisEndDate.getDate() + thisData.data.length*7);
        var datesReconstructed = d3.timeDay.range(startDate, new Date(thisEndDate).setDate(thisEndDate.getDate()+1), 7)

        var refDate = new Date(currentWeek)
        refDate.setDate(refDate.getDate() - 7)

        var index = datesReconstructed.findIndex((d) => d.getTime() == refDate.getTime())

        if (index > -1) {
            var circleData = thisData.data.slice(index).map(function(d, i) {
                return {"count": d, "date": datesReconstructed.slice(index)[i]};
            })

            historicalLabels.selectAll("circle")
                .data(circleData)
                .enter()
                .append("circle")
                .attr("r", 3)
                .attr("cx", (d) => xScaleHistorical(d.date))
                .attr("cy", (d) => yScale(d.count))
                .attr("stroke", dataSourceColorMap[dataSource])

            if (circleData.length > 1) {
                var yPosition = yScale(circleData[1].count)
                if (dataSource == "state-testing") {
                    if (stateCurrentLabelPositionAbove !== null) {
                        yPosition += stateCurrentLabelPositionAbove ? -6 : 12
                    }
                } else {
                    yPosition += 6
                }

                yPosition = Math.min(Math.max(yPosition, yScale.range()[1] + 12), yScale.range()[0] - 3)

                historicalLabels.append("text")
                    .attr("x", xScaleHistorical(circleData[1].date) + 6)
                    .attr("y", yPosition)
                    .attr("fill", dataSourceColorMap[dataSource])
                    .attr("font-size", "var(--sl-font-size-x-small)")
                    .text(parseFloat(circleData[1].count.toFixed(1)))
            }
            
        }
        
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
        .attr("transform", `translate(${1.5*em},${yScale(d3.mean(yScale.domain()))})rotate(-90)`)
        .attr("text-anchor", "middle")
        .attr("fill", "var(--sl-color-neutral-1000)")
        .attr("font-size", "var(--sl-font-size-small)")
        .text("Hospitalizations")

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

var ttpLineFunction = function(data, dates, xScale, yScale) {
    var thisStartDate = parseDate(data["start-date"])
    var startIndex = dates.findIndex((d) => d.getTime() == thisStartDate.getTime())

    return d3.line()
        .x((_, i) => xScale(dates[i+startIndex]))
        .y((d, i) => yScale(d))
        .curve(d3.curveMonotoneX)(data.data)
}

var ttpAreaFunction = function(data, dates, xScale, yScale) {
    var thisStartDate = parseDate(data["start-date"])
    var startIndex = dates.findIndex((d) => d.getTime() == thisStartDate.getTime())
    var y0 = yScale(0)

    return d3.area()
        .x((_, i) => xScale(dates[i+startIndex]))
        .y0(y0)
        .y1((d, i) => yScale(d))
        .curve(d3.curveMonotoneX)(data.data)
}
