
function gridInitialVisualization() {
    gridContainerD3 = d3.select(gridContainer)

    gridStartDate.html(d3.utcFormat("%B %d, %Y")(historicalDates[0]))
    gridEndDate.html(d3.utcFormat("%B %d, %Y")(thisWeekMonday))

    gridHeight = gridContainer.clientHeight
    gridWidth = gridContainer.clientWidth

    adjustedHeight = gridHeight - 1*em
    adjustedWidth = gridWidth - 1*em

    // calculate how many row and column items of at least specified width/height would fit in the grid container
    colItems = Math.min(6, Math.max(Math.floor(adjustedHeight/(120-.25*em)), 1))
    rowItems = Math.min(8, Math.max(Math.floor(adjustedWidth/(150-.25*em)), 1))

    // calculate height and width based on that
    gridItemHeight = (adjustedHeight-((colItems-1)*.25*em))/colItems
    gridItemWidth = (adjustedWidth-((rowItems-1)*.25*em))/rowItems

    // create x scale and color scale
    xScale = d3.scaleUtc()
                .domain([historicalDates[0], historicalDates.at(-1)])
                .range([0, gridItemWidth*.75]) 

    diseaseData = zctaData[gridDiseaseSelector.value]
    gridColor = d3.scaleQuantile()
        .domain(getDataAsArray(gridDiseaseSelector.value, gridDataSourceSortSelector.value, gridRateSwitch.value =="rate", gridIncludeImputations.checked)
            .filter(function(d) {return d != 0})) // TODO : if we decide to leave na values as na, this filter may need to be omited
        .range(gridBackgroundColors)
        .unknown("var(--sl-color-gray-600)")

    // create grid item elements
    gridContainerD3.selectAll("div")
        .data(diseaseData)
        .enter()
        .append("div") // data is attached here
        .attr("class", "grid-container")
        .each(function(d) {
            zcta = d.zcta
            county = d.county
            gridItemContainer = d3.select(this)
            
            // using sl-tooltip to use shoelace's built in functionality
            gridTTPContainer = gridItemContainer.append("sl-tooltip")
                .attr("trigger", "click")
                .attr("hoist", "")

            // set grid tooltip interaction - this happens when grid item is clicked
            setGridTooltip(gridTTPContainer)

            // tooltip
            gridTTP = gridTTPContainer.append("div")
                .attr("slot", "content")
                .attr("id", `grid-${zcta}-tooltip`)

            ttpTitle = gridTTP.append("p") // tooltip title
                .attr("class", "tooltip-title")
            ttpTitle.append("span")
                .attr("class", "tooltip-title")
            ttpTitle.append("br")
            ttpTitle.append("span")
                .attr("class", "tooltip-subtitle")

            gridTTP.append("svg") // tooltip graph in svg
                .attr("id", `grid-${zcta}-tooltip-svg`)
                .attr("class", `tooltip-outer-svg`)

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

            gridSVG.append("rect") // background
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

            // add each line object
            gridItemDataSources.forEach(function(dataSource) {
                // draw historical line chart
                historicalGroup = gridSVG.append("g")
                    .attr("class", dataSource)
                historicalGroup.append("path")
                    .attr("stroke", "black")
                    .attr("stroke-dasharray", dataSourceLineStyle[dataSource])
                    .attr("fill", "none")
                    .attr("stroke-width", 1.5)
            })

            // add value label and dot
            valueLabel = gridSVG.append("g") 
                .attr("class", "grid-item-value")
            valueLabel.append("line")
                .attr("stroke", "black")
                .attr("stroke-width", 1)
                .attr("stroke-dasharray", "5,5")
            valueLabel.append("circle")
                .attr("r", 3)
            valueLabel.append("text")
                .attr("font-size", "var(--sl-font-size-x-small)")
                .attr("text-anchor", gridDataSourceSortSelector.value == "state-prediction" ? "end" : "start")
        })
}

