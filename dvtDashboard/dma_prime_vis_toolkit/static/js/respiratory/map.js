const { GeoJsonLayer, IconLayer, TextLayer, MapboxOverlay } = deck;
import { outcomeVariableStringCrosswalk, populationColorMap, unknownColor, getCenter, getFeatureValue, getAllFeaturesValue, drawTooltip, drawStateHospitalizations } from "/static/js/respiratory/script.js";
export { map, popup, selectedItems, deckOverlay, 
    redraw, updateMapTitle, updateMapTooltip,
    updateMapOutcomeVariableOptions, updateMapPopulationOptions, updateMapGeographicUnitOptions
 }

var icons = {
    data: await d3.csv('/data/health-care-facility'),
    iconAtlas: '/static/assets/Icons/icon-pack.png',
    iconMapping: await d3.json('/static/assets/Icons/icon-pack.json'),
}
  

var selectedItems = {
    "feature": undefined,
    "icons": []
}

// For discrete-binned choropleth, store the current bin edges for legend rendering
var choroplethDiscreteEdges = null

var choroplethColorMap = d3.scaleLinear()
    .domain([0, 1])
    .range(["white", populationColorMap["general_population"]])
    .unknown(unknownColor).nice()

const map = new maplibregl.Map({
    container: "map-div",
    style: "https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json",
    center: [-81, 33.65],
    zoom: 7,
})

await map.once('load', d => {
    d3.selectAll(".map-option").attr("disabled", null)
})

var popup = new maplibregl.Popup({focusAfterOpen: false, closeOnClick: false})
d3.select(popup.getElement()).style("color", "var(--sl-color-neutral-0)")

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

var regionData = await d3.json(`/data/respiratory/${mapGeographicUnitSelector.value}/${mapDiseaseSelector.value}?data_version=${metadata.data_version}&${parseInt(Math.random()*9999999999)}`)

redraw(true, true)
drawStateHospitalizations(mapDiseaseSelector.value, mapTypeSwitch.value, mapStateHospitalizationsSvg, mapStateHospitalizationsSubtitle)

