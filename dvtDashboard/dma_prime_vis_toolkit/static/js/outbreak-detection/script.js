var unknownColor = d3.hsl("#CCCCCC")

function parseDate(datestring) {
    return dayjs(datestring, "YYYY-MM-DD").toDate()
}

function getBoundsOfCoords(coordinates) {
    var bounds = new maplibregl.LngLatBounds()
    function addCoordToBounds(bounds, arr) {
        if (Array.isArray(arr[0])) {
            arr.forEach(a => {
                addCoordToBounds(bounds, a)
            })
        } else {
            bounds.extend(arr)
            return
        }
    }
    addCoordToBounds(bounds, coordinates)
    return bounds
}

function getCenter(feature) {
    var coordinates = [feature.properties.INTPTLON, feature.properties.INTPTLAT]

    if (!(coordinates[0] && coordinates[1])) {
        coordinates = getBoundsOfCoords(feature.geometry.coordinates).getCenter()
        coordinates = [coordinates.lng, coordinates.lat]
    } else {
        coordinates[0] = fixCoord(coordinates[0])
        coordinates[1] = fixCoord(coordinates[1])    
    }
    return coordinates
}

function fixCoord(coord) {
    while (coord[1] == "0") {
        coord = coord[0] + coord.slice(2)
    }
    return parseFloat(coord)
}