function updateGridData() {
    gridContainerD3 = d3.select(gridContainer)

    gridStartDate.html(d3.utcFormat("%B %d, %Y")(historicalDates[0]))
    gridEndDate.html(d3.utcFormat("%B %d, %Y")(thisWeekMonday))

    gridHeight = gridContainer.clientHeight
    gridWidth = gridContainer.clientWidth

    adjustedHeight = gridHeight - 1*em
    adjustedWidth = gridWidth - 1*em

    colItems = Math.min(6, Math.max(Math.floor(adjustedHeight/(120-.25*em)), 1))
    rowItems = Math.min(8, Math.max(Math.floor(adjustedWidth/(150-.25*em)), 1))

    gridItemHeight = (adjustedHeight-((colItems-1)*.25*em))/colItems
    gridItemWidth = (adjustedWidth-((rowItems-1)*.25*em))/rowItems

    diseaseData = zctaData[gridDiseaseSelector.value]

    // create scales
    gridColor = d3.scaleQuantile()
        .domain(getDataAsArray(gridDiseaseSelector.value, gridDataSourceSortSelector.value, gridRateSwitch.value == "rate", gridIncludeImputations.checked)
            .filter(function(d) {return d != 0}))
        .range(gridBackgroundColors)
        .unknown("var(--sl-color-gray-600)")

    xScale = d3.scaleUtc()
                .domain([historicalDates[0], historicalDates.at(-1)])
                .range([0, gridItemWidth*.75]) 

    // draw grid graph        
    gridContainerD3.selectAll("div.grid-container").data(diseaseData, function(d) {
        return d.zcta
    }).each(function(d, i, dom) {
        zcta = d.zcta
        county = d.county

        data = JSON.parse(JSON.stringify(d))

        thisCountMax = 0

        // if not including imputations, skip if data is imputated
        if (!gridIncludeImputations.checked && d.imputation) {
            return
        }

        // process data
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

        value = NaN
        if (data[gridDataSourceSortSelector.value].data.length > 0) {
            if (gridDataSourceSortSelector.value == "state-prediction") {
                switch(gridDiseaseSelector.value) {
                    case "covid-19":
                        value = data[gridDataSourceSortSelector.value].data.at(5)
                        break
                    case "influenza-1":
                    case "influenza-2":
                        value = data[gridDataSourceSortSelector.value].data.at(2)
                        break
                    default:
                        value = data[gridDataSourceSortSelector.value].data.at(5)
                }
                if (typeof value == "undefined") {
                    value = NaN
                }
            } else {
                value = data[gridDataSourceSortSelector.value].data.at(-1)
            }
        }

        // update the heights/widths of things
        gridSVG = d3.select(`#grid-${zcta}-svg`)
            .attr("width", gridItemWidth)
            .attr("height", gridItemHeight)

        gridSVG.select(".grid-background")
            .transition()
            .duration(1000)
            .attr("width", gridItemWidth)
            .attr("height", gridItemHeight)
            .style("fill", gridColor(value))

        // create yscale
        yScale = d3.scaleLinear()
            .domain([0, thisCountMax])        
            .nice()
            .range([gridItemHeight-2, margin.top])
            
        // create the line creation function
        line = function(data) {
            startDate = d3.timeSaturday.round(new Date(data["start-date"]))
            startIndex = historicalDates.findIndex((d) => d.getTime() == startDate.getTime())
            
            return d3.line()
                .x((_, i) => xScale(historicalDates[i+startIndex]))
                .y((d, i) => yScale(d))
                .curve(d3.curveMonotoneX)(data.data)
        }

        // draw the lines!
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

        // place value label and dot 
        lastDot = gridSVG.select(".grid-item-value") //TODO: rename this, my brain is tired
        dotPlacementX = gridDataSourceSortSelector.value == "state-prediction" ? gridItemWidth - 3 : xScale.range()[1]
        valuePlacementX = gridDataSourceSortSelector.value == "state-prediction" ? dotPlacementX : dotPlacementX + 4
        if (!isNaN(value)) {
            lastDot.attr("opacity", 1)
            dotPlacementY = Math.max(yScale(value), 0)
            if (gridDataSourceSortSelector.value == "state-prediction") {
                if (data["state-testing"].data.at(-1) < value) {
                    valuePlacementY = Math.max(dotPlacementY - 6, em)
                } else{
                    valuePlacementY = Math.min(dotPlacementY + em, gridItemHeight - 3)
                }
            } else {
                valuePlacementY = Math.min(Math.max(dotPlacementY + 6, em), gridItemHeight - 3)
            }

            lastDot.select("text")
                .attr("x", valuePlacementX)
                .attr("y", valuePlacementY)
                .attr("text-anchor", gridDataSourceSortSelector.value == "state-prediction" ? "end" : "start")
                .text(value.toFixed(1))

            lastDot.select("circle")
                .attr("cx", dotPlacementX)
                .attr("cy", dotPlacementY)

            lastDot.select("line")
                .attr("display", gridDataSourceSortSelector.value == "state-prediction" ? "initial" : "none")

            if (gridDataSourceSortSelector.value == "state-prediction") {
                lastDot.select("line")
                    .attr("display", "initial")
                    .attr("x1", xScale.range()[1])
                    .attr("y1", yScale(data["state-testing"].data.at(-1)))
                    .attr("x2", dotPlacementX)
                    .attr("y2", dotPlacementY)
            }
            
        } else {
            lastDot.attr("opacity", 0)
        }

    })

    sortGrid()
    
}

function sortGrid() {        
    switch (gridSort.value) {
        case "value-high": // sort value high-low
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
        case "value-low": // sort value low-high
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
        case "alphabetical-low": // sort value a-z-0-9
            d3.selectAll("div.grid-container")
                .sort((a, b) => a.zcta - b.zcta)
            break;
        case "alphabetical-high": // sort value 9-0-a-z
            d3.selectAll("div.grid-container")
                .sort((a, b) => b.zcta - a.zcta)
            break;
        default: // sort value high-low
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