async function redraw(resetWarnings=false, fetchData=false, center=false) {
    updateMapTitle()
    if (fetchData == true) {
        d3.select("#map-loading-div").style("visibility", "visible")
        d3.selectAll("#map-loading-div circle").classed("animate", true)
        regionData = await d3.json(`/data/respiratory/${mapGeographicUnitSelector.value}/${mapDiseaseSelector.value}?data_version=${metadata.data_version}&${parseInt(Math.random()*9999999999)}`) 
    }
    if (resetWarnings) {
        updateMapWarnings()
    }
    createChoropleth(regionData, mapTypeSwitch.value, mapPopulationSelector.value, mapOutcomeVariableSelector.value, mapIncludeImputations.checked)
    drawLegend()
    var layers = []
    if (mapGeographicUnitSelector.value != "facility") {
        layers.push(
            new GeoJsonLayer({
                id: 'respiratory_choropleth',
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
                    data: [mapGeographicUnitSelector.value, dataVersion],
                    getFillColor: [ mapGeographicUnitSelector.value, mapOutcomeVariableSelector.value, dataVersion ],
                },
            })
        )
    } else {
        layers.push(
            new GeoJsonLayer({
                id: 'respiratory_facility_background',
                depthTest: false,
                pickable: false,
                data: regionData,                
                pointType: 'icon+text',
                iconAtlas: icons.iconAtlas,
                iconMapping: icons.iconMapping,
                getIconSize: 22,
                getIcon: d => d.properties.system,
                getIconColor: d => {
                    let val = getFeatureValue(d, mapPopulationSelector.value, mapOutcomeVariableSelector.value, mapTypeSwitch.value, mapIncludeImputations.checked)
                    if (val === undefined) {
                        let c = unknownColor.rgb()
                        return [c.r, c.g, c.b]
                    } else if (val.length) {
                        val = val[2]
                    }
                    let c = unknownColor.rgb()
                    return isNaN(val) ? [c.r, c.g, c.b] : [0, 0, 0, 255]},
                iconSizeMinPixels: 12,
                updateTriggers: {
                    data: [mapGeographicUnitSelector.value, dataVersion],
                },
            }),
            new GeoJsonLayer({
                id: 'respiratory_facility',
                depthTest: false,
                pickable: true,
                data: regionData,                
                pointType: 'icon+text',
                iconAtlas: icons.iconAtlas,
                iconMapping: icons.iconMapping,
                getIconSize: 20,
                getIcon: d => d.properties.system,
                getIconColor: d => getColor(d),
                iconSizeMinPixels: 10,
                updateTriggers: {
                    data: [mapGeographicUnitSelector.value, dataVersion],
                    getIconColor: [ mapGeographicUnitSelector.value, mapOutcomeVariableSelector.value, dataVersion ],
                },
            })
        )
    }
    if (selectedItems.icons.length) {
        layers.push(
            new IconLayer({
                id: 'hospital-and-cdap',
                data: icons.data,
                iconAtlas: icons.iconAtlas,
                iconMapping: icons.iconMapping,
                getPosition: d => {return [+d.longitude, +d.latitude]},
                getIcon: d => {if(selectedItems.icons.includes(d.type)) return d.type},
                getSize: 15,
                pickable: true,
                parameters: {
                    depthTest: false
                },
                updateTriggers: {
                    getIcon: [ hospitalIconsToggle.checked, mobileClinicIconsToggle.checked, communityPartnerIconsToggle.checked ]  
                }
            }),
        )
    }
    if (mapGeographicUnitSelector.value != "state" && mapOptionsGeographicLabelsToggle.checked) {
        layers.push(
            new TextLayer({
                id: 'labels',
                data: regionData.features,
                getPosition: d => getCenter(d),
                getText: d => d.properties.id.toString(),
                getAlignmentBaseline: 'center',
                getTextAnchor: 'middle',
                getColor: [0, 0, 0],
                background: true,
                getBackgroundColor: [255, 255, 255, 32],
                backgroundBorderRadius: 2,
                backgroundPadding: [4, 4],
                getSize: mapGeographicUnitSelector.value == "zcta" ? Math.min(Math.max(8, map.getZoom()*1.5), 16) : 16,
                fontFamily:getComputedStyle(document.head).getPropertyValue("--sl-font-sans").replace(/\s/g,'').split(',') ,
                collisionGroup: 'labels',
                collisionTestProps: {sizeScale: 2.5},
                updateTriggers: {
                    getSize: [map.getZoom()],
                },
            })
        )
    }
    deckOverlay.setProps({
        layers: layers
    })

    d3.select("#map-loading-div").style("visibility", "hidden")
    d3.selectAll("#map-loading-div circle").classed("animate", false)

    if (center) {
        map.flyTo({
            center: [-81, 33.65],
            zoom: 7,
            essential: true // this animation is considered essential with respect to prefers-reduced-motion
        })
    }

}

function getColor(feature) {
    if (!selectedItems.feature || selectedItems.feature.properties.id == feature.properties.id) {
        var population = mapPopulationSelector.value
        var outcomeVariable = mapOutcomeVariableSelector.value
        var imputations = mapIncludeImputations.checked

        var c

        let value = getFeatureValue(feature, population, outcomeVariable, mapTypeSwitch.value, imputations)
        if (mapTypeSwitch.value == "percentDifference") {
            if (isNaN(value[1]) || value[0]) {
                c = d3.rgb(choroplethColorMap(value[2]))
            } else if (value[1] == 0) {
                c = d3.rgb("white")
            } else {
                c = d3.rgb("#ff8800")
            }
        } else {
            c = d3.rgb(choroplethColorMap(value))
        }

        return [c.r, c.g, c.b]
    } else {
        return [82, 82, 91] //sl-gray-600
    }
}

function createChoropleth(data, mapType, population, outcomeVariable, imputations=true) {
    if (mapType == "percentDifference") {
        choroplethColorMap = d3.scaleThreshold()
        .domain([-100, -50, 0, 50, 100, 500])
        .range(d3.reverse(d3.schemeRdBu[8]).slice(1))
        .unknown(unknownColor)
    } else {
        var arr = []
        if (mapGeographicUnitSelector.value == "state") {
            var thisData = data.features[0].properties.data[population][outcomeVariable]['historical']
            if (mapType == "rate") {
                arr =  thisData.map(d => d/ data.features[0].properties.population * 1000)
            }
        } else {
            arr = getAllFeaturesValue(data.features, population, outcomeVariable, mapType, imputations)
        }
        if (outcomeVariable == "rate_of_transmission") {
            choroplethDiscreteEdges = null
            choroplethColorMap = d3.scaleLinear()
                .domain([0, .9, Math.max(d3.max(arr), 1)])
                .range(["white", populationColorMap[population]['historical'], "red"])
                .unknown(unknownColor).nice()
        } else {
            choroplethColorMap = d3.scaleQuantize()
                .domain([0, d3.max(arr) || 1])
                .range(d3.quantize(d3.interpolateRgb("white", populationColorMap[population]['historical']), 5))
                .unknown(unknownColor).nice()
        }
    }
}

