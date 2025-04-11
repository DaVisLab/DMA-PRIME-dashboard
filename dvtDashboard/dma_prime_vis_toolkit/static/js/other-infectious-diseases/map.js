const { GeoJsonLayer, IconLayer, MapboxOverlay, Widget } = deck;

export { styleSheet, selectedItems, map, deckOverlay, popup, redraw, drawTooltip, drawAggregation, drawLargeAggregation, drawLegend, updateDiseaseCountDisplay, getData, changeDataColumn, update }

var regionData = await d3.json(`/data/other-infectious-diseases/zcta/pos_tests`)
var stateFeature = regionData.features.find(d => d.properties.identifier == "state")

var selectedItems = {
    "region": undefined,
    "diseases": [],
    "dataVersion": 0
}

var choroplethColorMap = d3.scaleLinear()
    .domain([0, 1])
    .range(["white", "maroon"])
    .unknown(unknownColor).nice()

const map = new maplibregl.Map({
    container: mapDiv,
    style: "https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json",
    center: [-81, 33.65],
    zoom: 7,
})

await map.once('load')

var popup = new maplibregl.Popup({focusAfterOpen: false, closeOnClick: false})

const deckOverlay = new MapboxOverlay({
    interleaved: true,
})

map.addControl(deckOverlay)
map.addControl(new maplibregl.NavigationControl())

await Promise.allSettled([ // wait for following to be defined/load in
    customElements.whenDefined('sl-checkbox'),
    customElements.whenDefined('sl-button'),
])

var styleSheet = new CSSStyleSheet()
styleSheet.insertRule(`
    .maplibregl-popup-content {
        /* tooltip's containing div */
        background-color: hsla(${getComputedStyle(document.head).getPropertyValue("--sl-color-neutral-0").replace("hsl(", "").replace(")", "")}, 0.925);
    }`
    ,0)   

document.adoptedStyleSheets = [styleSheet]
drawAggregation()
updateDiseaseCountDisplay()
redraw(true)

function redraw(first=false) {
    createChoropleth(regionData)
    drawLegend()
    deckOverlay.setProps({
        layers: [
            new GeoJsonLayer({
                id: 'disease_choropleth',
                depthTest: false,
                pickable: true,
                data: regionData,
                stroked: true,
                filled: true,
                pointType: 'circle+text',
                pickable: true,
                getFillColor: d => getColor(d),
                lineWidthMinPixels: .75,
                getLineWidth: 20,
                getLineColor: [64, 64, 64],
                updateTriggers: {
                    getFillColor: [ mapRateSwitch.value, mapColumnSwitch.value, mapTimeSwitch.value, selectedItems.diseases, selectedItems.dataVersion ]
                },
            }),
            new GeoJsonLayer({
                id: 'region_highlight',
                depthTest: false,
                data: selectedItems.region,
                stroked: true,
                filled: false,
                pointType: 'circle+text',
                pickable: true,
                lineWidthMinPixels: .5,
                getLineWidth: 1000,
                getLineColor: [128, 128, 128],
                getPointRadius: 4,
                getTextSize: 12,
                updateTriggers: {
                    data: selectedItems.region ? selectedItems.region.properties.identifier : selectedItems.region,
                },
            }),
            // new IconLayer({
            //     id: 'hospital-and-cdap',
            //     data: d3.csv('/data/health-care-facility/all'),
            //     iconAtlas: '/data/icon-pack/png',
            //     iconMapping: '/data/icon-pack/json',
            //     getPosition: d => {return [+d.longitude, +d.latitude]},
            //     getIcon: d => {if(checked.includes(d.type)) return d.type},
            //     getSize: 15,
            //     pickable: true,
            //     parameters: {
            //         depthTest: false
            //     },
            // })
        ]
    })

}

function getColor(feature) {
    var thisData = getData(feature, mapTimeSwitch.value)
    var value = NaN
    if (thisData.data.length > 0) {
        value = thisData.data.at(-1)
    }

    var c = d3.rgb(choroplethColorMap(value))

    return [c.r, c.g, c.b]
}

