import { zctaData, historicalDates, startDate, currentWeek, gridLineStyle, gridItemDataSources, parseDate, getDataAsArray, drawTooltip } from "/static/js/respiratory/script.js";
export { gridWidth, gridHeight, updateGridData, sortGrid, setupGridTooltip }

await Promise.allSettled([ // wait for following to be defined/load in
    customElements.whenDefined('sl-select'),
    customElements.whenDefined('sl-option'),
    customElements.whenDefined('sl-button'),
])
gridInitialVisualization()

var gridWidth = gridContainer.clientWidth
var gridHeight = gridContainer.clientHeight

function gridInitialVisualization() {
    var gridContainerD3 = d3.select(gridContainer)

    gridStartDate.html(d3.timeFormat("%B %d, %Y")(historicalDates[0]))
    gridEndDate.html(d3.timeFormat("%B %d, %Y")(currentWeek))

    gridHeight = gridContainer.clientHeight
    gridWidth = gridContainer.clientWidth

    var adjustedHeight = gridHeight - 1*em
    var adjustedWidth = gridWidth - 1*em

    // calculate how many row and column items of at least specified width/height would fit in the grid container
    var colItems = Math.min(6, Math.max(Math.floor(adjustedHeight/(120-.25*em)), 1))
    var rowItems = Math.min(8, Math.max(Math.floor(adjustedWidth/(150-.25*em)), 1))

    // calculate height and width based on that
    var gridItemHeight = (adjustedHeight-((colItems-1)*.25*em))/colItems
    var gridItemWidth = (adjustedWidth-((rowItems-1)*.25*em))/rowItems

    // get data
    var diseaseData = zctaData.features

    // create grid item elements
    gridContainerD3.selectAll("div")
        .data(diseaseData)
        .enter()
        .append("div") // data is attached here
        .attr("class", "grid-container")
        .each(function(d) {
            var zcta = d.properties.ZCTA
            var county = d.properties.county
            var gridItemContainer = d3.select(this)

            var data = d.properties
            
            // using sl-tooltip to use shoelace's built in functionality
            var gridTTPContainer = gridItemContainer.append("sl-tooltip")
                .attr("trigger", "manual")
                .attr("hoist", "")

            // set grid tooltip interaction - this happens when grid item is clicked
            gridTTPContainer.on("sl-after-show", function(event) {
                setupGridTooltip(d3.select(event.target), false)
            })

            // tooltip
            var gridTTP = gridTTPContainer.append("div")
                .attr("slot", "content")
                .attr("id", `grid-${zcta}-tooltip`)
                .attr("class", `tooltip-div`)
                .style("padding", "var(--sl-spacing-small) 0")

            gridTTPContainer.node().updateComplete.then(function(a, b) {
                var slTtpBody = d3.select(gridTTPContainer.node().shadowRoot).select("div[part='body']")
                slTtpBody.style("pointer-events", "auto")

                slTtpBody.append("sl-icon-button")
                    .attr("name", "x")
                    .style("position", "absolute")
                    .style("right", 0)
                    .style("top", 0)
                    .style("color", "black")
                    .on("click", () => gridTTPContainer.node().open = false)

                // Add expand icon button next to close button
                slTtpBody.append("sl-icon-button")
                    .attr("name", "zoom-in")
                    .style("position", "absolute")
                    .style("right", "30px")
                    .style("top", 0)
                    .style("color", "black")
                    .on("click", () => {
                        var largeTtp = d3.select(tooltipLarge)
                        tooltipLarge.show().then(async () => {
                            var allExtendedData = await d3.json(`/data/respiratory/zcta/${gridDiseaseSelector.value}/extended?data_version=${metadata.data_version}&${parseInt(Math.random() * 9999999999)}`)
                            var ttpData = {
                                "id": gridTTPContainer.attr("zcta"),
                                "county": gridTTPContainer.attr("county"),
                                "data": allExtendedData[gridTTPContainer.attr("zcta")]
                            }
                            var [gridDataSource, gridDataVariable, _] = gridDataSourceSortSelector.value.split('_')
                            drawTooltip(ttpData,
                                largeTtp.select(".tooltip-outer-svg"), largeTtp.select(".tooltip-header"), largeTtp.select(".tooltip-footer"),
                                gridDataSource, gridDataVariable,
                                gridRateSwitch.value == "rate", true, true, {})
                        })
                    })
            })
            
            var gridTTPHeader = gridTTP.append("div")
                .attr("class", "tooltip-header")
            gridTTPHeader.append("div")
                .attr("class", "tooltip-region-info")
            gridTTPHeader.append("div")
                .attr("class", "tooltip-data-info")
            gridTTP.append("svg") // tooltip graph in svg
                .attr("id", `grid-${zcta}-tooltip-svg`)
                .attr("class", `tooltip-outer-svg`)
            var gridTTPFooter = gridTTP.append("div")
                .attr("class", "tooltip-footer")
            gridTTPFooter.append("div")
                .attr("class", "tooltip-options")

            // main visualization
            var gridDiv = gridTTPContainer.append("div")
                .attr("id", `grid-${zcta}`)
                .attr("class", "quadrant")
                .attr("zcta", zcta)
                .attr("county", county)
                .datum(zcta)

            gridDiv.on("click", () => (gridTTPContainer.node().open = !gridTTPContainer.node().open))

            var gridSVG = gridDiv.append("svg")
                .attr("id", `grid-${zcta}-svg`)
                .attr("class", "grid-item")
                .attr("zcta", zcta)
                .attr("width", gridItemWidth)
                .attr("height", gridItemHeight)

            gridSVG.append("rect") // background
                .attr("class", "grid-background")
                .attr("width", gridItemWidth)
                .attr("height", gridItemHeight)
                .style("fill", "var(--sl-color-gray-200)")

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
                var historicalGroup = gridSVG.append("g")
                    .attr("class", dataSource)
                historicalGroup.append("path")
                    .attr("stroke", "black")
                    .attr("stroke-dasharray", gridLineStyle[dataSource])
                    .attr("fill", "none")
                    .attr("stroke-width", 1.5)
            })

            // add value label and dot
            var valueLabel = gridSVG.append("g") 
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
    var gridContainerD3 = d3.select(gridContainer)

    gridStartDate.html(d3.timeFormat("%B %d, %Y")(historicalDates[0]))
    gridEndDate.html(d3.timeFormat("%B %d, %Y")(currentWeek))

    gridHeight = gridContainer.clientHeight
    gridWidth = gridContainer.clientWidth

    var adjustedHeight = gridHeight - 1*em
    var adjustedWidth = gridWidth - 1*em

    var colItems = Math.min(6, Math.max(Math.floor(adjustedHeight/(120-.25*em)), 1))
    var rowItems = Math.min(8, Math.max(Math.floor(adjustedWidth/(150-.25*em)), 1))

    var gridItemHeight = (adjustedHeight-((colItems-1)*.25*em))/colItems
    var gridItemWidth = (adjustedWidth-((rowItems-1)*.25*em))/rowItems

    var diseaseData = zctaData.features

    // create scales
    var [gridDataSource, gridDataVariable, gridHistOrProj] = gridDataSourceSortSelector.value.split('_')
    var gridColor = d3.scaleQuantile()
        .domain(getDataAsArray(zctaData, gridDataSource, gridDataVariable, gridHistOrProj, gridRateSwitch.value == "rate", gridIncludeImputations.checked)
            .filter(function(d) {return d != 0}))
        .range(gridBackgroundColors)
        .unknown("var(--sl-color-gray-600)")

    var xScale = d3.scaleTime()
                .domain([d3.timeDay.offset(startDate, -7), currentWeek])
                .range([0, gridItemWidth*.75]) 

    // draw grid graph        
    gridContainerD3.selectAll("div.grid-container").data(diseaseData, function(d) {
        return d.properties.ZCTA
    }).each(function(d, i, dom) {
        var zcta = d.properties.ZCTA

        var data = JSON.parse(JSON.stringify(d.properties.data))
        var mainData = data[gridDataSource][gridDataVariable][gridHistOrProj]

        var thisCountMax = 0

        // if not including imputations, skip if data is imputated
        if (!gridIncludeImputations.checked && data.imputation) {
            return
        }

        // process data
        gridItemDataSources.forEach(function(dataSource) {
            var [ds, dv, hop] = dataSource.split('_')
            if (gridRateSwitch.value == "rate") {
                data[ds][dv][hop] = data[ds][dv][hop].map(function(item) { return item === null ? null : item/d.population * 1000} )
            }
            if (data[ds][dv][hop].length) {
                thisCountMax = d3.max([thisCountMax, ...data[ds][dv][hop]])
            }
        })

        var value = parseFloat(mainData.at(-1))

        // update the heights/widths of things
        var gridSVG = d3.select(`#grid-${zcta}-svg`)
            .attr("width", gridItemWidth)
            .attr("height", gridItemHeight)

        gridSVG.select(".grid-background")
            .transition()
            .duration(1000)
            .attr("width", gridItemWidth)
            .attr("height", gridItemHeight)
            .style("fill", gridColor(value))

        // create yscale
        var yScale = d3.scaleLinear()
            .domain([0, thisCountMax])        
            .nice()
            .range([gridItemHeight-2, margin.top])

        // draw the lines!
        gridItemDataSources.forEach(function(dataSource) {
            var [ds, dv, hop] = dataSource.split('_')

            // draw historical line chart
            var historicalGroup = gridSVG.select("g."+dataSource)
            historicalGroup.select("path")
                .transition()
                .duration(1000)
                .attr("d", d3.line()
                            .x((_, i) => xScale(historicalDates[i]))
                            .y((d) => yScale(d))
                            .defined(d => d !== null)
                            .curve(d3.curveMonotoneX)(data[ds][dv][hop])
                )
                .attr("stroke", "black")
                .attr("stroke-dasharray", gridLineStyle[dataSource])
                .attr("fill", "none")
                .attr("stroke-width", 1.5)
        })

        // place value label and dot 
        var lastValueMarker = gridSVG.select(".grid-item-value") //TODO: rename this, my brain is tired
        var dotPlacementX = gridDataSourceSortSelector.value.includes("projected") ? gridItemWidth - 3 : xScale.range()[1]
        var valuePlacementX = gridDataSourceSortSelector.value.includes("projected") ? dotPlacementX : dotPlacementX + 4
        var dotPlacementY, valuePlacementY
        if (!isNaN(value)) {
            lastValueMarker.attr("opacity", 1)
            dotPlacementY = Math.max(yScale(value), 0)
            if (gridDataSourceSortSelector.value.includes("projected")) {
                if (mainData.at(-2) < value) {
                    valuePlacementY = Math.max(dotPlacementY - 6, em)
                } else{
                    valuePlacementY = Math.min(dotPlacementY + em, gridItemHeight - 3)
                }
            } else {
                valuePlacementY = Math.min(Math.max(dotPlacementY + 6, em), gridItemHeight - 3)
            }

            lastValueMarker.select("text")
                .attr("x", valuePlacementX)
                .attr("y", valuePlacementY)
                .attr("text-anchor", gridDataSourceSortSelector.value.includes("projected") ? "end" : "start")
                .text(value.toFixed(1))

            lastValueMarker.select("circle")
                .attr("cx", dotPlacementX)
                .attr("cy", dotPlacementY)

            lastValueMarker.select("line")
                .attr("display", gridDataSourceSortSelector.value.includes("projected") ? "initial" : "none")

            if (gridDataSourceSortSelector.value.includes("projected")) {
                lastValueMarker.select("line")
                    .attr("display", "initial")
                    .attr("x1", xScale.range()[1])
                    .attr("y1", yScale(value))
                    .attr("x2", dotPlacementX)
                    .attr("y2", dotPlacementY)
            }
            
        } else {
            lastValueMarker.attr("opacity", 0)
        }

    })

    sortGrid()
    
}

