const { GeoJsonLayer, IconLayer, TextLayer, MapboxOverlay } = deck;
const { load, ImageLoader } = loaders
import { startDate, currentWeek, endDate, dataSourceColorMap, unknownColor, parseDate, getCenter } from "/static/js/respiratory/script.js";
export { map, popup, selectedItems, deckOverlay, redraw, drawStateHospitalizations, drawLargeStateHospitalizations, updateMapTitle }

loaders.registerLoaders(loaders.ImageLoader);

var regionData

var icons = {
    "data": await d3.csv('/data/health-care-facility') ,
    "iconAtlas": await load('/data/icon-pack/png', ImageLoader),
    "iconMapping": await d3.json('/data/icon-pack/json'),
}

var selectedItems = {
    "feature": undefined,
    "icons": []
}

var choroplethColorMap = d3.scaleLinear()
    .domain([0, 1])
    .range(["white", dataSourceColorMap["state-data"]])
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
        regionData = await d3.json(`/data/deckgl-respiratory/${mapRegionSelector.value}?${parseInt(Math.random()*9999999999)}`) 
    }
    createChoropleth(regionData, mapDiseaseSelector.value, mapDataSourceSelector.value, mapTypeSwitch.value, mapIncludeImputations.checked)
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
                getFillColor: [ mapRegionSelector.value, dataVersion ],
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
        var disease = mapDiseaseSelector.value
        var dataSource = mapDataSourceSelector.value
        var imputations = mapIncludeImputations.checked
        var thisData = feature.properties.data[disease]

        var c

        if (mapTypeSwitch.value == "percentDifference") {
            var thisWeekDatum = parseFloat(thisData[dataSource].data.at(-1))
            var lastWeekDatum = parseFloat(thisData[dataSource].data.at(-2))
            c = d3.rgb(unknownColor)
            if (isNaN(thisWeekDatum) || lastWeekDatum) {
                c = d3.rgb(choroplethColorMap((thisWeekDatum - lastWeekDatum) / Math.abs(lastWeekDatum) * 100))
            } else if (thisWeekDatum == 0) {
                c = d3.rgb("white")
            } else {
                c = d3.rgb("#ffddff")
            }
        } else {
            var value
        
            if (imputations || !thisData.imputation) {
                if (mapTypeSwitch.value == "rate") {
                    value = thisData[dataSource].data.at(-1) / feature.properties.population * 1000
                } else {
                    value = thisData[dataSource].data.at(-1)
                }
            }
        
            c = d3.rgb(choroplethColorMap(value))
        }

        return [c.r, c.g, c.b]
    } else {
        return [82, 82, 91] //sl-gray-600
    }
}

