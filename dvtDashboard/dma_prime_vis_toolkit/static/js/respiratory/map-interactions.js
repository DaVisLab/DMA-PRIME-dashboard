import { getBoundsOfCoords, drawTooltip } from "/static/js/respiratory/script.js";
import { map, popup, deckOverlay, selectedItems, redraw, drawStateHospitalizations, drawLargeStateHospitalizations, updateMapTitle } from "/static/js/respiratory/map.js"


popup.on("close", e => {
    selectedItems.feature = undefined
    dataVersion++
    redraw()
})

map.on('zoom', _ => {if (mapRegionSelector.value == "zcta") { redraw() }})

map.on("click", e => {
    var temp = {x: e.point.x, y: e.point.y}
    var dataObject = deckOverlay.pickObject(temp).object

    var width = mapDiv.clientWidth
    var mapTooltipWidth = Math.max(500, width * .3)
    var mapTooltipHeight = mapTooltipWidth * .65

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
    const bounds = getBoundsOfCoords(fullCoords)

    map.fitBounds(bounds, {
        padding: Math.min(mapDiv.clientWidth/3, mapDiv.clientHeight/3),
        maxZoom: 12,
        screenSpeed: .7,
        offset: [0, -mapTooltipHeight/3]
    });

    var coordinates = [dataObject.properties.INTPTLON, dataObject.properties.INTPTLAT]
    if (!(coordinates[0] && coordinates[1])) {
        coordinates = bounds.getCenter()
    }
    popup.setLngLat(coordinates)
        .setHTML(`<div id='map-tooltip-div' class='tooltip-div'>
            <div class="tooltip-header">
                <div class="tooltip-region-info"></div>
                <div class="tooltip-data-info"></div>
            </div>
            <svg id="map-tooltip-svg" class="tooltip-outer-svg"></svg>
            <div class="tooltip-footer">
                <div class="tooltip-options"></div>
            </div>
            </div>`)

    if (!popup.isOpen()) {
        popup.addTo(map)
    }
    popup.setMaxWidth(`${mapDiv.clientWidth}px`)

    var expandPopupButton = d3.select("div.maplibregl-popup-content").append("sl-icon-button")
        .attr("name", "zoom-in")
        .style("font-size", "9px")
        .style("cursor", "pointer")
        .style("position", "absolute")
        .style("right", "18px")
        .style("top", 0)

    expandPopupButton.node().updateComplete.then(() => {
        d3.select(expandPopupButton.node().shadowRoot).select("button").node().style.padding = "4px"
    })

    expandPopupButton.on("click", () => {
        var ttpDiv = d3.select("#map-tooltip-div")
            .style("display", "initial")
            .style("border-style", "none")

        var tooltipData = dataObject.properties.data[mapDiseaseSelector.value]
        tooltipData["id"] = dataObject.properties.id
        if (mapRegionSelector.value == "zcta") {
            tooltipData["county"] = dataObject.properties.county
        }
        tooltipData["population"] = dataObject.properties.population

        var largeTtp = d3.select(mapTooltipLarge)
        mapTooltipLarge.show().then(() => {
            drawTooltip(tooltipData, largeTtp.select(".tooltip-outer-svg"), largeTtp.select(".tooltip-header"), largeTtp.select(".tooltip-footer"), mapTypeSwitch.value == "rate", false, [])
        })
    })

    var ttpDiv = d3.select("#map-tooltip-div")
        .style("display", "initial")
        .style("border-style", "none")

    var tooltipData = dataObject.properties.data[mapDiseaseSelector.value]
    tooltipData["id"] = dataObject.properties.id
    if (mapRegionSelector.value == "zcta") {
        tooltipData["county"] = dataObject.properties.county
    }
    tooltipData["population"] = dataObject.properties.population

    var ttpSVG = ttpDiv.select(".tooltip-outer-svg")
        .attr("width", mapTooltipWidth)
        .attr("height", mapTooltipHeight)

    drawTooltip(tooltipData, ttpSVG, ttpDiv.select(".tooltip-header"), ttpDiv.select(".tooltip-footer"), mapTypeSwitch.value == "rate", false, [])
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

mapTypeSwitch.addEventListener("sl-change", (event) => {
    // update legend title
    if (mapTypeSwitch.value == "rate"){
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
        var ttpSVG = ttpDiv.select(".tooltip-outer-svg")
            .attr("width", mapTooltipWidth)
            .attr("height", mapTooltipHeight)

        drawTooltip(tooltipData, ttpSVG, ttpDiv.select(".tooltip-header"), ttpDiv.select(".tooltip-footer"), mapTypeSwitch.value == "rate", false, [])
        
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
    dataVersion++
    redraw(true)
    selectedItems.feature = undefined
    popup.remove()
})

mapIncludeImputations.addEventListener("sl-change", () => {
    dataVersion++
    redraw()
})

mapOptionsTitleToggle.addEventListener("sl-change", () => {
    updateMapTitle()
})

// adding/removing labels
mapOptionsGeographicLabelsToggle.addEventListener("sl-change", () => {
    // toggle geographic unit labels
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