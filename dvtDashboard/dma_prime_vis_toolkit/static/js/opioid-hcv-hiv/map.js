// const { IconLayer } = require("@deck.gl/layers");

const { GeoJsonLayer, IconLayer, MapboxOverlay } = deck;

export { map, deckOverlay, brushes, thresholds, xScales, selectedZCTA, selectedCounty, zctaData, zctaFeatures, countyData, redraw, updateHistogram, mobileClinicClick, clearBrushes, changeDisease }

var brushes = {}
var thresholds = {}
var xScales = {}

await Promise.allSettled([ // wait for following to be defined/load in
    customElements.whenDefined('sl-select'),
    customElements.whenDefined('sl-option'),
    customElements.whenDefined('sl-button'),
])

var zctaData = await d3.json(`/data/opioid-hcv-hiv/${mapDiseaseSelector.value}?${parseInt(Math.random()*9999999999)}`)
var zctaFeatures = zctaData.features
var countyData = await d3.json(`/data/map/county`)

let selectedZCTA = {
    zcta: undefined,
}
let selectedCounty = {
    county: undefined,
}

const map = new maplibregl.Map({
    container: "map-div",
    style: "https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json",
    center: [-81, 33.65],
    zoom: 7
})

await map.once('load')

const deckOverlay = new MapboxOverlay({
    interleaved: false,
})

map.addControl(deckOverlay)
map.addControl(new maplibregl.NavigationControl())

redraw(true) 

function getDataFromFeatures(feature, column, year, rate) {
    var columnData = feature.properties.data[column]
    if (columnData) {
        var val = +columnData[year]
        if (rate && ["hospitalizations", "deaths"].includes(column))  {
            val = (val/feature.properties.population) * 1000
        } 
        return val  
    } else {
        return undefined
    }
}

function redraw(first=false) {
    drawLegend()
    if (first == true) {
        d3.select(mapVariable1Selector).selectAll("sl-option")
        .each(function(el) {
            var column = this.value
            d3.select(mapFiltersContainer).append("svg")
                .attr("id", `map-${column}-filter`)
                .attr("class", "map-histogram-filter")
            updateHistogram(column)
        })
        first = false
    }
    var highlightedData = []
    if (selectedZCTA.zcta) {
        highlightedData.push(selectedZCTA.zcta)
    }
    if (selectedCounty.county) {
        highlightedData.push(selectedCounty.county)
    }
    deckOverlay.setProps({
        layers: [
            new GeoJsonLayer({
                id: 'disease_choropleth',
                depthTest: false,
                data: zctaData,
                stroked: true,
                filled: true,
                pointType: 'circle+text',
                pickable: true,
                onClick: function(info, event) {mobileClinicClick(info.object); redraw();},
                getFillColor: d => getColor(d),
                highlightColor: [255, 255, 255, 0],
                lineWidthMinPixels: .5,
                getLineWidth: (d, i) => {return 20 * (d == selectedZCTA.zcta ? 50 :1)},
                getLineColor: (d, i) => {return d == selectedZCTA.zcta ? [255, 255, 255] : [0, 0, 0]},
                getPointRadius: 4,
                getTextSize: 12,
                updateTriggers: {
                    data: { dataVersion },
                    getFillColor: { dataVersion },
                    getLineWidth: selectedZCTA["zcta"],
                    getLineColor: selectedZCTA["zcta"],
                },
            }),
            new GeoJsonLayer({
                id: 'county',
                depthTest: false,
                data: d3.json(`/data/map/county`),
                onDataLoad: (data, context) => {          
                    countyData = data
                                        
                    if (selectedCounty.county) {
                        countyData.features.push(selectedCounty.county)
                        var currIndex = countyData.features.findIndex(d => {return selectedCounty.county.properties.NAME == d.properties.NAME})
                        countyData.features.splice(currIndex, 1)
                    }
                },
                stroked: true,
                filled: false,
                pointType: 'circle+text',
                pickable: false,
                lineWidthMinPixels: .5,
                getLineWidth: 20,
                getLineColor: [128, 128, 128],
                getPointRadius: 4,
                getTextSize: 12,
                updateTriggers: {
                    getLineWidth: selectedCounty["county"],
                    getLineColor: selectedCounty["county"],
                },
            }),
            new GeoJsonLayer({
                id: 'search_highlight',
                depthTest: false,
                data: highlightedData,
                stroked: true,
                filled: false,
                pointType: 'circle+text',
                pickable: true,
                lineWidthMinPixels: .5,
                getLineWidth: 1000,
                getLineColor: [255, 255, 255],
                getPointRadius: 4,
                getTextSize: 12,
                updateTriggers: {
                    data: { dataVersion },
                },
            }),
            new IconLayer({
                id: 'hospital-and-cdap',
                data: d3.csv('/data/health-care-facility'),
                iconAtlas: '/data/icon-pack/png',
                iconMapping: '/data/icon-pack/json',
                getPosition: d => {return [+d.longitude, +d.latitude]},
                getIcon: d => {if(checked.includes(d.type)) return d.type},
                getSize: 15,
                pickable: true,
                parameters: {
                    depthTest: false
                },
            })
        ]
    })
}

