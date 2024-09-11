
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
                .node().innerHTML = `County: ${county[0].toUpperCase() + county.slice(1)}<br>ZCTA: ${zcta}`

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
                .style("fill", "var(--sl-color-gray-600)")

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
    console.log("updating grid data")
    gridHeight = gridContainer.clientHeight
    gridWidth = gridContainer.clientWidth

    gridItemWidth = Math.max((gridWidth/8) - .5*em, 0)
    gridItemHeight = Math.max((gridHeight/6) - 1, 0)

    var parseDate = function(date) {return dayjs.tz(date, "America/New_York").toDate()}
    d3.selectAll(".grid-background")
        .attr("width", gridItemWidth)
        .attr("height", gridItemHeight)

    d3.selectAll("div.quadrant")
        .each(function(itemData, i) {

            d3.json(`/hospitalization-grid/${mapDiseaseSelector.value}`, {
                "method": "POST",
                "headers": {"Content-Type": "application/json"},
                "body": JSON.stringify({
                    "region": itemData,
                    "date": new Date(2024, 7, 26), // 5 is for month 6 - june
                    "rate": gridRateSwitch.value == "rate"
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
                stats.date.max = parseDate(stats.date.max)

                gridStartDate.html(d3.utcFormat("%B %d, %Y")(parseDate(result.stats.date.min)))
                gridEndDate.html(d3.utcFormat("%B %d, %Y")(parseDate(result.stats.date.max)))
                
                value = {
                    "state-model": 0,
                    "state-model-sum": 0,
                    "health-system": 0,
                    "zcta": itemData
                }
                
                yScale = d3.scaleLinear()
                            .domain([stats.count.min, stats.count.max])        
                            .nice()
                            .range([gridItemHeight, margin.top])

                xScale = d3.scaleUtc()
                    .domain([stats.date.min, stats.date.max])
                    .range([0, gridItemWidth*.75]) 

                line = d3.line()
                    .x((d) => xScale(parseDate(d.date)))
                    .y((d) => yScale(d.count))
                    .curve(d3.curveMonotoneX)

                Object.entries(data.historical).forEach(function([dataSource, values]) {
                    // for each data source
                    historicalData = []
                    Object.entries(values).forEach(function([date, count]) {
                        date = dayjs.tz(date, "America/New_York").toDate()
                        historicalData.push({"date": date, "count": count})
                    })

                    value[dataSource] = historicalData[historicalData.length-1].count

                    // draw historical line chart
                    historicalGroup = gridItem.append("g")
                    historicalGroup.append("path")
                        .attr("d", line(historicalData))
                        .attr("stroke", "black")
                        .attr("stroke-dasharray", gridLineStyle[dataSource])
                        .attr("fill", "none")
                        .attr("stroke-width", 2)

                })

                Object.entries(data.prediction).forEach(function([dataSource, values]) {
                    // for each data source
                    Object.entries(values).forEach(function([date, count]) {
                        value["state-model-sum"] += count
                    })
                })

                lastDot = gridItem.append("g") //TODO: rename this, my brain is tired
                    .attr("class", "grid-item-value")
                
                lastDot.append("text")
                    .attr("x", xScale.range()[1] + 6)
                    .attr("y", yScale(value[gridDataSourceSortSelector.value == "health-system" ? "health-system" : "state-model"]))
                    .attr("font-size", "var(--sl-font-size-x-small)")
                    .text(value[gridDataSourceSortSelector.value].toFixed(1))

                lastDot.append("circle")
                    .attr("cx", xScale.range()[1])
                    .attr("cy", yScale(value[gridDataSourceSortSelector.value == "health-system" ? "health-system" : "state-model"]))
                    .attr("r", 3)

                // Object.entries(data.prediction).forEach(function([dataSource, values]) {
                //     // for each data source
                //     predictiveData = []
                //     Object.entries(values).forEach(function([date, count]) {
                //         date = dayjs.tz(date, "America/New_York").toDate()
                //         predictiveData.push({"date": date, "count": count})
                //         value += count
                //     })

                //     // draw historical line chart
                //     predictiveGroup = gridItem.append("g")
                //     predictiveGroup.append("path")
                //         .attr("d", line(predictiveData))
                //         .attr("stroke", color(dataSource))
                //         .attr("fill", "none")
                //         .attr("stroke-width", 2)

                // })

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

                // if (predictiveData.length){
                //     // highlights predictive data
                //     gridItem.append("rect")
                //         .attr("class", "grid-prediction-highlighter")
                //         .attr("x", xScale(predictiveData[0].date))
                //         .attr("y", margin.top)
                //         .attr("width", xScale(predictiveData[predictiveData.length - 1].date) - xScale(predictiveData[0].date))
                //         .attr("height", gridItemHeight - margin.bottom - margin.top)

                //     // place line separating historical and prediction data
                //     gridItem.select(".grid-prediction-separator")
                //         .attr("x1", xScale(predictiveData[0].date))
                //         .attr("y1", margin.top)
                //         .attr("x2", xScale(predictiveData[0].date))
                //         .attr("y2", gridItemHeight - margin.bottom)
                // }
            })

        })
        .call(sortGrid)
}

function sortGrid() {
    scheme = d3.schemeReds[9]
    indices = [1, 2, 3, 4]
    colors = indices.map(i => scheme[i])

    gridColor = d3.scaleQuantile()
        .domain(d3.selectAll("div.grid-container").data()
            .map((d) => d[gridDataSourceSortSelector.value])
            .filter(function(d) {return d != 0}))
        .range(colors)

    d3.selectAll("div.grid-container").each(function(d, i, nodeList) {
        d3.select(this).select(".grid-background")
            .style("fill", d[gridDataSourceSortSelector.value] != 0 ? gridColor(d[gridDataSourceSortSelector.value]) : "var(--sl-color-gray-600)")
    })
        
    switch (gridSort.value) {
        case "value-high":
            d3.selectAll("div.grid-container")
                .sort((a, b) => b[gridDataSourceSortSelector.value] - a[gridDataSourceSortSelector.value])
            break;
        case "value-low": 
            d3.selectAll("div.grid-container")
                .sort((a, b) => a[gridDataSourceSortSelector.value] - b[gridDataSourceSortSelector.value])
            break;
        case "alphabetical-low":
            d3.selectAll("div.grid-container")
                .sort((a, b) => a.zcta - b.zcta)
            break;
        case "alphabetical-high":
            d3.selectAll("div.grid-container")
                .sort((a, b) => b.zcta - a.zcta)
            break;
        default:
            d3.selectAll("div.grid-container")
                .sort((a, b) => b[gridDataSourceSortSelector.value] - a[gridDataSourceSortSelector.value])
            break;
    }
}
