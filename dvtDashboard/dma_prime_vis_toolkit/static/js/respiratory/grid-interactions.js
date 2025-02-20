import { zctaData, drawTooltip } from "/static/js/respiratory/script.js";
import { gridWidth, gridHeight, updateGridData, sortGrid } from "/static/js/respiratory/grid.js";

gridContainerResizer.addEventListener("sl-resize", () => {
    updateGridData()
})

gridSort.addEventListener("sl-change", (event) => {
    sortGrid()
})

gridRateSwitch.addEventListener("sl-change", (event) => {
    d3.select(gridContainer).selectAll("sl-tooltip[open]")
        .each(function(d, i) {
            var gridTooltipWidth = Math.max(500, gridWidth * .3)
            var gridTooltipHeight = gridTooltipWidth * .65
    
            var slTTP = d3.select(this)
            console.log(slTTP)
            var slTTPDOM = slTTP.node()
            var thisGridContainer = d3.select(slTTPDOM.parentNode)
    
            var thisData = thisGridContainer.datum().properties
    
            var tooltipData = thisData.data[mapDiseaseSelector.value]
            tooltipData["zcta"] = thisData.ZCTA
            tooltipData["county"] = thisData.county
            tooltipData["population"] = thisData.population

            drawTooltip(thisData, slTTP.select("div[slot='content']"), gridTooltipHeight, gridTooltipWidth, gridRateSwitch.value == "rate")

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
        case "influenza-2":
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
    var diseaseData = zctaData.features

    // get all zcta that partially match (case ignored) either zip code or county
    var matchingZCTAData = diseaseData.filter(function(d) {
        var countyMatch = d.properties.county.toLowerCase().includes(gridTextFilter.value.toLowerCase())
        var zctaMatch = d.properties.ZCTA.toString().toLowerCase().includes(gridTextFilter.value.toLowerCase())
        return countyMatch || zctaMatch
    })

    // if we're not including imputations, then filter them out so they don't show
    if (!gridIncludeImputations.checked) {
        matchingZCTAData = matchingZCTAData.filter(function(d) {
            return !d.properties.data[gridDiseaseSelector.value].imputation
        })
    }

    // get all grid items corresponding to the selected zcta 
    var objs = d3.selectAll("div.grid-container")
        .data(matchingZCTAData, function(d) {
            return d.properties.ZCTA
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