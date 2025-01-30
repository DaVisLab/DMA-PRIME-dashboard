const { GeoJsonLayer, IconLayer, MapboxOverlay, Widget } = deck;

export { styleSheet, zctaData, selectedItems, map, deckOverlay, popup, redraw, drawTooltip, drawAggregation, drawLegend, updateDiseaseCountDisplay, getData, changeDataColumn }

var zctaData = await d3.json(`/data/other-infectious-diseases/encounters`)
var stateFeature = zctaData.features.find(d => d.properties.ZCTA == "state")

var selectedItems = {
    "zcta": undefined,
    "diseases": [],
    "dataVersion": 0
}

var choroplethColorMap = d3.scaleLinear()
    .domain([0, 1])
    .range(["white", "maroon"])
    .unknown(unknownColor).nice()

const map = new maplibregl.Map({
    container: "map-div",
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
    createChoropleth(zctaData)
    drawLegend()
    deckOverlay.setProps({
        layers: [
            new GeoJsonLayer({
                id: 'respiratory_choropleth',
                depthTest: false,
                pickable: true,
                data: zctaData,
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
                id: 'respiratory_county',
                depthTest: false,
                data: d3.json(`/data/map/county`),
                stroked: true,
                filled: false,
                pointType: 'circle+text',
                pickable: false,
                lineWidthMinPixels: 1.5,
                getLineWidth: 30,
                getLineColor: [0, 0, 0],
            }),
            new GeoJsonLayer({
                id: 'zcta_highlight',
                depthTest: false,
                data: selectedItems.zcta,
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
                    data: selectedItems.zcta ? selectedItems.zcta.properties.ZCTA : selectedItems.zcta,
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

        if (thisData.data.length > 0 && feature.properties.ZCTA != "state") {
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
        .html(`ZCTA: ${dataObject.properties.ZCTA}`)
    ttpTitle.append("br")
    ttpTitle.append("span")
        .attr("class", "tooltip-subtitle")
        .html(`County: ${dataObject.properties.county[0].toUpperCase()+dataObject.properties.county.substring(1)}`)

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
    encounterString += " in the "
    var thisWeek = parseDate(thisData.end_date)
    switch (mapTimeSwitch.value) {
        case "weekly":
            var formatDate = d3.utcFormat("%B %d, %Y")
            encounterString += `week of ${formatDate(thisWeek)}`
            break;
        case "monthly":
            var startWeek = d3.timeSaturday.offset(parseDate('2025-01-04'), -4)
            var formatDate = d3.utcFormat("%b/%d/%y")
            encounterString += `weeks ${formatDate(startWeek)}-${formatDate(thisWeek)}`
            break;
        case "yearly":
            var startWeek = d3.timeSaturday.offset(parseDate('2025-01-04'), -52)
            var formatDate = d3.utcFormat("%b/%d/%y")
            encounterString += `weeks ${formatDate(startWeek)}-${formatDate(thisWeek)}`
            break;
    }
    encounterString += ":<br/>"
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
    
    createBarGraph(ttpSVG, thisData, zctaData.metadata, ttpHeight, ttpWidth)
}

function drawAggregation() {
    var aggWidth = Math.max(300, document.getElementById("map-sidebar").clientWidth)
    var aggHeight = aggWidth * .5

    var aggSVG = d3.select(aggregatedDiseaseHistory)
    aggSVG.html("")

    var thisData = getData(stateFeature, "weekly")
    
    createBarGraph(aggSVG, thisData, zctaData.metadata, aggHeight, aggWidth)
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
        "population": feature.properties.population,
        "start_date": dayjs(),
        "end_date": dayjs(),
    }
    if (diseases.length > 0) {
        // one/many diseases
        var dataDicts = Object.entries(feature.properties.data).filter(d => diseases.includes(d[0]) && d[1][timeFrame].length > 0)
        dataDicts = dataDicts.map(d => d[1])
        var weeks
        if (dataDicts.length > 0) {
            if (timeFrame === "weekly") {
                var earliestDate = parseDate(zctaData.metadata.start_date)
                var latestDate = parseDate(zctaData.metadata.end_date)
                thisData.start_date = earliestDate
                thisData.end_date = latestDate
                weeks = d3.timeSaturday.count(earliestDate, latestDate) + 1
            } else {
                weeks = 1
            }
            thisData.data = new Array(weeks).fill(0)
            for (var data of dataDicts) {
                for (var i=0; i < data[timeFrame].length; i++) {
                    thisData.data[i] += data[timeFrame][i]
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

async function changeDataColumn() {
    zctaData = await d3.json(`/data/other-infectious-diseases/${mapColumnSwitch.value}`)
    stateFeature = zctaData.features.find(d => d.properties.ZCTA == "state")

    if (selectedItems.zcta) {
        selectedItems.zcta = zctaData.features.find(d => d.properties.ZCTA == selectedItems.zcta.properties.ZCTA)
        drawTooltip(selectedItems.zcta)
    }

    drawAggregation()
    drawLegend()
    redraw()
}