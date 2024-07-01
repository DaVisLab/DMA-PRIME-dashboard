
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
                
        diseaseData = mapSVG.append("g")
            .attr("id", "disease-data")
        
        d3.json("/get-county-disease-data", { // covid county data
            "method": "POST",
            "headers": {"Content-Type": "application/json"},
            "body": JSON.stringify({
                "region-name": "all",
                "disease": "all",
                "date": "max",
                "data-type": "cases 7-day average",
            })}).then((result) => {
                data = result.data.map(function(item) {
                    item.region = fixName(item.region)
                    item.date = "_"+item.date
                    return item
                })
                diseaseStats = result.stats
                diseaseMetadata = result.metadata

                maxRadius = Math.min(height, width) * 0.05
                radiusMap = d3.scaleLinear([0, diseaseStats.max], [0, maxRadius])

                diseaseGroups = {}
                diseaseMetadata.disease.forEach(disease => {
                    diseaseGroups[disease] = diseaseData.append("g").attr("id", disease + "-data").attr("class", "disease-data-group").raise()
                    // create checkbox
                    createDiseaseCheck(disease, diseaseColorMap(disease))
                })

                // draw legend
                drawLegend(diseaseStats, "disease", true)

                // setup bubbles
                data.forEach(element => {
                    temp = diseaseGroups[element.disease].selectAll(`.disease-bubble .${element.disease} .${element.date} .${element.region}`)
                    temp
                        .data([element])
                        .enter()
                        .append("circle")
                        .attr("class", `disease-bubble ${element.disease} ${element.date} ${element.region}`)
                        .attr("bubble-type", "disease")
                        .style("fill", diseaseColorMap(element.disease))
                        .style("stroke", diseaseColorMap(element.disease))
                        .each(function(d) {bubbleToolTip(d3.select(this))})
                });

        }).catch((err) => {console.log(err)})

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
                .style("opacity", 0)
                .lower()

                data = result.data.map(function(item) {
                    item["region"] = "_"+item["region"]
                    item["date"] = "_"+item["date"]
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
                drawLegend(hospitalStats, "hospital", false)

                // draw bubbles
                data.forEach(element => {
                    temp = diseaseGroups[element.disease].selectAll(`.hospital-bubble .${element.disease} .${element["date"]} .${element.region}`)
                    temp
                        .data([element])
                        .enter()
                        .append("circle")
                        .attr("class", `hospital-bubble ${element.disease} ${element["date"]} ${element.region}`)
                        .attr("bubble-type", "hospital")
                        .style("fill", diseaseColorMap(element.disease))
                        .style("stroke", diseaseColorMap(element.disease))
                        .each(function(d) {hospitalToolTip(d3.select(this))})
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
    
        mapSVG.selectAll(".disease-bubble").each(function(d) {
            maxRadius = Math.min(height, width) * 0.05
            radiusMap = d3.scaleLinear([0, diseaseStats.max], [0, maxRadius])
            mapCoords = mapProjection([d.INTPTLON, d.INTPTLAT])
            newPos = skew(mapCoords, maxRadius/5, diseaseIndexing[d.disease], numDiseases)
            d3.select(this)
                .attr("cx", newPos[0])
                .attr("cy", newPos[1])
                .attr("r", (d) => radiusMap(d.count))

            // updating legend stuff
            em = parseFloat(getComputedStyle(this).fontSize)
            mapSVG.select("#legends")
            .attr("transform", `translate(0 ${height}) scale(1 -1)`)

            mapSVG.selectAll(".legend.disease").select("circle")
                .attr("cx", (d) => (radiusMap(diseaseStats.max) * 2 + 10) * d[1] + radiusMap(d[0]) + Math.max(width/50, 30))
                .attr("cy", (d) => radiusMap(d[0]) + 2.5*em)
                .attr("r", (d) => radiusMap(d[0]))

            mapSVG.selectAll(".legend.disease").select("text")
                .attr("x", (d) => (radiusMap(diseaseStats.max) * 2 + 10) * d[1] + radiusMap(d[0]) + Math.max(width/50, 30))
                .attr("y", -em)
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

            mapSVG.selectAll(".legend.hospital").select("circle")
                .attr("cx", (d) => (radiusMap(hospitalStats.max) * 2 + 10) * d[1] + radiusMap(d[0]) + Math.max(width/50, 30))
                .attr("cy", (d) => radiusMap(d[0]) + 2.5*em)
                .attr("r", (d) => radiusMap(d[0]))

            mapSVG.selectAll(".legend.hospital").select("text")
                .attr("x", (d) => (radiusMap(hospitalStats.max) * 2 + 10) * d[1] + radiusMap(d[0]) + Math.max(width/50, 30))
                .attr("y", -em)
        })
    }

    setup().then(updateMap, (error) => {
        console.log("something bad happened during map resizing")
    })    
}


function drawLegend(stats, type, show) {
    mapSVG.select("#legends")
    .selectAll(`.legend.${type}`)
    .data([[stats.max / 3, 0], [stats.max * 2/3, 1], [stats.max, 2]])
    .enter()
    .append("g")
    .attr("class", `legend ${type}`)
    .style("opacity", +show)
    .each(function(d) {
        em = parseFloat(getComputedStyle(this).fontSize)
        d3.select(this).append("circle")
        
        d3.select(this).append("text")
        .text(f(d[0]))
    })
    resizeMap()
}


function drawDiseaseBubbles(dataType) {
    d3.json("/get-county-disease-data", { // covid county data
        "method": "POST",
        "headers": {"Content-Type": "application/json"},
        "body": JSON.stringify({
            "region-name": "all",
            "disease": "all",
            "date": "max",
            "data-type": `${dataType} 7-day average`,
        })}).then((result) => {
            data = result.data.map(function(item) {
                item.region = fixName(item.region)
                item.date = "_"+item.date
                return item
            })
            diseaseStats = result.stats
            diseaseMetadata = result.metadata

            maxRadius = Math.min(height, width) * 0.05
            radiusMap = d3.scaleLinear([0, diseaseStats.max], [0, maxRadius])
            
            mapSVG.selectAll(".disease-bubble")
                .data(data)
                .style("fill", (d) => diseaseColorMap(d.disease))
                .style("stroke", (d) => diseaseColorMap(d.disease))
            mapSVG.select("#legends")
                .selectAll(`.legend.disease`)
                .data([[diseaseStats.max / 3, 0], [diseaseStats.max * 2/3, 1], [diseaseStats.max, 2]])
                .each(function(d) {
                    d3.select(this).select("text").text(f(d[0]))
                })

            resizeMap()
    }).catch((err) => {console.log(err)})
}