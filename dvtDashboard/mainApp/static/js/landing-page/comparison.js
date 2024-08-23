
// 4 different divs with svgs with zip code maps - aggregated, covid, flu, rsv
// also need a color legend for each
// 

function comparisonInitialVisualization() {

    d3.json("/map-data/zcta").then(function(mapdata) {
        comparisonMapData = mapdata

        comparisonMapCount = visibleComparisonMaps.childElementCount
        numSplit = Math.max(Math.ceil(Math.sqrt(comparisonMapCount)), 1) // don't want div/0 errors
        comparisonWidth = visibleComparisonMaps.clientWidth * ((1 / numSplit) - .02)
        comparisonHeight = visibleComparisonMaps.clientHeight * ((1 / numSplit) - .02)
    
        comparisonProjection = d3.geoAlbers().fitExtent(
            [[margins.left, margins.top], [comparisonWidth-margins.right,comparisonHeight-margins.bottom]],
            mapdata)
        comparisonPathGenerator = d3.geoPath(comparisonProjection)

        d3.json("/get-hospital-zcta-data", { // zcta hospital data
            "method": "POST",
            "headers": {"Content-Type": "application/json"},
            "body": JSON.stringify({
                "region-name": "all",
                "disease": "all",
                "date": "2021-11",
        })}).then((result) => {
            data = result.data
            comparisonStats = result.stats
    
            comparisonColormaps = {}

            d3.selectAll(".comparison-svg")
                .attr("width", comparisonWidth)
                .attr("height", comparisonHeight)   
                .each(function(d) {
                    // Create a map for each disease
                    svg = d3.select(this)
                    disease = svg.attr("disease")

                    diseaseColor = disease == "aggregated" ? "saddlebrown" : diseaseColorMap(disease)
                    comparisonColormaps[disease] = d3.scaleLinear([0, comparisonStats.max[disease]], ["white", diseaseColor]).unknown("var(--sl-color-gray-600)").nice()                    
                
                    legendWidth = Math.max(comparisonWidth/3, 200)
                    legend = svg.select(`#comparison-${disease}-legend`)

                    // create gradient that goes from white to saddlebrown like the choropleth coloring
                    legendDefs = legend.append("defs")
                    gradient = legendDefs.append("linearGradient")
                    gradient.attr("id", `comparison-${disease}-linear-gradient`)
                        .attr("x1", "0%")
                        .attr("y1", "0%")
                        .attr("x2", "100%")
                        .attr("y2", "0%")
                        gradient.append("stop")
                        .attr("offset", "0%")
                        .attr("stop-color", "white")
                        gradient.append("stop")
                        .attr("offset", "100%")
                        .attr("stop-color", diseaseColor)

                    // add background
                    legend.append("rect")
                        .attr("id", `comparison-${disease}-legend-background`)
                        .attr("class", "comparison-legend-background")

                    // display the choropleth range using gradient
                    legendContent = legend.append("g").attr("id", `comparison-${disease}-legend-contents`)
                    legendContent.append("rect")
                        .attr("width", legendWidth)
                        .attr("height", em)
                        .attr("x", 2*em)
                        .attr("y", comparisonHeight - 3.5*em)
                        .style("fill", `url(#comparison-${disease}-linear-gradient)`);

                    // create x-axis to show the values at each hue
                    legendContent.append("g").attr("id", `comparison-${disease}-legend-axis`)
                        .attr("transform", `translate(${2*em},${comparisonHeight - 2.5*em})`)
                        .call(d3.axisBottom(d3.scaleLinear(comparisonColormaps[disease].domain(), [0, legendWidth])).ticks(9))

                    // add a title :)
                    legendContent.append("text")
                        .attr("class", `comparison-legend title`)
                        .attr("x", 2*em + legendWidth/2)
                        .attr("y", comparisonHeight-0.5*em)
                        .text(disease[0].toUpperCase() + disease.slice(1) + " Monthly Hospitalizations")

                    // set legend background
                    legendBBox = legend.select(`#comparison-${disease}-legend-contents`).node().getBBox()
                    legend.select(`#comparison-${disease}-legend-background`)
                        .attr("x", legendBBox.x - 0.5*em)
                        .attr("y", legendBBox.y)
                        .attr("height", legendBBox.height + 0.5*em)
                        .attr("width", legendBBox.width + em)

                    // create actual map
                    svg.append("g")
                        .attr("id", `comparison-${disease}-zctas`)
                        .attr("class", "comparison-zctas")
                        .selectAll("g")
                            .data(mapdata.features)
                            .enter()
                            .append("g")
                            .attr("id", d => `${disease}-map-${d.properties.ZCTA5CE20}-group`)
                            .attr("class", d => `comparison-zcta-group _${d.properties.ZCTA5CE20}`)
                            .each(function(d) {
                                setupComparisonTooltip(this)

                                zcta = d.properties.ZCTA5CE20
                                group = d3.select(this)
                                // add zcta items
                                group.append("path")
                                    .attr("id", disease + "-map-" + zcta)
                                    .attr("class", `comparison-zcta _${zcta}`)
                                    .attr("d", comparisonPathGenerator(d))
                                    .attr("disease", disease)
                                    .attr("count", 0)
                                    .style("fill", diseaseColor)
                                    .style("stroke-width", 0)
                                    .style("stroke", diseaseColor)
                                    .datum(d)
                            })
                })

            // assign population and count data to all zcta that has data
            data.forEach(d => {
                d3.select(`#${d.disease}-map-${d.region}`)
                    .attr("count", d.count)
                    .attr("population", d.ZCTA_POP ? d.ZCTA_POP : "")

                aggMapItem = d3.select(`#aggregated-map-${d.region}`)
                aggMapItem
                    .attr("count", parseFloat(aggMapItem.attr("count")) + d.count)
                    .attr("population", d.ZCTA_POP ? d.ZCTA_POP : "")
            })

            // visualize data
            d3.selectAll(".comparison-zctas").selectAll("path").each(function(d) {
                zctaElement = d3.select(this)
                zcta = d.properties.ZCTA5CE20

                lon = fixCoord(d.properties.INTPTLON20)
                lat = fixCoord(d.properties.INTPTLAT20)
                coords = comparisonProjection([lon, lat])

                zctaElement.style("fill", comparisonColormaps[zctaElement.attr("disease")](zctaElement.attr("count")))
            
                // add zcta labels (used for tooltip)
                d3.select(this.parentNode).append("text")
                    .attr("id", `${disease}-map-${zcta}-text`)
                    .attr("class", "comparison-zcta-text")
                    .attr("text-anchor", "middle")
                    .attr("x", coords[0])
                    .attr("y", coords[1])
                    .style("visibility", "collapse")
                    .style("pointer-events", "none")
                    .text(zcta)
                    .datum({"lat": lat, "lon": lon})
            })
        
        })

    }).then(() => {
        comparisonResizer.addEventListener("sl-resize", resizeComparisonMaps)
    })

}

