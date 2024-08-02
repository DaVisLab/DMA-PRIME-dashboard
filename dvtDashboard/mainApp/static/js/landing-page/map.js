mapTooltip.style.backgroundColor = opacify(d3.select(mapTooltip).style("--sl-color-neutral-500").replace(/ /g, ","), 0.75)
mapTooltip.style.borderColor = opacify(d3.select(mapTooltip).style("--sl-color-neutral-700").replace(/ /g, ","), 0.5)

function displayMap() {
    width = jsmapSVG.width.baseVal.value
    height = jsmapSVG.height.baseVal.value
    
    return d3.json("../../static/data/tl_2023_sc_county_trimmed.json").then(function(mapdata) {
        mapData = mapdata
        mapProjection = d3.geoAlbers().fitExtent(
            [[margins.left, margins.top], [width-margins.right,height-margins.bottom]],
            mapdata)
        pathGenerator = d3.geoPath(mapProjection)

        counties = mapSVG.append("g")
                .attr("id", "map-counties")
                .style("pointer-events", "none")
        counties.selectAll("path")
              .data(mapdata.features)
              .enter()
              .append("path")
              .attr("class", "county")
              .attr("id", d => "map-" + fixName(d.properties.NAME))
              .attr("d", d => pathGenerator(d))
              .style("fill", "var(--sl-color-gray-300)")
              .style("fill-opacity", 0)

        zctas = mapSVG.append("g")
            .attr("id", "map-zctas")

        hospitals = mapSVG.append("g")
                .attr("id", "map-hospitals")
                .style("pointer-events", "none")

    }).then(() => {
        
        hospSize = Math.max(16, Math.min(width, height) * 0.015)
        d3.json("../../static/data/Hospitals.geojson").then( async function(hospdata){
              hospitals.selectAll("svg")
              .data(hospdata.features)
              .enter()
              .append("svg")
              .attr("class", "hospital")
              .attr("id", d => "map-"+fixName(d.properties.webdbINFOHEALTHFACILITYLF_NAME))
              .attr("viewBox", "0 0 16 16")
              .attr("width", hospSize)
              .attr("height", hospSize)
              .each(function(d) {
                this.innerHTML = makeHospital(fixName(d.properties.webdbINFOHEALTHFACILITYLF_NAME))
              })
        })

        legendsGroup = mapSVG.append("g")
                .attr("id", "map-legends")
                .style("pointer-events", "none")
                
        d3.json("/get-hospital-zcta-data", { // zcta hospital data
            "method": "POST",
            "headers": {"Content-Type": "application/json"},
            "body": JSON.stringify({
                "region-name": "all",
                "disease": "all",
                "date": "2021-11",
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

            maxHospitalCount = hospitalStats.max['all']
            maxHospitalRadius = Math.min(height, width) * 0.025
            hospitalRadiusMap = d3.scaleLinear([0, maxHospitalCount], [0, maxHospitalRadius]).unknown(0).nice(9) // unknown values are being set to 0 if they are encountered
            diseaseGroups = {}
            hospitalMetadata.disease.forEach(disease => {
                diseaseGroups[disease] = hospitalData.append("g").attr("id", disease + "-hospital-data").attr("class", "hospital-data-group").raise()
                // create checkbox
                createHospitalCheck(disease, diseaseColorMap(disease))
            })
            
            hospitalLegend = legendsGroup.append("g")
                .attr("id", "map-hospital-legend")
                .style("opacity", 0)

            hospitalLegend.append("rect")
                .attr("id", "map-hospital-legend-background")
                .attr("class", "legend-background")

            hospitalLegendInnards = hospitalLegend.append("g")
                .attr("id", "map-hospital-legend-innards")

            hospitalLegendInnards.append("text")
                .attr("class", `legend title hospital`)
                .text("Monthly Count")

            hospitalLegendContent = hospitalLegendInnards.append("g").attr("id", "map-hospital-legend-contents")
            hospitalLegendContent.selectAll("legend hospital").data(hospitalRadiusMap.ticks(3).reverse().filter((d) => d != 0))
                .enter()
                .append("g")
                .attr("class", "legend hospital")
                .each(function(d) {
                    em = parseFloat(getComputedStyle(this).fontSize)
                    d3.select(this).append("line")
                    d3.select(this).append("circle")
                    d3.select(this).append("text")
                    .text(formatInt(d))
                })

            legendBBox = hospitalLegend.select("#map-hospital-legend-innards").node().getBBox()
            hospitalLegend.select("#map-hospital-legend-background")
                .attr("rx", 0.5*em)

            // draw bubbles
            data.forEach(element => {
                temp = diseaseGroups[element.disease].selectAll(`.hospital-bubble .${element.disease} .${element.region}`)
                temp
                    .data([element])
                    .enter()
                    .append("circle")
                    .attr("class", `hospital-bubble ${element.disease} ${element.region}`)
                    .attr("bubble-type", "hospital")
                    .style("fill", diseaseColorMap(element.disease))
                    .style("stroke", diseaseColorMap(element.disease))
                    .style("opacity", 0)
                    .each(function(d) {
                        bubble = d3.select(this)
                        region = d.region.substring(1)
                        data = bubble.datum()
                        data["main-county"] = result.metadata["zcta-main-county"][region]
                        data["population"] = result.metadata["zcta-population"][region]

                        result.metadata["zcta-county-crosswalk"][region].forEach((county) => {
                            bubble.attr(county, true)
                        })
                    })
                });

            d3.json("../../static/data/tl_2023_sc_zcta_trimmed.json").then( async function(mapdata) {
                d3.json("../../static/data/zcta_county_crosswalk.json").then( async function(crosswalk) {
                    zcta = mapdata
        
                    aggregated = []
                    zctas.selectAll("path")
                        .data(mapdata.features)
                        .enter()
                        .append("path")
                        .attr("class", "zcta")
                        .attr("id", d => "map-"+fixName(d.properties.ZCTA5CE20))
                        .attr("county", (d) => crosswalk[d.properties.ZCTA5CE20])
                        .attr("d", d => pathGenerator(d))
                        .each(function(zctaData) {
                            zcta = d3.select(this)
                            hospitalTooltip(zcta)
                            zcta.datum().properties['counties'] = result.metadata["zcta-county-crosswalk"][zctaData.properties.ZCTA5CE20]
                            zcta.attr("population", null)
    
                            value = 0
                            bubbles = mapSVG.selectAll(`._${zctaData.properties.ZCTA5CE20}`)
                            bubbles.each((d) => {
                                value += d.count
                                zcta.attr("population", d.population)
                            })
                            zcta.attr("count", value)
                            aggregated.push(value)
                        })

                    heatmapColorMap = d3.scaleLinear([0, d3.max(aggregated)], ["white", "saddlebrown"]).unknown("var(--sl-color-gray-600)").nice()
                    zctas.selectAll("path")
                        .style('fill', function(d) { return heatmapColorMap(d3.select(this).attr("count"))})
                        .each(function(data) {zoomToCounty(d3.select(this), data)})

                    legendWidth = Math.max(width/3, 300)
                    colorLegend = mapSVG.select("#map-legends").append("g")
                        .attr("id", "map-color-legend")

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
                        .attr("id", "map-color-legend-background")
                        .attr("class", "legend-background")

                    colorLegendContent = colorLegend.append("g").attr("id", "map-color-legend-contents")
                    colorLegendContent.append("rect")
                        .style("fill", "url(#linear-gradient)");

                    colorLegendContent.append("g").attr("id", "map-color-legend-axis")
                        .call(d3.axisBottom(d3.scaleLinear(heatmapColorMap.domain(), [0, legendWidth])).ticks(9))

                    colorLegendContent.append("text")
                        .text("Aggregated Monthly Hospitalizations")
                })
            })
        })
    })
}

async function resizeMap() {
    console.log("resizing")
    mapSVG.select("#map-counties").raise()

    async function setup() {
        width = jsmapSVG.width.baseVal.value
        height = jsmapSVG.height.baseVal.value
        mapProjection = d3.geoAlbers().fitExtent(
            [[margins.left, margins.top], [width-margins.right,height-margins.bottom]],
            mapData)
        pathGenerator = d3.geoPath(mapProjection)
    }

    function updateMap(value) {
        mapSVG.selectAll(".county")
            .attr("d", (d) => pathGenerator(d))

        mapSVG.selectAll(".zcta")
            .transition().duration(750)
            .attr("d", (d) => pathGenerator(d))
            .style("fill", function(d) {
                zcta = d3.select(this)
                population = zcta.attr("population") ? zcta.attr("population") : 1
                population = population == 0 ? NaN : population
                return mapAggregationSwitch.value == "aggregated" ? heatmapColorMap(zcta.attr("count") / (mapPopulationSwitch.value == "total" ? 1 : population)) : "var(--sl-color-gray-800)"
            })

        hospSize = Math.max(16, Math.min(width, height) * 0.015)
        mapSVG.select("#map-hospitals").selectAll(".hospital").each(function(d) {
                coords = mapProjection(d.geometry.coordinates)
                d3.select(this).transition().duration(750)
                    .attr("x", coords[0]*zoom + xSkew - hospSize/2)
                    .attr("y", coords[1]*zoom + ySkew - hospSize/2)
                    .attr("width", hospSize)
                    .attr("height", hospSize)
        })

        legendWidth = Math.max(width/3, 300)
        colorLegend = mapSVG.select("#map-color-legend")
        colorLegend.select("#map-color-legend-contents>rect")
            .attr("width", legendWidth)
            .attr("height", em)
            .attr("x", 2*em)
            .attr("y", height - 4.5*em)

        colorLegendAxis = colorLegend.select("#map-color-legend-axis")
        colorLegendAxis.selectAll("*").remove()
        colorLegendAxis
            .attr("transform", `translate(${2*em},${height - 3.5*em})`)
            .call(d3.axisBottom(d3.scaleLinear(heatmapColorMap.domain(), [0, legendWidth])).ticks(9))

        colorLegend.select("#map-color-legend-contents>text") 
            .attr("y", height-1*em)
            .attr("x", 2*em + legendWidth/2)

        legendBBox = colorLegend.select("#map-color-legend-contents").node().getBBox()
        colorLegend.select("#map-color-legend-background")
            .attr("x", legendBBox.x - 0.5*em)
            .attr("y", legendBBox.y)
            .attr("height", legendBBox.height + 0.5*em)
            .attr("width", legendBBox.width + em)

        maxHospitalCount = hospitalRadiusMap.domain()[1]
        maxHospitalRadius = Math.min(height, width) * 0.025
        mapSVG.selectAll(".hospital-bubble").each(function(d) {
            mapCoords = mapProjection([d.INTPTLON, d.INTPTLAT])
            newPos = skew(mapCoords, maxHospitalRadius/5, diseaseIndexing[d.disease], numDiseases)
            d3.select(this).transition().duration(750)
                .attr("cx", newPos[0]*zoom + xSkew)
                .attr("cy", newPos[1]*zoom + ySkew)
                .attr("r", function(d) {
                    population = d.population
                    population = population == 0 ? NaN : population
                    return hospitalRadiusMap(d.count / (mapPopulationSwitch.value == "total" ? 1 : population))
                })
            })

            // updating legend stuff
            legend = mapSVG.select("#map-hospital-legend").attr("transform", `translate(${width} ${height}) scale(1 -1)`)

            legend.select("#map-hospital-legend-contents").selectAll("g").data(hospitalRadiusMap.ticks(3).reverse().filter((d) => d != 0))
                .join(
                    enter => enter,
                    update => update
                    .each(function(d) {          
                        d3.select(this).select("line").transition().duration(750)
                            .attr("x2", (d) => -(hospitalRadiusMap(maxHospitalCount) + 2.5*em))
                            .attr("y2", (d) => hospitalRadiusMap(d) + 3*em)
                            .attr("x1", (d) => -(5*hospitalRadiusMap(d) + hospitalRadiusMap(maxHospitalCount) + 2*em))
                            .attr("y1", (d) => hospitalRadiusMap(d) + 3*em)

                        d3.select(this).select("circle").transition().duration(750)
                            .attr("cx", (d) => -(hospitalRadiusMap(maxHospitalCount) + 2.5 * em))
                            .attr("cy", (d) => hospitalRadiusMap(d) + 3*em)
                            .attr("r", (d) => hospitalRadiusMap(d))

                        d3.select(this).select("text").transition().duration(750)
                            .attr("x", (d) => -(5*hospitalRadiusMap(d) + hospitalRadiusMap(maxHospitalCount) + 2.25*em))
                            .attr("y", (d) => -(hospitalRadiusMap(d) + 2.5*em))
                            .text(d)
                }),
                exit => exit.remove()
                )
            legend.select(".legend.title.hospital").transition().duration(750)
                .attr("x", (d) => -(hospitalRadiusMap(maxHospitalCount) + 3*em))
                .attr("y", (d) => -em)

            legendBBox = hospitalLegend.select("#map-hospital-legend-innards").node().getBBox()
            hospitalLegend.select("#map-hospital-legend-background")
                .attr("x", legendBBox.x - 0.5*em)
                .attr("y", legendBBox.y)
                .attr("height", legendBBox.height + 0.5*em)
                .attr("width", legendBBox.width + em)
    }

    setup().then(updateMap).catch((error) => {
        console.log(error)
        console.log("something bad happened during map resizing")
        setTimeout(resizeMap, 100)
    })
}

