// const { IconLayer } = require("@deck.gl/layers");

const { DeckGL, GeoJsonLayer, IconLayer, FlyToInterpolator } = deck;


// import {MapboxOverlay as DeckOverlay} from '@deck.gl/mapbox';
// import {GeoJsonLayer} from '@deck.gl/layers';
// import maplibregl from 'maplibre-gl';
// import 'maplibre-gl/dist/maplibre-gl.css';

// const map = new maplibregl.Map({
//     container: "map-div",
//     style: 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json',
//     center: [-80.75, 33.8],
//     zoom: 7,
// })

// const deckOverlay = new DeckOverlay({

// })

// map.addControl(deckOverlay)
// map.addControl(new maplibregl.NavigationControl())

const deckgl = new DeckGL({
    container: document.getElementById("map-div"),
    mapStyle: 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json',
    initialViewState: {
        longitude: -80.75,
        latitude: 33.8,
        zoom: 7
    },
    controller: true,
    pickingRadius: 10,
});

// deckgl.addWidget(new D3Anchor({
//     "id": "choropleth-legend",
//     "placement": "bottom-left",
//     "divId": "help"
// }));

function mapSetup() {
    d3.json(`/data/hospitalizations/opioid`).then(function (zctaData) {
        features = zctaData.features
        d3.select(mapVariable1Selector).selectAll("sl-option")
            .each(function(el) {
                column = this.value
                d3.select(mapFiltersContainer).append("svg")
                    .attr("id", `map-${column}-filter`)
                    .attr("class", "map-histogram-filter")
                updateHistogram(column)
            })
    })
    
    redraw();
}

function getDataFromFeatures(feature, column, year, rate) {
    columnData = feature.properties.data[column]
    if (columnData) {
        val = +columnData[year]
        if (rate & ["hospitalizations", "deaths"].includes(column))  {
            val = (val/feature.properties.population) * 1000
        } 
        return val  
    } else {
        return undefined
    }
      
}

