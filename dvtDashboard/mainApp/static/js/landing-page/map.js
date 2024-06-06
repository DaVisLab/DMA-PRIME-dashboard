
function displayMap() {
    var width = jsmapSVG.width.baseVal.value
    var height = jsmapSVG.height.baseVal.value
    
    d3.json("../../static/data/tl_2023_sc_county.json").then(function(mapdata) {
        var projection = d3.geoAlbers().fitExtent(
            [[margins.left, margins.top], [width-margins.right,height-margins.bottom]],
            mapdata)
        var pathGenerator = d3.geoPath(projection)

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
    })
}

function resizeMap() {
    var width = jsmapSVG.width.baseVal.value
    var height = jsmapSVG.height.baseVal.value
    d3.json("../../static/data/tl_2023_sc_county.json").then(function(mapdata) {
        var projection = d3.geoAlbers().fitExtent(
            [[margins.left, margins.top], [width-margins.right,height-margins.bottom]],
            mapdata)
        var pathGenerator = d3.geoPath(projection)

        mapdata.features.forEach((areaData) => {
            d3.select("#" + areaData.properties.NAME.toLowerCase())
                .attr("d", pathGenerator(areaData))
        })
        
    })
}