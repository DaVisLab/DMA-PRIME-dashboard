const { GeoJsonLayer, IconLayer, MapboxOverlay, Widget } = deck;
import { startDate, currentWeek, zctaData,  dataSourceColorMap, parseHospDate } from "/static/js/respiratory/script.js";
export { map, popup, selectedItems, deckOverlay, redraw, drawStateHospitalizations }

var selectedItems = {
    "zcta": undefined,
    "icons": []
}

var choroplethColorMap = d3.scaleLinear()
    .domain([0, 1])
    .range(["white", dataSourceColorMap["state-data"]])
    .unknown("var(--sl-color-gray-600)").nice()

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
    customElements.whenDefined('sl-select'),
    customElements.whenDefined('sl-option'),
    customElements.whenDefined('sl-button'),
])
redraw(true)
drawStateHospitalizations()

function redraw(first=false) {
    createChoropleth(zctaData, mapDiseaseSelector.value, mapDataSourceSelector.value, mapRateSwitch.value == "rate", mapIncludeImputations.checked)
    drawLegend()
    deckOverlay.setProps({
        layers: [
            new GeoJsonLayer({
                id: 'respiratory_choropleth',
                depthTest: false,
                pickable: true,
                data: zctaData,
                stroked: false,
                stroked: true,
                filled: true,
                pointType: 'circle+text',
                pickable: true,
                getFillColor: d => getColor(d),
                lineWidthMinPixels: .75,
                getLineWidth: 20,
                getLineColor: [127, 127, 127],
                updateTriggers: {
                    getFillColor: { dataVersion },
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
                getLineWidth: 40,
                getLineColor: [0, 0, 0],
            }),
            new IconLayer({
                id: 'hospital-and-cdap',
                data: d3.csv('/data/health-care-facility/all'),
                iconAtlas: '/data/icon-pack/png',
                iconMapping: '/data/icon-pack/json',
                getPosition: d => {return [+d.longitude, +d.latitude]},
                getIcon: d => {if(selectedItems.icons.includes(d.type)) return d.type},
                getSize: 15,
                pickable: true,
                parameters: {
                    depthTest: false
                },
            })
        ]
    })

}

function getColor(feature) {
    if (!selectedItems.zcta || selectedItems.zcta.properties.ZCTA == feature.properties.ZCTA) {
    // if (!selectedItems.zcta) {
        var disease = mapDiseaseSelector.value
        var dataSource = mapDataSourceSelector.value
        var rate = mapRateSwitch.value == "rate"
        var imputations = mapIncludeImputations.checked
    
        var thisData = feature.properties.data[disease]
        var value = NaN
    
        if (thisData[dataSource].data.length > 0 && (imputations || !thisData.imputation)) {
            if (rate) {
                value = thisData[dataSource].data.at(-1) / feature.properties.population * 1000
            } else {
                value = thisData[dataSource].data.at(-1)
            }
        }
    
        var c = d3.rgb(choroplethColorMap(value))
        return [c.r, c.g, c.b]
    } else {
        return [82, 82, 91] //sl-gray-600
    }
}

function createChoropleth(data, disease, dataSource, rate, imputations=true) {
    var arr = data.features.map((d) => {
        var thisData = d.properties.data[disease]

        if (thisData[dataSource].data.length > 0 && (imputations || !thisData.imputation)) {
            if (rate) {
                return thisData[dataSource].data.at(-1) / d.properties.population * 1000
            } else {
                return thisData[dataSource].data.at(-1)
            }
        } else {
            return 0
        }
    })

    choroplethColorMap = d3.scaleLinear()
        .domain([0, d3.max(arr)])
        .range(["white", dataSourceColorMap[dataSource]])
        .unknown(d3.rgb(82, 82, 91)).nice()

}

function drawLegend() {
    var legendMargins = {
        "top": 8,
        "bottom": 8,
        "left": 8,
        "right": 8,
    }

    // Add components for choropleth legend
    choroplethLegendSVG.innerHTML = ""

    var legendWidth = Math.max(mapDiv.clientWidth/3, 300)
    var colorLegend = d3.select(choroplethLegendSVG)
        .attr("width", legendWidth + legendMargins.left + legendMargins.right)
        .attr("height", 3*em + legendMargins.top + legendMargins.bottom)

    // create gradient that goes from white to color... like the choropleth coloring
    var colorLegendDefs = colorLegend.append("defs")
    var linearGrdient = colorLegendDefs.append("linearGradient")
    linearGrdient.attr("id", "linear-gradient")
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "0%")
    linearGrdient.append("stop")
        .attr("id", "linear-gradient-stop-0")
        .attr("offset", "0%")
        .attr("stop-color", "white")
    linearGrdient.append("stop")
        .attr("id", "linear-gradient-stop-1")
        .attr("offset", "100%")
        .attr("stop-color", dataSourceColorMap[mapDataSourceSelector.value])

    // add background
    colorLegend.append("rect")
        .attr("class", "map-legend-background")
        .attr("width", legendWidth + legendMargins.left + legendMargins.right)
        .attr("height", 3*em + legendMargins.top + legendMargins.bottom)
    
    // display the choropleth range using gradient
    var colorLegendContent = colorLegend.append("g").attr("id", "map-color-legend-contents")
    colorLegendContent.append("rect")
        .style("fill", "url(#linear-gradient)")
        .attr("width", legendWidth)
        .attr("height", em)
        .attr("x", legendMargins.left)
        .attr("y", legendMargins.top)

    colorLegendContent.append("g").attr("id", "map-color-legend-axis")
        .attr('transform', `translate(${legendMargins.left} ${em+legendMargins.top})`)
        .call(d3.axisBottom(d3.scaleLinear(choroplethColorMap.domain(), [0, legendWidth])).ticks(9))

    colorLegendContent.append("text")
        .attr("id", `map-legend-title`)
        .attr("class", `map-legend title`)
        .attr("x", legendWidth/2 + legendMargins.left)
        .attr("y", 3*em + legendMargins.top)
        .text("Current Week's Hospitalizations by ZCTA")
}


