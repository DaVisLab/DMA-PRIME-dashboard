
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

    element.addEventListener("pointerenter", function(e) {
        zctaGroup = d3.select(e.target)
        zcta = zctaGroup.datum().properties.ZCTA

        groups = d3.selectAll(`.comparison-zcta-group._${zcta}`)
        groups.raise()

        d3.selectAll(`:not(._${zcta}).comparison-zcta-group`).select("path")
            .style("stroke-width", 0)
        d3.selectAll(`:not(._${zcta}).comparison-zcta-group`).select("text")
            .style("visibility", "collapse")

        groups.select("path")
            .style("stroke-width", 3)
        zctaGroup.select("text")
            .style("visibility", "visible")
    })

    element.addEventListener("pointerleave", function(e) {
        d3.selectAll(".comparison-zcta-text")
            .style("visibility", "collapse")

        d3.selectAll(`.comparison-zcta`)
            .style("stroke-width", 0)
    })
}