function drawLegend() {
    var legendMargins = {
        "top": 12,
        "bottom": 16,
        "left": 8,
        "right": 8,
    }

    // Add components for choropleth legend
    choroplethLegendSVG.innerHTML = ""

    d3.select(mapShapeLegend).attr("display", mapGeographicUnitSelector.value == "facility" ? "initial" : "none")

    if (mapTypeSwitch.value == "percentDifference") {

        var colors = d3.reverse(d3.schemeRdBu[8]).slice(1)
        var labels = [-100, -50, 0, 50, 100, 500]
        var legendLength = 350
        var legend = d3.select(choroplethLegendSVG)
            .attr("overflow", "visible")

        legend //.attr("transform", `translate(0, 16)`)
            .attr("width", legendLength)
            .attr("height", 140)

        legend.append("text")
            .attr("x", legendLength/2)
            .attr("y", 100 - em/2)
            .attr("text-anchor", "middle")
            .style("font-size", 'var(--sl-font-size-x-small)')
            .text(`Percent Change of ${d3.select(`sl-option[value=${mapDiseaseSelector.value}]`).html()} from Last Week`)
        
        legend.append("g").attr("transform", "translate(0, 100)").selectAll("rect")
            .data(colors)
            .enter()
            .append("rect")
            .attr("x", (d, i) => legendLength * i / colors.length)
            .attr("y", 0)
            .attr("width", legendLength / colors.length)
            .attr("height", 15)
            .attr("fill", d => d)
        
        legend.append("g").attr("transform", "translate(0, 100)").selectAll("text")
            .data(labels)
            .enter()
            .append("text")
            .attr("class", `map-legend`)
            .attr("x", (d, i) => legendLength * (i + 1) / colors.length)
            .attr("y", 15 + em*.75)
            .attr("text-anchor", "middle")
            .html(d => `${d}%`)

        var otherColors = legend.append("g")
        var others = [["white", `No ${outcomeVariableStringCrosswalk[mapOutcomeVariableSelector.value]}`], 
        ["#ff8800", `New ${outcomeVariableStringCrosswalk[mapOutcomeVariableSelector.value]} from Last Period`],
        [unknownColor, "Unknown"]]

        others.forEach((d, i) => {
            let group = otherColors.append("g")
                .attr("transform", `translate(0, ${(i+1) * 20})`)
            group.append("rect")
                .attr("x", 0)
                .attr("y", 0)
                .attr("height", 15)
                .attr("width", 15)
                .attr("fill", d[0])
                .attr("stroke", "black")
                .attr("stroke-width", 1)
            group.append("text")
                .attr("class", "legend-other-colors")
                .attr("x", 20)
                .attr("y", 7.5)
                .attr("dominant-baseline", "middle")
                .text(d[1])
        })
    } else {
        var legendWidth = Math.max(mapDiv.clientWidth/3, 340)
        var colorLegend = d3.select(choroplethLegendSVG)
            .attr("transform", null)
            .attr("width", legendWidth + legendMargins.left + legendMargins.right)
            .attr("height", 3*em + legendMargins.top + legendMargins.bottom)

        // Discrete 5-bin legend for encounters/inpatient/ed and positive-tests
        if (mapOutcomeVariableSelector.value != "rate_of_transmission") {
            var edges = (choroplethDiscreteEdges && choroplethDiscreteEdges.length === 6)
                ? choroplethDiscreteEdges
                : (function(){
                    var dom = choroplethColorMap.domain ? choroplethColorMap.domain() : [0]
                    var maxValTmp = Array.isArray(dom) && dom.length ? Math.max(0, d3.max(dom)) : 0
                    var t = d3.ticks(0, Math.max(maxValTmp, 1), 5)
                    var s = t.length >= 2 ? (t[1]-t[0]) : 1
                    return Array.from({length: 6}, (_, i) => i * s)
                })()
            var bins = choroplethColorMap.range().map((color, i) => ({ color, x0: edges[i], x1: edges[i+1] }))

            var xDomain = [edges[0], edges[edges.length - 1]]
            var xScale = d3.scaleLinear().domain(xDomain).range([0, legendWidth])

            var content = colorLegend.append("g")
                .attr("transform", "translate(0, 8)")
                .attr("id", "map-color-legend-contents")

            content.selectAll("rect.bin")
                .data(bins)
                .enter()
                .append("rect")
                .attr("class", "bin")
                .attr("x", d => legendMargins.left + xScale(d.x0))
                .attr("y", legendMargins.top)
                .attr("width", d => Math.max(1, xScale(d.x1) - xScale(d.x0)))
                .attr("height", em)
                .attr("fill", d => d.color)

            // Axis with bin boundaries
            var tickValues = edges
            var numberFormatter = d3.format(",.2~f")
            var axisG = content.append("g")
                .attr("id", "map-color-legend-axis")
                .attr('transform', `translate(${legendMargins.left} ${em+legendMargins.top})`)
                .call(d3.axisBottom(xScale)
                    .tickValues(tickValues)
                    .tickFormat(numberFormatter)
                )

            // Avoid label overflow: anchor first and last labels inside bounds
            axisG.selectAll("text")
                .attr("text-anchor", (d, i) => i === 0 ? "start" : (i === tickValues.length - 1 ? "end" : "middle"))

            content.append("text")
                .attr("id", `map-legend-title`)
                .attr("class", `map-legend title`)
                .attr("x", legendWidth/2 + legendMargins.left)
                .attr("y", 3*em + legendMargins.top)
                .text(`Current Week's ${metadata.outcome_variables[mapOutcomeVariableSelector.value]} by ${metadata.region_sizes[mapGeographicUnitSelector.value]}`)
        } else {
            // Continuous gradient legend (default)
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
            if (mapOutcomeVariableSelector.value == "rate_of_transmission") {
                linearGrdient.append("stop")
                    .attr("id", "linear-gradient-stop-1")
                    .attr("offset", `${(.9/choroplethColorMap.domain().at(-1))*100}%`)
                    .attr("stop-color", choroplethColorMap.range().at(1))
            }
            linearGrdient.append("stop")
                .attr("id", "linear-gradient-stop-1")
                .attr("offset", "100%")
                .attr("stop-color", choroplethColorMap.range().at(-1))

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
                .call(d3.axisBottom(d3.scaleLinear(d3.extent(choroplethColorMap.domain()), [0, legendWidth]).nice()).ticks(6))

            colorLegendContent.append("text")
                .attr("id", `map-legend-title`)
                .attr("class", `map-legend title`)
                .attr("x", legendWidth/2 + legendMargins.left)
                .attr("y", 3*em + legendMargins.top)
                .text(`Current Week's ${metadata.outcome_variables[mapOutcomeVariableSelector.value]} by ${metadata.region_sizes[mapGeographicUnitSelector.value]}`)
        }

    }
}

