import { selectedItems, zctaData, map, deckOverlay, popup, redraw, drawTooltip, drawAggregation } from "/static/js/state-disease-data/map.js"

mapResetButton.addEventListener("click", () => {
    // reset map zoom and center
    map.flyTo({
        center: [-81, 33.65],
        zoom: 7,
        essential: true // this animation is considered essential with respect to prefers-reduced-motion
    })

    // unselect zcta if applicable: clear highlight, remove tooltip

    redraw()
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
})

mapRateSwitch.addEventListener("sl-change", function() {
    drawTooltip(selectedItems.zcta)
    drawAggregation()
})

aggregatedDiseaseHistoryResizer.addEventListener("sl-resize", function() {
    drawTooltip(selectedItems.zcta)
    drawAggregation()
})