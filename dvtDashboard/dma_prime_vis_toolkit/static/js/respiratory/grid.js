
import { populationColorMap, unknownColor, getDataAsArray, drawTooltip } from "/static/js/respiratory/script.js";
export { updateGrid, sortGridItems, filterGridItems, setupGridTooltip }

var backgroundColors = d3.schemeReds[9].slice(1,5) //[1, 2, 3, 4].map(i => d3.schemeReds[9][i])

var margins = { 
    top: 1.5*em, 
    right: 0, 
    bottom: 0.5*em, 
    left: 0 }


await Promise.allSettled([ // wait for following to be defined/load in
    customElements.whenDefined('sl-select'),
    customElements.whenDefined('sl-option'),
    customElements.whenDefined('sl-button'),
])

var regionData = await d3.json(`/data/respiratory/${gridRegionSelector.value}/${gridDiseaseSelector.value}?data_version=${metadata.data_version}&${parseInt(Math.random()*9999999999)}`)

updateGrid(true)

// set up grids for each location in selected geographic unit

    // location div - attach feature data here
        // sl-tooltip
            // graph (svg)
            // popup (div slot=content)

async function updateData() {
    regionData = await d3.json(`/data/respiratory/${gridRegionSelector.value}/${gridDiseaseSelector.value}?data_version=${metadata.data_version}&${parseInt(Math.random()*9999999999)}`)
    gridContainer.innerHTML = ""

    var gridContainerD3 = d3.select(gridContainer)
    gridContainerD3.selectAll("div")
        .data(regionData.features)
        .enter()
        .append("div")
        .classed("grid-container", true)
        .each(function(feature) {
            let location = feature.properties.id
            let idLocation = location.toString().split(" ").join("_")
            
            var county = null

            if (gridRegionSelector.value == "zcta") {
                county = feature.properties.county
            }

            var gridItemContainer = d3.select(this)

            // using sl-tooltip to use shoelace's built in functionality
            var gridTTPContainer = gridItemContainer.append("sl-tooltip")
                .attr("class", "grid-item-tooltip")
                .attr("trigger", "manual")
                .attr("hoist", "")

            // set grid tooltip interaction - this happens when grid item is clicked
            gridTTPContainer.on("sl-after-show", function(event) {
                setupGridTooltip(d3.select(event.target), false)
            })

            // tooltip
            var gridTTP = gridTTPContainer.append("div")
                .attr("slot", "content")
                .attr("id", `grid-${idLocation}-tooltip`)
                .attr("class", `tooltip-div`)
                // .style("padding", "var(--sl-spacing-small) 0")

            gridTTPContainer.node().updateComplete.then(function(a, b) {
                var slTtpBody = d3.select(gridTTPContainer.node().shadowRoot).select("div[part='body']")
                slTtpBody.style("pointer-events", "auto")

                gridTTP.append("sl-icon-button")
                    .attr("name", "x")
                    .attr("class", "grid-close-tooltip-button grid-tooltip-toolbar-button")
                    // .style("right", 0)
                    .on("click", () => gridTTPContainer.node().open = false)

                // Add expand icon button next to close button
                gridTTP.append("sl-icon-button")
                    .attr("name", "zoom-in")
                    .attr("class", "grid-open-expanded-tooltip-button grid-tooltip-toolbar-button")
                    // .style("right", "30px")
                    .on("click", () => {
                        var largeTtp = d3.select(tooltipLarge)
                        tooltipLarge.show().then(async () => {
                            var allExtendedData = await d3.json(`/data/respiratory/${gridRegionSelector.value}/${gridDiseaseSelector.value}/extended?data_version=${metadata.data_version}&${parseInt(Math.random() * 9999999999)}`)
                            var ttpData = {
                                "id": location,
                                "county": feature.properties.county,
                                "data": allExtendedData[location]
                            }
                            drawTooltip(ttpData,
                                largeTtp.select(".tooltip-outer-svg"), largeTtp.select(".tooltip-header"), largeTtp.select(".tooltip-footer"),
                                gridPopulationSelector.value, gridOutcomeVariableSelector.value,
                                gridTypeSwitch.value == "rate", true, true, [])
                        })
                    })

                gridTTP.append("sl-icon-button")
                    .attr("name", "info-circle")
                    .attr("class", "grid-tooltip-toolbar-button grid-model-exploration-icon-button")
                    .on("click", () => {
                        window.open(`/respiratory-model-exploration?disease=${mapDiseaseSelector.value}&geographic-unit=${mapRegionSelector.value}&population=${mapPopulationSelector.value}&ouctome-variable${mapOutcomeVariableSelector.value}&location=${location}`)
                    })


            })
            
            var gridTTPHeader = gridTTP.append("div")
                .attr("class", "tooltip-header")
            gridTTPHeader.append("div")
                .attr("class", "tooltip-region-info")
            gridTTPHeader.append("div")
                .attr("class", "tooltip-data-info")
            gridTTP.append("svg") // tooltip graph in svg
                .attr("id", `grid-${idLocation}-tooltip-svg`)
                .attr("class", `tooltip-outer-svg`)
            var gridTTPFooter = gridTTP.append("div")
                .attr("class", "tooltip-footer")
            gridTTPFooter.append("div")
                .attr("class", "tooltip-legend")
            gridTTPFooter.append("div")
                .attr("class", "tooltip-options")

            // main visualization
            var gridDiv = gridTTPContainer.append("div")
                .attr("id", `grid-${idLocation}`)
                .attr("class", "quadrant")
                .attr("location", location)
                .attr("county", county)
                .datum(location)

            gridDiv.on("click", () => (gridTTPContainer.node().open = !gridTTPContainer.node().open))

            var gridSVG = gridDiv.append("svg")
                .attr("id", `grid-${idLocation}-svg`)
                .attr("class", "grid-item")
                .attr("location", location)

            gridSVG.append("rect") // background
                .attr("class", "grid-background")
                // .style("fill", "var(--sl-color-gray-200)")

            // title
            var gridTitle = gridSVG.append("text")
                .attr("class", "grid-title")
                .attr("x", 0.25*em)
                .attr("y", em)
                .text(location

                )
            if (gridRegionSelector.value == "zcta") {
                gridTitle.append("tspan")
                    .attr("class", "grid-subtitle")
                    .html(` (${county.toUpperCase()})`)

            }

            var historicalLine = gridSVG.append("path")
                .attr("class", "grid-item-historical-line")

            // // add each line object
            // gridItemDataSources.forEach(function(dataSource) {
            //     // draw historical line chart
            //     var historicalGroup = gridSVG.append("g")
            //         .attr("class", dataSource)
            //     historicalGroup.append("path")
            //         .attr("stroke", "black")
            //         .attr("stroke-dasharray", gridLineStyle[dataSource])
            //         .attr("fill", "none")
            //         .attr("stroke-width", 1.5)
            // })

            // add value label and dot
            var valueLabel = gridSVG.append("g") 
                .attr("class", "grid-item-value")
            valueLabel.append("line")
            valueLabel.append("circle")
            valueLabel.append("text")
                // .attr("text-anchor", gridDataSourceSortSelector.value == "state-prediction" ? "end" : "start")
        
        })
}