function redraw(highlightIndex=-1) {
    hIndex = highlightIndex == null ? deckgl.layerManager.layers[0].props.highlightedObjectIndex : highlightIndex
    d3.json(`/data/hospitalizations/opioid`).then(function (zctaData) {
        features = zctaData.features

        var1Data = d3.map(features, d => getDataFromFeatures(d, mapVariable1Selector.value, mapYearSelector.value, mapRateSwitch.value=="rate"))
        var2Data = d3.map(features, d => getDataFromFeatures(d, mapVariable2Selector.value, mapYearSelector.value, mapRateSwitch.value=="rate"))

        if (mapVariable2Selector.value == "none") {
            univariateColormap = createUnivariateColormap(d3.min(var1Data), d3.max(var1Data))
        } else {
            bivariateColormap = createBivariateColormap(d3.min(var1Data), d3.max(var1Data), d3.min(var2Data), d3.max(var2Data))
        }

        drawLegend(d3.min(var1Data), d3.max(var1Data), d3.min(var2Data), d3.max(var2Data))
    }).then(() => {
        deckgl.setProps({
            layers: [
                new GeoJsonLayer({
                    id: 'opioid_choropleth',
                    data: d3.json(`/data/hospitalizations/opioid`), //'../../static/data/opioid_zcta_hospitalization_data.json',
                    stroked: true,
                    filled: true,
                    pointType: 'circle+text',
                    pickable: true,
                    onClick: function(info, event) {redraw(info.index); mobileClinicClick(info.object)},
                    getFillColor: d => getColor(d),
                    highlightedObjectIndex: hIndex,
                    highlightColor: [255, 255, 255, 0],
                    lineWidthMinPixels: .5,
                    getLineWidth: (d, i) => {return 20 * (i.index == hIndex ? 50 :1)},
                    getLineColor: (d, i) => i.index == hIndex ? [255, 255, 255] : [0, 0, 0],
                    getPointRadius: 4,
                    getTextSize: 12,
                    updateTriggers: {
                        getFillColor: { dataVersion }
                    },
                }),
                new IconLayer({
                    id: 'hospital-and-cdap',
                    data: d3.csv('/data/icon/hospital-cdap_mhc_partners'),
                    iconAtlas: '/icon-pack/png',
                    iconMapping: 'icon-pack/json',
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
    })
}

function getColor(zcta) {
    // single or bivariate heatmap
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
        column = threshold[0]
        min = threshold[1][0]
        max = threshold[1][1]
        val = getDataFromFeatures(zcta, column, mapYearSelector.value, mapRateSwitch.value=="rate")
        if (val < min || val > max) {
            colormap = a => b => unknownColor
        }
    })

    c = d3.rgb(colormap(val1)(val2))
    if (c.toString() == unknownColor.toString()) {
        // ciccio opacity for greyed out zcta
        c.opacity = 0.5
    }

    return [c.r, c.g, c.b, c.opacity*255]
}

function drawLegend(primaryMin = 0, primaryMax = 3, secondaryMin = 0, secondaryMax = 3) {
    choroplethLegendSVG.innerHTML = ""
    legend = d3.select(choroplethLegendSVG)
        .attr("overflow", "visible")

    if (mapVariable2Selector.value == "none") {
        legend.attr("transform", `translate(40, 0)`)
            .attr("width", 450)
            .attr("height", 50)
        legDefs = legend.append("defs")
        linearGradient = legDefs.append("linearGradient")
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

        xAxis = legend.append("g")
            .attr("transform", "translate(0,15)")
            .call(d3.axisBottom(d3.scaleLinear().domain(d3.extent(univariateColormap.domain())).range([0, 450])))

    } else {
        legend.attr("width", 100)
            .attr("height", 100)
            .attr("transform", `translate(40,-40) rotate(0) scale(1 -1)`)

        for (i = 0; i < 3; i++) {
            for (j = 0; j < 3; j++) {
                rect = legend.append('rect')
                    .attr("id", `#r${i}${j}`)
                    .attr("fill", bivariateColormap(primaryMin + (primaryMax-primaryMin)*(i+.1)/3)(secondaryMin + (secondaryMax-secondaryMin)*(j+.1)/3))
                    .attr("height", 25)
                    .attr("width", 25)
                    .attr("x", 25 * i)
                    .attr("y", 25 * j)
            }
        }
    
        legendCountAxis = legend.append("g")
            .attr("id", "legend-count-axis")
        legendCountAxis.append("line")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", 75)
            .attr("y2", 0)
            .attr("stroke-width", 2)
            .attr("stroke", "black")
        legendCountAxis.append("text")
            .attr("x", 75 / 2)
            .attr("y", 10 + 10 + 12)
            .attr("text-anchor", "middle")
            .attr("font-size", 12)
            .attr("fill", "black")
            .attr("transform", "scale(1 -1)")
            .text(variableOptions[mapVariable1Selector.value]["displayName"])
        for (i = 1; i < 3; i++) {
            legendCountAxis.append("line")
                .attr("x1", 25 * i)
                .attr("y1", 0)
                .attr("x2", 25 * i)
                .attr("y2", -10)
                .attr("stroke-width", 2)
                .attr("stroke", "black")
            legendCountAxis.append("text")
                .attr("x", 25 * i)
                .attr("y", 10 + 10)
                .attr("text-anchor", "middle")
                .attr("font-size", 10)
                .attr("fill", "black")
                .attr("transform", "scale(1 -1)")
                .text(d3.format(".0f")(bivariateColormap.thresholds()[i-1]))
        }
    
        legendCountAxis = legend.append("g")
            .attr("id", "legend-confidence-axis")
            .attr("transform", "rotate(90)")
        legendCountAxis.append("line")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", 75)
            .attr("y2", 0)
            .attr("stroke-width", 2)
            .attr("stroke", "black")
        legendCountAxis.append("text")
            .attr("x", 75 / 2)
            .attr("y", -(5 + 10 + 12))
            .attr("text-anchor", "middle")
            .attr("font-size", 12)
            .attr("fill", "black")
            .attr("transform", "scale(1 -1)")
            .text(variableOptions[mapVariable2Selector.value]["displayName"])
        for (i = 1; i < 3; i++) {
            legendCountAxis.append("line")
                .attr("x1", 25 * i)
                .attr("y1", 0)
                .attr("x2", 25 * i)
                .attr("y2", 10)
                .attr("stroke-width", 2)
                .attr("stroke", "black")
            legendCountAxis.append("text")
                .attr("x", 25 * i)
                .attr("y", -(5 + 10))
                .attr("text-anchor", "middle")
                .attr("font-size", 10)
                .attr("fill", "black")
                .attr("transform", "scale(1 -1)")
                .text(d3.format(".0f")(bivariateColormap(0).thresholds()[i-1]))
        }
    }
}

function updateHistogram(column) {
    svgElement = document.getElementById(`map-${column}-filter`)
    svgElement.innerHTML = ""
    svg = d3.select(svgElement)
    
    svgHeight = svgElement.clientHeight
    svgWidth = svgElement.clientWidth

    data = d3.map(features, d => getDataFromFeatures(d, column, mapYearSelector.value, mapRateSwitch.value=="rate"))
    bins = d3.bin()(data) // if we want, we could change data to a selector of properties

    x = d3.scaleLinear().domain([bins[0].x0, bins[bins.length-1].x1]).range([2*em, svgWidth-em])
    y = d3.scaleLinear().domain([0, d3.max(bins, d => d.length)]).range([svgHeight-2*em, em])

    xScales[column] = x

    histogram = svg.append("g")
        .attr("id", "map-histogram")
        .attr("fill", unknownColor)
        .selectAll()
        .data(bins)
        .join("rect")
        .attr("x", d => x(d.x0)+1)
        .attr("y", d => y(d.length))
        .attr("width", d => x(d.x1)-x(d.x0)-1)
        .attr("height", d => y(0)-y(d.length))

    bottomTicks = x.domain()[1] < 1000 ? 6 : x.domain()[1] < 10000 ? 5 : 4

    xAxis = svg.append("g")
        .attr("transform", `translate(0,${svgHeight-2*em})`)
        .call(d3.axisBottom(x).ticks(bottomTicks).tickSizeOuter(0))
        .call((g) => g.append("text")
                        .attr("x", svgWidth/2)
                        .attr("y", 1.75*em)
                        .attr("fill", "currentColor")
                        .attr("text-anchor", "middle")
                        .text(variableOptions[column]["displayName"]))

    yAxis = svg.append("g")
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

    brush = d3.brushX().extent([[x.range()[0], y.range()[1]],[x.range()[1], y.range()[0]]]).on("end", function(d, event) { 
        if (d.selection && d.mode) {
            x = xScales[column]

            lowerVal = Math.floor(x.invert(d.selection[0])*100)/100
            higherVal = Math.ceil(x.invert(d.selection[1])*100)/100
            lowerX = x(lowerVal)
            higherX = x(higherVal)

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
        redraw(null)
    })
    svg.append("g").attr("id", `map-${column}-filter-brush`).call(brush)

    brushes[column] = brush
}