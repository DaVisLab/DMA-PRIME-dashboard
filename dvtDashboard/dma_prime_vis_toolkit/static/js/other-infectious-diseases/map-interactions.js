import { styleSheet, selectedItems, zctaData, map, deckOverlay, popup, redraw, drawTooltip, drawAggregation, drawLegend, updateDiseaseCountDisplay, getData, changeDataColumn } from "/static/js/other-infectious-diseases/map.js"

mapResetButton.addEventListener("click", () => {
    // reset map zoom and center
    map.flyTo({
        center: [-81, 33.65],
        zoom: 7,
        essential: true // this animation is considered essential with respect to prefers-reduced-motion
    })

    selectedItems.zcta = undefined
    selectedItems.diseases = []

    d3.selectAll(".disease-checkbox").attr("checked", null)
    mapAllDiseaseSelector.removeAttribute("checked")

    drawTooltip(selectedItems.zcta)
    drawAggregation()
    drawLegend()
    redraw()
})

mapRateSwitch.addEventListener("sl-change", function() {
    drawTooltip(selectedItems.zcta)
    drawAggregation()
    drawLegend()
    updateDiseaseCountDisplay()
    redraw()
})

mapTimeSwitch.addEventListener("sl-change", async () => {
    drawTooltip(selectedItems.zcta)
    drawLegend()
    updateDiseaseCountDisplay()
    redraw()
})

mapColumnSwitch.addEventListener("sl-change", async () => {
    await changeDataColumn()
    updateDiseaseCountDisplay()
})

mapAllDiseaseSelector.addEventListener("sl-change", function(e) {
    selectedItems.dataVersion++
    if (e.target.checked) {
        d3.selectAll(".disease-checkbox").attr("checked", "")
        selectedItems.diseases = d3.selectAll(".disease-checkbox").nodes().map(d => d.getAttribute("disease")) 
    } else {
        if (selectedItems.diseases.length == d3.selectAll(".disease-checkbox[checked]").nodes().length) {
            d3.selectAll(".disease-checkbox").attr("checked", null)
            selectedItems.diseases = []
        }
    }

    drawTooltip(selectedItems.zcta)
    drawAggregation()
    drawLegend()
    redraw()
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

    selectedItems.dataVersion++
    drawTooltip(selectedItems.zcta)
    drawAggregation()
    drawLegend()
    redraw()
})

popup.on("close", e => {
    selectedItems.zcta = undefined
    redraw()
})

map.on("click", e => {
    var temp = {x: e.point.x, y: e.point.y}
    var thisObject = deckOverlay.pickObject(temp)

    if (thisObject == null) {
        popup.remove()
        selectedItems.zcta = undefined
        redraw()
        return
    }

    // add popup to map
    var feature = thisObject.object
    selectedItems.zcta = feature
    
    var coordinates = [feature.properties.INTPTLON, feature.properties.INTPTLAT]
    popup.setLngLat(coordinates)
        .setHTML("<div id='map-tooltip-div' class='tooltip-div'></div>")

    if (!popup.isOpen()) {
        popup.addTo(map)
    }

    popup.setMaxWidth(`${mapDiv.clientWidth}px`)
    drawTooltip(feature)
    redraw()
})

aggregatedDiseaseHistoryResizer.addEventListener("sl-resize", function() {
    drawTooltip(selectedItems.zcta)
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