
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
        counties.selectAll("path")
              .data(mapdata.features)
              .enter()
              .append("path")
              .attr("class", "county")
              .attr("id", d => fixName(d.properties.NAME))
              .attr("d", d => pathGenerator(d))

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

        mapSVG.append("g")
                .attr("id", "legends")
                .attr("transform", `translate(0 ${height}) scale(1 -1)`)
                
        d3.json("/get-hospital-zcta-data", { // covid county data
            "method": "POST",
            "headers": {"Content-Type": "application/json"},
            "body": JSON.stringify({
                "region-name": "all",
                "disease": "all",
                "date": "max",
            })}).then((result) => { 
                hospitalData = mapSVG.append("g")
                .attr("id", "hospital-data")
                .style("opacity", +hospitalToggle.checked)

                data = result.data.map(function(item) {
                    item["region"] = "_"+item["region"]
                    return item
                })
                hospitalStats = result.stats
                hospitalMetadata = result.metadata

                maxRadius = Math.min(height, width) * 0.05
                radiusMap = d3.scaleLinear([0, hospitalStats.max], [0, maxRadius])

                diseaseGroups = {}
                hospitalMetadata.disease.forEach(disease => {
                    diseaseGroups[disease] = hospitalData.append("g").attr("id", disease + "-hospital-data").attr("class", "hospital-data-group").raise()
                    // create checkbox
                    createHospitalCheck(disease, diseaseColorMap(disease))
                })
                
                // draw legend
                drawLegend(hospitalStats, "hospital", true)

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
                        .each(function(d) {hospitalTooltip(d3.select(this))})
                    });
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
        mapSVG.selectAll(".county").each(function(item) {
            d3.select(this)
            .attr("d", (d) => pathGenerator(d))
        })
    
        mapSVG.select("#hospitals").selectAll(".hospital").each(function(item) {
            hospSize = Math.max(16, Math.min(width, height) * 0.015)
            d3.select(this)
                .attr("x", (d) => mapProjection(d.geometry.coordinates)[0] - hospSize/2)
                .attr("y", (d) => mapProjection(d.geometry.coordinates)[1] - hospSize/2)
                .attr("width", hospSize)
                .attr("height", hospSize)
        })

        mapSVG.selectAll(".hospital-bubble").each(function(d) {
            maxRadius = Math.min(height, width) * 0.025
            radiusMap = d3.scaleLinear([0, hospitalStats.max], [0, maxRadius])
            mapCoords = mapProjection([d.INTPTLON, d.INTPTLAT])
            newPos = skew(mapCoords, maxRadius/5, diseaseIndexing[d.disease], numDiseases)
            d3.select(this)
                .attr("cx", newPos[0])
                .attr("cy", newPos[1])
                .attr("r", radiusMap(d.count))

            // updating legend stuff
            em = parseFloat(getComputedStyle(this).fontSize)
            mapSVG.select("#legends")
            .attr("transform", `translate(0 ${height}) scale(1 -1)`)

            mapSVG.selectAll(".legend.hospital").selectAll("line")
                .attr("x1", (d) => radiusMap(hospitalStats.max) + 2.5*em)
                .attr("y1", (d) => radiusMap(d[0]) + 3*em)
                .attr("x2", (d) => 3*radiusMap(d[0]) + radiusMap(hospitalStats.max) + 3.5*em)
                .attr("y2", (d) => radiusMap(d[0]) + 3*em)

            mapSVG.selectAll(".legend.hospital").select("circle")
                .attr("cx", (d) => radiusMap(hospitalStats.max) + 2.5 * em)
                .attr("cy", (d) => radiusMap(d[0]) + 3*em)
                .attr("r", (d) => radiusMap(d[0]))

            mapSVG.selectAll(".legend.hospital").select("text")
                .attr("x", (d) => 3*radiusMap(d[0]) + radiusMap(hospitalStats.max) + 3.75*em)
                .attr("y", (d) => -(radiusMap(d[0]) + 2.5*em))

            mapSVG.select(".legend.title.hospital")
                .attr("x", (d) => radiusMap(hospitalStats.max) + 3*em)
                .attr("y", (d) => -em)
        })
    }

    setup().then(updateMap, (error) => {
        console.log("something bad happened during map resizing")
    })    
}


function drawLegend(stats, type, show) {
    mapSVG.select("#legends")
    .append("g").attr("id", `${type}-legend`).attr("class", "legend-group")
    .selectAll(`.legend.${type}`)
    .data([[stats.max *3/3, 0], [stats.max * 2/3, 1], [stats.max * 1/3, 2]])
    .enter()
    .append("g")
    .attr("class", `legend ${type}`)
    .style("opacity", +show)
    .each(function(d) {
        em = parseFloat(getComputedStyle(this).fontSize)
        d3.select(this).append("line")
        d3.select(this).append("circle")
        d3.select(this).append("text")
        .text(f(d[0]))
    })

    mapSVG.select(`#${type}-legend`).append("text")
        .attr("class", `legend title ${type}`)
        .style("opacity", +show)
        .text(() => type == "disease" ? "7 Day Average" : "Monthly\nAverage")
    resizeMap()
}
