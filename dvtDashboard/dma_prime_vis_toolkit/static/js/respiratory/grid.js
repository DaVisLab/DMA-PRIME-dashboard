
import { populationColorMap, unknownColor, getFeatureValue, getAllValuesFromFeature, getAllFeaturesValue, drawTooltip, drawStateHospitalizations } from "/static/js/respiratory/script.js";
export { updateGrid, sortGridItems, filterGridItems, setupGridTooltip,
    updateGridOutcomeVariableOptions, updateGridPopulationOptions, updateGridGeographicUnitOptions
 }

var margins = {
    top: 1.5 * em,
    right: 0,
    bottom: 0.5 * em,
    left: 0
}


await Promise.allSettled([ // wait for following to be defined/load in
    customElements.whenDefined('sl-select'),
    customElements.whenDefined('sl-option'),
    customElements.whenDefined('sl-button'),
])

var regionData = await d3.json(`/data/respiratory/${gridGeographicUnitSelector.value}/${gridDiseaseSelector.value}?data_version=${metadata.data_version}&${parseInt(Math.random() * 9999999999)}`)

updateGrid(true)
drawStateHospitalizations(gridDiseaseSelector.value, gridTypeSwitch.value, gridStateHospitalizationsSvg, gridStateHospitalizationsSubtitle)

// set up grids for each location in selected geographic unit

// location div - attach feature data here
// sl-tooltip
// graph (svg)
// popup (div slot=content)