function createChoropleth(data) {
    var arr = data.features.map((feature) => {
        var thisData = getData(feature, mapTimeSwitch.value)

        if (thisData.data.length > 0 && feature.properties.identifier != "state") {
            return thisData.data.at(-1)
        } else {
            return 0
        }
    })

    var minMaxVal = mapRateSwitch.value == "rate" ? 1000.0/stateFeature.properties.population : 1
    arr.push(minMaxVal)
    
    choroplethColorMap = d3.scaleLinear()
        .domain([0, d3.max(arr)])
        .range(["white", "maroon"])
        .unknown(unknownColor).nice()

}

function drawLegend() {
    choroplethLegendSVG.innerHTML = ""
    var legend = d3.select(choroplethLegendSVG)
        .attr("overflow", "visible")

    legend.attr("transform", `translate(40, 0)`)
        .attr("width", 450)
        .attr("height", 50)
    var legDefs = legend.append("defs")
    var linearGradient = legDefs.append("linearGradient")
        .attr("id", "linear-gradient")
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "0%")
    linearGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "white")
    linearGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "maroon")

    legend.append("rect")
        .style("fill", "url(#linear-gradient)")
        .attr("width", 450)
        .attr("height", 15)

    var xAxis = legend.append("g")
        .attr("transform", "translate(0,15)")
        .call(d3.axisBottom(d3.scaleLinear().domain(d3.extent(choroplethColorMap.domain())).range([0, 450])))

}

function drawTooltip(dataObject) {
    if(!dataObject || !popup.isOpen()) {
        popup.remove()
        return
    }
    var thisData = getData(dataObject, "weekly")
    // draw in tooltip
    var ttpWidth = Math.max(400, mapDiv.clientWidth * .25)
    var ttpHeight = ttpWidth * .35

    var ttpDiv = d3.select("#map-tooltip-div")

    ttpDiv.style("display", "initial")
    ttpDiv.style("border-style", "none")
    ttpDiv.html("")
        
    var ttpTitle = ttpDiv.append("p")
        .attr("class", "tooltip-title")
    ttpTitle.append("span")
        .attr("class", "tooltip-title")
        .html(`${d3.select(`sl-option[value=${mapRegionSelector.value}]`).html()}: ${dataObject.properties.identifier}`)
    ttpTitle.append("br")
    try {
        ttpTitle.append("span")
            .attr("class", "tooltip-subtitle")
            .html(`County: ${dataObject.properties.county[0].toUpperCase()+dataObject.properties.county.substring(1)}`)
    } catch (error) {
        
    }

    if (thisData.data.length < 1) {
        ttpDiv.append("p").html("No Data")
        return
    }

    var encounterString = ""
    switch (mapColumnSwitch.value) {
        case "encounters":
            encounterString += "Encounters"
            break;
        case "pos_tests":
            encounterString += "Positive tests"
            break;
        case "encounter_plus_test":
            encounterString += "Encounters and positive tests"
            break;
    }
    encounterString += " from "
    var thisWeek = thisData.end_date
    switch (mapTimeSwitch.value) {
        case "weekly":
            var formatDate = d3.timeFormat("%b %d, %Y")
            encounterString += `${formatDate(thisWeek)}<br/>to ${formatDate(d3.timeDay.offset(thisWeek, 6))}`
            break;
        case "monthly":
            var startWeek = d3.utcDay.offset(thisWeek, -4*7)
            var formatDate = d3.utcFormat("%b %d, %y")
            encounterString += `${formatDate(startWeek)}<br/>to ${formatDate(d3.utcDay.offset(thisWeek, 6))}`
            break;
        case "yearly":
            var startWeek = d3.utcDay.offset(thisWeek, -52*7)
            var formatDate = d3.utcFormat("%b %d, %y")
            encounterString += `${formatDate(startWeek)}<br/>to ${formatDate(d3.utcDay.offset(thisWeek, 6))}`
            break;
    }
    encounterString += ": "
    if (mapRateSwitch.value == "rate") {
        encounterString += `${Math.round(getData(dataObject, mapTimeSwitch.value).data.at(-1) * 1000) / 1000} (per 1000 people)`
    } else {
        encounterString += getData(dataObject, mapTimeSwitch.value).data.at(-1)
    }

    ttpTitle.append("br")
    ttpTitle.append("span")
        .attr("class", "tooltip-subtitle")
        .html(encounterString)

    var ttpSVG = ttpDiv.append("svg")
        .attr("id", `map-tooltip-svg`)
        .attr("class", `tooltip-outer-svg`)
    
    createBarGraph(ttpSVG, thisData, regionData.metadata, ttpHeight, ttpWidth)
}

