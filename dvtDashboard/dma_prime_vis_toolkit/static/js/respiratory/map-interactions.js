import { startDate, currentWeek, drawTooltip, parseHospDate } from "/static/js/respiratory/script.js";
import { map, popup, deckOverlay, selectedItems, redraw, drawStateHospitalizations } from "/static/js/respiratory/map.js"


popup.on("close", e => {
    selectedItems.zcta = undefined
    dataVersion++
    redraw()
})

map.on("click", e => {
    var temp = {x: e.point.x, y: e.point.y}
    var dataObject = deckOverlay.pickObject(temp).object

    if (dataObject == null) {
        selectedItems.zcta = undefined
        popup.remove()
        return
    }
    if (selectedItems.zcta && selectedItems.zcta.properties.ZCTA == dataObject.properties.ZCTA) {
        selectedItems.zcta = undefined
        popup.remove()
        map.flyTo({
            center: [-81, 33.65],
            zoom: 7,
            essential: true 
        })
        return
    }

    selectedItems.zcta = dataObject
    
    const fullCoords = dataObject.geometry.coordinates;
    const bounds = new maplibregl.LngLatBounds()
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
    addCoordToBounds(bounds, fullCoords)

    map.fitBounds(bounds, {
        padding: Math.min(mapDiv.clientWidth/3, mapDiv.clientHeight/3),
        maxZoom: 12,
        screenSpeed: .7
    });

    var coordinates = [dataObject.properties.INTPTLON, dataObject.properties.INTPTLAT]
    popup.setLngLat(coordinates)
        .setHTML("<div id='map-tooltip-div' class='tooltip-div'></div>")

    if (!popup.isOpen()) {
        popup.addTo(map)
    }
    popup.setMaxWidth(`${mapDiv.clientWidth}px`)

    var ttpDiv = d3.select("#map-tooltip-div")

    ttpDiv.style("display", "initial")
    ttpDiv.style("border-style", "none")
        
    var ttpTitle = ttpDiv.append("p")
        .attr("class", "tooltip-title")
    ttpTitle.append("span")
        .attr("class", "tooltip-title")
    ttpTitle.append("br")
    ttpTitle.append("span")
        .attr("class", "tooltip-subtitle")

    ttpDiv.append("svg")
        .attr("id", `map-tooltip-svg`)
        .attr("class", `tooltip-outer-svg`)

    var tooltipData = dataObject.properties.data[mapDiseaseSelector.value]
    tooltipData["zcta"] = dataObject.properties.ZCTA
    tooltipData["county"] = dataObject.properties.county
    tooltipData["population"] = dataObject.properties.population

    var width = mapDiv.clientWidth
    var mapTooltipWidth = Math.max(500, width * .3)
    var mapTooltipHeight = mapTooltipWidth * .65
    drawTooltip(tooltipData, ttpDiv, mapTooltipHeight, mapTooltipWidth, mapRateSwitch.value == "rate")
    dataVersion++
    redraw()
})


mapResetButton.addEventListener("click", () => {
    // reset map zoom and center
    map.flyTo({
        center: [-81, 33.65],
        zoom: 7,
        essential: true // this animation is considered essential with respect to prefers-reduced-motion
    })

    selectedItems.zcta = undefined
    popup.remove()
    dataVersion++
    redraw()
})

mapRateSwitch.addEventListener("sl-change", (event) => {
    // update legend title
    if (mapRateSwitch.value == "rate"){
        d3.select("#map-legend-title")
            .text("Current Week's Hospitalization Rates by ZCTA")
    } else {
        d3.select("#map-legend-title")
            .text("Current Week's Hospitalizations by ZCTA")
    }

    // update tooltip
    if (selectedItems.zcta) {
        var ttpDiv = d3.select("#map-tooltip-div")

        var tooltipData = selectedItems.zcta.properties.data[mapDiseaseSelector.value]
        tooltipData["zcta"] = selectedItems.zcta.properties.ZCTA
        tooltipData["county"] = selectedItems.zcta.properties.county
        tooltipData["population"] = selectedItems.zcta.properties.population

        var width = mapDiv.clientWidth
        var mapTooltipWidth = Math.max(500, width * .3)
        var mapTooltipHeight = mapTooltipWidth * .65
        drawTooltip(tooltipData, ttpDiv, mapTooltipHeight, mapTooltipWidth, mapRateSwitch.value == "rate")
    }
    dataVersion++
    redraw()

})

