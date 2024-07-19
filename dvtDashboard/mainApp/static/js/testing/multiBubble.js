jsmapSVG = document.getElementById("map")
mapSVG = d3.select("#map")
mapProjection = null
diseaseRadiusMap = null
var numDiseases = 3
var diseaseIndexing = {"covid-19": 1, "flu": 2, "opioid": 3}
var diseaseColorMap = d3.scaleOrdinal().domain(Object.keys(diseaseIndexing)).range(d3.schemeSet1)

margins = {
    top: 10,
    right: 10,
    bottom: 10,
    left: 10
}
f = d3.format(".0f")
var em = parseFloat(getComputedStyle(jsmapSVG).fontSize)
var width = jsmapSVG.width.baseVal.value
var height = jsmapSVG.height.baseVal.value

toggleUncertainty = mapSVG.append("g")
    .attr("id", "toggle-uncertainty")
toggleUncertainty.append("rect")
    .attr("id", "toggle-uncertainty-background")
    .attr("height", 50)
    .attr("width", 200)
    .attr("x", em)
    .attr("y", height - (50+em))
    .style("fill", "maroon")

tuText = toggleUncertainty.append("text")
    .attr("id", "toggle-uncertainty-text")
    .attr("x", em + 200/2)
    .attr("y", height - (50+em)/2)
    .text("Show Uncertainty")
    .style("fill", "white")
    .style("text-anchor", "middle")

showUncertainty = false

