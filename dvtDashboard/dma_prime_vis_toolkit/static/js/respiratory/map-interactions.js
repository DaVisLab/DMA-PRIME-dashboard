import { getBoundsOfCoords, drawTooltip, drawStateHospitalizations, drawLargeStateHospitalizations } from "/static/js/respiratory/script.js";
import { map, popup, deckOverlay, selectedItems, redraw, updateMapTooltip,
    updateMapOutcomeVariableOptions, updateMapPopulationOptions, updateMapGeographicUnitOptions
} from "/static/js/respiratory/map.js"


popup.on("close", e => {
    selectedItems.feature = undefined
    dataVersion++
    redraw(false, false, true)
})

map.on('zoom', _ => {if (mapGeographicUnitSelector.value == "zcta") { redraw() }})

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
                <div class="tooltip-legend"></div>
                <div class="tooltip-options"></div>
            </div>
            </div>`)

    if (!popup.isOpen()) {
        popup.addTo(map)
    }
    popup.setMaxWidth(`${mapDiv.clientWidth}px`)

    var ttpDiv = d3.select("#map-tooltip-div")
        .style("display", "initial")
        .style("border-style", "none")

    var ttpSVG = ttpDiv.select(".tooltip-outer-svg")
        .attr("width", mapTooltipWidth)
        .attr("height", mapTooltipHeight)

    drawTooltip(dataObject.properties,
        ttpSVG, ttpDiv.select(".tooltip-header"), ttpDiv.select(".tooltip-footer"), 
        mapPopulationSelector.value, mapOutcomeVariableSelector.value,
        mapTypeSwitch.value, false, false, [])

    // Add expand icon button to map tooltip
    var popupContent = d3.select("div.maplibregl-popup-content")
    if (popupContent.select(".expand-icon-button").empty()) {
        popupContent.append("sl-icon-button")
            .attr("class", "expand-icon-button")
            .attr("name", "zoom-in")
            .style("position", "absolute")
            .style("right", "18px")
            .style("top", "0px")
            .style("color", "black")
            .style("cursor", "pointer")
            .on("click", () => {
                d3.select(modelExplorationButtonTooltipLarge).on("click", () => {
                    window.open(`/respiratory-model-exploration?disease=${mapDiseaseSelector.value}&geographic-unit=${mapGeographicUnitSelector.value}&population=${mapPopulationSelector.value}&outcome-variable=${mapOutcomeVariableSelector.value}&location=${dataObject.properties.id}`)
                })
                var largeTtp = d3.select(tooltipLarge)
                tooltipLarge.show().then(async () => {
                    var allExtendedData = await d3.json(`/data/respiratory/${mapGeographicUnitSelector.value}/${mapDiseaseSelector.value}/extended?data_version=${metadata.data_version}&${parseInt(Math.random() * 9999999999)}`)
                    var ttpData = {
                        "id": dataObject.properties.id,
                        "display_name": dataObject.properties.display_name,
                        "county": dataObject.properties.county,
                        "data": allExtendedData[dataObject.properties.id],
                        "facility_type": dataObject.properties.facility_type,
                        "system": dataObject.properties.system,
                    }
                    drawTooltip(ttpData,
                        largeTtp.select(".tooltip-outer-svg"), largeTtp.select(".tooltip-header"), largeTtp.select(".tooltip-footer"),
                        mapPopulationSelector.value, mapOutcomeVariableSelector.value,
                        mapTypeSwitch.value, false, true, [])
                })
            })
    }
    if (popupContent.select(".model-exploration-icon-button").empty()) {
        popupContent.append("sl-icon-button")
            .attr("class", "model-exploration-icon-button")
            .attr("name", "info-circle")
            .style("position", "absolute")
            .style("right", "40px")
            .style("top", "0px")
            .style("color", "black")
            .style("cursor", "pointer")
            .on("click", () => {
                window.open(`/respiratory-model-exploration?disease=${mapDiseaseSelector.value}&geographic-unit=${mapGeographicUnitSelector.value}&population=${mapPopulationSelector.value}&outcome-variable=${mapOutcomeVariableSelector.value}&location=${dataObject.properties.id}`)
            })
    }
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
    if (popup.isOpen()) {
        popup.remove()        
    } 
    dataVersion++
    redraw()
})

mapTypeSwitch.addEventListener("sl-change", (event) => {
    var dataVarString = d3.select(mapOutcomeVariableSelector).select(`*[value=${mapOutcomeVariableSelector.value}]`).html()
    // update legend title
    if (mapTypeSwitch.value == "rate"){
        d3.select("#map-legend-title")
            .text(`Current Week's ${dataVarString} Rates by ${metadata.region_sizes[mapGeographicUnitSelector.value]}`)
    } else {
        d3.select("#map-legend-title")
            .text(`Current Week's ${dataVarString} by ${metadata.region_sizes[mapGeographicUnitSelector.value]}`)
    }

    drawStateHospitalizations(mapDiseaseSelector.value, mapTypeSwitch.value, mapStateHospitalizationsSvg, mapStateHospitalizationsSubtitle)

    // update tooltip
    if (selectedItems.feature) {
        updateMapTooltip(selectedItems.feature.properties)
    }
    dataVersion++
    redraw()
})

