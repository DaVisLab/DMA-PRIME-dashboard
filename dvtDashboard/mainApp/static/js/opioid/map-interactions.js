
mapResetButton.addEventListener("click", () => {
    // reset map zoom and center
    deckgl.setProps({
        initialViewState: {
            longitude: -80.75,
            latitude: 33.8,
            zoom: 7,
            transitionInterpolator: new FlyToInterpolator({speed: 2}),
            transitionDuration: 'auto'
          },
    })
    
})

mapFilterResetButton.addEventListener("click", () => {
    // clear brushes on histograms that act as filters for map zctas
    Object.entries(brushes).forEach(brush => {
        column = brush[0]
        d3.select(`#map-${column}-filter-brush`).call(brush[1].clear)
        thresholds[column] = xScales[column].domain()
    })
})

// options selection handling
mapYearSelector.addEventListener("sl-change", function(event) {
    dataVersion++
    if (Number.isNaN(Number.parseInt(mapYearSelector.value))) {
        d3.selectAll("sl-option[value='hospitalizations']")
            .html("Hospitalizations (2020-2023)")
        d3.selectAll("sl-option[value='deaths']")
            .html("Deaths (2020-2022)")
    } else {
        d3.selectAll("sl-option[value='hospitalizations']")
            .html(mapYearSelector.value < 2024 ? "Hospitalizations" : "Hospitalizations (predicted)")
        d3.selectAll("sl-option[value='deaths']")
            .html(mapYearSelector.value < 2023 ? "Deaths" : "Deaths (predicted)")
    } 
    updateHistogram("hospitalizations")
    updateHistogram("deaths")
    if (selectedZCTA) {
        mobileClinicClick(selectedZCTA)
    }
    redraw(null)
})

mapVariable1Selector.addEventListener("sl-change", function(event) {
    dataVersion++
    redraw(null)
})

mapVariable2Selector.addEventListener("sl-change", function(event) {
    dataVersion++
    redraw(null)
})

// adding/removing icons
hospitalIconsToggle.addEventListener("sl-change", () => {
    // toggle hospital icons
    if (hospitalIconsToggle.checked) {
        checked.push("hospital")
    } else {
        checked = checked.filter(check => check !== "hospital")
    }
    dataVersion++
    redraw(null)
})
cdapIconsToggle.addEventListener("sl-change", () => {
    // toggle cdap icons
    if (cdapIconsToggle.checked) {
        checked.push("CDAP")
    } else {
        checked = checked.filter(check => check !== "CDAP")
    }
    dataVersion++
    redraw(null)
})
mobileClinicIconsToggle.addEventListener("sl-change", () => {
    // toggle mhc icons
    if (mobileClinicIconsToggle.checked) {
        checked.push("community_partner")
    } else {
        checked = checked.filter(check => check !== "community_partner")
    }
    dataVersion++
    redraw(null)
})
communityPartnerIconsToggle.addEventListener("sl-change", () => {
    // toggle community partner icons
    if (communityPartnerIconsToggle.checked) {
        checked.push("mobile_health_clinic")
    } else {
        checked = checked.filter(check => check !== "mobile_health_clinic")
    }
    dataVersion++
    redraw(null)
})

// zcta details panel
mapSecondarySidebarClose.addEventListener("sl-focus", function(event) {
    mapAndMinorSidebar.setAttribute("position", 100)
    mobileClinicInfoPanel.removeAttribute("active")
    selectedZCTA = undefined
    redraw()
})

function mobileClinicClick(object) {
    selectedZCTA = object
    mapAndMinorSidebar.setAttribute("position", 80)
    mobileClinicInfoPanel.setAttribute("active", "")

    mapSecondarySidebarZctaName.innerHTML = `ZCTA: ${object.properties.ZCTA5CE20}`
    mapSecondarySidebarZctaCounty.innerHTML = `County: ${object.properties.county == "NaN" ? "Unknown" : capitalizeFirst(object.properties.county)}`
    mapSecondarySidebarHospitalizations.innerHTML = object.properties.data.hospitalizations[mapYearSelector.value] == "NaN" ? "Unknown" : object.properties.data.hospitalizations[mapYearSelector.value]
    mapSecondarySidebarDeaths.innerHTML = object.properties.data.deaths[mapYearSelector.value] == "NaN" ? "Unknown" : object.properties.data.deaths[mapYearSelector.value]
    mapSecondarySidebarPopulation.innerHTML = object.properties.population == "NaN" ? "Unknown" : formatInt(object.properties.population)
    mapSecondarySidebarSVI.innerHTML = object.properties.data.SVI[mapYearSelector.value] == "NaN" ? "Unknown" : d3.format(".0%")(object.properties.data.SVI[mapYearSelector.value])
    mapSecondarySidebarProportionUninsured.innerHTML = object.properties.data.proportion_uninsured[mapYearSelector.value] == "NaN" ? "Unknown" : d3.format(".0%")(object.properties.data.proportion_uninsured[mapYearSelector.value])
    mapSecondarySidebarMedianIncome.innerHTML = object.properties.data.median_income[mapYearSelector.value] == "NaN" ? "Unknown" : d3.format("$,")(object.properties.data.median_income[mapYearSelector.value])
}