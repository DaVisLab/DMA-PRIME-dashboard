jsmapSVG = document.getElementById("map")
mapSVG = d3.select("#map")
mapProjection = null
bivariateColormap = null
margins = {
    top: 10,
    right: 10,
    bottom: 10,
    left: 10
}
f = d3.format(".0f")

var width = jsmapSVG.width.baseVal.value
var height = jsmapSVG.height.baseVal.value
d3.json("../../static/data/tl_2023_sc_county_trimmed.json").then(function(mapdata) {
    mapData = mapdata
    mapProjection = d3.geoAlbers().fitExtent(
        [[margins.left, margins.top], [width-margins.right,height-margins.bottom]],
        mapdata)
    pathGenerator = d3.geoPath(mapProjection)

    counties = mapSVG.append("g")
            .attr("id", "counties")
            // .style("pointer-events", "none")
    counties.selectAll("path")
          .data(mapdata.features)
          .enter()
          .append("path")
          .attr("class", "county")
          .attr("id", d => fixName(d.properties.NAME))
          .attr("d", d => pathGenerator(d))
          .attr("fill", "var(--sl-color-gray-300)")

}).then(() => {
    d3.json("/get-county-disease-data", { // zcta hospital data
        "method": "POST",
        "headers": {"Content-Type": "application/json"},
        "body": JSON.stringify({
            "region-name": "all",
            "disease": "covid-19",
            "date": "max",
            "data-type": "cases 7-day average",
        })}).then(function(response) {
            mainColor = d3.scaleLinear().domain([0, 2]).range(["#0000FF", "#F00F00"])
            range = []
            for(hue=0; hue < 3; hue++) {
                innerRange = []
                for(sat=0; sat < 3; sat++) {
                    color = d3.hsl(mainColor(hue))
                    color.l = .4
                    color.s -= .3 * sat
                    color.l += .2 * sat
                    innerRange.push(color)
                }
                range.push(d3.scaleThreshold().domain([.75, .9]).range(innerRange.reverse()))
            }
            bivariateColormap = d3.scaleQuantize().domain([response.stats.min,response.stats.max]).range(range)

            response.data.forEach(function(datum) {
                // datum.confidence
                randomConfidence = function() {
                    // valInit = 1 - d3.randomLogNormal(.075, 1)()
                    valInit = d3.randomNormal(1, .35)()
                    return Math.min(1, Math.max(0, valInit))
                }
                datum.confidence = randomConfidence()
                county = d3.select(`#${datum.region}`)
                county.style("fill", bivariateColormap(datum.count)(datum.confidence))
            })

            legend = mapSVG.append("svg")
                .attr("id", "legend")
                .attr("overflow", "visible")
                .attr("transform", `translate(${10+10+12+16},${height-(10+10+12+16)}) rotate(0) scale(1 -1)`)
            opacityDomain = [0].concat(bivariateColormap(0).domain())
            opacityDomain.push(1)
            for(i=0; i < 3; i++) {
                for(j=0; j < 3; j++) {
                    rect = legend.append('rect')
                        .attr("id", `#r${i}${j}`)
                        .attr("fill", bivariateColormap((i+.1)*(response.stats.max-response.stats.min)/3)(opacityDomain[j]))
                        .attr("height", 25)
                        .attr("width", 25)
                        .attr("x", 25 * i)
                        .attr("y", 25 * j)
                }
            }

            legendCountAxis = legend.append("g")
                .attr("id", "legend-count-axis")
            legendCountAxis.append("line")
                .attr("x1", 0)
                .attr("y1", 0)
                .attr("x2", 75)
                .attr("y2", 0)
                .attr("stroke-width", 2)
                .attr("stroke", "white")
            legendCountAxis.append("text")
                .attr("x", 75/2)
                .attr("y", 10 + 10 + 12)
                .attr("text-anchor", "middle")
                .attr("font-size", 12)
                .attr("fill", "white")
                .attr("transform", "scale(1 -1)")
                .text("Disease Count")
            for(i=0; i < 4; i++) {
                legendCountAxis.append("line")
                    .attr("x1", 25 * i)
                    .attr("y1", 0)
                    .attr("x2", 25 * i)
                    .attr("y2", -10)
                    .attr("stroke-width", 2)
                    .attr("stroke", "white")
                legendCountAxis.append("text")
                    .attr("x", 25 * i)
                    .attr("y", 10 + 10)
                    .attr("text-anchor", "middle")
                    .attr("font-size", 10)
                    .attr("fill", "white")
                    .attr("transform", "scale(1 -1)")
                    .text(formatInt(i * (response.stats.max-response.stats.min)/3))
            }

            legendCountAxis = legend.append("g")
                .attr("id", "legend-confidence-axis")
                .attr("transform", "rotate(90)")
            legendCountAxis.append("line")
                .attr("x1", 0)
                .attr("y1", 0)
                .attr("x2", 75)
                .attr("y2", 0)
                .attr("stroke-width", 2)
                .attr("stroke", "white")
            legendCountAxis.append("text")
                .attr("x", 75/2)
                .attr("y", -(5 + 10 + 12))
                .attr("text-anchor", "middle")
                .attr("font-size", 12)
                .attr("fill", "white")
                .attr("transform", "scale(1 -1)")
                .text("Confidence")
            for(i=0; i < 4; i++) {
                legendCountAxis.append("line")
                    .attr("x1", 25 * i)
                    .attr("y1", 0)
                    .attr("x2", 25 * i)
                    .attr("y2", 10)
                    .attr("stroke-width", 2)
                    .attr("stroke", "white")
                legendCountAxis.append("text")
                    .attr("x", 25 * i)
                    .attr("y", -(5 + 10))
                    .attr("text-anchor", "middle")
                    .attr("font-size", 10)
                    .attr("fill", "white")
                    .attr("transform", "scale(1 -1)")
                    .text(opacityDomain[i])
            }
        })
})

// helper functions
function fixName(name) {
    newName = name.toLowerCase().split(" ").join("-")
    newName = newName.replace(/[\/']/g, "")
    return newName
}