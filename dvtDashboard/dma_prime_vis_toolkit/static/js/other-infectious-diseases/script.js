
var unknownColor = d3.hsl("#CCCCCC")

function parseDate(datestring) {
    return dayjs.tz(datestring, "YYYY-MM-DD", "America/New_York").toDate()
}

function createBarGraph(svg, data, height, width) {
    svg
        .attr("height", height)
        .attr("width", width)

    var graphSVG = svg.append("svg")
        .attr("class", "tooltip-graph-svg")
        .attr("height", height)
        .attr("width", width)

    var yAxis = svg.append("g")
        .attr("class", "y-axis")
    var xAxis = svg.append("g")
        .attr("class", "x-axis")
        
    // figure out how much space is needed for the y-axis text
    var temp = svg.append("text").text(d3.format(".2r")(d3.max(data.data))).attr("x", 0).attr("y", 0)
    var margins = {
        "top": .5*em, 
        "bottom": 1.5*em,
        "left": Math.max(20, temp.node().getBBox().width) + 1.25*em,
        "right": .5*em,
    }

    var yScale = d3.scaleLinear()
        .domain([0, d3.max(data.data)])
        .nice()
        .range([height-margins.bottom, margins.top])

    var start_date = parseDate(zctaData.metadata.start_date)
    var xScale = d3.scaleUtc()
        .domain([start_date, d3.utcDay.offset(start_date, (7 * data.data.length))])
        .nice()
        .range([margins.left, width - margins.right])

    graphSVG.selectAll("rect")
        .data(data.data)
        .enter()
        .append("rect")
        .attr("x", (d, i) => xScale(d3.utcDay.offset(start_date, (7 * i))))
        .attr("y", d => yScale(d))
        .attr("height", d => yScale(0) - yScale(d))
        .attr("width", (width - (margins.left + margins.right)) / data.data.length)
        .attr("fill", "red")

    yAxis.append("text")
        .attr("transform", `translate(${1*em},${yScale(d3.mean(yScale.domain()))})rotate(-90)`)
        .attr("text-anchor", "middle")
        .attr("fill", "var(--sl-color-neutral-1000)")
        .attr("font-size", "var(--sl-font-size-small)")
        .text("Encounters")
        
    yAxis.append("g")
        .attr("transform", `translate(${margins.left},0)`)
        .call(d3.axisLeft(yScale).ticks(5).tickSize(4))
        .selectAll("text")
        .attr("class", "tooltip-label")
        .attr("fill", "var(--sl-color-neutral-1000)")

    xAxis.call(d3.axisBottom(xScale).tickArguments([d3.timeYear.every(1), d3.timeFormat("%Y")]))
        .attr("transform", `translate(0, ${height - margins.bottom})`)
    
}