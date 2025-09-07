const { GeoJsonLayer, IconLayer, TextLayer, MapboxOverlay } = deck;
import { getDataAsArray, outcomeVariableStringCrosswalk, populationColorMap, unknownColor, getCenter, drawTooltip } from "/static/js/respiratory/script.js";
export { map, popup, selectedItems, deckOverlay, redraw, drawStateHospitalizations, drawLargeStateHospitalizations, updateMapTitle, updateMapTooltip }

var regionData

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

await map.once('load')

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
redraw(true)
drawStateHospitalizations()

async function redraw(fetchData=false) {
    updateMapTitle()
    if (fetchData == true) {
        regionData = await d3.json(`/data/respiratory/${mapRegionSelector.value}/${mapDiseaseSelector.value}?data_version=${metadata.data_version}&${parseInt(Math.random()*9999999999)}`) 
    }
    createChoropleth(regionData, mapTypeSwitch.value, mapPopulationSelector.value, mapOutcomeVariableSelector.value, mapIncludeImputations.checked)
    drawLegend()
    var layers = [
        new GeoJsonLayer({
            id: 'respiratory_choropleth',
            depthTest: false,
            pickable: true,
            data: regionData,
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
                data: [mapRegionSelector.value, dataVersion],
                getFillColor: [ mapRegionSelector.value, mapOutcomeVariableSelector.value, dataVersion ],
            },
        })
    ]
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
    if (mapRegionSelector.value != "state" && mapOptionsGeographicLabelsToggle.checked) {
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
                getSize: mapRegionSelector.value == "zcta" ? Math.min(Math.max(8, map.getZoom()*1.5), 16) : 16,
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

}

function getColor(feature) {
    if (!selectedItems.feature || selectedItems.feature.properties.id == feature.properties.id) {
        var population = mapPopulationSelector.value
        var outcomeVariable = mapOutcomeVariableSelector.value
        var imputations = mapIncludeImputations.checked
        var thisData = feature.properties.data[population][outcomeVariable]['historical']

        var c

        if (mapTypeSwitch.value == "percentDifference") {
            var thisWeekDatum = parseFloat(thisData.values.at(expectedShortHistoryDataPoints-1))
            var lastWeekDatum = parseFloat(thisData.values.at(expectedShortHistoryDataPoints-2))
            console.log(feature.properties.id, thisWeekDatum, lastWeekDatum, (thisWeekDatum - lastWeekDatum) / Math.abs(lastWeekDatum) * 100)
            console.log(d3.rgb(choroplethColorMap((thisWeekDatum - lastWeekDatum) / Math.abs(lastWeekDatum) * 100)))
            c = d3.rgb(unknownColor)
            if (isNaN(thisWeekDatum) || lastWeekDatum) {
                c = d3.rgb(choroplethColorMap((thisWeekDatum - lastWeekDatum) / Math.abs(lastWeekDatum) * 100))
            } else if (thisWeekDatum == 0) {
                c = d3.rgb("white")
            } else {
                c = d3.rgb("#ff8800")
            }
        } else {
            var value
        
            if (imputations || !thisData.imputed) {
                if (mapTypeSwitch.value == "rate") {
                    value = thisData.values.at(expectedShortHistoryDataPoints-1) / feature.properties.population * 1000
                } else {
                    value = thisData.values.at(expectedShortHistoryDataPoints-1)
                }
            }
            if (value === undefined || value === null || isNaN(value)) {
                c = d3.rgb(unknownColor)
            } else {
                c = d3.rgb(choroplethColorMap(value))
            }
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
        var arr
        if (mapRegionSelector.value == "state") {
            var thisData = data.features[0].properties.data[population][outcomeVariable]['historical']
            if (thisData.length > 0) {
                if (mapType == "rate") {
                    arr =  thisData.map(d => (d || 0) / data.features[0].properties.population * 1000)
                } else {
                    arr =  thisData.map(d => d || 1)
                }
            } else {
                arr = [1]
            }
        } else {
            arr = getDataAsArray(data, population, outcomeVariable, ['historical'], mapType == "rate", imputations)
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
        }
    }
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

    if (mapTypeSwitch.value == "percentDifference") {

        var colors = d3.reverse(d3.schemeRdBu[8]).slice(1)
        var labels = [-100, -50, 0, 50, 100, 500]
        var legendLength = 350
        var legend = d3.select(choroplethLegendSVG)
            .attr("overflow", "visible")

        legend.attr("transform", `translate(0, 16)`)
            .attr("width", legendLength)
            .attr("height", 50)

        legend.append("text")
            .attr("x", legendLength/2)
            .attr("y", -em/2)
            .attr("text-anchor", "middle")
            .style("font-size", 'var(--sl-font-size-x-small)')
            .text(`Percent Change of ${d3.select(`sl-option[value=${mapDiseaseSelector.value}]`).html()} from Last Week`)
        
        legend.append("g").selectAll("rect")
            .data(colors)
            .enter()
            .append("rect")
            .attr("x", (d, i) => legendLength * i / colors.length)
            .attr("y", 0)
            .attr("width", legendLength / colors.length)
            .attr("height", 15)
            .attr("fill", d => d)
        
        legend.append("g").selectAll("text")
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
                .attr("transform", `translate(0, ${(i+1) * -20 - 2*em})`)
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

            // add background
            colorLegend.append("rect")
                .attr("class", "map-legend-background")
                .attr("width", legendWidth + legendMargins.left + legendMargins.right)
                .attr("height", 3*em + legendMargins.top + legendMargins.bottom)

            var content = colorLegend.append("g").attr("id", "map-color-legend-contents")

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
                .text(`Current Week's ${metadata.outcome_variables[mapOutcomeVariableSelector.value]} by ${metadata.region_sizes[mapRegionSelector.value]}`)
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
                .text(`Current Week's ${metadata.outcome_variables[mapOutcomeVariableSelector.value]} by ${metadata.region_sizes[mapRegionSelector.value]}`)
        }

    }
}