function updateMapTitle() {
    var titleStart = `${d3.select(mapTypeSwitch).select(`*[value=${mapTypeSwitch.value}]`).html()} `
    titleStart += `of ${d3.select(mapDiseaseSelector).select(`*[value=${mapDiseaseSelector.value}]`).html()} `
    titleStart += `${d3.select(mapOutcomeVariableSelector).select(`*[value=${mapOutcomeVariableSelector.value}]`).html()} `

    var titleEnd = "in South Carolina "
    if (mapGeographicUnitSelector.value != "state") {
        titleEnd += "by "
        titleEnd += d3.select(mapGeographicUnitSelector).select(`*[value=${mapGeographicUnitSelector.value}]`).html() 
    } 

    var newTitle

    switch (mapTypeSwitch.value) {
        case "count": 
            newTitle = titleStart + titleEnd
            break;
        case "rate": 
            newTitle = titleStart + "(per 1000 people) " + titleEnd
            break;
        case "percentDifference": 
            newTitle = titleStart + "from Last Week " + titleEnd
            break;
        default: 
            newTitle = titleStart + titleEnd
            break;
    }

    mapTitle.innerHTML = newTitle
}

function updateMapTooltip(featureProperties) {
    var ttpDiv = d3.select("#map-tooltip-div")
        var width = mapDiv.clientWidth
        var mapTooltipWidth = Math.max(500, width * .3)
        var mapTooltipHeight = mapTooltipWidth * .65
        var ttpSVG = ttpDiv.select(".tooltip-outer-svg")
            .attr("width", mapTooltipWidth)
            .attr("height", mapTooltipHeight)

    drawTooltip(featureProperties,
        ttpSVG, ttpDiv.select(".tooltip-header"), ttpDiv.select(".tooltip-footer"), 
        mapPopulationSelector.value, mapOutcomeVariableSelector.value,
        mapTypeSwitch.value, false, false)
        
}

