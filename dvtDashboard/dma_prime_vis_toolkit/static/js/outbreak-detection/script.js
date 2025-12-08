var unknownColor = d3.hsl("#CCCCCC")
var secondaryColor = "#d6604d"

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

function createBarGraph(svg, data, metadata, options = {}) {
    const isLargeTooltip = options && options.isLargeTooltip;
    var panelType = mapRateSwitch.value

    var height = svg.node().clientHeight
    var width = svg.node().clientWidth
    
    svg.attr("class", "tooltip-graph-svg")

  // 2) Use the same svg as your drawing surface
    const graphSVG = svg.append("g");

  // 3) Now append your axes and bars onto graphSVG:
    const yAxis = svg.append("g").attr("class", "y-axis");
    const xAxis = svg.append("g").attr("class", "x-axis");
    var dataPointTTP = svg.append("g").attr("class", "data-point-ttp")

    // Margins and scale definitions
    var margins = {
        "top": mapOutcomeVariableSelector.value == "positive_tests" ? 3*em : 2*em, 
        "bottom": 2*em,
        "left": 1.5*em,
        "right": 1*em,
    }

    function createDataPointTooltip(event, groupStartDate, other=null) {  
        dataPointTTP.html("")

        let tooltipDateFormat = d3.timeFormat("%b %d")

        let thisDataPointShape = event.target
        let dataShapeBBox = thisDataPointShape.getBBox()

        let thisIndex = [...event.target.parentElement.childNodes].findIndex(d => d == event.target)
        let date = d3.timeDay.offset(groupStartDate, 7*thisIndex)
        let dateStr = `${tooltipDateFormat(d3.timeDay.offset(date, -6))} - ${tooltipDateFormat(date)}`

        let value = "rate" ? Math.round(d3.select(thisDataPointShape).datum() * 1000) / 1000.0: d3.select(thisDataPointShape).datum() 
        let valueStr = panelType == "rate" ? `${value.toFixed(3)} per 1000` : value

        let valueTypeStr
        switch (panelType) {
            case "count": 
                valueTypeStr = "Count"
                break;
            case "rate":
                valueTypeStr = "Rate"
                break;
            case "percentDifference":
                valueTypeStr = "Percent Change"
                break;
            default:
                valueTypeStr = "Count"
                break;
        } 

        var dataPointTTPHeight = 1*em
        var dataPointTTPDate = dataPointTTP.append("text").text(dateStr)
        var dataPointTTPCount = dataPointTTP.append("text").text(`${valueTypeStr}: ${valueStr}`)
            .attr("transform", `translate(0, ${.75*em})`)
        if (mapOutcomeVariableSelector.value == "positive_tests") {
            dataPointTTPHeight += 1.5*em
            let thisPercentPos = percentages[thisIndex] * 100
            var dataPointTTPCount = dataPointTTP.append("text").text(`Percent Positive Tests: ${thisPercentPos.toFixed(2)}`)
                .attr("transform", `translate(0, ${1.5*em})`)
        }
        dataPointTTP.append("path")
            .attr("stroke", "black")
            .attr("stroke-width", 1)
            .attr("d", `M 0 0 l 0 ${height - (margins.bottom + dataPointTTPHeight + 2*em )}`)
            .attr("transform", `translate(0, ${dataPointTTPHeight})`)

        dataPointTTP.attr("transform", `translate(${dataShapeBBox.x + dataShapeBBox.width/2 + thisDataPointShape.getCTM().e}, ${1*em})`)
    }
    
    var minMaxVal = panelType == "rate" ? 1000.0/data.population : 1
    var maxVal = d3.max(data.data) ? d3.max(data.data) : minMaxVal

    var yScale = d3.scaleLinear()
        .domain([0, maxVal])
        .nice()
        .range([height-margins.bottom, margins.top])

    // figure out how much space is needed for the y-axis text
    var tempLeft = svg.append("text").text(d3.format(".2r")(yScale.domain()[1])).attr("x", 0).attr("y", 0)
    var tempRight = svg.append("text").text(d3.format(".0%")(1)).attr("x", 0).attr("y", 0)

    margins.left += Math.max(20, tempLeft.node().getBBox().width + 6)
    if (mapOutcomeVariableSelector.value == "positive_tests") {
        var percentages = data.data.map((pos_test, i) => pos_test / data.other[i])
        margins.right += Math.max(10, tempRight.node().getBBox().width) + (isLargeTooltip ? 1.25*em : .5*em) + 6
    }

    var end_date = parseDate(metadata.end_date)
    var start_date = d3.timeDay.offset(end_date, -(7*data.data.length))
    var xScale = d3.scaleTime()
        .domain([start_date, end_date])
        .range([margins.left, width - margins.right])
        .nice()

    graphSVG.append("g").selectAll("rect")
        .data(data.data)
        .enter()
        .append("rect")
        .attr("x", (d, i) => xScale(d3.timeDay.offset(start_date, (7 * i))))
        .attr("y", d => yScale(d))
        .attr("height", d => yScale(0) - yScale(d))
        .attr("width", (width - (margins.left + margins.right)) / data.data.length)
        .attr("fill", "var(--sl-color-neutral-1000)")
        .on("mouseover", function(event, d) {
            if (!isNaN(d)) {
                if (mapOutcomeVariableSelector.value == "positive_tests") {
                    createDataPointTooltip(event, start_date, percentages)
                } else {
                    createDataPointTooltip(event, start_date)
                }
            }
        })
        .on("mouseout", function() {
                dataPointTTP.html("")
            })

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
    // Dynamically offset left y-axis label just outside widest tick label
    var leftLabelOffset
    if (isLargeTooltip) {
        leftLabelOffset = .25*em; 
    } else {
        leftLabelOffset = .5*em
    }
    yAxis.append("text")
        .attr("transform", `translate(${leftLabelOffset},${(yScale.range()[0] + yScale.range()[1]) / 2})rotate(-90)`)
        .attr("text-anchor", "middle")
        .attr("fill", "var(--sl-color-neutral-1000)")
        .text(d3.select(`sl-option[value=${mapOutcomeVariableSelector.value}]`).html());

    // Always show all years, slant labels for both tooltips
    let ticks = d3.timeMonth.every(1)
    let ticksFormat = d3.timeFormat("%b %y")
    if (isLargeTooltip) {
        ticks = d3.timeYear.every(1)
        ticksFormat = d3.timeFormat("%Y")
    }
    xAxis.call(d3.axisBottom(xScale).ticks(ticks).tickFormat(ticksFormat))
        .attr("transform", `translate(0, ${height - margins.bottom})`)
        .selectAll("text")
        .attr("transform", "rotate(-40)")
        .style("text-anchor", "end");

    if (mapOutcomeVariableSelector.value == "positive_tests") {
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
            .attr("fill", "none")
            .attr("stroke-width", 2.5)
            .style("stroke", secondaryColor)

        // Right y-axis label (percent positive): fixed  padding from axis
        var rightLabelOffset
        if (isLargeTooltip) {
            rightLabelOffset = 1.5*em; 
        } else {
            rightLabelOffset = .5*em
        }
        yAxis2.append("text")
            .attr("transform", `translate(${width - rightLabelOffset},${(yScale2.range()[0] + yScale2.range()[1]) / 2})rotate(90)`)
            .attr("text-anchor", "middle")
            .attr("fill", secondaryColor)
            .text("Percent Positive Tests");
        
        // Restore the right y-axis with red ticks and percent labels
        var yAxis2Axis = yAxis2.append("g")
            .attr("transform", `translate(${xScale.range()[1]},0)`)
            .call(d3.axisRight(yScale2).ticks(5, ".0%").tickSize(4));
        yAxis2Axis.selectAll("text")
            .attr("class", "tooltip-label")
            .attr("fill", secondaryColor);
        yAxis2Axis.selectAll("line,path")
            .style("stroke", secondaryColor);
    }

    tempLeft.remove()
    tempRight.remove()
    
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
