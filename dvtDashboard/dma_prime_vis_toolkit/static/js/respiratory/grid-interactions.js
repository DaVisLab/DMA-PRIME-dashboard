import { updateGrid, sortGridItems, filterGridItems, setupGridTooltip } from "/static/js/respiratory/grid.js";

gridContainerResizer.addEventListener("sl-resize", updateGrid)

gridCloseTtpsButton.addEventListener("click", () => {
    d3.selectAll(".grid-container > sl-tooltip").each(function(_) {this.open = false})
})

gridTypeSwitch.addEventListener("sl-change", (event) => {
    d3.select(gridContainer).selectAll("sl-tooltip[open]")
        .each(function(d, i) {
            setupGridTooltip(d3.select(this), true)
        })
    updateGrid()
})

gridDiseaseSelector.addEventListener("sl-change", (event) => {
    d3.select(gridContainer).selectAll("sl-tooltip[open]")
        .each(function(d, i) {
            setupGridTooltip(d3.select(this), true)
        })
    updateGrid(true)    
})

gridRegionSelector.addEventListener("sl-change", (event) => {
    updateGrid(true)
})

gridPopulationSelector.addEventListener("sl-change", (event) => {
    d3.select(gridContainer).selectAll("sl-tooltip[open]")
        .each(function(d, i) {
            setupGridTooltip(d3.select(this), true)
        })
    updateGrid()    
})

gridOutcomeVariableSelector.addEventListener("sl-change", (event) => {
    d3.select(gridContainer).selectAll("sl-tooltip[open]")
        .each(function(d, i) {
            setupGridTooltip(d3.select(this), true)
        })
    updateGrid()    
})

gridIncludeImputations.addEventListener("sl-change", filterGridItems)

gridSort.addEventListener("sl-change", (event) => {
    sortGridItems()
})

gridTextFilter.addEventListener("sl-input", filterGridItems)
gridTextFilter.addEventListener("clear", filterGridItems)