function updateMapWarnings() {
            
    // check for alert status
    let noForecast = 1
    let noForecastThisWeek = 1
    let someForecastThisWeek
    let allForecast = 1
    for (let feature of regionData.features) {
        let thisData = feature.properties.data[mapPopulationSelector.value][mapOutcomeVariableSelector.value]

        let hasProjection = thisData.projected.values.length

        // essentially trying to "prove wrong" each option
        if (noForecast) {
            let hasHistorical = thisData.historical.values.length
            noForecast &&= !(hasHistorical | hasProjection)
        }
        if (noForecastThisWeek | allForecast) {
            let startECurr = dayjs(thisData.projected.start_date).isSame(currentDate)
            if (hasProjection) {
                noForecastThisWeek &&= !startECurr
                allForecast &&= startECurr
            }
        }

    }
    someForecastThisWeek = !(noForecastThisWeek | allForecast)

    mapNoForecastAlert.hide()
    mapNoForecastThisWeekAlert.hide()
    mapMixedForecastThisWeekAlert.hide()
    mapDisclaimer.innerHTML = ""

    if (noForecast) {
        mapNoForecastAlert.show()

    } else {
        if (noForecastThisWeek) {
            mapNoForecastThisWeekAlert.show()
        }
        if (someForecastThisWeek) {
            mapMixedForecastThisWeekAlert.show()
            mapDisclaimer.innerHTML = "Partial forecast submissions available for this week"
        }
    }

    // no forecast: all historical & projection lengths = 0
    // no forecast this week: all start_date != current_week where projection has length
    // some forecast this week: some start_date != current_week
    // all forecast updated: all start_date = current_week (and some projections have length)
}

async function updateMapGeographicUnitOptions() {
    d3.selectAll(".map-geographic-unit-option").remove()
    var availableGeographicUnits = Object.keys(metadata.available_models[mapDiseaseSelector.value])
    d3.select(mapGeographicUnitSelector)
        .selectAll(".map-geographic-unit-option")
        .data(availableGeographicUnits)
        .enter()
        .append("sl-option")
        .attr("class", "map-geographic-unit-option")
        .attr("value", d => d)
        .html(d => metadata.region_sizes[d])

    if (availableGeographicUnits.includes(mapGeographicUnit)) {
        // do nothing
    } else {
        mapGeographicUnit = availableGeographicUnits[0]
        mapGeographicUnitSelector.value = mapGeographicUnit
    }

    updateMapPopulationOptions()
}

async function updateMapPopulationOptions() {
    d3.selectAll(".map-population-tooltip").remove()
    var availablePopulations = Object.keys(metadata.available_models[mapDiseaseSelector.value][mapGeographicUnitSelector.value])
    d3.select(mapPopulationSelector)
        .selectAll(".map-population-tooltip")
        .data(availablePopulations)
        .enter()
        .append("sl-tooltip")
        .attr("class", "map-population-tooltip")
        .attr("content", d => metadata.populations_tooltips[d])
        .attr("triger", "hover")
        .attr("hoist", "")
        .append("sl-option")
        .attr("class", "map-population-option")
        .attr("value", d => d)
        .html(d => metadata.populations[d])

    if (availablePopulations.includes(mapPopulation)) {
        // do nothing
    } else {
        mapPopulation = availablePopulations[0]
        mapPopulationSelector.value = mapPopulation
    }

    updateMapOutcomeVariableOptions()
}

async function updateMapOutcomeVariableOptions() {
    d3.selectAll(".map-outcome-tooltip").remove()
    var availableOutcomeVariables = metadata.available_models[mapDiseaseSelector.value][mapGeographicUnitSelector.value][mapPopulationSelector.value]
    d3.select(mapOutcomeVariableSelector)
        .selectAll(".map-outcome-tooltip")
        .data(availableOutcomeVariables)
        .enter()
        .append("sl-tooltip")
        .attr("class", "map-outcome-tooltip")
        .attr("content", d => metadata.outcome_variables_tooltips[d])
        .attr("triger", "hover")
        .attr("hoist", "")
        .append("sl-option")
        .attr("class", "map-outcome-option")
        .attr("value", d => d)
        .html(d => metadata.outcome_variables[d])

    if (availableOutcomeVariables.includes(mapOutcomeVariable)) {
        // do nothing
    } else {
        mapOutcomeVariable = availableOutcomeVariables[0]
        mapOutcomeVariableSelector.value = mapOutcomeVariable
    }
}