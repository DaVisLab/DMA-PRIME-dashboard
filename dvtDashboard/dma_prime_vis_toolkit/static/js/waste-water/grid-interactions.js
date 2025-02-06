
gridDiseaseSelector.addEventListener("sl-change", () => {
    drawCharts()
})

gridMapResizer.addEventListener("sl-resize", (e) => {
    drawMap(e.detail.entries[0].contentRect.height, e.detail.entries[0].contentRect.width)
})

gridContainerResizer.addEventListener("sl-resize", () => {
    drawCharts()
})