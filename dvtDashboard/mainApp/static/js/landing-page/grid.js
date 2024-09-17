
function gridInitialVisualization() {
    gridContainerD3 = d3.select(gridContainer)

    gridStartDate.html(d3.utcFormat("%B %d, %Y")(historicalDates[0]))
    gridEndDate.html(d3.utcFormat("%B %d, %Y")(thisWeekMonday))

    gridHeight = gridContainer.clientHeight
    gridWidth = gridContainer.clientWidth

    gridItemWidth = Math.max((gridWidth/8) - .5*em, 150)
    gridItemHeight = Math.max((gridHeight/6) - 1, 100)

    xScale = d3.scaleUtc()
                .domain([historicalDates[0], historicalDates.at(-1)])
                .range([0, gridItemWidth*.75]) 


    diseaseData = zctaData[gridDiseaseSelector.value]
    gridColor = d3.scaleQuantile()
        .domain(getDataAsArray(gridDiseaseSelector.value, gridDataSourceSortSelector.value, gridRateSwitch =="rate")
            .filter(function(d) {return d != 0}))
        .range(gridBackgroundColors)

    gridContainerD3.selectAll("div")
        .data(diseaseData)
        .enter()
        .append("div")
        .attr("class", "grid-container")
        .each(function(d, i, dom) {
            zcta = d.zcta
            county = d.county
            gridItemContainer = d3.select(this)
                        
            gridTTPContainer = gridItemContainer.append("sl-tooltip")
                .attr("trigger", "click")
                .attr("hoist", "")

            setGridTooltip(gridTTPContainer)

            // tooltip
            gridTTP = gridTTPContainer.append("div")
                .attr("slot", "content")
                .attr("id", `grid-${zcta}-tooltip`)

            gridTTP.append("p")
                .attr("class", "tooltip-title")
                .node().innerHTML = `County: ${county[0].toUpperCase() + county.slice(1)}<br>ZCTA: ${zcta}`

            gridTTP.append("svg")
                .attr("id", `grid-${zcta}-tooltip-svg`)
                .attr("class", `map-tooltip-outer-svg`)

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
                .style("fill", d[gridDataSourceSortSelector.value].data.length > 0 ? gridColor(d[gridDataSourceSortSelector.value].data.at(-1)) : "var(--sl-color-gray-200)")

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
                if (d[dataSource].data.length) {
                    thisCountMax = Math.max(d3.max(d[dataSource].data), thisCountMax)
                }
            })
            
            yScale = d3.scaleLinear()
                .domain([0, thisCountMax])        
                .nice()
                .range([gridItemHeight-2, margin.top])
                
            line = function(data) {
                startDate = d3.timeMonday.round(new Date(data["start-date"]))
                startIndex = historicalDates.findIndex((d) => d.getTime() == startDate.getTime())
                
                return d3.line()
                    .x((_, i) => xScale(historicalDates[i+startIndex]))
                    .y((d, i) => yScale(d))
                    .curve(d3.curveMonotoneX)(data.data)
            }

            gridItemDataSources.forEach(function(dataSource) {
                // draw historical line chart
                historicalGroup = gridSVG.append("g")
                    .attr("class", dataSource)
                historicalGroup.append("path")
                    .attr("d", line(d[dataSource]))
                    .attr("stroke", "black")
                    .attr("stroke-dasharray", dataSourceLineStyle[dataSource])
                    .attr("fill", "none")
                    .attr("stroke-width", 1.5)
            })

            valueData = d[gridDataSourceSortSelector.value].data

            dotPlacementX = gridDataSourceSortSelector.value == "state-prediction" ? gridItemWidth - 3 : xScale.range()[1]
            valuePlacementX = gridDataSourceSortSelector.value == "state-prediction" ? dotPlacementX - 4 : dotPlacementX + 4
            if (valueData.length > 0) {
                dotPlacementY = Math.max(yScale(valueData.at(-1)), 0)
                valuePlacementY = Math.min(Math.max(dotPlacementY + 6, em), gridItemHeight-3)
                lastDot = gridSVG.append("g") //TODO: rename this, my brain is tired
                .attr("class", "grid-item-value")

                lastDot.append("text")
                    .attr("x", valuePlacementX)
                    .attr("y", valuePlacementY)
                    .attr("font-size", "var(--sl-font-size-x-small)")
                    .attr("text-anchor", gridDataSourceSortSelector.value == "state-prediction" ? "end" : "start")
                    .text(valueData.at(-1).toFixed(1))

                lastDot.append("circle")
                    .attr("cx", dotPlacementX)
                    .attr("cy", dotPlacementY)
                    .attr("r", 3)
            }
            
        })
}

