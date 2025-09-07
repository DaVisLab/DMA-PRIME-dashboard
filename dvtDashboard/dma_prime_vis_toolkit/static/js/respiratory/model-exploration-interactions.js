
function changeModel() {
    modelExploration.src = `/respiratory/model/${explorationDiseaseSelector.value}/${explorationRegionSelector.value}/${explorationDataSourceSelector.value}/${explorationDataVariableSelector.value}/${modelLocation}`
}

// explorationDiseaseSelector.addEventListener("sl-change", (event) => {
    
// })

locationMenu.addEventListener("sl-select", event => {
    var selectedLocation = event.detail.item;

    modelLocation = selectedLocation.value

    locationIdSearch.value = d3.select(`sl-menu-item[value='${modelLocation}'`).node().getTextLabel()
})

// filter menu items
locationIdSearch.addEventListener("sl-input", event => {
    d3.selectAll("sl-menu-item.location-id").each(function() {
        let menuItem = d3.select(this)
        let incorrectGeographicUnit = !menuItem.classed(`${explorationRegionSelector.value}-id`)
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
            menuItem.classed("hide", !menuItem.classed(`${explorationRegionSelector.value}-id`))
        })
    }
})

// swap menu items when geographic unit changed
explorationRegionSelector.addEventListener("sl-change", event => {
    d3.selectAll("sl-menu-item.location-id").each(function() {
        let menuItem = d3.select(this)
        menuItem.classed("hide", !menuItem.classed(`${explorationRegionSelector.value}-id`))
    })

    modelLocation = null
    locationIdSearch.value = ""
})