function drawAggregation() {
    var thisData = getData(stateFeature, "weekly")
    var aggWidth = Math.max(300, document.getElementById("map-sidebar").clientWidth)
    var aggHeight = aggWidth * .5

    aggregatedDiseaseHistoryTitle.innerHTML = `State Wide ${d3.select(`sl-option[value=${mapColumnSwitch.value}]`).html()}`

    var encounterString = ""
    switch (mapColumnSwitch.value) {
        case "encounters":
            encounterString += "Encounters"
            break;
        case "pos_tests":
            encounterString += "Positive tests"
            break;
        case "encounter_plus_test":
            encounterString += "Encounters and positive tests"
            break;
    }
    encounterString += " from "
    var thisWeek = thisData.end_date
    switch (mapTimeSwitch.value) {
        case "weekly":
            var formatDate = d3.utcFormat("%b %d, %Y")
            encounterString += `${formatDate(thisWeek)} to<br/>${formatDate(d3.utcDay.offset(thisWeek, 6))}`
            break;
        case "monthly":
            var startWeek = d3.utcDay.offset(thisWeek, -4*7)
            var formatDate = d3.utcFormat("%b %d, %y")
            encounterString += `${formatDate(startWeek)} to<br/>${formatDate(d3.utcDay.offset(thisWeek, 6))}`
            break;
        case "yearly":
            var startWeek = d3.utcDay.offset(thisWeek, -52*7)
            var formatDate = d3.utcFormat("%b %d, %y")
            encounterString += `${formatDate(startWeek)} to<br/>${formatDate(d3.utcDay.offset(thisWeek, 6))}`
            break;
    }
    encounterString += ": "
    var val = getData(stateFeature, mapTimeSwitch.value).data.at(-1)
    if (val) {
        if (mapRateSwitch.value == "rate") {
            val = Math.round(val * 1000) / 1000
            encounterString += `${val} (per 1000 people)`
        } else {
            encounterString += val
        }
    } else {
        encounterString += "N/A"
    }
    aggregatedDiseaseHistorySubtitle.innerHTML = encounterString

    var aggSVG = d3.select(aggregatedDiseaseHistory)
    aggSVG.html("")
    
    createBarGraph(aggSVG, thisData, regionData.metadata, aggHeight, aggWidth)
}

function updateDiseaseCountDisplay() {
    var diseases = d3.selectAll(".disease-checkbox").nodes().map(d => d.getAttribute("disease")) 
    var allCount = 0
    diseases.forEach(disease => {
        var val = stateFeature.properties.data[disease][mapTimeSwitch.value].at(-1)
        if (mapRateSwitch.value == "rate") {
            val /= (stateFeature.properties.population / 1000.0)
        }
        allCount += val
        d3.select(`#map-${disease}-count`).html(`(${Math.round(val * 1000) / 1000})`)
    })
    d3.select("#map-all-count").html(`(${Math.round(allCount * 1000) / 1000})`)
}