async function updateData() {
    regionData = await d3.json(`/data/respiratory/${gridGeographicUnitSelector.value}/${gridDiseaseSelector.value}?data_version=${metadata.data_version}&${parseInt(Math.random() * 9999999999)}`)
    gridContainer.innerHTML = ""

    var gridContainerD3 = d3.select(gridContainer)
    gridContainerD3.selectAll("div")
        .data(regionData.features)
        .enter()
        .append("div")
        .classed("grid-container", true)
        .each(function (feature) {
            let location = feature.properties.id
            let idLocation = location.toString().split(" ").join("_")

            var county = null

            if (gridGeographicUnitSelector.value == "zcta") {
                county = feature.properties.county
            }

            var gridItemContainer = d3.select(this)

            // using sl-tooltip to use shoelace's built in functionality
            var gridTTPContainer = gridItemContainer.append("sl-tooltip")
                .attr("class", "grid-item-tooltip")
                .attr("trigger", "manual")
                .attr("hoist", "")

            // set grid tooltip interaction - this happens when grid item is clicked
            gridTTPContainer.on("sl-after-show", function (event) {
                setupGridTooltip(d3.select(event.target), false)
            })

            // tooltip
            var gridTTP = gridTTPContainer.append("div")
                .attr("slot", "content")
                .attr("id", `grid-${idLocation}-tooltip`)
                .attr("class", `tooltip-div`)

            gridTTPContainer.node().updateComplete.then(function (a, b) {
                var slTtpBody = d3.select(gridTTPContainer.node().shadowRoot).select("div[part='body']")
                slTtpBody.style("pointer-events", "auto")

                gridTTP.append("sl-icon-button")
                    .attr("name", "x")
                    .attr("class", "grid-close-tooltip-button grid-tooltip-toolbar-button")
                    .on("click", () => gridTTPContainer.node().open = false)

                // Add expand icon button next to close button
                gridTTP.append("sl-icon-button")
                    .attr("name", "zoom-in")
                    .attr("class", "grid-open-expanded-tooltip-button grid-tooltip-toolbar-button")
                    .on("click", () => {
                        d3.select(modelExplorationButtonTooltipLarge).on("click", () => {
                            window.open(`/respiratory-model-exploration?disease=${gridDiseaseSelector.value}&geographic-unit=${gridGeographicUnitSelector.value}&population=${gridPopulationSelector.value}&outcome-variable=${gridOutcomeVariableSelector.value}&location=${location}`)
                        })
                        var largeTtp = d3.select(tooltipLarge)
                        tooltipLarge.show().then(async () => {
                            var allExtendedData = await d3.json(`/data/respiratory/${gridGeographicUnitSelector.value}/${gridDiseaseSelector.value}/extended?data_version=${metadata.data_version}&${parseInt(Math.random() * 9999999999)}`)
                            var ttpData = {
                                "id": location,
                                "display_name": feature.properties.display_name,
                                "county": feature.properties.county,
                                "data": allExtendedData[location],
                                "facility_type": feature.properties.facility_type,
                                "system": feature.properties.system,
                            }
                            drawTooltip(ttpData,
                                largeTtp.select(".tooltip-outer-svg"), largeTtp.select(".tooltip-header"), largeTtp.select(".tooltip-footer"),
                                gridPopulationSelector.value, gridOutcomeVariableSelector.value,
                                gridTypeSwitch.value, true, true, [])
                        })
                    })

                gridTTP.append("sl-icon-button")
                    .attr("name", "info-circle")
                    .attr("class", "grid-tooltip-toolbar-button grid-model-exploration-icon-button")
                    .on("click", () => {
                        window.open(`/respiratory-model-exploration?disease=${gridDiseaseSelector.value}&geographic-unit=${gridGeographicUnitSelector.value}&population=${gridPopulationSelector.value}&ouctome-variable=${gridOutcomeVariableSelector.value}&location=${location}`)
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

            // title
            var gridTitle = gridSVG.append("text")
                .attr("class", "grid-title")
                .attr("x", 0.25 * em)
                .attr("y", em)
                .text(location)

            if (gridGeographicUnitSelector.value == "facility") {
                gridTitle.text(feature.properties.display_name)
            }

            if (gridGeographicUnitSelector.value == "zcta") {
                gridTitle.append("tspan")
                    .attr("class", "grid-subtitle")
                    .html(` (${county.toUpperCase()})`)
            }

            var historicalLine = gridSVG.append("path")
                .attr("class", "grid-item-historical-line")

            // add value label and dot
            var valueLabel = gridSVG.append("g")
                .attr("class", "grid-item-value")
            valueLabel.append("line")
            valueLabel.append("circle")
            valueLabel.append("text")

        })
}

async function updateGrid(fetchData = true) {
    // idk
    if (fetchData == true) {
        await updateData()
    }

// redo summary text
    let outcomeVariableString = d3.select(gridOutcomeVariableSelector).select(`*[value=${gridOutcomeVariableSelector.value}]`).html()
    let gridSummaryText = `Weekly `
    gridSummaryText += d3.select(gridTypeSwitch).select(`*[value=${gridTypeSwitch.value}]`).html().toLowerCase()
    gridSummaryText += ` of ${outcomeVariableString.toLowerCase()} due to `
    gridSummaryText += d3.select(gridDiseaseSelector).select(`*[value=${gridDiseaseSelector.value}]`).html()
    gridSummaryText += ` from ${d3.timeFormat("%B %d, %Y")(startShortHistory)} to ${d3.timeFormat("%B %d, %Y")(shortHistoryDates[expectedShortHistoryDataPoints-1])}.<br/>`
    gridSummaryText += `${outcomeVariableString[0]}${outcomeVariableString.toLowerCase().slice(1)} are aggregated by `
    gridSummaryText += d3.select(gridGeographicUnitSelector).select(`*[value=${gridGeographicUnitSelector.value}]`).html().toLowerCase().replace("zcta", "ZCTA")
    gridSummaryText += `.`
    gridSummary.innerHTML = gridSummaryText

    var gridContainerD3 = d3.select(gridContainer)

    var gridHeight = gridContent.clientHeight
    var gridWidth = gridContainer.clientWidth

    var adjustedHeight = gridHeight - 1 * em
    var adjustedWidth = gridWidth - 2 * em

    // calculate how many row and column items of at least specified width/height would fit in the grid container
    var colItems = Math.min(6, Math.max(Math.floor(adjustedHeight / (120 - .25 * em)), 1))
    var rowItems = Math.min(8, Math.max(Math.floor(adjustedWidth / (150 - .25 * em)), 1))

    if (d3.select(gridContainer).selectAll("div.grid-container").size() > colItems*rowItems) {
        adjustedWidth -= scrollbarWidth
    }

    // calculate height and width based on that
    var gridItemHeight = (adjustedHeight - ((colItems - 1) * .25 * em)) / colItems
    var gridItemWidth = (adjustedWidth - ((rowItems - 1) * .25 * em)) / rowItems

    // create scales
    var gridColor

    if (gridTypeSwitch.value == "percentDifference") {
        gridColor = d3.scaleThreshold()
            .domain([-100, -50, 0, 50, 100, 500])
            .range(d3.reverse(d3.schemeRdBu[8]).slice(1))
            .unknown(unknownColor)
    } else {
        gridColor = d3.scaleQuantile()
            .domain(d3.extent(getAllFeaturesValue(regionData.features,
                gridPopulationSelector.value, gridOutcomeVariableSelector.value,
                gridTypeSwitch.value, gridIncludeImputations.checked)))
            .unknown(unknownColor)
            .range(d3.quantize(d3.interpolateRgb("white", populationColorMap[gridPopulationSelector.value]['historical']), 5))

    }

    var xScale = d3.scaleTime()
        .domain([startShortHistory, currentDate])
        .range([0, gridItemWidth * .75])

    gridContainerD3.selectAll("div.grid-container").each(function (feature) {
        // draw grid graph
        var data = JSON.parse(JSON.stringify(feature.properties.data[gridPopulationSelector.value][gridOutcomeVariableSelector.value]))

        let countMax = 0

        // update the heights/widths of things
        var gridSVG = d3.select(this).select(`.grid-item`)
            .attr("width", gridItemWidth)
            .attr("height", gridItemHeight)

        // process data
        Array("historical", "projected").forEach(e_p => {
            if (gridTypeSwitch.value == "rate") {
                data[e_p]["values"] = data[e_p]["values"].map(d => d === null ? null : d / feature.properties.population * 1000)
            }
            countMax = d3.max([...data[e_p]["values"], countMax])
        })

        let value = getFeatureValue(feature, gridPopulationSelector.value, gridOutcomeVariableSelector.value,
            gridTypeSwitch.value, gridIncludeImputations.checked)

        gridSVG.select(".grid-background")
            // .transition()
            // .duration(1000)
            .attr("width", gridItemWidth)
            .attr("height", gridItemHeight)

        if (gridTypeSwitch.value == "percentDifference") {
            let c
            if (isNaN(value[1]) || value[0]) {
                c = gridColor(value[2])
            } else if (value[1] == 0) {
                c = "white"
            } else {
                c = "#ff8800"
            }
            gridSVG.select(".grid-background").style("fill", c)
        } else {
            gridSVG.select(".grid-background").style("fill", gridColor(value))
        }
        
        // create yscale
        var yScale = d3.scaleLinear()
            .domain([0, countMax])
            .nice()
            .range([gridItemHeight - 2, margins.top])
            .clamp(true)


        if (gridTypeSwitch.value == "percentDifference") {
            var percentDifferenceValues = getAllValuesFromFeature(feature.properties, gridPopulationSelector.value, gridOutcomeVariableSelector.value, gridTypeSwitch.value, "historical")
            let pdMax = d3.max(percentDifferenceValues)
            let pdMin = d3.min(percentDifferenceValues)
            pdMax = Math.min(pdMax, 500)
                    
            var yScale2 = d3.scaleLinear()
                .domain([pdMin, pdMax])        
                .nice()
                .range([gridItemHeight - 2, margins.top])
                    
            yScale.domain([yScale.domain()[1]*(yScale2.domain()[0]/yScale2.domain()[1]), yScale.domain()[1]])
            gridSVG.insert("line", ".grid-item-historical-line")
                .attr("x1", 0)
                .attr("x2", gridWidth)
                .attr("y1", yScale2(0))
                .attr("y2", yScale2(0))
                .attr("stroke", "#cccccc")
        }

        // draw historical line chart
        var historicalGroup = gridSVG.select(".grid-item-historical-line")
        historicalGroup
            .attr("d", d3.line()
                .x((_, i) => xScale(d3.timeDay.offset(startShortHistory, 7*i)))
                .y((d) => yScale(d))
                .defined(d => d || d == 0)
                .curve(d3.curveMonotoneX)(data.historical.values.concat([data.projected.values[0]]))
            )

        if (gridTypeSwitch.value == "percentDifference") {
            percentDifferenceValues.push(value[2])
            historicalGroup.attr("stroke-dasharray", "3")
                .attr("stroke", "#444444")
            gridSVG.append("path")
                .attr("d", d3.line()
                    .defined(d => d || d == 0)
                    .x((_, i) => xScale(d3.timeDay.offset(startShortHistory, 7*i)))
                    .y((d, i) => yScale2(d))
                    .curve(d3.curveMonotoneX)(percentDifferenceValues)
                )
                .attr("fill", "none")
                .attr("stroke", "black")
                .attr("stroke-width", 2)
        }

        // place value label and dot 
        var lastValueMarker = gridSVG.select(".grid-item-value")
        var placementX = xScale.range()[1]
        let displayValue
        var dotPlacementY, valuePlacementY
        if (gridTypeSwitch.value == "percentDifference") {
            displayValue = value[2]
            dotPlacementY = yScale2(displayValue)
            dotPlacementY = Math.max(dotPlacementY, yScale2.range()[1])
            dotPlacementY = Math.min(dotPlacementY, yScale2.range()[0])
        } else {
            displayValue = value
            dotPlacementY = yScale(displayValue)
        }

        if (displayValue) {
            valuePlacementY = .25 * em
            if (dotPlacementY < .625*em) {
                valuePlacementY = .625*em - dotPlacementY
            } else if (dotPlacementY + 1.125*em > adjustedHeight) {
                valuePlacementY = adjustedHeight - (dotPlacementY + 1.125*em)
            }

            lastValueMarker.attr("opacity", 1)
                .attr("transform", `translate(${placementX}, ${dotPlacementY})`)

            lastValueMarker.select("text")
                .attr("x", 4)
                .attr("y", valuePlacementY)
                .text(displayValue.toFixed(1))

            lastValueMarker.select("circle")
                .attr("cx", 0)
                .attr("cy", 0)

            lastValueMarker.select("line")
                .attr("display", "none")
        } else {
            lastValueMarker.attr("opacity", 0)
        }
        
    })

    sortGridItems()
    filterGridItems()
}

function setupGridTooltip(ttpDiv, redraw = false) {
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
        gridTypeSwitch.value, true, false, [])

}

function sortGridItems() {
    switch (gridSort.value) {
        case "value-high": // sort value high-low
            d3.selectAll("div.grid-container")
                .sort((a, b) => {
                    var aValue = getFeatureValue(a, gridPopulationSelector.value, gridOutcomeVariableSelector.value, gridTypeSwitch.value, gridIncludeImputations.checked) || -1
                    var bValue = getFeatureValue(b, gridPopulationSelector.value, gridOutcomeVariableSelector.value, gridTypeSwitch.value, gridIncludeImputations.checked) || -1

                    return bValue - aValue
                })
            break;
        case "value-low": // sort value low-high
            d3.selectAll("div.grid-container")
                .sort((a, b) => {
                    var aValue = getFeatureValue(a, gridPopulationSelector.value, gridOutcomeVariableSelector.value, gridTypeSwitch.value, gridIncludeImputations.checked) || -1
                    var bValue = getFeatureValue(b, gridPopulationSelector.value, gridOutcomeVariableSelector.value, gridTypeSwitch.value, gridIncludeImputations.checked) || -1

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
                    var aValue = getFeatureValue(a, gridPopulationSelector.value, gridOutcomeVariableSelector.value, gridTypeSwitch.value, gridIncludeImputations.checked) || -1
                    var bValue = getFeatureValue(b, gridPopulationSelector.value, gridOutcomeVariableSelector.value, gridTypeSwitch.value, gridIncludeImputations.checked) || -1

                    return bValue - aValue
                })
            break;
    }
}

function filterGridItems() {

    gridContainerResizer.removeEventListener("sl-resize", updateGrid)
    let filterString = gridTextFilter.value.toLowerCase()
    d3.selectAll("div.grid-container")
        .classed("hide", feature => {
            let matched = false

            if (!gridTextFilter.value | gridTextFilter.value == "") {
                matched = true
            } else {
                if (feature.properties.county) {
                    matched |= feature.properties.county.toString().toLowerCase().includes(filterString)
                }
                matched |= feature.properties.id.toString().toLowerCase().includes(filterString)
            }

            matched &= gridIncludeImputations.checked || !feature.properties.data[gridPopulationSelector.value][gridOutcomeVariableSelector.value]["historical"].imputed
            return !matched
        })

    gridContainerResizer.addEventListener("sl-resize", updateGrid)
}

async function updateGridGeographicUnitOptions() {
    d3.selectAll(".grid-geographic-unit-option").remove()
    var availableGeographicUnits = Object.keys(metadata.available_models[gridDiseaseSelector.value])
    d3.select(gridGeographicUnitSelector)
        .selectAll(".grid-geographic-unit-option")
        .data(availableGeographicUnits)
        .enter()
        .append("sl-option")
        .attr("class", "grid-geographic-unit-option")
        .attr("value", d => d)
        .html(d => metadata.region_sizes[d])

    if (availableGeographicUnits.includes(gridGeographicUnit)) {
        // do nothing
    } else {
        gridGeographicUnit = availableGeographicUnits[0]
        gridGeographicUnitSelector.value = gridGeographicUnit
    }

    updateGridPopulationOptions()
}

async function updateGridPopulationOptions() {
    d3.selectAll(".grid-population-tooltip").remove()
    var availablePopulations = Object.keys(metadata.available_models[gridDiseaseSelector.value][gridGeographicUnitSelector.value])
    d3.select(gridPopulationSelector)
        .selectAll(".grid-population-tooltip")
        .data(availablePopulations)
        .enter()
        .append("sl-tooltip")
        .attr("class", "grid-population-tooltip")
        .attr("content", d => metadata.populations_tooltips[d])
        .attr("triger", "hover")
        .attr("hoist", "")
        .append("sl-option")
        .attr("class", "grid-population-option")
        .attr("value", d => d)
        .html(d => metadata.populations[d])

    if (availablePopulations.includes(gridPopulation)) {
        // do nothing
    } else {
        gridPopulation = availablePopulations[0]
        gridPopulationSelector.value = gridPopulation
    }

    updateGridOutcomeVariableOptions()
}

async function updateGridOutcomeVariableOptions() {
    d3.selectAll(".grid-outcome-tooltip").remove()
    var availableOutcomeVariables = metadata.available_models[gridDiseaseSelector.value][gridGeographicUnitSelector.value][gridPopulationSelector.value]
    d3.select(gridOutcomeVariableSelector)
        .selectAll(".grid-outcome-tooltip")
        .data(availableOutcomeVariables)
        .enter()
        .append("sl-tooltip")
        .attr("class", "grid-outcome-tooltip")
        .attr("content", d => metadata.outcome_variables_tooltips[d])
        .attr("triger", "hover")
        .attr("hoist", "")
        .append("sl-option")
        .attr("class", "grid-outcome-option")
        .attr("value", d => d)
        .html(d => metadata.outcome_variables[d])

    if (availableOutcomeVariables.includes(gridOutcomeVariable)) {
        // do nothing
    } else {
        gridOutcomeVariable = availableOutcomeVariables[0]
        gridOutcomeVariableSelector.value = gridOutcomeVariable
    }
}