function drawStateHospitalizations() {
    var disease_crosswalk = {
        "covid-19": d => +d["Total.COVID.19.Admissions"],
        "influenza-1": d => +d["Total.Influenza.Admissions"],
        "RSV": d => +d["Total.RSV.Admissions"], 
        "respiratory-diseases": d => (parseFloat(d["Total.COVID.19.Admissions"]) || 0) + (parseFloat(d["Total.Influenza.Admissions"]) || 0) + (parseFloat(d["Total.RSV.Admissions"]) || 0),
        "respiratory-diseases-2": d => (parseFloat(d["Total.COVID.19.Admissions"]) || 0) + (parseFloat(d["Total.Influenza.Admissions"]) || 0) + (parseFloat(d["Total.RSV.Admissions"]) || 0),
    }

    var disease_display_names = {
        "covid-19": "COVID-19",
        "influenza-1": "Influenza",
        "RSV": "RSV", 
        "respiratory-diseases": "COVID-19, Flu, RSV",
        "respiratory-diseases-2": "COVID-19, Flu, RSV"
    }
    
    mapStateHospitalizationsSvg.innerHTML = ""
    var stateHeight = mapStateHospitalizationsSvg.clientHeight
    var stateWidth = mapStateHospitalizationsSvg.clientWidth
    
    var svg = d3.select(mapStateHospitalizationsSvg)

    d3.csv("/data/hospitalizations/state").then(function(stateData) {
        stateData = stateData.filter(d => {
            var thisDate = dayjs(parseHospDate(d["Week.Ending.Date"]))
            return thisDate.isSameOrAfter(startDate) && thisDate.isSameOrBefore(currentWeek)})
        var yAxis = svg.append("g")
            .attr("class", "y-axis")
        var xAxis = svg.append("g")
            .attr("class", "x-axis")

        
        var maxVal = d3.max(stateData.map(d => disease_crosswalk[mapDiseaseSelector.value](d)))

        var temp = svg.append("text").text(d3.format(".2r")(maxVal)).attr("x", 0).attr("y", 0)
        var stateMargins = {
            "top": 1*em, 
            "bottom": 3.25*em,
            "left": Math.max(20, temp.node().getBBox().width) + 1.25*em,
            "right": 1*em,
        }

        var stateXScale = d3.scaleUtc()
                    .domain([startDate, d3.timeSaturday.offset(currentWeek, 1)]).range([stateMargins.left, stateWidth - stateMargins.right])    

        var stateYScale = d3.scaleLinear()
            .domain([0, maxVal])
            .nice()
            .range([stateHeight-stateMargins.bottom, stateMargins.top])

        svg.append("g")
            .selectAll("rect")
            .data(stateData)
            .enter()
            .append("rect")
            .attr("x", (d) => stateXScale(parseHospDate(d["Week.Ending.Date"])))
            .attr("y", d => stateYScale(disease_crosswalk[mapDiseaseSelector.value](d)))
            .attr("height", d => stateYScale(0) - stateYScale(disease_crosswalk[mapDiseaseSelector.value](d)))
            .attr("width", (stateWidth - (stateMargins.left + stateMargins.right)) / stateData.length)
            .attr("stroke", "var(--sl-color-neutral-1000)")
            .attr("stroke-width", 1)
            .attr("fill", "var(--sl-color-neutral-100)")

        yAxis.append("text")
            .attr("id", "map-state-hospitalizations-yaxis-title")
            .attr("transform", `translate(${1*em},${d3.mean(stateYScale.range())})rotate(-90)`)
            .attr("text-anchor", "middle")
            .attr("fill", "var(--sl-color-neutral-1000)")
            .attr("font-size", "var(--sl-font-size-small)")
            .text(disease_display_names[mapDiseaseSelector.value])
            
        yAxis.append("g")
            .attr("transform", `translate(${stateMargins.left},0)`)
            .call(d3.axisLeft(stateYScale).ticks(5).tickSize(4))
            .selectAll("text")
            .attr("class", "tooltip-label")
            .attr("fill", "var(--sl-color-neutral-1000)")

        xAxis.call(d3.axisBottom(stateXScale).tickArguments([d3.timeMonth.every(1), d3.timeFormat("%b %Y")]))
            .attr("transform", `translate(0, ${stateHeight - stateMargins.bottom})`)  
            .selectAll("text")
            .style("text-anchor", "end")
            .attr("transform", `translate(-12, 6) rotate(-90)`)
    })
}
