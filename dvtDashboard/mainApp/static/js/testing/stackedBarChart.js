jsmapSVG = document.getElementById("map")
mapSVG = d3.select("#map")

stackedBarChartGroup = mapSVG.append("g")

dimensions = {
    "x": 100,
    "y": 100,
    "height": 50,
    "width": 50,
}

stackedBarChartGroup.append("rect")
    .attr("id", "bar-chart-background")
    .attr("x", dimensions.x)
    .attr("y", dimensions.y)
    .attr("width", dimensions.width)
    .attr("height", dimensions.height)

stackedBarChartGroup.append("rect")
    .attr("id", "regular-bed-capacity")
    .attr("x", dimensions.x)
    .attr("y", dimensions.y + (dimensions.height-35))
    .attr("width", dimensions.width/2)
    .attr("height", 35)
    .style("fill", "blue")

stackedBarChartGroup.append("rect")
    .attr("id", "icu-bed-capacity")
    .attr("x", dimensions.x + dimensions.width/2)
    .attr("y", dimensions.y + (dimensions.height-5))
    .attr("width", dimensions.width/2)
    .attr("height", 5)
    .style("fill", "red")


bedUseTimeseriesGlyph = mapSVG.append("g")
dimensions2 = {
    "x": 500,
    "y": 100,
    "height": 50,
    "width": 50,
}

regularBedData = Array.from({length: 30}, () => Math.random())
icuBedData = Array.from({length: 30}, () => Math.random())
unoccupied = regularBedData.map(function(e, i) {
    return 2 - (e + icuBedData[i])
})


bedUseTimeseriesGlyph.append("rect")
    .attr("id", "bar-chart-glyph-background")
    .attr("x", dimensions2.x)
    .attr("y", dimensions2.y)
    .attr("width", dimensions2.width)
    .attr("height", dimensions2.height)

timeBarsGroup = bedUseTimeseriesGlyph.append("g")
    .attr("id", "time-bars")

regularBedData.forEach(function(e, i) {
    regularBedHeight = e * dimensions2.height/2
    timeBarsGroup.append("rect")
        .attr("x", dimensions2.x + i * (dimensions2.width/30))
        .attr("y", dimensions2.y + (dimensions2.height/2))
        .attr("width", dimensions2.width/30)
        .attr("height", regularBedHeight)
        .style("fill", "blue")

    icuBedHeight = icuBedData[i] * dimensions2.height/2
    timeBarsGroup.append("rect")
        .attr("x", dimensions2.x + i * (dimensions2.width/30))
        .attr("y", dimensions2.y + dimensions2.height/2 - icuBedHeight)
        .attr("width", dimensions2.width/30)
        .attr("height", icuBedHeight)
        .style("fill", "red")
    console.log(e, i)
})