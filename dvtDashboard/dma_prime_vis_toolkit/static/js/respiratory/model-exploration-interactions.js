
import {
    applyRespiratoryOptionRestrictions,
    getCurrentControlState,
    getRespiratoryModelDataSrc,
    resolveRespiratoryControlState,
} from "./utils/controlState_utils.js"
import {
    updateGeographicOptions as renderGeographicOptions,
    updateOutcomeOptions as renderOutcomeOptions,
    updatePopulationOptions as renderPopulationOptions,
} from "./utils/interfaceOption_utils.js"

let currentModelSrc = modelExploration.getAttribute("src") || "";

function getExplorationControlState() {
    return resolveRespiratoryControlState(
        metadata,
        getCurrentControlState({
            diseaseEl: explorationDiseaseSelector,
            geographicUnitEl: explorationGeographicUnitSelector,
            populationEl: explorationPopulationSelector,
            outcomeEl: explorationOutcomeVariableSelector,
        }),
    )
}

function applyExplorationControlState(state) {
    explorationGeographicUnitSelector.value = state.geographicUnit
    explorationPopulationSelector.value = state.population
    explorationOutcomeVariableSelector.value = state.outcomeVariable

    explorationGeographicUnit = state.geographicUnit
    explorationPopulation = state.population
    explorationOutcomeVariable = state.outcomeVariable

    applyRespiratoryOptionRestrictions({
        diseaseEl: explorationDiseaseSelector,
        geographicUnitEl: explorationGeographicUnitSelector,
        populationEl: explorationPopulationSelector,
        outcomeEl: explorationOutcomeVariableSelector,
    })
}

applyExplorationControlState(getExplorationControlState())

function getModelSrc() {
    const state = getExplorationControlState()
    applyExplorationControlState(state)

    return getRespiratoryModelDataSrc({
        metadata,
        ...state,
        location: modelLocation,
        dataVersion: metadata.data_version,
    })
}

function changeModel() {
    const nextSrc = getModelSrc()
    if (nextSrc === currentModelSrc) return

    currentModelSrc = nextSrc
    modelExploration.src = nextSrc
}

locationMenu.addEventListener("sl-select", event => {
    var selectedLocation = event.detail.item;

    modelLocation = selectedLocation.value

    locationIdSearch.value = d3.select(`sl-menu-item[value='${modelLocation}']`).node().getTextLabel()
    changeModel()
})

// filter menu items
locationIdSearch.addEventListener("sl-input", event => {
    d3.selectAll("sl-menu-item.location-id").each(function() {
        let menuItem = d3.select(this)
        let incorrectGeographicUnit = !menuItem.classed(`${explorationGeographicUnitSelector.value}-id`)
        let filteredOut = !d3.select(this).attr("value").toLowerCase().includes(locationIdSearch.value.toLowerCase())
        menuItem.classed("hide", incorrectGeographicUnit || filteredOut)
  })
})

locationIdSearch.addEventListener("sl-change", event => {
    var exactMatch = d3.selectAll("sl-menu-item.location-id").nodes().some(e => e.value == locationIdSearch.value)
    if (exactMatch) {
        modelLocation = locationIdSearch.value
        locationIdSearch.value = d3.select(`sl-menu-item[value='${modelLocation}']`).node().getTextLabel()
        d3.selectAll("sl-menu-item.location-id").each(function() {
            let menuItem = d3.select(this)
            menuItem.classed("hide", !menuItem.classed(`${explorationGeographicUnitSelector.value}-id`))
        })
    } else {
        modelLocation = null
    }
    changeModel()
})

locationIdSearch.addEventListener("clear", event => {
    modelLocation = null
    changeModel()
})

explorationDiseaseSelector.addEventListener("sl-change", async event => {
    await updateExplorationGeographicUnitOptions()
    changeModel()
})

// swap menu items when geographic unit changed
explorationGeographicUnitSelector.addEventListener("sl-change", async event => {
    await updateExplorationPopulationOptions()

    d3.selectAll("sl-menu-item.location-id").each(function() {
        let menuItem = d3.select(this)
        menuItem.classed("hide", !menuItem.classed(`${explorationGeographicUnitSelector.value}-id`))
    })

    modelLocation = null
    locationIdSearch.value = ""
   
    changeModel()
})

explorationPopulationSelector.addEventListener("sl-change", async event => {
    await updateExplorationOutcomeVariableOptions()
    changeModel()
})

explorationOutcomeVariableSelector.addEventListener("sl-change", event => {
    changeModel()
})

async function updateExplorationGeographicUnitOptions() {
    renderGeographicOptions(
        "exploration",
        explorationOutcomeVariableSelector,
        explorationDiseaseSelector,
        explorationGeographicUnitSelector,
        explorationPopulationSelector,
        { dispatchSelectionChange: false },
    )
    applyExplorationControlState(getExplorationControlState())

    updateExplorationPopulationOptions()
}

async function updateExplorationPopulationOptions() {
    applyExplorationControlState(getExplorationControlState())
    renderPopulationOptions(
        "exploration",
        explorationOutcomeVariableSelector,
        explorationDiseaseSelector,
        explorationGeographicUnitSelector,
        explorationPopulationSelector,
        { dispatchSelectionChange: false },
    )
    applyExplorationControlState(getExplorationControlState())

    updateExplorationOutcomeVariableOptions()
}

async function updateExplorationOutcomeVariableOptions() {
    applyExplorationControlState(getExplorationControlState())
    renderOutcomeOptions(
        "exploration",
        explorationOutcomeVariableSelector,
        explorationDiseaseSelector,
        explorationGeographicUnitSelector,
        explorationPopulationSelector,
        { dispatchSelectionChange: false },
    )
    applyExplorationControlState(getExplorationControlState())
}