function getColor(zcta) {
    // single or bivariate heatmap
    var colormap, val1, val2
    if (mapVariable2Selector.value == "none") {
        colormap = a => b => univariateColormap(a)
        val1 = getDataFromFeatures(zcta, mapVariable1Selector.value, mapYearSelector.value, mapRateSwitch.value=="rate")
        val2 = null
    } else {
        colormap = bivariateColormap
        val1 = getDataFromFeatures(zcta, mapVariable1Selector.value, mapYearSelector.value, mapRateSwitch.value=="rate")
        val2 = getDataFromFeatures(zcta, mapVariable2Selector.value, mapYearSelector.value, mapRateSwitch.value=="rate")
    }

    // filter all thresholds, use colormap = (a, b) => unknownColor
    Object.entries(thresholds).forEach(threshold => {
        var column = threshold[0]
        var min = threshold[1][0]
        var max = threshold[1][1]
        var val = getDataFromFeatures(zcta, column, mapYearSelector.value, mapRateSwitch.value=="rate")
        if ((val < min || val > max) && !isNaN(parseInt(val))) {
            colormap = a => b => unknownColor
        }
    })

    var c = d3.rgb(colormap(val1)(val2))
    if (c.toString() == unknownColor.toString()) {
        // ciccio opacity for greyed out zcta
        c.opacity = 0.5
    }

    return [c.r, c.g, c.b, c.opacity*255]
}