async function updateGrid(fetchData=true) {
    // idk
    if (fetchData == true) {
        await updateData()
    }

    var gridContainerD3 = d3.select(gridContainer)

    var gridHeight = gridContent.clientHeight
    var gridWidth = gridContainer.clientWidth

    var adjustedHeight = gridHeight - 1*em
    var adjustedWidth = gridWidth - 2*em

    // calculate how many row and column items of at least specified width/height would fit in the grid container
    var colItems = Math.min(6, Math.max(Math.floor(adjustedHeight/(120-.25*em)), 1))
    var rowItems = Math.min(8, Math.max(Math.floor(adjustedWidth/(150-.25*em)), 1))

    // calculate height and width based on that
    var gridItemHeight = (adjustedHeight-((colItems-1)*.25*em))/colItems
    var gridItemWidth = (adjustedWidth-((rowItems-1)*.25*em))/rowItems


    // create scales
    var gridColor = d3.scaleQuantile()
                    .domain(d3.extent(getDataAsArray(regionData, 
                        gridPopulationSelector.value, gridOutcomeVariableSelector.value, 
                        "historical", gridTypeSwitch.value == "rate", 
                        gridIncludeImputations.checked)))
                    .range(d3.quantize(d3.interpolateRgb("white", populationColorMap[gridPopulationSelector.value]['historical']), 5))
                    .unknown(unknownColor)

    var xScale = d3.scaleTime()
                .domain([startShortHistory, shortHistoryDates[expectedShortHistoryDataPoints-1]])
                .range([0, gridItemWidth*.75]) 

    gridContainerD3.selectAll("div.grid-container").each(function(feature) {
        // draw grid graph
        let location = feature.properties.id
        var data = JSON.parse(JSON.stringify(feature.properties.data[gridPopulationSelector.value][gridOutcomeVariableSelector.value]))
        
        let countMax = 0
        d3.select(this).classed("hide", false)

        // update the heights/widths of things
        var gridSVG = d3.select(this).select(`.grid-item`)
            .attr("width", gridItemWidth)
            .attr("height", gridItemHeight)

        // process data
        Array("historical", "projected").forEach(e_p => {
            if (gridTypeSwitch.value == "rate") {
                data[e_p]["values"] = data[e_p]["values"].map(d => d === null ? null : d/feature.properties.population * 1000)
            }
            countMax = d3.max([...data[e_p]["values"], countMax])
        })

        let value

        value = data["historical"].values[expectedShortHistoryDataPoints-1]


        gridSVG.select(".grid-background")
            // .transition()
            // .duration(1000)
            .attr("width", gridItemWidth)
            .attr("height", gridItemHeight)
            .style("fill", gridColor(value))

        // create yscale
        var yScale = d3.scaleLinear()
            .domain([0, countMax])        
            .nice()
            .range([gridItemHeight-2, margins.top])

        // draw historical line chart
        var historicalGroup = gridSVG.select(".grid-item-historical-line")
        historicalGroup
            // .transition()
            // .duration(1000)
            .attr("d", d3.line()
                        .x((_, i) => xScale(shortHistoryDates[i]))
                        .y((d) => yScale(d))
                        .defined(d => d !== null)
                        .curve(d3.curveMonotoneX)(data.historical.values)
            )
        
        // place value label and dot 
        var lastValueMarker = gridSVG.select(".grid-item-value")
        // var dotPlacementX = gridDataSourceSortSelector.value.includes("projected") ? gridItemWidth - 3 : xScale.range()[1]
        // var valuePlacementX = gridDataSourceSortSelector.value.includes("projected") ? dotPlacementX : dotPlacementX + 4
        var dotPlacementX = xScale.range()[1]
        var valuePlacementX = dotPlacementX + 4
        var dotPlacementY, valuePlacementY
        if (!isNaN(value)) {
            lastValueMarker.attr("opacity", 1)
            dotPlacementY = Math.max(yScale(value), 0)
            valuePlacementY = Math.min(Math.max(dotPlacementY + 6, em), gridItemHeight - 3)
            // if (gridDataSourceSortSelector.value.includes("projected")) {
            //     if (mainData.at(-2) < value) {
            //         valuePlacementY = Math.max(dotPlacementY - 6, em)
            //     } else{
            //         valuePlacementY = Math.min(dotPlacementY + em, gridItemHeight - 3)
            //     }
            // } else {
            //     valuePlacementY = Math.min(Math.max(dotPlacementY + 6, em), gridItemHeight - 3)
            // }

            lastValueMarker.select("text")
                .attr("x", valuePlacementX)
                .attr("y", valuePlacementY)
                // .attr("text-anchor", gridDataSourceSortSelector.value.includes("projected") ? "end" : "start")
                .text(value.toFixed(1))

            lastValueMarker.select("circle")
                .attr("cx", dotPlacementX)
                .attr("cy", dotPlacementY)

            lastValueMarker.select("line")
                .attr("display", "none")
                // .attr("display", gridDataSourceSortSelector.value.includes("projected") ? "initial" : "none")

            // if (gridDataSourceSortSelector.value.includes("projected")) {
            //     lastValueMarker.select("line")
            //         .attr("display", "initial")
            //         .attr("x1", xScale.range()[1])
            //         .attr("y1", yScale(value))
            //         .attr("x2", dotPlacementX)
            //         .attr("y2", dotPlacementY)
            // }
            
        } else {
            lastValueMarker.attr("opacity", 0)
        }
    })

    sortGridItems()
    filterGridItems()
}