function drawStateHospitalizations() {
    var stateMargins = {
        "top": 1*em, 
        "bottom": 3.25*em,
        "left": 1.25*em,
        "right": 1*em,
        "axis-thickness": 1,
    }

    function yAxisDisplayFunc(svg, stateYScale, stateWidth, stateHeight, stateMargins, diseaseDisplayNames) {
        svg.select(".y-axis").append("text")
        .attr("id", "map-state-hospitalizations-yaxis-title")
        .attr("transform", `translate(${1*em},${d3.mean(stateYScale.range())})rotate(-90)`)
        .attr("text-anchor", "middle")
        .attr("fill", "var(--sl-color-neutral-1000)")
        .attr("font-size", "var(--sl-font-size-small)")
        .text(diseaseDisplayNames[mapDiseaseSelector.value])
        
        svg.select(".y-axis").append("g")
            .attr("transform", `translate(${stateMargins.left - stateMargins["axis-thickness"]},0)`)
            .call(d3.axisLeft(stateYScale).ticks(5).tickSize(4))
            .selectAll("text")
            .attr("class", "tooltip-label")
            .attr("fill", "var(--sl-color-neutral-1000)")
    }

    function xAxisDisplayFunc(svg, stateXScale, stateWidth, stateHeight, stateMargins, diseaseDisplayNames) {
        svg.select(".x-axis").call(d3.axisBottom(stateXScale).tickArguments([d3.timeMonth.every(1), d3.timeFormat("%b %Y")]))
            .attr("transform", `translate(0, ${stateHeight - stateMargins.bottom})`)  
            .selectAll("text")
            .style("text-anchor", "end")
            .attr("transform", `translate(-12, 6) rotate(-90)`)
    }
    drawStateBarChart(mapStateHospitalizationsSvg, mapStateHospitalizationsSubtitle, stateMargins, yAxisDisplayFunc, xAxisDisplayFunc)
    
}

