
comparisonResizer.addEventListener("sl-resize", resizeComparisonMaps)

comparisonPopulationSwitch.addEventListener("sl-change", (event) => {
    // when population aggregation switch is changed, update the visualization
    displayComparisonAggregateChart()

    d3.selectAll(".comparison-svg").each(function(d) {
        svg = d3.select(this)
        disease = svg.attr("disease")
        max = 0
        if (comparisonPopulationSwitch.value == "total") {
            max = comparisonStats.max[disease]
        } else{
            max = d3.max(svg.selectAll("path"), (entry) => {
                item = d3.select(entry)
                if(item.attr("count") == "16") {
                }
                if (item.attr("population")) {
                    return item.attr("count") / item.attr("population")
                } else {
                    return NaN
                }
            })
        }

        colormap = comparisonColormaps[disease]
        colormap.domain([0, max]).nice()

        svg.selectAll("path").each(function(d) {
            item = d3.select(this)    
            value = comparisonPopulationSwitch.value == "total" ? item.attr("count") : item.attr("count") / item.attr("population")
            item.style("fill", colormap(value))
        })

    })
    
})

function setupComparisonTooltip(element) {

    element.on("pointerenter", function(e) {
        zctaElement = d3.select(e.target)
        zcta = zctaElement.datum().properties.ZCTA5CE20
        
        lon = fixCoord(zctaElement.datum().properties.INTPTLON20)
        lat = fixCoord(zctaElement.datum().properties.INTPTLAT20)
        coords = comparisonProjection([lon, lat])

        d3.selectAll(`.comparison-zcta`)
            .style("stroke-width", 0)

        d3.select(`#comparison-${zctaElement.attr("disease")}-tooltip-text`)
            .attr("text-anchor", "middle")
            .attr("x", coords[0])
            .attr("y", coords[1])
            .style("visibility", "visible")
            .text(zcta)
            .raise()

        d3.selectAll(`.comparison-zcta._${zcta}`)
            .style("stroke-width", 3)
            .raise()
    })

    element.on("pointerleave", function(e) {
        zctaElement = d3.select(e.target)
        zcta = zctaElement.datum().properties.ZCTA5CE20

        d3.selectAll(`.comparison-tooltip-text`)
            .style("visibility", "collapse")
            .lower()

        d3.selectAll(`.comparison-zcta`)
            .style("stroke-width", 0)
    })
}
