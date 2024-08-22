
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
                        .selectAll("path")
                            .data(mapdata.features)
                            .enter()
                            .append("path")
                            .attr("class", d => `comparison-zcta _${d.properties.ZCTA5CE20}`)
                            .attr("id", d => disease + "-map-" + d.properties.ZCTA5CE20)
                            .attr("d", d => comparisonPathGenerator(d))
                            .attr("disease", disease)
                            .attr("count", 0)
                            .style("fill", diseaseColor)
                            .style("stroke-width", 0)
                            .style("stroke", diseaseColor)
                            .each(function(d) {setupComparisonTooltip(d3.select(this))})
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
                item = d3.select(this)

                item.style("fill", comparisonColormaps[item.attr("disease")](item.attr("count")))
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
    })
    
}
