import { drawStateHospitalizations, drawLargeStateHospitalizations } from "/static/js/respiratory/script.js";
import { updateGrid, sortGridItems, filterGridItems, setupGridTooltip,
    updateGridOutcomeVariableOptions, updateGridPopulationOptions, updateGridGeographicUnitOptions
} from "/static/js/respiratory/grid.js";

gridContainerResizer.addEventListener("sl-resize", updateGrid)

gridCloseTtpsButton.addEventListener("click", () => {
    d3.selectAll(".grid-container > sl-tooltip").each(function(_) {this.open = false})
})

gridTypeSwitch.addEventListener("sl-change", (event) => {
    d3.select(gridContainer).selectAll("sl-tooltip[open]")
        .each(function(d, i) {
            setupGridTooltip(d3.select(this), true)
        })

    d3.select(gridMainLegend).select("text").text(d3.select(gridTypeSwitch).select(`*[value=${gridTypeSwitch.value}]`).html())
    drawStateHospitalizations(gridDiseaseSelector.value, gridTypeSwitch.value, gridStateHospitalizationsSvg, gridStateHospitalizationsSubtitle)

    if (gridTypeSwitch.value == "percentDifference") {
        d3.select(gridSecondaryLegend).style("display", "initial")
    } else {
        d3.select(gridSecondaryLegend).style("display", "none")
    }
    updateGrid()
})

gridDiseaseSelector.addEventListener("sl-change", async (event) => {
    await updateGridGeographicUnitOptions()

    d3.select(gridContainer).selectAll("sl-tooltip[open]")
        .each(function(d, i) {
            setupGridTooltip(d3.select(this), true)
        })
    updateGrid(true)    
    drawStateHospitalizations(gridDiseaseSelector.value, gridTypeSwitch.value, gridStateHospitalizationsSvg, gridStateHospitalizationsSubtitle)
})

gridGeographicUnitSelector.addEventListener("sl-change", async (event) => {
    await updateGridPopulationOptions()
    gridGeographicUnit = gridGeographicUnitSelector.value

    updateGrid(true)
})

gridPopulationSelector.addEventListener("sl-change", async (event) => {
    await updateGridOutcomeVariableOptions()
    gridPopulation = gridPopulationSelector.value

    d3.select(gridContainer).selectAll("sl-tooltip[open]")
        .each(function(d, i) {
            setupGridTooltip(d3.select(this), true)
        })
    updateGrid()    
})

gridOutcomeVariableSelector.addEventListener("sl-change", (event) => {
    gridOutcomeVariable = gridOutcomeVariableSelector.value

    d3.select(gridContainer).selectAll("sl-tooltip[open]")
        .each(function(d, i) {
            setupGridTooltip(d3.select(this), true)
        })
    updateGrid()    
})

gridIncludeImputations.addEventListener("sl-change", updateGrid)

gridSort.addEventListener("sl-change", (event) => {
    sortGridItems()
})

gridTextFilter.addEventListener("sl-input", filterGridItems)
gridTextFilter.addEventListener("clear", filterGridItems)

gridStateHospitalizationsResizer.addEventListener("sl-resize", () => {
    drawStateHospitalizations(gridDiseaseSelector.value, gridTypeSwitch.value, gridStateHospitalizationsSvg, gridStateHospitalizationsSubtitle)
})

gridStateHospitalizationsSvg.addEventListener("click", () => {
    gridStateHospitalizationsLarge.show()
})

gridStateHospitalizationsLargeResizer.addEventListener("sl-resize", () => {
    drawLargeStateHospitalizations(gridDiseaseSelector.value, gridTypeSwitch.value, gridStateHospitalizationsLargeSvg, gridStateHospitalizationsLargeSubtitle)
})