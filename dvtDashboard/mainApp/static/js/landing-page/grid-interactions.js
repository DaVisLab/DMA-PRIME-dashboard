gridAggregationSwitch.addEventListener("sl-change", (event) => {
    displayGridAggregateChart()
    updateCountyGraphs()

    if(gridAggregationSwitch.value == "aggregated") {
        d3.selectAll(".grid-check")
            .style("display", "none")
    } else {
        d3.selectAll(".grid-check")
            .style("display", "initial")
    }
})

gridPopulationSwitch.addEventListener("sl-change", (event) => {
    displayGridAggregateChart()
    updateCountyGraphs()
})