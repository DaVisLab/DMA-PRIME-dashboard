
function displayMap() {
    width = jsmapSVG.width.baseVal.value
    height = jsmapSVG.height.baseVal.value
    
    d3.json("../../static/data/tl_2023_sc_county_trimmed.json").then(function(mapdata) {
        mapData = mapdata
        mapProjection = d3.geoAlbers().fitExtent(
            [[margins.left, margins.top], [width-margins.right,height-margins.bottom]],
            mapdata)
        pathGenerator = d3.geoPath(mapProjection)

        counties = mapSVG.append("g")
                .attr("id", "counties")
                .style("pointer-events", "none")
        counties.selectAll("path")
              .data(mapdata.features)
              .enter()
              .append("path")
              .attr("class", "county")
              .attr("id", d => fixName(d.properties.NAME))
              .attr("d", d => pathGenerator(d))

        zctas = mapSVG.append("g")
            .attr("id", "zctas")

        hospitals = mapSVG.append("g")
                .attr("id", "hospitals")
    }).then(() => {
        
        hospSize = Math.max(16, Math.min(width, height) * 0.015)
        d3.json("../../static/data/Hospitals.geojson").then(function(hospdata){
              hospitals.selectAll("svg")
              .data(hospdata.features)
              .enter()
              .append("svg")
              .attr("class", "hospital")
              .attr("id", d => fixName(d.properties.webdbINFOHEALTHFACILITYLF_NAME))
              .attr("viewBox", "0 0 16 16")
              .attr("x", (d) => mapProjection(d.geometry.coordinates)[0] - hospSize)
              .attr("y", (d) => mapProjection(d.geometry.coordinates)[1] - hospSize)
              .attr("width", hospSize)
              .attr("height", hospSize)
              .each(function(d) {
                this.innerHTML = makeHospital(fixName(d.properties.webdbINFOHEALTHFACILITYLF_NAME))
              })
        })

        legendsGroup = mapSVG.append("g")
                .attr("id", "legends")
                .style("pointer-events", "none")
                
        d3.json("/get-hospital-zcta-data", { // zcta hospital data
            "method": "POST",
            "headers": {"Content-Type": "application/json"},
            "body": JSON.stringify({
                "region-name": "all",
                "disease": "all",
                "date": "max",
            })}).then((result) => { 
                hospitalData = mapSVG.append("g")
                .attr("id", "hospital-bubbles")
                .style("pointer-events", "none")

                data = result.data.map(function(item) {
                    item["region"] = "_"+item["region"]
                    return item
                })
                hospitalStats = result.stats
                hospitalMetadata = result.metadata

                maxRadius = Math.min(height, width) * 0.02
                radiusMap = d3.scaleLinear([0, hospitalStats.max], [0, maxRadius])

                diseaseGroups = {}
                hospitalMetadata.disease.forEach(disease => {
                    diseaseGroups[disease] = hospitalData.append("g").attr("id", disease + "-hospital-data").attr("class", "hospital-data-group").raise()
                    // create checkbox
                    createHospitalCheck(disease, diseaseColorMap(disease))
                })
                
                hospitalLegend = legendsGroup.append("g")
                    .attr("id", "hospital-legend")
                    .style("opacity", 0)

                hospitalLegendInnards = hospitalLegend.append("g")
                    .attr("id", "hospital-legend-innards")

                hospitalLegendInnards.append("rect").attr("id", "hospital-legend-background").attr("class", "legend-background")
                hospitalLegendInnards.append("text")
                    .attr("class", `legend title hospital`)
                    .text("Monthly Count")

                hospitalLegendContent = hospitalLegendInnards.append("g").attr("id", "hospital-legend-contents")
                hospitalLegendContent.selectAll("legend hospital").data([[hospitalStats.max *3/3, 0], [hospitalStats.max * 2/3, 1], [hospitalStats.max * 1/3, 2]])
                    .enter()
                    .append("g")
                    .attr("class", "legend hospital")
                    .each(function(d) {
                        em = parseFloat(getComputedStyle(this).fontSize)
                        d3.select(this).append("line")
                        d3.select(this).append("circle")
                        d3.select(this).append("text")
                        .text(f(d[0]))
                    })

                // draw bubbles
                data.forEach(element => {
                    temp = diseaseGroups[element.disease].selectAll(`.hospital-bubble .${element.disease} .${element.region}`)
                    temp
                        .data([element])
                        .enter()
                        .append("circle")
                        .attr("class", `hospital-bubble ${element.disease} ${element.region} ${element.county}`)
                        .attr("bubble-type", "hospital")
                        .style("fill", diseaseColorMap(element.disease))
                        .style("stroke", diseaseColorMap(element.disease))
                        .style("opacity", 0)
                    });
        }).then(() => {
            d3.json("../../static/data/tl_2023_sc_zcta_trimmed.json").then(function(mapdata) {
                d3.json("../../static/data/zcta_county_crosswalk.json").then(function(crosswalk) {
                    zcta = mapdata
                    pathGenerator = d3.geoPath(mapProjection)
        
                    zctas.selectAll("path")
                        .data(mapdata.features)
                        .enter()
                        .append("path")
                        .attr("class", "zcta")
                        .attr("id", d => "_"+fixName(d.properties.ZCTA5CE20))
                        .attr("county", (d) => crosswalk[d.properties.ZCTA5CE20])
                        .attr("d", d => pathGenerator(d))
                        .attr("fill", "var(--sl-color-gray-500)")
                    aggregated = []
                    zctas.selectAll("path").each(function(data) {
                        bubbles = mapSVG.selectAll(`._${data.properties.ZCTA5CE20}`)
                        if (!bubbles.empty())
                        {                    
                            value = null ? bubbles.empty() : 0
                            bubbles.each((d) => {
                                value += d.count
                            })
                            d3.select(this).attr("count", value)
                            aggregated.push(value)
                        }
                    })
                    
                    heatmapColorMap = d3.scaleLinear([d3.min(aggregated), d3.max(aggregated)], ["white", "saddlebrown"]).unknown("var(--sl-color-gray-600)").nice()
                    zctas.selectAll("path")
                        .style('fill', function(d) { return heatmapColorMap(d3.select(this).attr("count")) })
                        .each(function(data) {zoomToCounty(this, data)})


                    legendWidth = Math.max(width/3, 300)
                    colorLegend = mapSVG.select("#legends").append("g")
                        .attr("id", "color-legend")

                    colorLegendDefs = colorLegend.append("defs")
                    linearGrdient = colorLegendDefs.append("linearGradient")
                    linearGrdient.attr("id", "linear-gradient")
                        .attr("x1", "0%")
                        .attr("y1", "0%")
                        .attr("x2", "100%")
                        .attr("y2", "0%")
                    linearGrdient.append("stop")
                        .attr("offset", "0%")
                        .attr("stop-color", "white")

                    linearGrdient.append("stop")
                        .attr("offset", "100%")
                        .attr("stop-color", "saddlebrown")

                    colorLegend.append("rect")
                        .attr("id", "color-legend-background")
                        .attr("class", "legend-background")

                    colorLegendContent = colorLegend.append("g").attr("id", "color-legend-contents")
                    colorLegendContent.append("rect")
                        .attr("width", legendWidth)
                        .attr("height", em)
                        .attr("x", 2*em)
                        .attr("y", height - 4.5*em)
                        .style("fill", "url(#linear-gradient)");

                    colorLegendContent.append("g").attr("id", "color-legend-axis")
                        .attr("transform", `translate(${2*em},${height - 3.5*em})`)
                        .call(d3.axisBottom(d3.scaleLinear(heatmapColorMap.domain(), [0, legendWidth])))

                    colorLegendContent.append("text")
                        .attr("y", height-1*em)
                        .attr("x", 2*em + legendWidth/2)
                        .text("Monthly Hospitalization for All Diseases")
      
                    resizeMap()
                })
            })
        })
    }).then(() => {
        console.log("resizepls")
        resizeMap()
    })
}

