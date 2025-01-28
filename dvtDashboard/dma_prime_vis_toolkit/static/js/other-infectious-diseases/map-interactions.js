import { styleSheet, selectedItems, zctaData, map, deckOverlay, popup, redraw, drawTooltip, drawAggregation, drawLegend, getData } from "/static/js/other-infectious-diseases/map.js"

mapResetButton.addEventListener("click", () => {
    // reset map zoom and center
    map.flyTo({
        center: [-81, 33.65],
        zoom: 7,
        essential: true // this animation is considered essential with respect to prefers-reduced-motion
    })
})

map.on("click", e => {
    var temp = {x: e.point.x, y: e.point.y}
    var thisObject = deckOverlay.pickObject(temp)

    if (thisObject == null) {
        popup.remove()
        selectedItems.zcta = undefined
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

mapRateSwitch.addEventListener("sl-change", function() {
    drawTooltip(selectedItems.zcta)
    drawAggregation()
    drawLegend()
    redraw()
})

mapAllDiseaseSelector.addEventListener("sl-change", function() {
    selectedItems.dataVersion++

    if (d3.select(".disease-checkbox").attr("disabled") != null) {
        d3.selectAll(".disease-checkbox").attr("disabled", null)
    } else {
        d3.selectAll(".disease-checkbox").attr("disabled", "")
    }
    
    drawTooltip(selectedItems.zcta)
    drawAggregation()
    drawLegend()
    redraw()
})

d3.selectAll(".disease-checkbox").on("sl-change", function(d) {
    var disease = this.getAttribute("disease")
    var index = selectedItems.diseases.indexOf(disease)
        if (index > -1) { // remove disease if on list
        selectedItems.diseases.splice(index, 1)
    } else { // add disease if not on list aka toggle disease
        selectedItems.diseases.push(disease)
    }
    selectedItems.dataVersion++
    drawTooltip(selectedItems.zcta)
    drawAggregation()
    drawLegend()
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