toggleUncertainty.on("click", function(event) {
    showUncertainty = !showUncertainty
    tu = d3.select(this)
    tu.select("#toggle-uncertainty-text").text(showUncertainty ? "Show Prediction":"Show Uncertainty")
    
    dataBubbles = d3.select("#covid-19-data")
    d3.selectAll(".prediction").selectAll("*")
        .style("fill-opacity", showUncertainty ? 0 : .6)
    d3.selectAll(".min-uncertainty").style("opacity", +(showUncertainty))
    d3.selectAll(".max-uncertainty").style("opacity", +(showUncertainty))
})

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
    d3.json("/get-county-disease-data", { // zcta disease data
        "method": "POST",
        "headers": {"Content-Type": "application/json"},
        "body": JSON.stringify({
            "region-name": "all",
            "disease": "all",
            "date": "max",
            "data-type": "cases 7-day average",
        })}).then(function(result) {
            data = result.data.map(function(item) {
                item.region = fixName(item.region)
                return item
            })
            // diseaseCountMax = d3.max(data, d => d.count)
            diseaseCountMax = result.stats.max
            diseaseMetadata = result.metadata

            maxRadius = Math.min(height, width) * 0.05
            diseaseRadiusMap = d3.scaleLinear([0, diseaseCountMax], [0, maxRadius])

            diseaseGroups = {}
            diseaseMetadata.disease.forEach(disease => {
                diseaseGroups[disease] = mapSVG.append("g")
                    .attr("id", disease + "-data")
                    .attr("class", "disease-data-group")
                    .attr("disease", disease)
                    .raise()

                diseaseGroups[disease].append("g")
                    .attr("class", "prediction")
                diseaseGroups[disease].append("g")
                    .attr("class", "min-uncertainty")
                    .style("opacity", 0)
                diseaseGroups[disease].append("g")
                    .attr("class", "max-uncertainty")
                    .style("opacity", 0)
            })

            // draw legend
            diseaseLegend = mapSVG.append("g")
                .attr("id", "disease-legend")
                .style("opacity", 0)

            diseaseLegend.append("rect")
                .attr("id", "disease-legend-background")
                .attr("class", "legend-background")

            diseaseLegendInnards = diseaseLegend.append("g")
                .attr("id", "disease-legend-innards")

            diseaseLegendInnards.append("text")
                .attr("class", `legend title disease`)
                .text("Monthly Count")

            diseaseLegendContent = diseaseLegendInnards.append("g").attr("id", "disease-legend-contents")
            diseaseLegendContent.selectAll("legend disease").data(diseaseRadiusMap.ticks(3).reverse().filter((d) => d != 0))
                .enter()
                .append("g")
                .attr("class", "legend disease")
                .each(function(d) {
                    em = parseFloat(getComputedStyle(this).fontSize)
                    d3.select(this).append("line")
                    d3.select(this).append("circle")
                    d3.select(this).append("text")
                    .text(f(d))
                })

            legendBBox = diseaseLegend.select("#disease-legend-innards").node().getBBox()
            diseaseLegend.select("#disease-legend-background")
                .attr("x", legendBBox.x - 0.5*em)
                .attr("y", legendBBox.y)
                .attr("height", legendBBox.height + 0.5*em)
                .attr("width", legendBBox.width + em)
                .attr("rx", 0.5*em)

            // setup bubbles
            data.forEach(element => {
                temp = diseaseGroups[element.disease].select(".prediction").selectAll(`.disease-bubble .${element.disease}.${element.region}`)
                temp
                    .data([element])
                    .enter()
                    .append("circle")
                    .attr("class", `disease-bubble ${element.disease} ${element.region}`)
                    .attr("bubble-type", "disease")
                    .style("fill", diseaseColorMap(element.disease))
                    .style("fill-opacity", .5)
                    .style("stroke", diseaseColorMap(element.disease))
                    .style("stroke-width", 3)
                    .style("stroke-opacity", .6)
                    .each(function(d) {
                        mapCoords = mapProjection([d.INTPTLON, d.INTPTLAT])
                        newPos = skew(mapCoords, maxRadius/5, diseaseIndexing[d.disease], numDiseases)
                        d3.select(this)
                            .attr("cx", newPos[0])
                            .attr("cy", newPos[1])
                            .attr("r", (d) => diseaseRadiusMap(d.count))
                    })

                diseaseGroups[element.disease].select(".min-uncertainty").selectAll(`.disease-bubble .${element.disease}.${element.region}`)
                    .data([element])
                    .enter()
                    .append("circle")
                    .attr("class", `disease-bubble ${element.disease} ${element.region}`)
                    .attr("bubble-type", "disease")
                    .style("fill", diseaseColorMap(element.disease))
                    .style("fill-opacity", .3)
                    .style("stroke", diseaseColorMap(element.disease))
                    .style("stroke-width", 3)
                    .style("stroke-opacity", .4)
                    .style("stroke-dasharray", "3,1")
                    .each(function(d) {
                        mapCoords = mapProjection([d.INTPTLON, d.INTPTLAT])
                        newPos = skew(mapCoords, maxRadius/5, diseaseIndexing[d.disease], numDiseases)
                        d3.select(this)
                            .attr("cx", newPos[0])
                            .attr("cy", newPos[1])
                            .attr("r", (d) => diseaseRadiusMap(d.count) / (1 + Math.random()))
                    })

                diseaseGroups[element.disease].select(".max-uncertainty").selectAll(`.disease-bubble .${element.disease}.${element.region}`)
                    .data([element])
                    .enter()
                    .append("circle")
                    .attr("class", `disease-bubble ${element.disease} ${element.region}`)
                    .attr("bubble-type", "disease")
                    .style("fill", diseaseColorMap(element.disease))
                    .style("fill-opacity", .3)
                    .style("stroke", diseaseColorMap(element.disease))
                    .style("stroke-width", 3)
                    .style("stroke-opacity", .4)
                    .style("stroke-dasharray", "3,1")
                    .each(function(d) {
                        mapCoords = mapProjection([d.INTPTLON, d.INTPTLAT])
                        newPos = skew(mapCoords, maxRadius/5, diseaseIndexing[d.disease], numDiseases)
                        d3.select(this)
                            .attr("cx", newPos[0])
                            .attr("cy", newPos[1])
                            .attr("r", (d) => diseaseRadiusMap(d.count) * (1 + Math.random()))
                    })
            });
        })
})

// helper functions
function fixName(name) {
    newName = name.toLowerCase().split(" ").join("-")
    newName = newName.replace(/[\/']/g, "")
    return newName
}

function fakeSin(angle) {
    angle = angle % 360
    neg = angle < 0
    angle *= neg ? -1 : 1
    val = 0
    if (angle < 180) {
        val = 1 - (0.5 * ((angle-90)*Math.PI/200)^2)
    } else {
        val = -1 + (0.5 * ((angle-270)*Math.PI/200)^2)
    }
    val *= neg ? -1 : 1
    return val
}

function fakeCos(angle) {
    angle = angle % 360
    neg = angle < 0
    angle *= neg ? -1 : 1
    val = 0
    if (angle < 90) {
        val = 1 - (0.5 * ((angle)*Math.PI/200)^2)
    } else if(angle < 270){
        val = -1 + (0.5 * ((angle-180)*Math.PI/200)^2)
    } else {
        val = 1 - (0.5 * ((angle-360)*Math.PI/200)^2)
    }
    return val
}

function skew(orig, radius, idx, total) {
    if(total == 1)
        return orig
    
    angle = (idx/total) * 360
    orig[0] += radius * fakeSin(angle)
    orig[1] += radius * fakeCos(angle)
    return orig
}