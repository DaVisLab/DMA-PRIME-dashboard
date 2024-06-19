
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
                .on("mouseenter", function(e) {
                    toolTipCreator(this, e)
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
                stats = JSON.parse(result.stats)
                metadata = JSON.parse(result.metadata)

                numDiseases = metadata.disease.length

                maxRadius = Math.min(height, width) * 0.05
                radiusMap = d3.scaleLinear([stats.min, stats.max], [0, maxRadius])
                diseaseColorMap = d3.scaleOrdinal().domain(metadata.disease).range(d3.schemeSet1)

                diseaseGroups = {}
                metadata.disease.forEach(disease => {
                    diseaseGroups[disease] = diseaseData.append("g").attr("id", disease + "-data").attr("class", "disease-data-group")
                    diseaseIndexing[disease] = Object.keys(diseaseGroups).length
                    // create checkbox
                    createDiseaseCheck(disease)
                })
                data.forEach(element => {
                    temp = diseaseGroups[element[0][1]].selectAll(".disease-bubble." + element[0].join("."))
                    temp
                        .data([element])
                        .enter()
                        .append("circle")
                        .attr("class", (d) => {
                            return "disease-bubble " + d[0].join(" ")})
                        .attr("cx", (d) => getGeoCenterPos(d[0][0]).x)
                        .attr("cy", (d) => getGeoCenterPos(d[0][0]).y)
                        .attr("r", (d) => radiusMap(d[1]))
                        .style("fill", d => diseaseColorMap(d[0][1]))
                        .style("fill-opacity", .25)
                        .style("stroke", d => diseaseColorMap(d[0][1]))
                        .style("stroke-width", 3)
                        .style("stroke-opacity", .3)
                });

            }).catch((err) => {console.log(err)})
        
    }).then(() => {
        console.log('resizepls')
        resizeMap()})
}

function resizeMap() {
    width = jsmapSVG.width.baseVal.value
    height = jsmapSVG.height.baseVal.value
    mapProjection = d3.geoAlbers().fitExtent(
        [[margins.left, margins.top], [width-margins.right,height-margins.bottom]],
        mapData)
    pathGenerator = d3.geoPath(mapProjection)

    d3.selectAll(".county").each(function(item) {
        d3.select(this)
        .attr("d", (d) => pathGenerator(d))
    })

    d3.selectAll(".hospital").each(function(item) {
        hospSize = Math.max(16, Math.min(width, height) * 0.015)
        d3.select(this)
            .attr("width", hospSize)
            .attr("height", hospSize)
            .attr("x", (d) => mapProjection(d.geometry.coordinates)[0] - hospSize/2)
            .attr("y", (d) => mapProjection(d.geometry.coordinates)[1] - hospSize/2)
    })

    d3.selectAll(".disease-bubble").each(function(d) {
        maxRadius = Math.min(height, width) * 0.05
        radiusMap = d3.scaleLinear([stats.min, stats.max], [0, maxRadius])
        ogPos = getGeoCenterPos(d[0][0])
        newPos = stack.checked ? ogPos : skew(ogPos, maxRadius/5, diseaseIndexing[d[0][1]], numDiseases)
        d3.select(this)
            .attr("cx", newPos.x)
            .attr("cy", (d) => newPos.y)
            .attr("r", (d) => radiusMap(d[1]))
    })
}