function createBarGraph(svg, data, metadata, height, width, altMargins) {
    svg
    .attr("class", "tooltip-graph-svg")
    .attr("preserveAspectRatio", "none")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet"); 
    

  // 2) Use the same svg as your drawing surface
    const graphSVG = svg;

  // 3) Now append your axes and bars onto graphSVG:
    const yAxis = graphSVG.append("g").attr("class", "y-axis");
    const xAxis = graphSVG.append("g").attr("class", "x-axis");
    
    var minMaxVal = mapRateSwitch.value == "rate" ? 1000.0/data.population : 1
    var maxVal = d3.max(data.data) ? d3.max(data.data) : minMaxVal
    // maxVal = d3.max(data.other) ? Math.max(maxVal, d3.max(data.other)) : maxVal

    // figure out how much space is needed for the y-axis text
    var temp = svg.append("text").text(d3.format(".2r")(maxVal)).attr("x", 0).attr("y", 0)

    var margins = {
        "top": .5*em, 
        "bottom": 1.5*em,
        "left": 1.25*em,
        "right": .5*em,
    }
    margins.left += Math.max(20, temp.node().getBBox().width)

    if (mapColumnSwitch.value == "pos_tests") {
        var percentages = data.data.map((pos_test, i) => pos_test / Math.max(data.other[i], 1))
        temp.text(d3.format(".0%")(1))
        margins.right += Math.max(10, temp.node().getBBox().width) + .75*em
    }

    var yScale = d3.scaleLinear()
        .domain([0, maxVal])
        .nice()
        .range([height-margins.bottom, margins.top])

    var start_date = parseDate(metadata.start_date)
    var xScale = d3.scaleTime()
        .domain([start_date, parseDate(metadata.end_date)])
        .nice()
        .range([margins.left, width - margins.right])

    // graphSVG.append("g").selectAll("rect")
    //     .data(data.other)
    //     .enter()
    //     .append("rect")
    //     .attr("x", (d, i) => xScale(d3.timeDay.offset(start_date, (7 * i))))
    //     .attr("y", d => yScale(d))
    //     .attr("height", d => yScale(0) - yScale(d))
    //     .attr("width", (width - (margins.left + margins.right)) / data.data.length)
    //     .attr("fill", "var(--sl-color-neutral-400)")

    graphSVG.append("g").selectAll("rect")
        .data(data.data)
        .enter()
        .append("rect")
        .attr("x", (d, i) => xScale(d3.timeDay.offset(start_date, (7 * i))))
        .attr("y", d => yScale(d))
        .attr("height", d => yScale(0) - yScale(d))
        .attr("width", (width - (margins.left + margins.right)) / data.data.length)
        .attr("fill", "var(--sl-color-neutral-1000)")

    yAxis.append("text")
        .attr("transform", `translate(${1*em},${yScale(d3.mean(yScale.domain()))})rotate(-90)`)
        .attr("text-anchor", "middle")
        .attr("fill", "var(--sl-color-neutral-1000)")
        .attr("font-size", "var(--sl-font-size-small)")
        // .text(mapColumnSwitch.value == "pos_tests" ? "Tests" : d3.select(`sl-option[value=${mapColumnSwitch.value}]`).html())
        .text(d3.select(`sl-option[value=${mapColumnSwitch.value}]`).html())
        
    // ────────────────────────────────────────────────
    // Replace the single-axis call with filtering-out duplicate labels:
    // ────────────────────────────────────────────────

    // 1) Ask D3 for up to 5 “nice” tick values
    let rawTicks = yScale.ticks(5) // e.g. [0, 0.005, 0.01, 0.015, 0.02]
    
    // 2) Choose a formatting function based on how large maxVal is
    let formatTick
    if (maxVal >= 100) {
      formatTick = d3.format(",.0f")  // e.g. “1,234”
    } else if (maxVal >= 1) {
      formatTick = d3.format(",.1f")  // e.g. “12.3”
    } else {
      formatTick = d3.format(".2f")   // e.g. “0.12”
    }

    // 3) Filter out any tick whose formatted label duplicates the previous
    const filteredTicks = []
    rawTicks.forEach((v, i) => {
      const label = formatTick(v)
      if (i === 0 || label !== formatTick(rawTicks[i - 1])) {
        filteredTicks.push(v)
      }
    })

    // 4) Draw only those unique-label ticks
    yAxis.append("g")
        .attr("transform", `translate(${margins.left},0)`)
        .call(
          d3.axisLeft(yScale)
            .tickValues(filteredTicks)  // only unique values
            .tickSize(4)
        )
        .selectAll("text")
        .attr("class", "tooltip-label")
        .attr("fill", "var(--sl-color-neutral-1000)")

    xAxis.call(d3.axisBottom(xScale).tickArguments([d3.timeYear.every(1), d3.timeFormat("%Y")]))
        .attr("transform", `translate(0, ${height - margins.bottom})`)

    if (mapColumnSwitch.value == "pos_tests") {
        var yScale2 = d3.scaleLinear()
            .domain([0, 1])
            .nice()
            .range([height-margins.bottom, margins.top])

        var yAxis2 = svg.append("g")
            .attr("class", "y-axis")
        
        var percentageGroup = graphSVG.append("g")

          const line = d3.line()
            .x((_, i) => xScale(d3.timeDay.offset(start_date, (7 * i))))
            .y((d) => yScale2(d))

        percentageGroup.append("path")
            .attr("d", line(percentages))
            .style("stroke", "blue")
            .attr("fill", "none")
            .attr("stroke-width", 1)

        yAxis2.append("text")
            .attr("transform", `translate(${width-em},${yScale(d3.mean(yScale.domain()))})rotate(90)`)
            .attr("text-anchor", "middle")
            .attr("fill", "blue")
            .attr("font-size", "var(--sl-font-size-small)")
            .text("Percent Positive Tests")
            
        var yAxis2Axis = yAxis2.append("g")
            .attr("transform", `translate(${xScale.range()[1]},0)`)
            .call(d3.axisRight(yScale2).ticks(5, ".0%").tickSize(4))
        yAxis2Axis.selectAll("text")
            .attr("class", "tooltip-label")
            .attr("fill", "blue")
        yAxis2Axis.selectAll("line,path")
            .style("stroke", "blue")
        
        var legend = svg.append("g")
        legend.attr("transform", `translate(${xScale.range()[0] + .5*em}, 0)`)
        var posTest = legend.append("g")
        posTest.append("rect")
            .attr("height", .5*em)
            .attr("width", .5*em)
            .attr("x", 0)
            .attr("y", .5*em/4)
            .attr("fill", "var(--sl-color-neutral-1000)")
        posTest.append("text")
            .attr("x", .5*1.5*em)
            .attr("y", em/2)
            .attr("dominant-baseline", "middle")
            .attr("fill", "var(--sl-color-neutral-1000)")
            .style("font-size", "var(--sl-font-size-small)")
            .text("Positive Tests")
        var test = legend.append("g")
        // test.attr("transform", `translate(0, ${em})`)
        // test.append("rect")
        //     .attr("height", .5*em)
        //     .attr("width", .5*em)
        //     .attr("x", 0)
        //     .attr("y", .5*em/4)
        //     .attr("fill", "var(--sl-color-neutral-400)")
        // test.append("text")
        //     .attr("x", .5*1.5*em)
        //     .attr("y", em/2)
        //     .attr("dominant-baseline", "middle")
        //     .attr("fill", "var(--sl-color-neutral-1000)")
        //     .style("font-size", "var(--sl-font-size-small)")
        //     .text("Tests")
        var percentPosTest = legend.append("g")
        percentPosTest.attr("transform", `translate(0, ${em})`)
        // percentPosTest.attr("transform", `translate(0, ${2*em})`)
        percentPosTest.append("line")
            .attr("x1", 0)
            .attr("x2", .5*em)
            .attr("y1", .5*em)
            .attr("y2", .5*em)
            .attr("stroke", "blue")
        percentPosTest.append("text")
            .attr("x", .5*1.5*em)
            .attr("y", em/2)
            .attr("dominant-baseline", "middle")
            .attr("fill", "blue")
            .style("font-size", "var(--sl-font-size-small)")
            .text("Percent Positive Tests")
        
    }

    temp.remove()
    
}
