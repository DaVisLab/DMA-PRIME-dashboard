import { zctaData } from "/static/js/respiratory/script.js";
import { gridWidth, gridHeight, updateGridData, sortGrid, setupGridTooltip } from "/static/js/respiratory/grid.js";

gridCloseTtpsButton.addEventListener("click", () => {
    d3.selectAll(".grid-container > sl-tooltip").each(function(_) {this.open = false})
})

gridContainerResizer.addEventListener("sl-resize", () => {
    updateGridData()
})

gridSort.addEventListener("sl-change", (event) => {
    sortGrid()
})

gridRateSwitch.addEventListener("sl-change", (event) => {
    d3.select(gridContainer).selectAll("sl-tooltip[open]")
        .each(function(d, i) {
            setupGridTooltip(d3.select(this), true)
        })
    updateGridData()
})

gridDataSourceSortSelector.addEventListener("sl-change", (event) => {
    updateGridData()    
})

gridDiseaseSelector.addEventListener("sl-change", (event) => {
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