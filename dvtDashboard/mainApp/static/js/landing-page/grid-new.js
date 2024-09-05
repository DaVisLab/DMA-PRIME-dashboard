
// grid colors depending on something maybe quantile based

function gridInitialVisualization() {
    gridContainerD3 = d3.select(gridContainer)

    // grid colormap...

    d3.json("/map-data/zcta_county_crosswalk").then(function(zcta_data) {
        Object.entries(zcta_data).forEach(([zcta, county]) => {
            gridItemContainer = gridContainerD3.append("div")
                .attr("class", "grid-container")
                        
            gridTTPContainer = gridItemContainer.append("sl-tooltip")
                .attr("trigger", "click")

            setGridTooltip(gridTTPContainer)

            // tooltip
            gridTTP = gridTTPContainer.append("div")
                .attr("slot", "content")
                .attr("id", `grid-${zcta}-tooltip`)

            gridTTP.append("p")
                .attr("class", "tooltip")
                .node().innerHTML = `${county[0].toUpperCase() + county.slice(1)}<br>ZCTA: ${zcta}`

            gridTTP.append("svg")
                .attr("id", `grid-${zcta}-tooltip-svg`)
                .attr("zcta", zcta)

            // main visualization
            gridDiv = gridTTPContainer.append("div")
                .attr("id", `grid-${zcta}`)
                .attr("class", "quadrant")
                .attr("zcta", zcta)
                .attr("county", county)
                .datum(zcta)

            gridSVG = gridDiv.append("svg")
                .attr("id", `grid-${zcta}-svg`)
                .attr("class", "grid-item")
                .attr("zcta", zcta)
                .attr("county", county)

            gridSVG.append("rect")
                .attr("class", "grid-background")
                .style("fill", "grey")

            // title
            gridSVG.append("text")
                .attr("class", "grid-title")
                .attr("x", 0.25*em)
                .attr("y", em)
                .text(zcta)
                .append("tspan")
                .attr("class", "grid-subtitle")
                .html(` (${county.toUpperCase()})`)

            // Value
            gridSVG.append("text")
                .attr("class", "grid-value")
                .attr("x", 0.25*em)
                .attr("y", 2*em) // Adjust the y-coordinate to position it below the existing text

            // line to delineate prediction and historical data
            gridSVG.append("line")
                .attr("class", "grid-prediction-separator")
        })
    }) //.then(updateGridData)
}

function updateGridData() {
    gridHeight = gridContainer.clientHeight
    gridWidth = gridContainer.clientWidth

    gridItemWidth = Math.max((gridWidth/8) - 1, 0)
    gridItemHeight = Math.max((gridHeight/6) - 1, 0)

    var parseDate = function(date) {return dayjs.tz(date, "America/New_York").toDate()}
    d3.selectAll(".grid-background")
        .attr("width", gridItemWidth)
        .attr("height", gridItemHeight)

    d3.selectAll("div.quadrant")
        .each(function(itemData, i) {
            // thisMonday = new Date((date - date.getDay()) + 1) 

            d3.json(`/hospitalization-history/${mapDiseaseSelector.value}`, {
                "method": "POST",
                "headers": {"Content-Type": "application/json"},
                "body": JSON.stringify({
                    "region": itemData,
                    "date": new Date(2024, 5, 24), // 5 is for month 6 - june
                    "rate": mapRateSwitch.value == "rate"
            })}).then((result) => {
                gridItemContainer = d3.select(this.parentNode.parentNode)
                gridItem = d3.select(`#grid-${itemData}-svg`)
                gridItem
                    .attr("width", gridItemWidth)
                    .attr("height", gridItemHeight)

                gridItem.selectAll("g").remove()

                data = result.data
                stats = result.stats

                stats.date.min = parseDate(stats.date.min)
                stats.date.max =parseDate(stats.date.max)

                value = 0
                
                yScale = d3.scaleLinear()
                            .domain([stats.count.min, stats.count.max])        
                            .nice()
                            .range([gridItemHeight - margin.bottom, margin.top])

                xScale = d3.scaleUtc()
                    .domain([stats.date.min, stats.date.max])
                    .range([0, gridItemWidth]) 

                line = d3.line()
                    .x((d) => xScale(parseDate(d.date)))
                    .y((d) => yScale(d.count))
                    .curve(d3.curveMonotoneX)

                color = d3.scaleOrdinal(d3.schemeAccent).domain(Object.keys(data.historical))

                Object.entries(data.historical).forEach(function([dataSource, values]) {
                    // for each data source
                    historicalData = []
                    Object.entries(values).forEach(function([date, count]) {
                        date = dayjs.tz(date, "America/New_York").toDate()
                        historicalData.push({"date": date, "count": count})
                    })

                    // draw historical line chart
                    historicalGroup = gridItem.append("g")
                    historicalGroup.append("path")
                        .attr("d", line(historicalData))
                        .attr("stroke", color(dataSource))
                        .attr("fill", "none")
                        .attr("stroke-width", 2)

                })

                Object.entries(data.prediction).forEach(function([dataSource, values]) {
                    // for each data source
                    predictiveData = []
                    Object.entries(values).forEach(function([date, count]) {
                        date = dayjs.tz(date, "America/New_York").toDate()
                        predictiveData.push({"date": date, "count": count})
                        value += count
                    })

                    // draw historical line chart
                    predictiveGroup = gridItem.append("g")
                    predictiveGroup.append("path")
                        .attr("d", line(predictiveData))
                        .attr("stroke", color(dataSource))
                        .attr("fill", "none")
                        .attr("stroke-width", 2)

                })

                gridItemContainer.datum(value).enter()

                // // Show confidence interval
                // predictiveGroup.append("path")
                //     .attr("class", "prediction-background")
                //     .datum(predictiveData)
                //     .style("fill", diseaseColorMap(disease))
                //     .style("opacity", 0.25)
                //     .attr("stroke", "none")
                //     .attr("d", d3.area()
                //         .x(function(d) { return xScale(d.date) })
                //         .y0(function(d, i) { return yScale(i == 0 ? d.count : d["min-prediction"]) })
                //         .y1(function(d, i) { return yScale(i == 0 ? d.count : d["max-prediction"]) })
                //         .curve(d3.curveMonotoneX)
                //     )

                if (predictiveData.length){
                    // highlights predictive data
                    gridItem.append("rect")
                        .attr("class", "grid-prediction-highlighter")
                        .attr("x", xScale(predictiveData[0].date))
                        .attr("y", margin.top)
                        .attr("width", xScale(predictiveData[predictiveData.length - 1].date) - xScale(predictiveData[0].date))
                        .attr("height", gridItemHeight - margin.bottom - margin.top)

                    // place line separating historical and prediction data
                    gridItem.select(".grid-prediction-separator")
                        .attr("x1", xScale(predictiveData[0].date))
                        .attr("y1", margin.top)
                        .attr("x2", xScale(predictiveData[0].date))
                        .attr("y2", gridItemHeight - margin.bottom)
                }
            })

        })
        .call(sortGrid)
}