function createChoropleth(data, disease, dataSource, mapType, imputations=true) {
    if (mapType == "percentDifference") {
        choroplethColorMap = d3.scaleLinear()
        .domain([-100, -50, -10, 0, 10, 50, 100, 500])
        .range(d3.reverse(d3.schemeRdYlGn[10]).slice(1))
        .unknown(unknownColor).nice()
    } else {
        var arr
        if (mapRegionSelector.value == "state") {
            var thisData = data.features[0].properties.data[disease]
            if (thisData[dataSource].data.length > 0 && (imputations || !thisData.imputation)) {
                if (mapType == "rate") {
                    arr =  thisData[dataSource].data / d.properties.population * 1000
                } else {
                    arr =  thisData[dataSource].data
                }
            } else {
                arr = [0]
            }
        } else {
            arr = data.features.map((d) => {
                var thisData = d.properties.data[disease]
        
                if (thisData[dataSource].data.length > 0 && (imputations || !thisData.imputation)) {
                    if (mapType == "rate") {
                        return thisData[dataSource].data.at(-1) / d.properties.population * 1000
                    } else {
                        return thisData[dataSource].data.at(-1)
                    }
                } else {
                    return 0
                }
            })
        }

        choroplethColorMap = d3.scaleLinear()
            .domain([0, d3.max(arr)])
            .range(["white", dataSourceColorMap[dataSource]])
            .unknown(unknownColor).nice()

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

        var colors = d3.reverse(d3.schemeRdYlGn[10]).slice(1)
        var labels = [-100, -50, -10, 0, 10, 50, 100, 500]
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
        var others = [["white", `No Hospitalizations`], 
        ["#ffddff", `New Hospitalizations from Last Period`],
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
        var legendWidth = Math.max(mapDiv.clientWidth/3, 300)
        var colorLegend = d3.select(choroplethLegendSVG)
            .attr("transform", null)
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
            .text(`Current Week's Hospitalizations by ${metadata.region_sizes[mapRegionSelector.value]}`)

    }
}


function drawStateHospitalizations() {
    var stateMargins = {
        "top": 1*em, 
        "bottom": 3.25*em,
        "left": 1.25*em,
        "right": 1*em,
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
            .attr("transform", `translate(${stateMargins.left},0)`)
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
            .attr("transform", `translate(${stateMargins.left},0)`)
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
        var allWeeks = d3.timeDay.range(startDate, d3.timeDay.offset(endDate, 7), 7)
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
                .attr("x", i < a.length-1 ? (stateXScale(a[i+1].__data__)-stateXScale(d))/2 : stateXScale.range()[1]-stateXScale(d))
                .html(d3.timeFormat("%b")(d))

            thisText.append("tspan")
                .style("text-anchor", "middle")
                .attr("dy", 12)
                .attr("x", i < a.length-1 ? (stateXScale(a[i+1].__data__)-stateXScale(d))/2 : stateXScale.range()[1]-stateXScale(d))
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
        "covid-19": "COVID-19",
        "influenza-1": "Influenza",
        "RSV": "RSV", 
        "respiratory-diseases": "COVID-19, Flu, RSV",
        "respiratory-diseases-2": "COVID-19, Flu, RSV"
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
        stateData = await d3.json(`/data/deckgl-respiratory/state-cdc?${parseInt(Math.random()*9999999999)}`) 
        stateData = Object.entries(stateData[mapDiseaseSelector.value]).map(d => {
            temp = {"Date": d[0], "count": d[1]}
            if (mapTypeSwitch.value == "rate") {
                temp["count"] /= (scPopulation / 1000)
            }
            return temp
        })
        subtitleDOM.innerHTML = `Data from ${d3.timeFormat("%b %d, %Y")(parseDate(d3.min(stateData, d => d.Date)))} to ${d3.timeFormat("%b %d, %Y")(parseDate(d3.max(stateData, d => d.Date)))}`
    } catch (error) {
        stateData = [{"Date": "2020-01-01", "count": 1}]
        subtitleDOM.innerHTML = "N/A"
    }
    
    var maxVal = d3.max(stateData.map(d => d.count)) || 1

    var temp = svg.append("text").text(d3.format(".2r")(maxVal)).attr("x", 0).attr("y", 0)
    stateMargins.left += Math.max(20, temp.node().getBBox().width)

    var stateXScale = d3.scaleTime()
                .domain([startDate, d3.timeDay.offset(endDate, 7)]).range([stateMargins.left, stateWidth - stateMargins.right])    

    var stateYScale = d3.scaleLinear()
        .domain([0, maxVal])
        .nice()
        .range([stateHeight-stateMargins.bottom, stateMargins.top])

    svg.append("g")
        .selectAll("rect")
        .data(stateData)
        .enter()
        .append("rect")
        .attr("x", (d) => stateXScale(parseDate(d["Date"])))
        .attr("y", d => stateYScale(d["count"]))
        .attr("height", d => stateYScale(0) - stateYScale(d["count"]))
        .attr("width", (stateWidth - (stateMargins.left + stateMargins.right)) / stateData.length)
        .attr("stroke", "var(--sl-color-neutral-1000)")
        .attr("stroke-width", 1)
        .attr("fill", d => dayjs(parseDate(d["Date"])).isAfter(currentWeek) ? "var(--sl-color-neutral-600)" : "var(--sl-color-neutral-100)")

    yAxisDisplayFunc(svg, stateYScale, stateWidth, stateHeight, stateMargins, diseaseDisplayNames)
    xAxisDisplayFunc(svg, stateXScale, stateWidth, stateHeight, stateMargins, diseaseDisplayNames)
    
    temp.remove()
}

function updateMapTitle() {
    if (!mapOptionsTitleToggle.checked) {
        mapTitle.innerHTML = ""
        return
    }
    var titleStart = `${d3.select(mapTypeSwitch).select(`*[value=${mapTypeSwitch.value}]`).html()} `
    titleStart += `of ${d3.select(mapDiseaseSelector).select(`*[value=${mapDiseaseSelector.value}]`).html()} `
    titleStart += "Hospitalizations "

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