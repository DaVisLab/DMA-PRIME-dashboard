gridSort.addEventListener("sl-change", (event) => {
    sortGrid()
})

gridRateSwitch.addEventListener("sl-change", (event) => {
    // when population aggregation switch is changed, update the visualization
    // displayGridAggregateChart()
    updateGridData()
})

gridDataSourceSortSelector.addEventListener("sl-change", (event) => {
    updateGridData()    
})

function setGridTooltip(gridTooltip) {
    gridTooltip.on("sl-show", function(event) {        
        gridTooltipWidth = Math.max(500, width * .3)
        gridTooltipHeight = gridTooltipWidth * .65

        slTTPDOM = event.target
        slTTP = d3.select(slTTPDOM)
            .style("--max-width", gridTooltipWidth*1.2)
        thisGridContainer = d3.select(slTTPDOM.parentNode)

        drawTooltip(thisGridContainer.datum(), slTTP.select("div[slot='content']"), gridTooltipHeight, gridTooltipWidth)
    })
    
}