function drawLargeStateHospitalizations() {
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
            .attr("fill", "var(--sl-color-neutral-1000)")
            .attr("font-size", "var(--sl-font-size-small)")
            .text(diseaseDisplayNames[mapDiseaseSelector.value])
            
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
            .attr("fill", "var(--sl-color-neutral-1000)")
    }

    function xAxisDisplayFunc(svg, stateXScale, stateWidth, stateHeight, stateMargins, diseaseDisplayNames) {
        var allWeeks = [d3.timeDay.offset(startShortHistory, -7)].concat(shortHistoryDates)
        var xAxis = svg.select(".x-axis")
        var svgMajorXAxis = xAxis.append("g")
            .attr("id", "map-state-hospitalizations-large-major-xaxis")
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
            .attr("id", "map-state-hospitalizations-large-minor-xaxis")
            .call(d3.axisBottom(stateXScale).tickArguments([d3.timeDay.every(7), d3.timeFormat("")]))
            .attr("transform", `translate(0, ${stateHeight - stateMargins.bottom})`)

    }
    drawStateBarChart(mapStateHospitalizationsLargeSvg, mapStateHospitalizationsLargeSubtitle, stateMargins, yAxisDisplayFunc, xAxisDisplayFunc)
}

async function drawStateBarChart(svgDOM, subtitleDOM, stateMargins, yAxisDisplayFunc, xAxisDisplayFunc) {
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
        stateData = Object.entries(stateData[mapDiseaseSelector.value]).map(d => {
            temp = {"Date": parseDate(d[0]), "count": d[1]}
            if (mapTypeSwitch.value == "rate") {
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
        .attr("fill", d => dayjs(d["Date"]).isAfter(currentDate) ? "var(--sl-color-neutral-600)" : "var(--sl-color-neutral-100)")
        .attr("transform", `translate(-${barWidth}, 0)`)
        .on("mouseover", function(event, d) {
            var formatDate = d3.timeFormat("%b %d, %Y")
            var dateStr = formatDate(d["Date"])
            var countStr = mapTypeSwitch.value == "rate" ? `${d["count"].toFixed(2)} per 1000` : d["count"].toString()
            
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
        })
        .on("mouseout", function() {
            d3.selectAll(".chart-tooltip").remove()
        })

    yAxisDisplayFunc(svg, stateYScale, stateWidth, stateHeight, stateMargins, diseaseDisplayNames)
    xAxisDisplayFunc(svg, stateXScale, stateWidth, stateHeight, stateMargins, diseaseDisplayNames)
    
    temp.remove()
}

function updateMapTitle() {
    var titleStart = `${d3.select(mapTypeSwitch).select(`*[value=${mapTypeSwitch.value}]`).html()} `
    titleStart += `of ${d3.select(mapDiseaseSelector).select(`*[value=${mapDiseaseSelector.value}]`).html()} `
    titleStart += `${d3.select(mapOutcomeVariableSelector).select(`*[value=${mapOutcomeVariableSelector.value}]`).html()} `

    var titleEnd = "in South Carolina "
    if (mapRegionSelector.value != "state") {
        titleEnd += "by "
        titleEnd += d3.select(mapRegionSelector).select(`*[value=${mapRegionSelector.value}]`).html() 
    } 

    switch (mapTypeSwitch.value) {
        case "count": 
            mapTitle.innerHTML = titleStart + titleEnd
            break;
        case "rate": 
            mapTitle.innerHTML = titleStart + "(per 1000 people) " + titleEnd
            break;
        case "percentDifference": 
            mapTitle.innerHTML = titleStart + "from Last Week " + titleEnd
            break;
        default: 
            mapTitle.innerHTML = titleStart + titleEnd
            break;
    }
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
        mapTypeSwitch.value == "rate", false, false)
        
}
