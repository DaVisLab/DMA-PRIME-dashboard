
// 4 different divs with svgs with zip code maps - aggregated, covid, flu, rsv
// also need a color legend for each
// 

function comparisonInitialVisualization() {

    d3.json("/map-data/county").then(function(mapdata) {

        d3.selectAll(".comparison-svg").each(function(d) {
            // Create a map for each disease
            svg = d3.select(this)
            disease = svg.attr("disease")
            
            comparisonWidth = this.width.baseVal.value
            comparisonHeight = this.height.baseVal.value

            mapData = mapdata
            comparisonProjection = d3.geoAlbers().fitExtent(
                [[margins.left, margins.top], [comparisonWidth-margins.right,comparisonHeight-margins.bottom]],
                mapdata)
            comparisonPathGenerator = d3.geoPath(comparisonProjection)

            svg.append("g")
                .attr("id", `comparison-${disease}-counties`)
                .style("pointer-events", "none")
                .selectAll("path")
                    .data(mapdata.features)
                    .enter()
                    .append("path")
                    .attr("class", "county")
                    .attr("id", d => disease + "-map-" + fixName(d.properties.NAME))
                    .attr("d", d => comparisonPathGenerator(d))
                    .style("fill", disease == "aggregated" ? "saddlebrown" : diseaseColorMap(disease))

        })
    })

}

function resizeComparisonMaps() {
    // Resize maps
    d3.select(visibleComparisonMaps).selectAll(".comparison-svg").each(function(d) {
        async function setup(map) {
            comparisonWidth = map.width.baseVal.value
            comparisonHeight = map.height.baseVal.value
    
            comparisonProjection = d3.geoAlbers().fitExtent(
                [[margins.left, margins.top], [comparisonWidth-margins.right,comparisonHeight-margins.bottom]],
                mapData)
                
            comparisonPathGenerator = d3.geoPath(comparisonProjection)
        }
        
        setup(this).then(() => {
            svg = d3.select(this)
            disease = svg.attr("disease")

            svg.select(`#comparison-${disease}-counties`).selectAll("path")
            .attr("d", d => comparisonPathGenerator(d))
        })
        
    })
}