function sortGrid() {        
    var [gridDataSource, gridDataVariable, gridHistOrProj] = gridDataSourceSortSelector.value.split('_')
    switch (gridSort.value) {
        case "value-high": // sort value high-low
            d3.selectAll("div.grid-container")
                .sort((a, b) => {
                    var aValue = parseFloat(a.properties.data[gridDataSource][gridDataVariable][gridHistOrProj].at(-1)) || 0
                    var bValue = parseFloat(b.properties.data[gridDataSource][gridDataVariable][gridHistOrProj].at(-1)) || 0
                    if (gridRateSwitch.value == "rate") {
                        aValue /= a.properties.population / 1000
                        bValue /= b.properties.population / 1000
                    }

                    return bValue - aValue
                })
            break;
        case "value-low": // sort value low-high
            d3.selectAll("div.grid-container")
                .sort((a, b) => {
                    var aValue = parseFloat(a.properties.data[gridDataSource][gridDataVariable][gridHistOrProj].at(-1)) || 0
                    var bValue = parseFloat(b.properties.data[gridDataSource][gridDataVariable][gridHistOrProj].at(-1)) || 0
                    if (gridRateSwitch.value == "rate") {
                        aValue /= a.properties.population / 1000
                        bValue /= b.properties.population / 1000
                    }

                    return aValue - bValue
            })
            break;
        case "alphabetical-low": // sort value a-z-0-9
            d3.selectAll("div.grid-container")
                .sort((a, b) => a.properties.ZCTA - b.properties.ZCTA)
            break;
        case "alphabetical-high": // sort value 9-0-a-z
            d3.selectAll("div.grid-container")
                .sort((a, b) => b.properties.ZCTA - a.properties.ZCTA)
            break;
        default: // sort value high-low
            d3.selectAll("div.grid-container")
                .sort((a, b) => {
                    var aValue = parseFloat(a.properties.data[gridDataSource][gridDataVariable][gridHistOrProj].at(-1)) || 0
                    var bValue = parseFloat(b.properties.data[gridDataSource][gridDataVariable][gridHistOrProj].at(-1)) || 0
                    if (gridRateSwitch.value == "rate") {
                        aValue /= a.properties.population / 1000
                        bValue /= b.properties.population / 1000
                    }

                    return bValue - aValue
                })
            break;
    }
}

function setupGridTooltip(ttpDiv, redraw=false) {
    var [gridDataSource, gridDataVariable, gridHistOrProj] = gridDataSourceSortSelector.value.split('_')

    var gridTooltipWidth = Math.max(500, gridWidth * .3)
    var gridTooltipHeight = gridTooltipWidth * .65

    var slTTP = ttpDiv
    var ttpSVG = slTTP.select(".tooltip-outer-svg")
    var thisGridContainer = d3.select(slTTP.node().parentNode)
    
    var thisData = thisGridContainer.datum().properties

    var extraDataSources = {}
    if (redraw) {
        ttpSVG.datum()["extraDataSources"]
    }

    ttpSVG.attr("width", gridTooltipWidth)
    ttpSVG.attr("height", gridTooltipHeight)

    drawTooltip(thisData, 
        ttpSVG, slTTP.select(".tooltip-header"), slTTP.select(".tooltip-footer"), 
        gridDataSource, gridDataVariable, 
        gridRateSwitch.value == "rate", true, false, extraDataSources)
}