function drawLegend() {
    var var1Data = d3.map(zctaFeatures, d => getDataFromFeatures(d, mapVariable1Selector.value, mapYearSelector.value, mapRateSwitch.value=="rate"))
    var var2Data = d3.map(zctaFeatures, d => getDataFromFeatures(d, mapVariable2Selector.value, mapYearSelector.value, mapRateSwitch.value=="rate"))

    primaryMin = d3.min(var1Data)
    primaryMax = d3.max(var1Data)
    secondaryMin = d3.min(var2Data)
    secondaryMax = d3.max(var2Data)

    if (mapVariable2Selector.value == "none") {
        univariateColormap = createUnivariateColormap(primaryMin, primaryMax)
    } else {
        bivariateColormap = createBivariateColormap(primaryMin, primaryMax, secondaryMin, secondaryMax)
    }

    choroplethLegendSVG.innerHTML = ""
    var legend = d3.select(choroplethLegendSVG)
        .attr("overflow", "visible")

    if (mapVariable2Selector.value == "none") {
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
            .attr("stop-color", mainColor[0])
        linearGradient.append("stop")
            .attr("offset", "50%")
            .attr("stop-color", mainColor[1])
        linearGradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", mainColor[2])

        legend.append("rect")
            .style("fill", "url(#linear-gradient)")
            .attr("width", 450)
            .attr("height", 15)

        var xAxis = legend.append("g")
            .attr("transform", "translate(0,15)")
            .call(d3.axisBottom(d3.scaleLinear().domain(d3.extent(univariateColormap.domain())).range([0, 450])))

    } else {
        var gridSize = 35
        legend.attr("width", 100)
            .attr("height", 100)
            .attr("transform", `translate(40,-40) rotate(0) scale(1 -1)`)

        for (var i = 0; i < 3; i++) {
            for (var j = 0; j < 3; j++) {
                var rect = legend.append('rect')
                    .attr("id", `#r${i}${j}`)
                    .attr("fill", bivariateColormap(primaryMin + (primaryMax-primaryMin)*(i+.1)/3)(secondaryMin + (secondaryMax-secondaryMin)*(j+.1)/3))
                    .attr("height", gridSize)
                    .attr("width", gridSize)
                    .attr("x", gridSize * i)
                    .attr("y", gridSize * j)
            }
        }
    
        var legendCountAxis = legend.append("g")
            .attr("id", "legend-count-axis")
        legendCountAxis.append("line")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", gridSize*3)
            .attr("y2", 0)
            .attr("stroke-width", 2)
            .attr("stroke", "black")
        legendCountAxis.append("text")
            .attr("x", gridSize*3 / 2)
            .attr("y", 10 + 10 + 12)
            .attr("text-anchor", "middle")
            .attr("font-size", 12)
            .attr("fill", "black")
            .attr("transform", "scale(1 -1)")
            .text(metadata['variables'][mapVariable1Selector.value])
        for (i = 1; i < 3; i++) {
            legendCountAxis.append("line")
                .attr("x1", gridSize * i)
                .attr("y1", 0)
                .attr("x2", gridSize * i)
                .attr("y2", -10)
                .attr("stroke-width", 2)
                .attr("stroke", "black")
            legendCountAxis.append("text")
                .attr("x", gridSize * i)
                .attr("y", 10 + 10)
                .attr("text-anchor", "middle")
                .attr("font-size", 10)
                .attr("fill", "black")
                .attr("transform", "scale(1 -1)")
                .text(parseInt(bivariateColormap.thresholds()[i-1] * 100)/100)
        }
    
        legendCountAxis = legend.append("g")
            .attr("id", "legend-confidence-axis")
            .attr("transform", "rotate(90)")
        legendCountAxis.append("line")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", gridSize*3)
            .attr("y2", 0)
            .attr("stroke-width", 2)
            .attr("stroke", "black")
        legendCountAxis.append("text")
            .attr("x", gridSize*3 / 2)
            .attr("y", -(5 + 10 + 12))
            .attr("text-anchor", "middle")
            .attr("font-size", 12)
            .attr("fill", "black")
            .attr("transform", "scale(1 -1)")
            .text(metadata['variables'][mapVariable2Selector.value])
        for (i = 1; i < 3; i++) {
            legendCountAxis.append("line")
                .attr("x1", gridSize * i)
                .attr("y1", 0)
                .attr("x2", gridSize * i)
                .attr("y2", 10)
                .attr("stroke-width", 2)
                .attr("stroke", "black")
            legendCountAxis.append("text")
                .attr("x", gridSize * i)
                .attr("y", -(5 + 10))
                .attr("text-anchor", "middle")
                .attr("font-size", 10)
                .attr("fill", "black")
                .attr("transform", "scale(1 -1)")
                .text(parseInt(bivariateColormap(0).thresholds()[i-1] * 100.) / 100)
        }
    }
}

