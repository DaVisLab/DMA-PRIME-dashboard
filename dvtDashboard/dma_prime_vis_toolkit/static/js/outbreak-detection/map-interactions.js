import { styleSheet, selectedItems, map, deckOverlay, popup, redraw, drawTooltip, drawAggregation, drawLargeAggregation, changeDataColumn, update } from "/static/js/outbreak-detection/map.js"

mapResetButton.addEventListener("click", () => {
    // reset map zoom and center
    map.flyTo({
        center: [-81, 33.65],
        zoom: 7,
        essential: true // this animation is considered essential with respect to prefers-reduced-motion
    })

    selectedItems.region = undefined
    selectedItems.diseases = []

    d3.selectAll(".disease-checkbox").attr("checked", null)
    mapAllDiseaseSelector.removeAttribute("checked")

    update()
})

mapRateSwitch.addEventListener("sl-change", () => {
    update()
    mapWeeklyTooltip.content = `${d3.selectAll(`sl-radio-button[value=${mapRateSwitch.value}]`).html()} for the week`
    mapMonthlyTooltip.content = `${d3.selectAll(`sl-radio-button[value=${mapRateSwitch.value}]`).html()} for the past 4 weeks`
    mapYearlyTooltip.content = `${d3.selectAll(`sl-radio-button[value=${mapRateSwitch.value}]`).html()} for the past 52 weeks`
})

mapTimeSwitch.addEventListener("sl-change", update)

mapRegionSelector.addEventListener("sl-change", changeDataColumn)

mapOutcomeVariableSelector.addEventListener("sl-change", changeDataColumn)

// adding/removing labels
mapOptionsGeographicLabelsToggle.addEventListener("sl-change", () => {
    // toggle geographic unit labels
    selectedItems.dataVersion++
    redraw()
})

// adding/removing icons
hospitalIconsToggle.addEventListener("sl-change", () => {
    // toggle hospital icons
    selectedItems.icons = selectedItems.icons.filter(check => check !== "hospital")
    if (hospitalIconsToggle.checked) {
            selectedItems.icons.push("hospital")
    }
    selectedItems.dataVersion++
    redraw()
})
mobileClinicIconsToggle.addEventListener("sl-change", () => {
    // toggle mhc icons
    selectedItems.icons = selectedItems.icons.filter(check => check !== "mobile_health_clinic")
    if (mobileClinicIconsToggle.checked) {
        selectedItems.icons.push("mobile_health_clinic")
    }
    selectedItems.dataVersion++
    redraw()
})
communityPartnerIconsToggle.addEventListener("sl-change", () => {
    // toggle community partner icons
    selectedItems.icons = selectedItems.icons.filter(check => check !== "community_partner")
    if (communityPartnerIconsToggle.checked) {
        selectedItems.icons.push("community_partner")
    }
    selectedItems.dataVersion++
    redraw()
})


mapAllDiseaseSelector.addEventListener("sl-change", function(e) {
    if (e.target.checked) {
        d3.selectAll(".disease-checkbox").attr("checked", "")
        selectedItems.diseases = d3.selectAll(".disease-checkbox").nodes().map(d => d.getAttribute("disease")) 
    } else {
        if (selectedItems.diseases.length == d3.selectAll(".disease-checkbox[checked]").nodes().length) {
            d3.selectAll(".disease-checkbox").attr("checked", null)
            selectedItems.diseases = []
        }
    }

    update()
})

d3.selectAll(".disease-checkbox").on("sl-change", function(e) {
    var disease = this.getAttribute("disease")
    var index = selectedItems.diseases.indexOf(disease)
    if (e.target.checked) {
        // add disease if not on list
        if (index == -1) {
            selectedItems.diseases.push(disease)
        }
    } else {
        // remove disease if on list
        if (index > -1) {
            selectedItems.diseases.splice(index, 1)
        }
        mapAllDiseaseSelector.removeAttribute("checked")
    }

    update()
})

popup.on("close", e => {
    selectedItems.region = undefined
    redraw()
})

map.on("click", e => {
    var temp = {x: e.point.x, y: e.point.y}
    var thisObject = deckOverlay.pickObject(temp)

    if (thisObject == null) {
        popup.remove()
        selectedItems.region = undefined
        redraw()
        return
    }

    // add popup to map
    var feature = thisObject.object

    // --- ADDED LOGIC: close tooltip and zoom out if same region is clicked ---
    if (selectedItems.region && selectedItems.region.properties.identifier === feature.properties.identifier) {
        selectedItems.region = undefined;
        popup.remove();
        map.flyTo({
            center: [-81, 33.65],
            zoom: 7,
            essential: true
        });
        redraw();
        return;
    }
    // --- END ADDED LOGIC ---

    selectedItems.region = feature
    
    var width = mapDiv.clientWidth
    var mapTooltipWidth = Math.max(500, width * .3)
    var mapTooltipHeight = mapTooltipWidth * .65

    const fullCoords = feature.geometry.coordinates;
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
        screenSpeed: .7,
        offset: [0, -mapTooltipHeight/3]
    });

    var coordinates = [feature.properties.INTPTLON, feature.properties.INTPTLAT]
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

    var ttpDiv = d3.select("#map-tooltip-div")
        .style("display", "initial")
        .style("border-style", "none")

    var ttpSVG = ttpDiv.select(".tooltip-outer-svg")
        .attr("width", mapTooltipWidth)
        .attr("height", mapTooltipHeight)

    drawTooltip(feature)
    redraw()
})

aggregatedDiseaseHistoryResizer.addEventListener("sl-resize", function() {
    drawTooltip(selectedItems.region)
    drawAggregation()
})

window.addEventListener("keydown", (event) => {
    if (event.key == "m") {
        function waitForChange() {
            if(changed != true) {
                window.setTimeout(waitForChange, 10);
            } else {
                styleSheet.deleteRule(0)
                styleSheet.insertRule(`
                    .maplibregl-popup-content {
                        /* tooltip's containing div */
                        background-color: hsla(${getComputedStyle(document.head).getPropertyValue("--sl-color-neutral-0").replace("hsl(", "").replace(")", "")}, 0.925);
                    }`
                    ,0)
                changed = false
            }
        }
        waitForChange()
    }
});

aggregatedDiseaseHistory.addEventListener("click", () => {
    aggregatedDiseaseHistoryLarge.show()
})

aggregatedDiseaseHistoryResizerLarge.addEventListener("sl-resize", () => {
    drawLargeAggregation()
})