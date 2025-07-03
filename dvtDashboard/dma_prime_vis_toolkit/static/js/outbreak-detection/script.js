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

function createBarGraph(svg, data, metadata, height, width, options = {}) {
    const isLargeTooltip = options && options.isLargeTooltip;
    const extraBottom = isLargeTooltip ? 25 : 15;
    height = height + extraBottom;
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
        "bottom": 1.5*em + extraBottom,
        "left": 1*em,
        "right": 0*em,
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

    // ────────────────────────────────────────────────
    // Replace the single-axis call with filtering-out duplicate labels:
    // ────────────────────────────────────────────────

    // 1) Ask D3 for up to 8 "nice" tick values for a balanced axis (applies to both small and large tooltips)
    let rawTicks = yScale.ticks(8); // Up to 8 ticks for balance
    
    // 2) Choose a formatting function based on how large maxVal is
    let formatTick
    if (maxVal >= 100) {
      formatTick = d3.format(",.0f")  // e.g. "1,234"
    } else if (maxVal >= 1) {
      formatTick = d3.format(",.1f")  // e.g. "12.3"
    } else {
      formatTick = d3.format(".2f")   // e.g. "0.12"
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
    const yTickGroup = yAxis.append("g")
        .attr("transform", `translate(${margins.left},0)`)
        .call(
          d3.axisLeft(yScale)
            .tickValues(filteredTicks)
            .tickSize(4)
        );
    yTickGroup.selectAll("text")
        .attr("class", "tooltip-label")
        .attr("fill", "var(--sl-color-neutral-1000)")
        .style("font-size", isLargeTooltip ? "var(--sl-font-size-x-small)" : "var(--sl-font-size-small)");
    // Dynamically offset left y-axis label just outside widest tick label
    const yTickTexts = yTickGroup.selectAll("text").nodes();
    const maxTickWidth = Math.max(...yTickTexts.map(t => t.getBBox().width), 30);
    let labelPadding, minOffset;
    if (isLargeTooltip) {
        labelPadding = -120;   // more space for large tooltip
        minOffset = 8;        // more space from edge in large tooltip
        var minAxisOffset = -100; // always at least 40px left of axis
    } else {
        labelPadding = -30; // close to ticks in normal tooltip
        minOffset = 4;      // minimal space in normal tooltip
        var minAxisOffset = null;
    }
    let leftLabelOffset;
    if (isLargeTooltip) {
        leftLabelOffset = -10; // always 100px left of axis in large tooltip
    } else {
        leftLabelOffset = -maxTickWidth + labelPadding;
        if (leftLabelOffset < minOffset) leftLabelOffset = minOffset;
    }
    yAxis.append("text")
        .attr("transform", `translate(${leftLabelOffset},${(yScale.range()[0] + yScale.range()[1]) / 2})rotate(-90)`)
        .attr("text-anchor", "middle")
        .attr("fill", "var(--sl-color-neutral-1000)")
        .attr("font-size", isLargeTooltip ? "var(--sl-font-size-x-small)" : "var(--sl-font-size-small)")
        .text(d3.select(`sl-option[value=${mapColumnSwitch.value}]`).html());

    // Always show all years, slant labels for both tooltips
    xAxis.call(d3.axisBottom(xScale).ticks(d3.timeYear.every(1)).tickFormat(d3.timeFormat("%Y")))
        .attr("transform", `translate(0, ${height - margins.bottom})`)
        .selectAll("text")
        .style("font-size", "var(--sl-font-size-x-small)")
        .attr("transform", "rotate(-40)")
        .style("text-anchor", "end");

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

        // Right y-axis label (percent positive): fixed  padding from axis
        const rightLabelPadding = 48;
        yAxis2.append("text")
            .attr("transform", `translate(${xScale.range()[1] + rightLabelPadding},${(yScale2.range()[0] + yScale2.range()[1]) / 2})rotate(90)`)
            .attr("text-anchor", "middle")
            .attr("fill", "blue")
            .attr("font-size", isLargeTooltip ? "var(--sl-font-size-x-small)" : "var(--sl-font-size-small)")
            .text("Percent Positive Tests");
        
        // Restore the right y-axis with blue ticks and percent labels
        var yAxis2Axis = yAxis2.append("g")
            .attr("transform", `translate(${xScale.range()[1]},0)`)
            .call(d3.axisRight(yScale2).ticks(5, ".0%").tickSize(4));
        yAxis2Axis.selectAll("text")
            .attr("class", "tooltip-label")
            .attr("fill", "blue");
        yAxis2Axis.selectAll("line,path")
            .style("stroke", "blue");
    }

    // Restore original legend position: top left, stacked vertically
    var legend = svg.append("g");
    legend.attr("transform", `translate(${xScale.range()[0] + .5*em}, 0)`);
    var posTest = legend.append("g");
    posTest.append("rect")
        .attr("height", .5*em)
        .attr("width", .5*em)
        .attr("x", 0)
        .attr("y", .5*em/4)
        .attr("fill", "var(--sl-color-neutral-1000)");
    posTest.append("text")
        .attr("x", .5*1.5*em)
        .attr("y", em/2)
        .attr("dominant-baseline", "middle")
        .attr("fill", "var(--sl-color-neutral-1000)")
        .style("font-size", isLargeTooltip ? "var(--sl-font-size-x-small)" : "var(--sl-font-size-small)")
        .text("Positive Tests");
    var percentPosTest = legend.append("g");
    percentPosTest.attr("transform", `translate(0, ${em})`);
    percentPosTest.append("line")
        .attr("x1", 0)
        .attr("x2", .5*em)
        .attr("y1", .5*em)
        .attr("y2", .5*em)
        .attr("stroke", "blue");
    percentPosTest.append("text")
        .attr("x", .5*1.5*em)
        .attr("y", em/2)
        .attr("dominant-baseline", "middle")
        .attr("fill", "blue")
        .style("font-size", isLargeTooltip ? "var(--sl-font-size-x-small)" : "var(--sl-font-size-small)")
        .text("Percent Positive Tests");

    temp.remove()
    
}

function drawTooltip(dataObject) {
    var width = mapDiv.clientWidth;
    var mapTooltipWidth = Math.max(500, width * .3);
    var mapTooltipHeight = mapTooltipWidth * .65 + 30;
    const ttpSVG = ttpDiv
      .append("svg")
      .attr("id", "map-tooltip-svg")
      .attr("class", "tooltip-outer-svg")
      .attr("width", mapTooltipWidth)
      .attr("height", mapTooltipHeight);
    createBarGraph(ttpSVG, thisData, regionData.metadata, mapTooltipHeight, mapTooltipWidth);
}