mapDataSourceSelector.addEventListener("sl-change", (event) => {
    dataVersion++
    redraw()
})

mapDiseaseSelector.addEventListener("sl-change", (event) => {
    drawStateHospitalizations()
    dataVersion++
    redraw()

    if (selectedItems.zcta) {
        var ttpDiv = d3.select("#map-tooltip-div")

        var tooltipData = selectedItems.zcta.properties.data[mapDiseaseSelector.value]
        tooltipData["zcta"] = selectedItems.zcta.properties.ZCTA
        tooltipData["county"] = selectedItems.zcta.properties.county
        tooltipData["population"] = selectedItems.zcta.properties.population

        var width = mapDiv.clientWidth
        var mapTooltipWidth = Math.max(500, width * .3)
        var mapTooltipHeight = mapTooltipWidth * .65
        drawTooltip(tooltipData, ttpDiv, mapTooltipHeight, mapTooltipWidth, mapRateSwitch.value == "rate")
    }
})

mapIncludeImputations.addEventListener("sl-change", () => {
    dataVersion++
    redraw()
})


// adding/removing icons
hospitalIconsToggle.addEventListener("sl-change", () => {
    // toggle hospital icons
    selectedItems.icons = selectedItems.icons.filter(check => check !== "hospital")
    if (hospitalIconsToggle.checked) {
            selectedItems.icons.push("hospital")
    }
    dataVersion++
    redraw()
})
mobileClinicIconsToggle.addEventListener("sl-change", () => {
    // toggle mhc icons
    selectedItems.icons = selectedItems.icons.filter(check => check !== "mobile_health_clinic")
    if (mobileClinicIconsToggle.checked) {
        selectedItems.icons.push("mobile_health_clinic")
    }
    dataVersion++
    redraw()
})
communityPartnerIconsToggle.addEventListener("sl-change", () => {
    // toggle community partner icons
    selectedItems.icons = selectedItems.icons.filter(check => check !== "community_partner")
    if (communityPartnerIconsToggle.checked) {
        selectedItems.icons.push("community_partner")
    }
    dataVersion++
    redraw()
})


mapStateHospitalizationsResizer.addEventListener("sl-resize", () => {
    drawStateHospitalizations()
})

mapStateHospitalizationsSvg.addEventListener("click", () => {
    mapStateHospitalizationsLarge.show()
})

mapStateHospitalizationsLargeResizer.addEventListener("sl-resize", () => {
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
    
    mapStateHospitalizationsLargeSvg.innerHTML = ""
    var stateHeight = mapStateHospitalizationsLargeSvg.clientHeight
    var stateWidth = mapStateHospitalizationsLargeSvg.clientWidth
    
    var svg = d3.select(mapStateHospitalizationsLargeSvg)

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
            "top": .5*em, 
            "bottom": 3.5*em,
            "left": Math.max(20, temp.node().getBBox().width) + 1.75*em,
            "right": 2*em,
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
            .attr("id", "map-state-hospitalizations-large-yaxis-title")
            .attr("transform", `translate(${1*em},${d3.mean(stateYScale.range())})rotate(-90)`)
            .attr("text-anchor", "middle")
            .attr("fill", "var(--sl-color-neutral-1000)")
            .attr("font-size", "var(--sl-font-size-small)")
            .text(disease_display_names[mapDiseaseSelector.value])
            
        var svgYAxis = yAxis.append("g")
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

        var svgMajorXAxis = xAxis.append("g")
            .attr("id", "map-state-hospitalizations-large-major-xaxis")
            .call(d3.axisBottom(stateXScale)
                .tickValues(d3.timeMonth.every(1).range(stateXScale.domain()[0], stateXScale.domain()[1]).map(d => d3.timeSaturday.ceil(d)))
                .tickFormat(d3.timeFormat("")))
                // .tickFormat(d3.timeFormat("%b %Y")))
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
            .call(d3.axisBottom(stateXScale).tickArguments([d3.timeSaturday.every(1), d3.timeFormat("")]))
            .attr("transform", `translate(0, ${stateHeight - stateMargins.bottom})`)

        temp.remove()
    })
})