function resizeMap() {

    function setup() {
        return new Promise(function(resolve, failure) {
            width = jsmapSVG.width.baseVal.value
            height = jsmapSVG.height.baseVal.value
            mapProjection = d3.geoAlbers().fitExtent(
                [[margins.left, margins.top], [width-margins.right,height-margins.bottom]],
                mapData)
            pathGenerator = d3.geoPath(mapProjection)

            resolve("set")
            failure("idk")
        })
    }

    function updateMap(value) {
        mapSVG.selectAll(".county")
            .attr("d", (d) => pathGenerator(d))

        mapSVG.selectAll(".zcta")
            .attr("d", (d) => pathGenerator(d))

        legendWidth = Math.max(width/3, 300)
        colorLegend = mapSVG.select("#color-legend")
        colorLegend.select("#color-legend-contents>rect")
            .attr("width", legendWidth)

        colorLegendAxis = colorLegend.select("#color-legend-axis")
        colorLegendAxis.selectAll("*").remove()
        colorLegendAxis
            .attr("transform", `translate(${2*em},${height - 3.5*em})`)
            .call(d3.axisBottom(d3.scaleLinear(heatmapColorMap.domain(), [0, legendWidth])))

        legendBBox = colorLegend.select("#color-legend-contents").node().getBBox()
        colorLegend.select("#color-legend-background")
            .attr("x", legendBBox.x - 0.5*em)
            .attr("y", legendBBox.y)
            .attr("height", legendBBox.height + 0.5*em)
            .attr("width", legendBBox.width + em)
            .attr("rx", 0.5*em)

        colorLegend.select("#color-legend-contents>text")
            .attr("x", legendBBox.x + legendBBox.width/2)
    
        mapSVG.select("#hospitals").selectAll(".hospital").each(function(item) {
            hospSize = Math.max(16, Math.min(width, height) * 0.015)
            coords = mapProjection(item.geometry.coordinates)
            d3.select(this)
                .attr("x", coords[0] - hospSize/2)
                .attr("y", coords[1] - hospSize/2)
                .attr("width", hospSize)
                .attr("height", hospSize)
        })

        mapSVG.selectAll(".hospital-bubble").each(function(d) {
            maxRadius = Math.min(height, width) * 0.02
            radiusMap = d3.scaleLinear([0, hospitalStats.max], [0, maxRadius])
            mapCoords = mapProjection([d.INTPTLON, d.INTPTLAT])
            newPos = skew(mapCoords, maxRadius/5, diseaseIndexing[d.disease], numDiseases)
            d3.select(this)
                .attr("cx", newPos[0])
                .attr("cy", newPos[1])
                .attr("r", radiusMap(d.count))

            // updating legend stuff
            em = parseFloat(getComputedStyle(this).fontSize)
            legend = mapSVG.select("#hospital-legend").attr("transform", `translate(${width} ${height}) scale(1 -1)`)
            legend.selectAll(".legend.hospital").selectAll("line")
                .attr("x2", (d) => -(radiusMap(hospitalStats.max) + 2.5*em))
                .attr("y2", (d) => radiusMap(d[0]) + 3*em)
                .attr("x1", (d) => -(5*radiusMap(d[0]) + radiusMap(hospitalStats.max) + 2*em))
                .attr("y1", (d) => radiusMap(d[0]) + 3*em)

            legend.selectAll(".legend.hospital").select("circle")
                .attr("cx", (d) => -(radiusMap(hospitalStats.max) + 2.5 * em))
                .attr("cy", (d) => radiusMap(d[0]) + 3*em)
                .attr("r", (d) => radiusMap(d[0]))

            legend.selectAll(".legend.hospital").select("text")
                .attr("x", (d) => -(5*radiusMap(d[0]) + radiusMap(hospitalStats.max) + 2.25*em))
                .attr("y", (d) => -(radiusMap(d[0]) + 2.5*em))

            legend.select(".legend.title.hospital")
                .attr("x", (d) => -(radiusMap(hospitalStats.max) + 3*em))
                .attr("y", (d) => -em)
        })
    }

    setup().then(updateMap, (error) => {
        console.log("something bad happened during map resizing")
    }).then(() => {
        legend = mapSVG.select("#hospital-legend-contents")
        legendBBox = legend.node().getBBox()
        legend.select("#hospital-legend-background")
                .attr("x", legendBBox.x - 0.5*em)
                .attr("y", legendBBox.y - 0.5*em)
                .attr("height", legendBBox.height + em)
                .attr("width", legendBBox.width + em)
                .attr("rx", 0.5*em)
    })
}

// function drawLegend(stats, type, show) {
//     legends = mapSVG.select("#legends")
//         .append("g")
//         .attr("id", `${type}-legend`)
//         .attr("class", "legend-group").style("opacity", 0)
//     legends.selectAll(`.legend.${type}`)
//         .data([[stats.max *3/3, 0], [stats.max * 2/3, 1], [stats.max * 1/3, 2]])
//         .enter()
//         .append("g")
//         .attr("class", `legend ${type}`)
//         .style("opacity", +show)
//         .each(function(d) {
//             em = parseFloat(getComputedStyle(this).fontSize)
//             d3.select(this).append("rect").attr("id", "legend-background")
//             d3.select(this).append("line")
//             d3.select(this).append("circle")
//             d3.select(this).append("text")
//             .text(f(d[0]))
//         })

//     mapSVG.select(`#${type}-legend`).append("text")
//         .attr("class", `legend title ${type}`)
//         .style("opacity", +show)
//         .text(() => type == "disease" ? "7 Day Average" : "Monthly Count")

//     resizeMap()
// }