function getData(feature, timeFrame="weekly") {
    var diseases = selectedItems.diseases
    var thisData = {
        "data": [],
        "other": [],
        "population": feature.properties.population,
        "start_date": dayjs().utc().toDate(),
        "end_date": dayjs.utc().toDate(),
    }
    if (diseases.length > 0) {
        // one/many diseases
        var dataDicts = Object.entries(feature.properties.data).filter(d => diseases.includes(d[0]) && d[1][timeFrame].length > 0)
        dataDicts = dataDicts.map(d => d[1])
        var otherDicts = Object.entries(feature.properties.other).filter(d => diseases.includes(d[0]) && d[1][timeFrame].length > 0)
        otherDicts = otherDicts.map(d => d[1])
        var weeks
        if (dataDicts.length > 0) {
            if (timeFrame === "weekly") {
                var earliestDate = parseDate(regionData.metadata.start_date)
                var latestDate = parseDate(regionData.metadata.end_date)
                thisData.start_date = earliestDate
                thisData.end_date = latestDate
                weeks = (d3.utcDay.count(earliestDate, latestDate)/7) + 1
            } else {
                weeks = 1
            }
            thisData.data = new Array(weeks).fill(0)
            for (var data of dataDicts) {
                for (var i=0; i < data[timeFrame].length; i++) {
                    thisData.data[i] += data[timeFrame][i]
                }
            }
            thisData.other = new Array(weeks).fill(0)
            for (var other of otherDicts) {
                for (var i=0; i < other[timeFrame].length; i++) {
                    thisData.other[i] += other[timeFrame][i]
                }
            }
        }
    }
    
    // rate applied at end
    if (mapRateSwitch.value == "rate") {
        thisData.data = thisData.data.map((val) => 
            (parseFloat(val) / (thisData.population / 1000.0)) || 0)
    }

    return thisData
}

