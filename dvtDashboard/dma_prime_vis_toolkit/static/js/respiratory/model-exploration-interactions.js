
function changeModel() {
    if (modelLocation) {
        modelExploration.src = `/data/respiratory/model/${explorationDiseaseSelector.value}/${explorationGeographicUnitSelector.value}/${explorationPopulationSelector.value}/${explorationOutcomeVariableSelector.value}/${modelLocation}`
    } else {
        modelExploration.src = ''
    }
}

locationMenu.addEventListener("sl-select", event => {
    var selectedLocation = event.detail.item;

    modelLocation = selectedLocation.value

    locationIdSearch.value = d3.select(`sl-menu-item[value='${modelLocation}'`).node().getTextLabel()
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
        locationIdSearch.value = d3.select(`sl-menu-item[value='${modelLocation}'`).node().getTextLabel()
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
    d3.selectAll(".exploration-geographic-unit-option").remove()
    var availableGeographicUnits = Object.keys(metadata.available_models[explorationDiseaseSelector.value])
    d3.select(explorationGeographicUnitSelector)
        .selectAll(".exploration-geographic-unit-option")
        .data(availableGeographicUnits)
        .enter()
        .append("sl-option")
        .attr("class", "exploration-geographic-unit-option")
        .attr("value", d => d)
        .html(d => metadata.region_sizes[d])

    if (availableGeographicUnits.includes(explorationGeographicUnit)) {
        // do nothing
    } else {
        explorationGeographicUnit = availableGeographicUnits[0]
        explorationGeographicUnitSelector.value = explorationGeographicUnit
    }

    updateExplorationPopulationOptions()
}

async function updateExplorationPopulationOptions() {
    d3.selectAll(".exploration-population-tooltip").remove()
    var availablePopulations = Object.keys(metadata.available_models[explorationDiseaseSelector.value][explorationGeographicUnitSelector.value])
    d3.select(explorationPopulationSelector)
        .selectAll(".exploration-population-tooltip")
        .data(availablePopulations)
        .enter()
        .append("sl-tooltip")
        .attr("class", "exploration-population-tooltip")
        .attr("content", d => metadata.populations_tooltips[d])
        .attr("triger", "hover")
        .attr("hoist", "")
        .append("sl-option")
        .attr("class", "exploration-population-option")
        .attr("value", d => d)
        .html(d => metadata.populations[d])

    if (availablePopulations.includes(explorationPopulation)) {
        // do nothing
    } else {
        explorationPopulation = availablePopulations[0]
        explorationPopulationSelector.value = explorationPopulation
    }

    updateExplorationOutcomeVariableOptions()
}

async function updateExplorationOutcomeVariableOptions() {
    d3.selectAll(".exploration-outcome-tooltip").remove()
    var availableOutcomeVariables = metadata.available_models[explorationDiseaseSelector.value][explorationGeographicUnitSelector.value][explorationPopulationSelector.value]
    d3.select(explorationOutcomeVariableSelector)
        .selectAll(".exploration-outcome-tooltip")
        .data(availableOutcomeVariables)
        .enter()
        .append("sl-tooltip")
        .attr("class", "exploration-outcome-tooltip")
        .attr("content", d => metadata.outcome_variables_tooltips[d])
        .attr("triger", "hover")
        .attr("hoist", "")
        .append("sl-option")
        .attr("class", "exploration-outcome-option")
        .attr("value", d => d)
        .html(d => metadata.outcome_variables[d])

    if (availableOutcomeVariables.includes(explorationOutcomeVariable)) {
        // do nothing
    } else {
        explorationOutcomeVariable = availableOutcomeVariables[0]
        explorationOutcomeVariableSelector.value = explorationOutcomeVariable
    }
}