function updateGridData() {
    gridContainerD3 = d3.select(gridContainer)

    gridStartDate.html(d3.utcFormat("%B %d, %Y")(historicalDates[0]))
    gridEndDate.html(d3.utcFormat("%B %d, %Y")(thisWeekMonday))

    gridHeight = gridContainer.clientHeight
    gridWidth = gridContainer.clientWidth

    gridItemWidth = Math.max((gridWidth/8) - .5*em, 150)
    gridItemHeight = Math.max((gridHeight/6) - 1, 100)

    diseaseData = zctaData[gridDiseaseSelector.value]

    gridColor = d3.scaleQuantile()
    .domain(getDataAsArray(gridDiseaseSelector.value, gridDataSourceSortSelector.value, gridRateSwitch =="rate")
        .filter(function(d) {return d != 0}))
    .range(gridBackgroundColors)

    xScale = d3.scaleUtc()
                .domain([historicalDates[0], historicalDates.at(-1)])
                .range([0, gridItemWidth*.75]) 

    gridContainerD3.selectAll("div.grid-container")
        .each(function(d, i, dom) {
            zcta = d.zcta
            county = d.county

            data = JSON.parse(JSON.stringify(d))

            thisCountMax = 0

            gridItemDataSources.forEach(function(dataSource) {
                if (gridRateSwitch.value == "rate") {
                    data[dataSource].data = d[dataSource].data.map(function(item) { return item/d.population * 1000} )
                }
                if (data[dataSource].data.length) {
                    thisCountMax = Math.max(d3.max(data[dataSource].data), thisCountMax)
                }
            })

            if (gridRateSwitch.value == "rate") {
                data[gridDataSourceSortSelector.value].data = d[gridDataSourceSortSelector.value].data.map(function(item) { return item/d.population * 1000} )
            }


            // main visualization
            gridSVG = d3.select(`#grid-${zcta}-svg`)
                .attr("width", gridItemWidth)
                .attr("height", gridItemHeight)

            gridSVG.select(".grid-background")
                .transition()
                .duration(1000)
                .attr("width", gridItemWidth)
                .attr("height", gridItemHeight)
                .style("fill", data[gridDataSourceSortSelector.value].data.length > 0 ? gridColor(data[gridDataSourceSortSelector.value].data.at(-1)) : "var(--sl-color-gray-600)")

            yScale = d3.scaleLinear()
                .domain([0, thisCountMax])        
                .nice()
                .range([gridItemHeight-2, margin.top])
                
            line = function(data) {
                startDate = d3.timeMonday.round(new Date(data["start-date"]))
                startIndex = historicalDates.findIndex((d) => d.getTime() == startDate.getTime())
                
                return d3.line()
                    .x((_, i) => xScale(historicalDates[i+startIndex]))
                    .y((d, i) => yScale(d))
                    .curve(d3.curveMonotoneX)(data.data)
            }

            gridItemDataSources.forEach(function(dataSource) {
                // draw historical line chart
                historicalGroup = gridSVG.select("g."+dataSource)
                historicalGroup.select("path")
                    .transition()
                    .duration(1000)
                    .attr("d", line(data[dataSource]))
                    .attr("stroke", "black")
                    .attr("stroke-dasharray", dataSourceLineStyle[dataSource])
                    .attr("fill", "none")
                    .attr("stroke-width", 1.5)
            })

            valueData = data[gridDataSourceSortSelector.value].data

            dotPlacementX = gridDataSourceSortSelector.value == "state-prediction" ? gridItemWidth - 3 : xScale.range()[1]
            valuePlacementX = gridDataSourceSortSelector.value == "state-prediction" ? dotPlacementX - 4 : dotPlacementX + 4
            if (valueData.length > 0) {
                dotPlacementY = Math.max(yScale(valueData.at(-1)), 0)
                valuePlacementY = Math.min(Math.max(dotPlacementY + 6, em), gridItemHeight-3)
                lastDot = gridSVG.select(".grid-item-value") //TODO: rename this, my brain is tired

                lastDot.select("text")
                    .attr("x", valuePlacementX)
                    .attr("y", valuePlacementY)
                    .attr("text-anchor", gridDataSourceSortSelector.value == "state-prediction" ? "end" : "start")
                    .text(valueData.at(-1).toFixed(1))

                lastDot.select("circle")
                    .attr("cx", dotPlacementX)
                    .attr("cy", dotPlacementY)
            }

        })

    sortGrid()
    
}

function sortGrid() {        
    switch (gridSort.value) {
        case "value-high":
            d3.selectAll("div.grid-container")
                .sort((a, b) => {
                    aValue = a[gridDataSourceSortSelector.value].data.length > 0 ? a[gridDataSourceSortSelector.value].data.at(-1) : 0
                    bValue = b[gridDataSourceSortSelector.value].data.length > 0 ? b[gridDataSourceSortSelector.value].data.at(-1) : 0
                    if (gridRateSwitch.value == "rate") {
                        aValue /= a.population / 1000
                        bValue /= b.population / 1000
                    }

                    return bValue - aValue
                })
            break;
        case "value-low": 
            d3.selectAll("div.grid-container")
            .sort((a, b) => {
                aValue = a[gridDataSourceSortSelector.value].data.length > 0 ? a[gridDataSourceSortSelector.value].data.at(-1) : 0
                bValue = b[gridDataSourceSortSelector.value].data.length > 0 ? b[gridDataSourceSortSelector.value].data.at(-1) : 0
                if (gridRateSwitch.value == "rate") {
                    aValue /= a.population / 1000
                    bValue /= b.population / 1000
                }

                return aValue - bValue
            })
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
                .sort((a, b) => {
                    aValue = a[gridDataSourceSortSelector.value].data.length > 0 ? a[gridDataSourceSortSelector.value].data.at(-1) : 0
                    bValue = b[gridDataSourceSortSelector.value].data.length > 0 ? b[gridDataSourceSortSelector.value].data.at(-1) : 0
                    if (gridRateSwitch.value == "rate") {
                        aValue /= a.population / 1000
                        bValue /= b.population / 1000
                    }
                    
                    return bValue - aValue
                })
            break;
    }
}