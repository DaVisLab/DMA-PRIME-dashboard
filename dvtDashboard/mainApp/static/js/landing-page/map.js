
function displayMap() {
    width = jsmapSVG.width.baseVal.value
    height = jsmapSVG.height.baseVal.value
    
    d3.json("../../static/data/tl_2023_sc_county.json").then(function(mapdata) {
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
              .style("fill", "var(--sl-color-gray-400)")
                .each(function(element) {
                    toolTipCreator(this)
                })

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
              .attr("width", hospSize)
              .attr("height", hospSize)
              .attr("x", (d) => mapProjection(d.geometry.coordinates)[0] - hospSize)
              .attr("y", (d) => mapProjection(d.geometry.coordinates)[1] - hospSize)
              .attr("viewBox", "0 0 16 16")
              .each(function(d) {
                this.innerHTML = makeHospital(fixName(d.properties.webdbINFOHEALTHFACILITYLF_NAME))
              })
        })

        diseaseData = mapSVG.append("g")
            .attr("id", "disease-data")
        
        d3.json("/get-real-disease-data", { // covid county data
            "method": "POST",
            "headers": {"Content-Type": "application/json"},
            "body": JSON.stringify({
                'region-size': 'county',
                'region-name': 'all',
                'disease': 'all',
                'date': 'max',
                'data-type': 'cases 7-day averange',
            })}).then((result) => {
                data = JSON.parse(result.data)
                data = Object.keys(data).map((key) => [key, data[key]])
                data = data.map(function(item) {
                    attributes = formatTuple(item[0])
                    attributes[0] = fixName(attributes[0])
                    attributes[2] = '_'+attributes[2]
                    return [attributes, item[1]]
                })
                diseaseStats = JSON.parse(result.stats)
                diseaseMetadata = JSON.parse(result.metadata)

                numDiseases = diseaseMetadata.disease.length

                maxRadius = Math.min(height, width) * 0.05
                radiusMap = d3.scaleLinear([0, diseaseStats.max], [0, maxRadius])
                diseaseColorMap = d3.scaleOrdinal().domain(diseaseMetadata.disease).range(d3.schemeSet1)

                diseaseGroups = {}
                diseaseMetadata.disease.forEach(disease => {
                    diseaseGroups[disease] = diseaseData.append("g").attr("id", disease + "-data").attr("class", "disease-data-group").raise()
                    diseaseIndexing[disease] = Object.keys(diseaseGroups).length
                    // create checkbox
                    createDiseaseCheck(disease, diseaseColorMap(disease))
                })

                // draw legend
                mapSVG.append("g")
                .attr("id", "legends")
                .attr("transform", `translate(0 ${height}) scale(1 -1)`)
                .selectAll(".legend.disease")
                .data([[diseaseStats.max / 3, 0], [diseaseStats.max * 2/3, 1], [diseaseStats.max, 2]])
                .enter()
                .append("g")
                .attr("class", "legend disease")
                .each(function(d) {
                    f = d3.format(".2f")
                    em = parseFloat(getComputedStyle(this).fontSize)
                    d3.select(this).append("circle")
                    .attr("cx", (radiusMap(diseaseStats.max) * 2 + 10) * d[1] + radiusMap(d[0]) + width/50)
                    .attr("cy", (d) => radiusMap(d[0]) + 2.5*em)
                    .attr("r", radiusMap(d[0]))
                    .style("fill", "var(--sl-color-neutral-500)")
                    .style("fill-opacity", .25)
                    .style("stroke", "var(--sl-color-neutral-600)")
                    .style("stroke-width", 3)
                    .style("stroke-opacity", .3)
                    
                    d3.select(this).append("text")
                    .attr("x", (radiusMap(diseaseStats.max) * 2 + 10) * d[1] + radiusMap(d[0]) + width/50)
                    .attr("y", - em)
                    .attr("text-anchor", "middle")
                    .style("transform", "scaleY(-1)")
                    .text(f(d[0]))
                })

                // draw bubbles
                data.forEach(element => {
                    temp = diseaseGroups[element[0][1]].selectAll(".disease-bubble." + element[0].join("."))
                    temp
                        .data([element])
                        .enter()
                        .append("circle")
                        .attr("class", (d) => {
                            return "disease-bubble " + d[0].join(" ")})
                        .attr("cx", (d) => skew(getGeoCenterPos(d[0][0]), maxRadius/5, diseaseIndexing[d[0][1]], numDiseases)[0])
                        .attr("cy", (d) => skew(getGeoCenterPos(d[0][0]), maxRadius/5, diseaseIndexing[d[0][1]], numDiseases)[1])
                        .attr("r", (d) => radiusMap(d[1]))
                        .style("fill", d => diseaseColorMap(d[0][1]))
                        .style("fill-opacity", .25)
                        .style("stroke", d => diseaseColorMap(d[0][1]))
                        .style("stroke-width", 3)
                        .style("stroke-opacity", .3)
                });

            }).catch((err) => {console.log(err)})

            d3.json("/get-hospital-zcta-data", { // covid county data
                "method": "POST",
                "headers": {"Content-Type": "application/json"},
                "body": JSON.stringify({
                    'region-name': 'all',
                    'disease': 'all',
                    'date': 'max',
                })}).then((result) => { 
                    hospitalData = mapSVG.append("g")
                    .attr("id", "hospital-data")
                    .style("opacity", 0)

                    data = JSON.parse(result.data)
                    data = Object.keys(data).map((key) => [key, data[key]])
                    data = data.map(function(item) {
                            attributes = formatTuple(item[0])
                            attributes[0] = '_'+attributes[0]
                            attributes[2] = '_'+attributes[2]
                            return [attributes, item[1]]
                    })
                    hospitalStats = JSON.parse(result.stats)
                    hospitalMetadata = JSON.parse(result.metadata)

                    maxRadius = Math.min(height, width) * 0.05
                    radiusMap = d3.scaleLinear([0, hospitalStats.max], [0, maxRadius])
                    diseaseColorMap = d3.scaleOrdinal().domain(hospitalMetadata.disease).range(d3.schemeSet1)

                    diseaseGroups = {}
                    hospitalMetadata.disease.forEach(disease => {
                        diseaseGroups[disease] = hospitalData.append("g").attr("id", disease + "-hospital-data").attr("class", "hospital-data-group").raise()
                        diseaseIndexing[disease] = Object.keys(diseaseGroups).length
                        // create checkbox
                        createHospitalCheck(disease, diseaseColorMap(disease))
                    })
                    
                    // draw legend
                    d3.select("#legends")
                    .selectAll(".legend.hospital")
                    .data([[hospitalStats.max / 3, 0], [hospitalStats.max * 2/3, 1], [hospitalStats.max, 2]])
                    .enter()
                    .append("g")
                    .attr("class", "legend hospital")
                    .style("opacity", 0)
                    .each(function(d) {
                        f = d3.format(".2f")
                        em = parseFloat(getComputedStyle(this).fontSize)
                        d3.select(this).append("circle")
                        .attr("cx", (radiusMap(hospitalStats.max) * 2 + 10) * d[1] + radiusMap(d[0]) + width/50)
                        .attr("cy", (d) => radiusMap(d[0]) + 2.5*em)
                        .attr("r", radiusMap(d[0]))
                        .style("fill", "var(--sl-color-neutral-500)")
                        .style("fill-opacity", .25)
                        .style("stroke", "var(--sl-color-neutral-600)")
                        .style("stroke-width", 3)
                        .style("stroke-opacity", .3)
                        
                        d3.select(this).append("text")
                        .attr("x", (radiusMap(hospitalStats.max) * 2 + 10) * d[1] + radiusMap(d[0]) + width/50)
                        .attr("y", - em)
                        .attr("text-anchor", "middle")
                        .style("transform", "scaleY(-1)")
                        .text(f(d[0]))
                    })

                    // draw bubbles
                    data.forEach(element => {
                        temp = diseaseGroups[element[0][1]].selectAll(".hospital-bubble." + element[0].join("."))
                        temp
                            .data([element])
                            .enter()
                            .append("circle")
                            .attr("class", (d) => {
                                return "hospital-bubble " + d[0].join(" ")})
                            .attr("cx", (d) => skew(mapProjection([d[1].INTPTLON20, d[1].INTPTLAT20]), maxRadius/5, diseaseIndexing[d[0][1]], numDiseases)[0])
                            .attr("cy", (d) => skew(mapProjection([d[1].INTPTLON20, d[1].INTPTLAT20]), maxRadius/5, diseaseIndexing[d[0][1]], numDiseases)[1])
                            .attr("r", (d) => radiusMap(d[1].count))
                            .style("fill", d => diseaseColorMap(d[0][1]))
                            .style("fill-opacity", .25)
                            .style("stroke", d => diseaseColorMap(d[0][1]))
                            .style("stroke-width", 3)
                            .style("stroke-opacity", .3)
                        });
            })
    }).then(() => {
        console.log('resizepls')
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
        d3.selectAll(".county").each(function(item) {
            d3.select(this)
            .attr("d", (d) => pathGenerator(d))
        })
    
        d3.select("#hospitals").selectAll(".hospital").each(function(item) {
            hospSize = Math.max(16, Math.min(width, height) * 0.015)
            d3.select(this)
                .attr("width", hospSize)
                .attr("height", hospSize)
                .attr("x", (d) => mapProjection(d.geometry.coordinates)[0] - hospSize/2)
                .attr("y", (d) => mapProjection(d.geometry.coordinates)[1] - hospSize/2)
        })
    
        d3.selectAll(".disease-bubble").each(function(d) {
            maxRadius = Math.min(height, width) * 0.05
            radiusMap = d3.scaleLinear([0, diseaseStats.max], [0, maxRadius])
            mapCoords = getGeoCenterPos(d[0][0])
            newPos = skew(mapCoords, maxRadius/5, diseaseIndexing[d[0][1]], numDiseases)
            d3.select(this)
                .attr("cx", newPos[0])
                .attr("cy", (d) => newPos[1])
                .attr("r", (d) => radiusMap(d[1]))

            // updating legend stuff
            f = d3.format(".2f")
            em = parseFloat(getComputedStyle(this).fontSize)
            d3.select("#legends")
            .attr("transform", `translate(0 ${height}) scale(1 -1)`)

            d3.selectAll(".legend.disease").select("circle")
                .attr("cx", (d) => (radiusMap(diseaseStats.max) * 2 + 10) * d[1] + radiusMap(d[0]) + Math.max(width/50, 30))
                .attr("cy", (d) => radiusMap(d[0]) + 2.5*em)
                .attr("r", (d) => radiusMap(d[0]))

            d3.selectAll(".legend.disease").select("text")
                .attr("x", (d) => (radiusMap(diseaseStats.max) * 2 + 10) * d[1] + radiusMap(d[0]) + Math.max(width/50, 30))
                .attr("y", -em)
        })
    
        d3.selectAll(".hospital-bubble").each(function(d) {
            maxRadius = Math.min(height, width) * 0.025
            radiusMap = d3.scaleLinear([0, hospitalStats.max], [0, maxRadius])
            mapCoords = mapProjection([d[1].INTPTLON20, d[1].INTPTLAT20])
            newPos = skew(mapCoords, maxRadius/5, diseaseIndexing[d[0][1]], numDiseases)
            d3.select(this)
                .attr("cx", newPos[0])
                .attr("cy", newPos[1])
                .attr("r", (d) => radiusMap(d[1].count))

            // updating legend stuff
            f = d3.format(".2f")
            em = parseFloat(getComputedStyle(this).fontSize)
            d3.select("#legends")
            .attr("transform", `translate(0 ${height}) scale(1 -1)`)

            d3.selectAll(".legend.hospital").select("circle")
                .attr("cx", (d) => (radiusMap(hospitalStats.max) * 2 + 10) * d[1] + radiusMap(d[0]) + Math.max(width/50, 30))
                .attr("cy", (d) => radiusMap(d[0]) + 2.5*em)
                .attr("r", (d) => radiusMap(d[0]))

            d3.selectAll(".legend.hospital").select("text")
                .attr("x", (d) => (radiusMap(hospitalStats.max) * 2 + 10) * d[1] + radiusMap(d[0]) + Math.max(width/50, 30))
                .attr("y", -em)
        })
    }

    setup().then(updateMap, (error) => {
        console.log("something bad happened during map resizing")
    })    
}