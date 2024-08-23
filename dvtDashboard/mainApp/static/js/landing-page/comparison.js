
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
                
                                lon = fixCoord(d.properties.INTPTLON20)
                                lat = fixCoord(d.properties.INTPTLAT20)
                                coords = comparisonProjection([lon, lat])

                                group = d3.select(this)
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

                                group.append("text")
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

            data.forEach(d => {
                d3.select(`#${d.disease}-map-${d.region}`)
                    .attr("count", d.count)
                    .attr("population", d.ZCTA_POP ? d.ZCTA_POP : "")

                aggMapItem = d3.select(`#aggregated-map-${d.region}`)
                aggMapItem
                    .attr("count", parseFloat(aggMapItem.attr("count")) + d.count)
                    .attr("population", d.ZCTA_POP ? d.ZCTA_POP : "")
            })

            d3.selectAll(".comparison-svg").selectAll("path").each(function(d) {
                zctaElement = d3.select(this)
                zcta = zctaElement.datum().properties.ZCTA5CE20

                lon = fixCoord(zctaElement.datum().properties.INTPTLON20)
                lat = fixCoord(zctaElement.datum().properties.INTPTLAT20)
                coords = comparisonProjection([lon, lat])

                d3.select(this.parentNode)
                    .append("text")
                    .attr("id", `${zctaElement.attr("disease")}-map-${zcta}-text`)
                    .attr("class", "comparison-zcta-text")
                    .attr("text-anchor", "middle")
                    .attr("x", coords[0])
                    .attr("y", coords[1])
                    .style("visibility", "collapse")
                    .style("pointer-events", "none")
                    .text(zcta)
                    .datum({"lat": lat, "lon": lon})

                zctaElement.style("fill", comparisonColormaps[zctaElement.attr("disease")](zctaElement.attr("count")))
            })
        
        })

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

                
        d3.selectAll(".comparison-svg")
        .attr("width", comparisonWidth)
        .attr("height", comparisonHeight) 
    }
    
    setup(this).then(() => {

        d3.select(visibleComparisonMaps).selectAll("path")
            .attr("d", d => comparisonPathGenerator(d))
        
        d3.select(visibleComparisonMaps).selectAll("text")
            .attr("x", d => comparisonPathGenerator([d.lon, d.lat])[0])
            .attr("x", d => comparisonPathGenerator([d.lon, d.lat])[1])

    })
    
}
