import { regionData, drawTooltip } from "/static/js/respiratory/script.js";
import { map, popup, deckOverlay, selectedItems, redraw, drawStateHospitalizations, drawLargeStateHospitalizations } from "/static/js/respiratory/map.js"


popup.on("close", e => {
    selectedItems.feature = undefined
    dataVersion++
    redraw()
})

map.on("click", e => {
    var temp = {x: e.point.x, y: e.point.y}
    var dataObject = deckOverlay.pickObject(temp).object

    if (dataObject == null) {
        selectedItems.feature = undefined
        popup.remove()
        return
    }
    if (selectedItems.feature && selectedItems.feature.properties.id == dataObject.properties.id) {
        selectedItems.feature = undefined
        popup.remove()
        map.flyTo({
            center: [-81, 33.65],
            zoom: 7,
            essential: true 
        })
        return
    }

    selectedItems.feature = dataObject
    
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
    if (!(coordinates[0] || coordinates[1])) {
        coordinates = bounds.getCenter()
    }
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
    ttpTitle.append("br")
    ttpTitle.append("span")
        .attr("class", "tooltip-subtitle-2")

    ttpDiv.append("svg")
        .attr("id", `map-tooltip-svg`)
        .attr("class", `tooltip-outer-svg`)

    var tooltipData = dataObject.properties.data[mapDiseaseSelector.value]
    tooltipData["id"] = dataObject.properties.id
    if (mapRegionSelector.value == "zcta") {
        tooltipData["county"] = dataObject.properties.county
    }
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

    selectedItems.feature = undefined
    popup.remove()
    dataVersion++
    redraw()
})

mapRateSwitch.addEventListener("sl-change", (event) => {
    // update legend title
    if (mapRateSwitch.value == "rate"){
        d3.select("#map-legend-title")
            .text(`Current Week's Hospitalization Rates by ${metadata.region_sizes[mapRegionSelector.value]}`)
    } else {
        d3.select("#map-legend-title")
            .text(`Current Week's Hospitalizations by ${metadata.region_sizes[mapRegionSelector.value]}`)
    }

    // update tooltip
    drawStateHospitalizations()
    if (selectedItems.feature) {
        var ttpDiv = d3.select("#map-tooltip-div")

        var tooltipData = selectedItems.feature.properties.data[mapDiseaseSelector.value]
        tooltipData["id"] = selectedItems.feature.properties.id
        if (mapRegionSelector.value == "zcta") {
            tooltipData["county"] = selectedItems.feature.properties.county
        }
        tooltipData["population"] = selectedItems.feature.properties.population

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
    selectedItems.feature = undefined
    popup.remove()
    dataVersion++
    redraw()
})

mapRegionSelector.addEventListener("sl-change", (event) => {
    d3.json(`/data/deckgl-respiratory/${mapRegionSelector.value}?${parseInt(Math.random()*9999999999)}`).then((data) => {
        regionData.features = data.features
    }).then(() => {
        dataVersion++
        redraw()
    })
    selectedItems.feature = undefined
    popup.remove()
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
    drawLargeStateHospitalizations()
})