function resizeComparisonMaps() {
    // Resize maps
    async function setup(map) {
        comparisonMapCount = visibleComparisonMaps.childElementCount
        numSplit = Math.max(Math.ceil(Math.sqrt(comparisonMapCount)), 1) // don't want div/0 errors
        comparisonWidth = visibleComparisonMaps.clientWidth * ((1 / numSplit) - .02)
        comparisonHeight = visibleComparisonMaps.clientHeight * ((1 / numSplit) - .02)

        comparisonProjection = d3.geoAlbers().fitExtent(
            [[margins.left, margins.top], [comparisonWidth-margins.right,comparisonHeight-margins.bottom]],
            comparisonMapData)
            
        comparisonPathGenerator = d3.geoPath(comparisonProjection)
    }
    
    setup(this).then((val) => {
        // zcta items
        d3.select(visibleComparisonMaps).selectAll(".comparison-zctas").selectAll("path")
            .attr("d", d => comparisonPathGenerator(d))
        // zcta item labels
        d3.select(visibleComparisonMaps).selectAll(".comparison-zctas").selectAll("text")
            .attr("x", d => comparisonProjection([d.lon, d.lat])[0])
            .attr("y", d => comparisonProjection([d.lon, d.lat])[1])

        d3.selectAll(".comparison-svg")
            .attr("width", comparisonWidth)
            .attr("height", comparisonHeight)
            .each(function(d) {
                svg = d3.select(this)
                disease = svg.attr("disease")
                // legend
                legendWidth = Math.max(comparisonWidth/3, 200)
                legend = svg.select(`#comparison-${disease}-legend`)
                legendContents = legend.select(`#comparison-${disease}-legend-contents`)

                legendContents.select("rect")
                    .attr("width", legendWidth)
                    .attr("height", em)
                    .attr("x", 2*em)
                    .attr("y", comparisonHeight - 3.5*em)

                legendAxis = legend.select(`#comparison-${disease}-legend-axis`)
                legendAxis.selectAll("*").remove()
                legendAxis
                    .attr("transform", `translate(${2*em},${comparisonHeight - 2.5*em})`)
                    .call(d3.axisBottom(d3.scaleLinear(comparisonColormaps[disease].domain(), [0, legendWidth])).ticks(9))

                legendContents.select("text.title") 
                    .attr("x", 2*em + legendWidth/2)
                    .attr("y", comparisonHeight-.5*em)

                legendBBox = legendContents.node().getBBox()
                legend.select(`#comparison-${disease}-legend-background`)
                    .attr("x", legendBBox.x - 0.5*em)
                    .attr("y", legendBBox.y)
                    .attr("height", legendBBox.height + 0.5*em)
                    .attr("width", legendBBox.width + em)
        })

    })
    
}
