
gridSort.addEventListener("sl-change", (event) => {
    sortGrid()
})

gridRateSwitch.addEventListener("sl-change", (event) => {
    // when population aggregation switch is changed, update the visualization
    // displayGridAggregateChart()

  d3.select(gridContainer).selectAll("sl-tooltip[open]")
        .each(function(d, i) {
            slTTP = d3.select(this)
            gridTooltipWidth = Math.max(500, width * .3)
            gridTooltipHeight = gridTooltipWidth * .65
            drawTooltip(d3.select(this.parentNode).datum(), slTTP.select("div[slot='content']"), gridTooltipHeight, gridTooltipWidth, gridRateSwitch.value == "rate")

        })
    updateGridData()
})

gridDataSourceSortSelector.addEventListener("sl-change", (event) => {
    updateGridData()    
})

gridDiseaseSelector.addEventListener("sl-change", (event) => {
    switch(gridDiseaseSelector.value) {
        case "covid-19":
            gridStatePredictionOption.innerHTML = "State (5th week prediction)"
            break
        case "influenza-1":
            console.log("influenza-1")
        case "influenza-2":
            console.log("influenza-2")
            gridStatePredictionOption.innerHTML = "State (2nd week prediction)"
            break
        default:
            gridStatePredictionOption.innerHTML = "State (5th week prediction)"
    }
    updateGridData()
})

gridTextFilter.addEventListener("sl-input", filterZCTAByText)

function filterZCTAByText(event) {
    // get filtration value
    diseaseData = zctaData[gridDiseaseSelector.value]

    // get all zcta that partially match (case ignored) either zip code or county
    matchingZCTAData = diseaseData.filter(function(d) {
        countyMatch = d.county.toLowerCase().includes(gridTextFilter.value.toLowerCase())
        zctaMatch = d.zcta.toString().toLowerCase().includes(gridTextFilter.value.toLowerCase())
        return countyMatch || zctaMatch
    })

    // if we're not including imputations, then filter them out so they don't show
    if (!gridIncludeImputations.checked) {
        matchingZCTAData = matchingZCTAData.filter(function(d) {
            return !d.imputation
        })
    }

    // get all grid items corresponding to the selected zcta 
    objs = d3.selectAll("div.grid-container")
        .data(matchingZCTAData, function(d) {
            return d.zcta
        })
    objs.style("display", "initial") // show ones that match
    objs.exit()
        .style("display", "none") // hide ones that don't
}

gridIncludeImputations.addEventListener("sl-change", () => {
    if (gridIncludeImputations.checked) {
        // include all zcta including imputations
        d3.selectAll("div.grid-container")
            .style("display", "initial")
    } else {
        // hide imputed zcta
        d3.selectAll("div.grid-container")
            .filter(function(d) {
                return d.imputation
            })
            .style("display", "none")
    }
    updateGridData() // update display since the min and max values will change
    filterZCTAByText() // filter again since the if else statement didn't account for that
})

function setGridTooltip(gridTooltip) {
    // draw the tooltip for each grid item
    gridTooltip.on("sl-show", function(event) {
        // get data/parameters together for drawing the tooltip         
        gridTooltipWidth = Math.max(500, width * .3)
        gridTooltipHeight = gridTooltipWidth * .65

        slTTPDOM = event.target
        slTTP = d3.select(slTTPDOM)
            .style("--max-width", gridTooltipWidth*1.2)
        thisGridContainer = d3.select(slTTPDOM.parentNode)

        // actually draw tooltip
        drawTooltip(thisGridContainer.datum(), slTTP.select("div[slot='content']"), gridTooltipHeight, gridTooltipWidth, gridRateSwitch.value == "rate")
    })
    
}