
mapZoom = d3.zoom().on("zoom", function(e) {
    d3.select("#counties").attr('transform', e.transform)
    d3.select("#hospitals").attr('transform', e.transform)
})
mapSVG.call(mapZoom)

mapResizer.addEventListener("sl-resize", () => {
    resizeMap()
})

resetButton.addEventListener("click", () => {
    mapSVG.call(mapZoom.transform, d3.zoomIdentity.translate(0, 0).scale(1))
})