function setupGridTooltip(ttpDiv, redraw=false) {    
    var gridWidth = gridContainer.clientWidth

    var gridTooltipWidth = Math.max(500, gridWidth * .3)
    var gridTooltipHeight = gridTooltipWidth * .65

    var slTTP = ttpDiv
    var ttpSVG = slTTP.select(".tooltip-outer-svg")
    var thisGridContainer = d3.select(slTTP.node().parentNode)
    
    var thisData = thisGridContainer.datum().properties

    ttpSVG.attr("width", gridTooltipWidth)
    ttpSVG.attr("height", gridTooltipHeight)

    drawTooltip(thisData, 
        ttpSVG, slTTP.select(".tooltip-header"), slTTP.select(".tooltip-footer"), 
        gridPopulationSelector.value, gridOutcomeVariableSelector.value, 
        gridTypeSwitch.value == "rate", true, false, [])
    
}

function sortGridItems() {
    switch (gridSort.value) {
        case "value-high": // sort value high-low
            d3.selectAll("div.grid-container")
                .sort((a, b) => {
                    var aValue = parseFloat(a.properties.data[gridPopulationSelector.value][gridOutcomeVariableSelector.value]["historical"].values.at(expectedShortHistoryDataPoints-1)) || 0
                    var bValue = parseFloat(b.properties.data[gridPopulationSelector.value][gridOutcomeVariableSelector.value]["historical"].values.at(expectedShortHistoryDataPoints-1)) || 0
                    if (gridTypeSwitch.value == "rate") {
                        aValue /= a.properties.population / 1000
                        bValue /= b.properties.population / 1000
                    }

                    return bValue - aValue
                })
            break;
        case "value-low": // sort value low-high
            d3.selectAll("div.grid-container")
                .sort((a, b) => {
                    var aValue = parseFloat(a.properties.data[gridPopulationSelector.value][gridOutcomeVariableSelector.value]["historical"].values.at(expectedShortHistoryDataPoints-1)) || 0
                    var bValue = parseFloat(b.properties.data[gridPopulationSelector.value][gridOutcomeVariableSelector.value]["historical"].values.at(expectedShortHistoryDataPoints-1)) || 0
                    if (gridTypeSwitch.value == "rate") {
                        aValue /= a.properties.population / 1000
                        bValue /= b.properties.population / 1000
                    }

                    return aValue - bValue
            })
            break;
        case "alphabetical-low": // sort value a-z-0-9
            d3.selectAll("div.grid-container")
                .sort((a, b) => {
                    if (a.properties.id.toString() < b.properties.id.toString()) {
                        return -1
                    } else if (a.properties.id.toString() > b.properties.id.toString()) {
                        return 1
                    } else {
                        return 0
                    }
                })
            break;
        case "alphabetical-high": // sort value 9-0-a-z
            d3.selectAll("div.grid-container")
                .sort((a, b) => {
                    if (b.properties.id.toString() < a.properties.id.toString()) {
                        return -1
                    } else if (b.properties.id.toString() > a.properties.id.toString()) {
                        return 1
                    } else {
                        return 0
                    }
                })
            break;
        default: // sort value high-low
            d3.selectAll("div.grid-container")
                .sort((a, b) => {
                    var aValue = parseFloat(a.properties.data[gridPopulationSelector.value][gridOutcomeVariableSelector.value]["historical"].values.at(expectedShortHistoryDataPoints-1)) || 0
                    var bValue = parseFloat(b.properties.data[gridPopulationSelector.value][gridOutcomeVariableSelector.value]["historical"].values.at(expectedShortHistoryDataPoints-1)) || 0
                    if (gridTypeSwitch.value == "rate") {
                        aValue /= a.properties.population / 1000
                        bValue /= b.properties.population / 1000
                    }

                    return bValue - aValue
                })
            break;
    }
}

function filterGridItems() {
    if (!gridTextFilter.value | gridTextFilter.value == "") {
        return
    }
    gridContainerResizer.removeEventListener("sl-resize", updateGrid)
    let filterString = gridTextFilter.value.toLowerCase()
    d3.selectAll("div.grid-container").each(function(feature) {
        let matched = false

        if (feature.properties.county) {
            matched |= feature.properties.county.toString().toLowerCase().includes(filterString)
        }
        matched |= feature.properties.id.toString().toLowerCase().includes(filterString)
        matched &= gridIncludeImputations.checked || !feature.properties.data[gridPopulationSelector.value][gridOutcomeVariableSelector.value]["historical"].imputed

        if (!matched) {
            d3.select(this).classed("hide", true)
        } else {
            d3.select(this).classed("hide", false)
        }
    }).then(d => {
        gridContainerResizer.addEventListener("sl-resize", updateGrid)
    })
}