function drawLargeAggregation() {
    var thisData = getData(stateFeature, "weekly")

    aggregatedDiseaseHistoryLargeTitle.innerHTML = `State Wide ${d3.select(`sl-option[value=${mapColumnSwitch.value}]`).html()}`

    var encounterString = ""
    switch (mapColumnSwitch.value) {
        case "encounters":
            encounterString += "Encounters"
            break;
        case "pos_tests":
            encounterString += "Positive tests"
            break;
        case "encounter_plus_test":
            encounterString += "Encounters and positive tests"
            break;
    }
    encounterString += " from "
    var thisWeek = thisData.end_date
    switch (mapTimeSwitch.value) {
        case "weekly":
            var formatDate = d3.utcFormat("%b %d, %Y")
            encounterString += `${formatDate(thisWeek)} to ${formatDate(d3.utcDay.offset(thisWeek, 6))}`
            break;
        case "monthly":
            var startWeek = d3.utcDay.offset(thisWeek, -4*7)
            var formatDate = d3.utcFormat("%b %d, %y")
            encounterString += `${formatDate(startWeek)} to ${formatDate(d3.utcDay.offset(thisWeek, 6))}`
            break;
        case "yearly":
            var startWeek = d3.utcDay.offset(thisWeek, -52*7)
            var formatDate = d3.utcFormat("%b %d, %y")
            encounterString += `${formatDate(startWeek)} to ${formatDate(d3.utcDay.offset(thisWeek, 6))}`
            break;
    }
    encounterString += ": "
    var val = getData(stateFeature, mapTimeSwitch.value).data.at(-1)
    if (val) {
        if (mapRateSwitch.value == "rate") {
            val = Math.round(val * 1000) / 1000
            encounterString += `${val} (per 1000 people)`
        } else {
            encounterString += val
        }
    } else {
        encounterString += "N/A"
    }
    aggregatedDiseaseHistoryLargeSubtitle.innerHTML = encounterString

    var svg = d3.select(aggregatedDiseaseHistoryLargeSvg)
    svg.html("")
    var data = thisData
    var metadata = regionData.metadata
    var width = aggregatedDiseaseHistoryLargeSvg.clientWidth
    var height = aggregatedDiseaseHistoryLargeSvg.clientHeight

    var graphSVG = svg.append("svg")
        .attr("class", "tooltip-graph-svg")
        .attr("height", height)
        .attr("width", width)

    var yAxis = svg.append("g")
        .attr("class", "y-axis")
    var xAxis = svg.append("g")
        .attr("class", "x-axis")
    
    var minMaxVal = mapRateSwitch.value == "rate" ? 1000.0/data.population : 1
    var maxVal = d3.max(data.data) ? d3.max(data.data) : minMaxVal
    maxVal = d3.max(data.other) ? Math.max(maxVal, d3.max(data.other)) : maxVal
    
    // figure out how much space is needed for the y-axis text
    var temp = svg.append("text").text(d3.format(".2r")(maxVal)).attr("x", 0).attr("y", 0)
    var margins = {
        "top": .5*em, 
        "bottom": 1.5*em,
        "left": 1.25*em,
        "right": .5*em,
    }
    margins.left += Math.max(20, temp.node().getBBox().width)

    if (mapColumnSwitch.value == "pos_tests") {
        var percentages = data.data.map((pos_test, i) => pos_test / Math.max(data.other[i], 1))
        temp.text(d3.format(".0%")(1))
        margins.right += Math.max(10, temp.node().getBBox().width) + .75*em
    }

    var yScale = d3.scaleLinear()
        .domain([0, maxVal])
        .nice()
        .range([height-margins.bottom, margins.top])

    var start_date = parseDate(metadata.start_date)
    var xScale = d3.scaleUtc()
        .domain([start_date, parseDate(metadata.end_date)])
        .nice()
        .range([margins.left, width - margins.right])

    graphSVG.append("g").selectAll("rect")
        .data(data.other)
        .enter()
        .append("rect")
        .attr("x", (d, i) => xScale(d3.utcDay.offset(start_date, (7 * i))))
        .attr("y", d => yScale(d))
        .attr("height", d => yScale(0) - yScale(d))
        .attr("width", (width - (margins.left + margins.right)) / data.data.length)
        .attr("fill", "var(--sl-color-neutral-400)")

    graphSVG.append("g").selectAll("rect")
        .data(data.data)
        .enter()
        .append("rect")
        .attr("x", (d, i) => xScale(d3.utcDay.offset(start_date, (7 * i))))
        .attr("y", d => yScale(d))
        .attr("height", d => yScale(0) - yScale(d))
        .attr("width", (width - (margins.left + margins.right)) / data.data.length)
        .attr("fill", "var(--sl-color-neutral-1000)")

    yAxis.append("text")
        .attr("transform", `translate(${1*em},${yScale(d3.mean(yScale.domain()))})rotate(-90)`)
        .attr("text-anchor", "middle")
        .attr("fill", "var(--sl-color-neutral-1000)")
        .attr("font-size", "var(--sl-font-size-small)")
        .text(mapColumnSwitch.value == "pos_tests" ? "Tests" : d3.select(`sl-option[value=${mapColumnSwitch.value}]`).html())
        
    yAxis.append("g")
        .attr("transform", `translate(${margins.left},0)`)
        .call(d3.axisLeft(yScale).ticks(5).tickSize(4))
        .selectAll("text")
        .attr("class", "tooltip-label")
        .attr("fill", "var(--sl-color-neutral-1000)")

    xAxis.call(d3.axisBottom(xScale).tickArguments([d3.utcYear.every(1), d3.timeFormat("%Y")]))
        .attr("transform", `translate(0, ${height - margins.bottom})`)

    if (mapColumnSwitch.value == "pos_tests") {
        var yScale2 = d3.scaleLinear()
            .domain([0, 1])
            .nice()
            .range([height-margins.bottom, margins.top])

        var yAxis2 = svg.append("g")
            .attr("class", "y-axis")
        
        var percentageGroup = graphSVG.append("g")

          const line = d3.line()
            .x((_, i) => xScale(d3.utcDay.offset(start_date, (7 * i))))
            .y((d) => yScale2(d))

        percentageGroup.append("path")
            .attr("d", line(percentages))
            .style("stroke", "blue")
            .attr("fill", "none")
            .attr("stroke-width", 1)

        yAxis2.append("text")
            .attr("transform", `translate(${width-em},${yScale(d3.mean(yScale.domain()))})rotate(90)`)
            .attr("text-anchor", "middle")
            .attr("fill", "blue")
            .attr("font-size", "var(--sl-font-size-small)")
            .text("Percent Positive Tests")
            
        var yAxis2Axis = yAxis2.append("g")
            .attr("transform", `translate(${xScale.range()[1]},0)`)
            .call(d3.axisRight(yScale2).ticks(5, ".0%").tickSize(4))
        yAxis2Axis.selectAll("text")
            .attr("class", "tooltip-label")
            .attr("fill", "blue")
        yAxis2Axis.selectAll("line,path")
            .style("stroke", "blue")
        
        var legend = svg.append("g")
        legend.attr("transform", `translate(${xScale.range()[0] + .5*em}, 0)`)
        var posTest = legend.append("g")
        posTest.append("rect")
            .attr("height", .5*em)
            .attr("width", .5*em)
            .attr("x", 0)
            .attr("y", .5*em/4)
            .attr("fill", "var(--sl-color-neutral-1000)")
        posTest.append("text")
            .attr("x", .5*1.5*em)
            .attr("y", em/2)
            .attr("dominant-baseline", "middle")
            .attr("fill", "var(--sl-color-neutral-1000)")
            .style("font-size", "var(--sl-font-size-small)")
            .text("Positive Tests")
        var test = legend.append("g")
        test.attr("transform", `translate(0, ${em})`)
        test.append("rect")
            .attr("height", .5*em)
            .attr("width", .5*em)
            .attr("x", 0)
            .attr("y", .5*em/4)
            .attr("fill", "#FFCCCC")
        test.append("text")
            .attr("x", .5*1.5*em)
            .attr("y", em/2)
            .attr("dominant-baseline", "middle")
            .attr("fill", "var(--sl-color-neutral-400)")
            .style("font-size", "var(--sl-font-size-small)")
            .text("Tests")
        var percentPosTest = legend.append("g")
        percentPosTest.attr("transform", `translate(0, ${2*em})`)
        percentPosTest.append("line")
            .attr("x1", 0)
            .attr("x2", .5*em)
            .attr("y1", .5*em)
            .attr("y2", .5*em)
            .attr("stroke", "blue")
        percentPosTest.append("text")
            .attr("x", .5*1.5*em)
            .attr("y", em/2)
            .attr("dominant-baseline", "middle")
            .attr("fill", "blue")
            .style("font-size", "var(--sl-font-size-small)")
            .text("Percent Positive Tests")
    }
    
    temp.remove()
    
}

async function changeRegionSize() {
    regionData = await d3.json(`/data/other-infectious-diseases/${mapRegionSelector.value}/${mapColumnSwitch.value}`)
    stateFeature = regionData.features.find(d => d.properties.identifier == "state")

    selectedItems.region = undefined

    update()
}

async function changeDataColumn() {
    regionData = await d3.json(`/data/other-infectious-diseases/${mapRegionSelector.value}/${mapColumnSwitch.value}`)
    stateFeature = regionData.features.find(d => d.properties.identifier == "state")

    if (selectedItems.region) {
        selectedItems.region = regionData.features.find(d => d.properties.identifier == selectedItems.region.properties.identifier)
    }

    update()
}

function update() {
    selectedItems.dataVersion++
    drawTooltip(selectedItems.region)
    updateDiseaseCountDisplay()
    drawAggregation()
    drawLargeAggregation()
    drawLegend()
    redraw()
}