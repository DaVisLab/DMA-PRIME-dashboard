
function gridInitialVisualization() {
    gridContainerD3 = d3.select(gridContainer)

    gridStartDate.html(d3.utcFormat("%B %d, %Y")(historicalDates[0]))
    gridEndDate.html(d3.utcFormat("%B %d, %Y")(thisWeekMonday))

    gridHeight = gridContainer.clientHeight
    gridWidth = gridContainer.clientWidth

    gridItemWidth = Math.max((gridWidth/8) - .5*em, 183)
    gridItemHeight = Math.max((gridHeight/6) - 1, 135)

    xScale = d3.scaleUtc()
                .domain([historicalDates[0], historicalDates.at(-1)])
                .range([0, gridItemWidth*.75]) 

    d3.json(`/hospitalization-grid/${mapDiseaseSelector.value}`).then(function(zcta_data) {
        console.log(zcta_data)
        zctaData = zcta_data

        gridContainerD3.selectAll("div")
            .data(zctaData)
            .enter()
            .append("div")
            .attr("class", "grid-container")
            .each(function(d, i, dom) {
                // console.log(d, i, dom, this)
                zcta = d.zcta
                county = d.county
                gridItemContainer = d3.select(this)
                            
                gridTTPContainer = gridItemContainer.append("sl-tooltip")
                    .attr("trigger", "click")

                // setGridTooltip(gridTTPContainer)

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
                    .attr("width", gridItemWidth)
                    .attr("height", gridItemHeight)

                gridSVG.append("rect")
                    .attr("class", "grid-background")
                    .attr("width", gridItemWidth)
                    .attr("height", gridItemHeight)
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

                thisCountMax = 0

                gridItemDataSources.forEach(function(dataSource) {
                    if (gridRateSwitch.value == "rate") {
                        d[dataSource].data /= d.population * 1000
                    }
                    if (d[dataSource].data.length) {
                        thisCountMax = Math.max(d3.max(d[dataSource].data), thisCountMax)
                    }
                })

                
                
                yScale = d3.scaleLinear()
                    .domain([0, thisCountMax])        
                    .nice()
                    .range([gridItemHeight, margin.top])
                    
                line = function(data) {
                    startDate = d3.timeMonday.round(new Date(data["start-date"]))
                    startIndex = historicalDates.findIndex((d) => d.getTime() == startDate.getTime())
                    
                    return d3.line()
                        .x((_, i) => xScale(historicalDates[i+startIndex]))
                        .y((d, i) => {console.log(d, i); return yScale(d)})
                        .curve(d3.curveMonotoneX)(data.data)
                }

                gridItemDataSources.forEach(function(dataSource) {
                    // draw historical line chart
                    console.log(dataSource)
                    historicalGroup = gridSVG.append("g")
                    historicalGroup.append("path")
                        .attr("d", line(d[dataSource]))
                        .attr("stroke", "black")
                        .attr("stroke-dasharray", dataSourceLineStyle[dataSource])
                        .attr("fill", "none")
                        .attr("stroke-width", 2)
                })

                valueSelector = gridDataSourceSortSelector.value == "state-prediction" ? "state-testing" : gridDataSourceSortSelector.value
                valuePlacementData = d[valueSelector].data
                valueData = d[gridDataSourceSortSelector.value].data

                if (valueData.length > 0 && valuePlacementData.length > 0) {
                    lastDot = gridSVG.append("g") //TODO: rename this, my brain is tired
                    .attr("class", "grid-item-value")

                    lastDot.append("text")
                        .attr("x", xScale.range()[1] + 6)
                        .attr("y", yScale(valuePlacementData.at(-1)))
                        .attr("font-size", "var(--sl-font-size-x-small)")
                        .text(valueData.at(-1).toFixed(1))

                    lastDot.append("circle")
                        .attr("cx", xScale.range()[1])
                        .attr("cy", yScale(valuePlacementData.at(-1)))
                        .attr("r", 3)
                }

            })
        
    })
}