
function displayMap() {
    var width = jsmapSVG.width.baseVal.value
    var height = jsmapSVG.height.baseVal.value
    
    d3.json("../../static/data/tl_2023_sc_county.json").then(function(mapdata) {d3.json("../../static/data/Hospitals.geojson").then(function(hospdata){
        mapProjection = d3.geoAlbers().fitExtent(
            [[margins.left, margins.top], [width-margins.right,height-margins.bottom]],
            mapdata)
        var pathGenerator = d3.geoPath(mapProjection)

        counties = mapSVG.append("g")
              .attr("id", "counties")
        counties.selectAll("path")
              .data(mapdata.features)
              .enter()
              .append("path")
              .attr("class", "county")
              .attr("id", d => d.properties.NAME.toLowerCase())
              .attr("d", d => pathGenerator(d))
              .style("fill", "var(--sl-color-gray-400)")

              hospitals = mapSVG.append("g")
              .attr("id", "hospitals")
        temp = null
        hospitals.selectAll("circle")
              .data(hospdata.features)
              .enter()
              .append("circle")
              .attr("class", "hospital")
              .attr("id", d => fixHospitalName(d.properties.webdbINFOHEALTHFACILITYLF_NAME))
              .attr("cx", (d) => mapProjection(d.geometry.coordinates)[0])
              .attr("cy", (d) => mapProjection(d.geometry.coordinates)[1])
              .attr("r", Math.min(width, height) * 0.005)
    })})
}

function resizeMap() {
    var width = jsmapSVG.width.baseVal.value
    var height = jsmapSVG.height.baseVal.value
    d3.json("../../static/data/tl_2023_sc_county.json").then(function(mapdata) {
        mapProjection = d3.geoAlbers().fitExtent(
            [[margins.left, margins.top], [width-margins.right,height-margins.bottom]],
            mapdata)
        var pathGenerator = d3.geoPath(mapProjection)

        // mapdata.features.forEach((areaData) => {
        //     d3.select("#" + areaData.properties.NAME.toLowerCase())
        //         .attr("d", pathGenerator(areaData))
        // })
        d3.selectAll(".county").each(function(item) {
            d3.select(this)
            .attr("d", (d) => pathGenerator(d))
        })

        d3.selectAll(".hospital").each(function(item) {
            d3.select(this)
              .attr("cx", (d) => mapProjection(d.geometry.coordinates)[0])
              .attr("cy", (d) => mapProjection(d.geometry.coordinates)[1])
              .attr("r", Math.min(width, height) * 0.005)
        })
    })
}