function sortGrid() {
    switch (gridSort.value) {
        case "value-high":
            d3.selectAll("div.grid-container")
                .sort((a, b) => b - a)
            break;
        case "value-low": 
            d3.selectAll("div.grid-container")
                .sort((a, b) => a - b)
            break;
        case "alphabetical-low":
            d3.selectAll("div.grid-container")
                .sort(d3.ascending)
            break;
        case "alphabetical-high":
            d3.selectAll("div.grid-container")
                .sort(d3.descending)
            break;
        default:
            d3.selectAll("div.grid-container")
                .sort((a, b) => b - a)
            break;
    }
}

function updateGridTooltips() {
    zcta.on("pointerenter", function(e) {
        // make sure this is in the shown county
        county = zcta.attr("county")
        if(focusCounty != county) {
            return
        }

        // draw the stuff 
        zctaName = zcta.datum().properties.ZCTA5CE20

        d3.json(`/hospitalization-history/${mapDiseaseSelector.value}`, {
            "method": "POST",
            "headers": {"Content-Type": "application/json"},
            "body": JSON.stringify({
                "region": zctaName,
                "date": new Date(2024, 5, 24), // 5 is for month 6 - june
                "rate": mapRateSwitch.value == "rate"
            })}).then((result) => {
                mapTooltipWidth = Math.max(400, width * .1)
                mapTooltipHeight = mapTooltipWidth * .65

                ttp = d3.select(mapTooltip)
                ttp.style("display", "block").style("z-index", 1)
                ttpSVG = ttp.select("#map-tooltip-svg")
                    .attr("height", mapTooltipHeight)
                    .attr("width", mapTooltipWidth)

                // reset tooltip contents for new data
                ttp.select("p.tooltip").node().innerHTML = `${county[0].toUpperCase() + county.slice(1)}<br>ZCTA: ${zctaName}`
                ttpSVG.node().innerHTML = ""

                data = result.data
                stats = result.stats

                stats.date.min = dayjs.tz(stats.date.min, "America/New_York").toDate()
                stats.date.max = dayjs.tz(stats.date.max, "America/New_York").toDate()

                // create y axis scaling (counts of hospitalizations)
                yScale = d3.scaleLinear()
                            .domain([stats.count.min, stats.count.max])        
                            .nice()

                // figure out how much space is needed for the y-axis text
                temp = ttpSVG.append("text").text(yScale.domain()[1]).attr("x", 0).attr("y", 0)
                ttpMargins = {
                    "top": em, 
                    "bottom": 2.5*em,
                    "left": temp.node().getBBox().width + em,
                    "right": em,
                }
                temp.remove()

                // finish creating both x and y scales
                xScale = d3.scaleUtc([stats.date.min, stats.date.max], [ttpMargins.left, mapTooltipWidth - ttpMargins.right]) 
                yScale.range([mapTooltipHeight - ttpMargins.bottom, ttpMargins.top])

                // line generator
                line = d3.line()
                    .x((d) => xScale(d.date))
                    .y((d) => yScale(d.count))
                    .curve(d3.curveMonotoneX)

                // line to delineate prediction and historical data
                ttpSVG.append("line").attr("id", "tooltip-prediction-separator")
                
                // holds lines of linechart
                graphSVG = ttpSVG.append("svg")
                    .attr("id", "graph-svg")
                    .attr("height", mapTooltipHeight)
                    .attr("width", mapTooltipWidth)

                color = d3.scaleOrdinal(d3.schemeAccent).domain(Object.keys(data.historical))

                Object.entries(data.historical).forEach(function([dataSource, values]) {
                    // for each data source
                    historicalData = []
                    Object.entries(values).forEach(function([date, count]) {
                        date = dayjs.tz(date, "America/New_York").toDate()
                        historicalData.push({"date": date, "count": count})
                    })

                    // draw historical line chart
                    historicalGroup = graphSVG.append("g")
                    historicalGroup.append("path")
                        .attr("d", line(historicalData))
                        .attr("stroke", color(dataSource))
                        .attr("fill", "none")
                        .attr("stroke-width", 2)
    
                    // marks each datapoint on historical line
                    historicalGroup.selectAll("circle").data(historicalData)
                        .enter()
                        .append("circle")
                        .attr("r", 3)
                        .attr("cx", (d) => xScale(d.date))
                        .attr("cy", (d) => yScale(d.count))
                        .attr("stroke", color(dataSource))

                })

                Object.entries(data.prediction).forEach(function([dataSource, values]) {
                    // for each data source
                    predictiveData = []
                    Object.entries(values).forEach(function([date, count]) {
                        date = dayjs.tz(date, "America/New_York").toDate()
                        predictiveData.push({"date": date, "count": count})
                    })

                    // draw historical line chart
                    predictiveGroup = graphSVG.append("g")
                    predictiveGroup.append("path")
                        .attr("d", line(predictiveData))
                        .attr("stroke", color(dataSource))
                        .attr("fill", "none")
                        .attr("stroke-width", 2)
    
                    // marks each datapoint on prediction line
                    predictiveGroup.selectAll("circle").data(predictiveData)
                        .enter()
                        .append("circle")
                        .attr("r", 3)
                        .attr("cx", (d) => xScale(d.date))
                        .attr("cy", (d) => yScale(d.count))
                        .attr("stroke", color(dataSource))

                })

                // // Show confidence interval
                // predictiveGroup.append("path")
                //     .attr("class", "prediction-background")
                //     .datum(predictiveData)
                //     .style("fill", diseaseColorMap(disease))
                //     .style("opacity", 0.25)
                //     .attr("stroke", "none")
                //     .attr("d", d3.area()
                //         .x(function(d) { return xScale(d.date) })
                //         .y0(function(d, i) { return yScale(i == 0 ? d.count : d["min-prediction"]) })
                //         .y1(function(d, i) { return yScale(i == 0 ? d.count : d["max-prediction"]) })
                //         .curve(d3.curveMonotoneX)
                //     )

                if (predictiveData.length){
                    // highlights predictive data
                    graphSVG.append("rect")
                        .attr("id", "tooltip-prediction-highlighter")
                        .attr("x", xScale(predictiveData[0].date))
                        .attr("y", ttpMargins.top)
                        .attr("width", xScale(predictiveData[predictiveData.length - 1].date) - xScale(predictiveData[0].date))
                        .attr("height", mapTooltipHeight - ttpMargins.bottom - ttpMargins.top)

                    // place line separating historical and prediction data
                    ttpSVG.select("#tooltip-prediction-separator")
                        .attr("x1", xScale(predictiveData[0].date))
                        .attr("y1", ttpMargins.top)
                        .attr("x2", xScale(predictiveData[0].date))
                        .attr("y2", mapTooltipHeight - ttpMargins.bottom)
                }

                // display x-axis on the bottom
                ttpSVG.append("g")
                    .attr("transform", `translate(0,${mapTooltipHeight - ttpMargins.bottom})`)
                    .call(d3.axisBottom(xScale).tickSize(4).tickFormat(d3.timeFormat("%d %b %Y")))
                    .selectAll("text")  
                    .style("text-anchor", "end")
                    .attr("transform", "rotate(-30)");
    
                // display y-axis on the left
                ttpSVG.append("g")
                    .attr("transform", `translate(${ttpMargins.left},0)`)
                    .call(d3.axisLeft(yScale).ticks(5).tickSize(4));
                
            })
    })
}