mapDiseaseSelector.addEventListener("sl-change", async(event) => {
    await updateMapGeographicUnitOptions()
    drawStateHospitalizations(mapDiseaseSelector.value, mapTypeSwitch.value, mapStateHospitalizationsSvg, mapStateHospitalizationsSubtitle)
    selectedItems.feature = undefined
    
    if (popup.isOpen()) {
        popup.remove()        
    } 
    dataVersion++
    redraw(true, true)
})

mapGeographicUnitSelector.addEventListener("sl-change", async(event) => {
    await updateMapPopulationOptions()
    mapGeographicUnit = mapGeographicUnitSelector.value

    selectedItems.feature = undefined
    if (popup.isOpen()) {
        popup.remove()        
    }

    if (mapGeographicUnitSelector.value == "facility") {
        mapOptionsGeographicLabelsToggle.checked = true
        hospitalIconsToggle.checked = false
        selectedItems.icons = selectedItems.icons.filter(check => check !== "hospital")
        d3.select(hospitalIconsToggle).attr("disabled", "")
    } else {
        d3.select(hospitalIconsToggle).attr("disabled", null)
    }
    dataVersion++
    redraw(true, true)
})

mapPopulationSelector.addEventListener("sl-change", async (event) => {
    await updateMapOutcomeVariableOptions()
    mapPopulation = mapPopulationSelector.value

    if (selectedItems.feature) {
        updateMapTooltip(selectedItems.feature.properties)
    }
    dataVersion++
    redraw(true)    
})

mapOutcomeVariableSelector.addEventListener("sl-change", (event) => {
    mapOutcomeVariable = mapOutcomeVariableSelector.value
    
    var dataVarString = d3.select(mapOutcomeVariableSelector).select(`*[value=${mapOutcomeVariableSelector.value}]`).html()
    // update legend title
    if (mapTypeSwitch.value == "rate"){
        d3.select("#map-legend-title")
            .text(`Current Week's ${dataVarString} Rates by ${metadata.region_sizes[mapGeographicUnitSelector.value]}`)
    } else {
        d3.select("#map-legend-title")
            .text(`Current Week's ${dataVarString} by ${metadata.region_sizes[mapGeographicUnitSelector.value]}`)
    }

    // update tooltip
    if (selectedItems.feature) {
        updateMapTooltip(selectedItems.feature.properties)
    }
    dataVersion++
    redraw(true)

})

mapIncludeImputations.addEventListener("sl-change", () => {
    dataVersion++
    redraw()
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
    drawStateHospitalizations(mapDiseaseSelector.value, mapTypeSwitch.value, mapStateHospitalizationsSvg, mapStateHospitalizationsSubtitle)
})

mapStateHospitalizationsSvg.addEventListener("click", () => {
    mapStateHospitalizationsLarge.show()
})

mapStateHospitalizationsLargeResizer.addEventListener("sl-resize", () => {
    drawLargeStateHospitalizations(mapDiseaseSelector.value, mapTypeSwitch.value, mapStateHospitalizationsLargeSvg, mapStateHospitalizationsLargeSubtitle)
})