async function updateHistogram(column) {
    var svgElement = document.getElementById(`map-${column}-filter`)
    svgElement.innerHTML = ""
    var svg = d3.select(svgElement)
    
    var svgHeight = svgElement.clientHeight
    var svgWidth = svgElement.clientWidth

    var data = d3.map(zctaFeatures, d => getDataFromFeatures(d, column, mapYearSelector.value, mapRateSwitch.value=="rate"))
    var bins = d3.bin()(data) // if we want, we could change data to a selector of properties

    var x = d3.scaleLinear().domain([bins[0].x0, bins[bins.length-1].x1]).range([2*em, svgWidth-em])
    var y = d3.scaleLinear().domain([0, d3.max(bins, d => d.length)]).range([svgHeight-2*em, em])

    xScales[column] = x

    var histogram = svg.append("g")
        .attr("id", "map-histogram")
        .attr("fill", unknownColor)
        .selectAll()
        .data(bins)
        .join("rect")
        .attr("x", d => x(d.x0)+1)
        .attr("y", d => y(d.length))
        .attr("width", d => x(d.x1)-x(d.x0)-1)
        .attr("height", d => y(0)-y(d.length))

    var bottomTicks = x.domain()[1] < 1000 ? 6 : x.domain()[1] < 10000 ? 5 : 4

    var xAxis = svg.append("g")
        .attr("transform", `translate(0,${svgHeight-2*em})`)
        .call(d3.axisBottom(x).ticks(bottomTicks).tickSizeOuter(0))
        .call((g) => g.append("text")
                        .attr("x", svgWidth/2)
                        .attr("y", 1.75*em)
                        .attr("fill", "currentColor")
                        .attr("text-anchor", "middle")
                        .text(metadata['variables'][column]))

    var yAxis = svg.append("g")
        .attr("transform", `translate(${2*em}, 0)`)
        .call(d3.axisLeft(y).ticks(4))

    svg.append("text").attr("id", `map-${column}-filter-left`)
        .attr("class", "map-filter-end-text")
        .attr("y", .75*em)
        .attr("text-anchor", "middle")

    svg.append("text").attr("id", `map-${column}-filter-right`)
        .attr("class", "map-filter-end-text")
        .attr("y", .75*em)
        .attr("text-anchor", "middle")

    var brush = d3.brushX().extent([[x.range()[0], y.range()[1]],[x.range()[1], y.range()[0]]]).on("end", function(d, event) { 
        if (d.selection && d.mode) {
            var x = xScales[column]

            var lowerVal = Math.floor(x.invert(d.selection[0])*100)/100
            var higherVal = Math.ceil(x.invert(d.selection[1])*100)/100
            var lowerX = x(lowerVal)
            var higherX = x(higherVal)

            brushes[column].move(d3.select(`#map-${column}-filter-brush`), [lowerX, higherX])

            d3.select(`#map-${column}-filter-left`).attr("x", d.selection[0]).text(lowerVal)
            d3.select(`#map-${column}-filter-right`).attr("x", d.selection[1]).text(higherVal)
            thresholds[column] = [lowerVal, higherVal]
        } else {
            thresholds[column] = xScales[column].domain()
            d3.select(`#map-${column}-filter-left`).text("")
            d3.select(`#map-${column}-filter-right`).text("")
        }
        dataVersion++
        redraw()
    })
    svg.append("g").attr("id", `map-${column}-filter-brush`).call(brush)

    brushes[column] = brush
}

function mobileClinicClick(object) {
    if (object === undefined) {
        return
    }
    selectedZCTA.zcta = object
    
    mapAndMinorSidebar.setAttribute("position", 80)
    zctaDiseaseInfoPanel.setAttribute("active", "")

    mapSecondarySidebarZctaName.innerHTML = `ZCTA: ${object.properties.ZCTA}`
    mapSecondarySidebarZctaCounty.innerHTML = `County: ${object.properties.county == "NaN" ? "Unknown" : capitalizeFirst(object.properties.county)}`
    mapSecondarySidebarHospitalizations.value = formatZctaData(object.properties.data["hospitalizations"][mapYearSelector.value], d => formatRateData(d, object.properties.population))
    mapSecondarySidebarDeaths.value = formatZctaData(object.properties.data["deaths"][mapYearSelector.value], d => formatRateData(d, object.properties.population))
    mapSecondarySidebarPopulation.value = formatZctaData(object.properties.population, formatInt)
    mapSecondarySidebarSVI.value = formatZctaData(object.properties.data["SVI"][mapYearSelector.value], d3.format(".0%"))
    mapSecondarySidebarProportionUninsured.value = formatZctaData(object.properties.data["proportion_uninsured"][mapYearSelector.value], d3.format(".0%"))
    mapSecondarySidebarMedianIncome.value = formatZctaData(object.properties.data["median_income"][mapYearSelector.value], d3.format("$,"))
    
    dataVersion++
}

function formatRateData(value, population) {
    return `${value} (${d3.format(".2")((value/population)*1000)} per 1000 people)`
}

function formatZctaData(value, formatter = (d) => d) {
    if (value == "NaN") {
        return "Unknown"
    } else {
        return formatter(value)
    }
}

function clearBrushes() {
    Object.entries(brushes).forEach(brush => {
        var column = brush[0]
        if (["hospitalizations", "deaths"].includes(column)) {
            d3.select(`#map-${column}-filter-brush`).call(brush[1].clear)
            thresholds[column] = xScales[column].domain()
        }
    })
}

async function changeDisease() {
    dataVersion++
    zctaData = await d3.json(`/data/opioid-hcv-hiv/${mapDiseaseSelector.value}?${parseInt(Math.random()*9999999999)}`)
    zctaFeatures = zctaData.features
    await Promise.allSettled([updateHistogram("hospitalizations"), updateHistogram("deaths") ])
    clearBrushes()
    if (selectedZCTA.zcta) {
        mobileClinicClick(selectedZCTA.zcta)
    }
    redraw()
}