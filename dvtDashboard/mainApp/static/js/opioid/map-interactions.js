
mapResetButton.addEventListener("click", () => {
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
    Object.entries(brushes).forEach(brush => {
        column = brush[0]
        d3.select(`#map-${column}-filter-brush`).call(brush[1].clear)
        thresholds[column] = xScales[column].domain()
    })
})

mapYearSelector.addEventListener("sl-change", function(event) {
    dataVersion++
    updateHistogram("hospitalizations")
    updateHistogram("deaths")
    mobileClinicClick(selectedZCTA)
    redraw()
})

mapVariable1Selector.addEventListener("sl-change", function(event) {
    dataVersion++
    redraw()
})

mapVariable2Selector.addEventListener("sl-change", function(event) {
    dataVersion++
    redraw()
})

hospitalIconsToggle.addEventListener("sl-change", () => {
    // toggle hospital icons
    if (hospitalIconsToggle.checked) {
        checked.push("hospital")
    } else {
        checked = checked.filter(check => check !== "hospital")
    }
    dataVersion++
    redraw()
})
cdapIconsToggle.addEventListener("sl-change", () => {
    // toggle cdap icons
    if (cdapIconsToggle.checked) {
        checked.push("CDAP")
    } else {
        checked = checked.filter(check => check !== "CDAP")
    }
    dataVersion++
    redraw()
})
mobileClinicIconsToggle.addEventListener("sl-change", () => {
    // toggle mhc icons
    if (mobileClinicIconsToggle.checked) {
        checked.push("community_partner")
    } else {
        checked = checked.filter(check => check !== "community_partner")
    }
    dataVersion++
    redraw()
})
communityPartnerIconsToggle.addEventListener("sl-change", () => {
    // toggle community partner icons
    if (communityPartnerIconsToggle.checked) {
        checked.push("mobile_health_clinic")
    } else {
        checked = checked.filter(check => check !== "mobile_health_clinic")
    }
    dataVersion++
    redraw()
})

mapSecondarySidebarClose.addEventListener("sl-focus", function(event) {
    mapAndMinorSidebar.setAttribute("position", 100)
    mobileClinicInfoPanel.removeAttribute("active")
    selectedZCTA = undefined
})

function mobileClinicClick(object) {
    selectedZCTA = object
    mapAndMinorSidebar.setAttribute("position", 80)
    mobileClinicInfoPanel.setAttribute("active", "")

    mapSecondarySidebarZctaName.innerHTML = `ZCTA: ${object.properties.ZCTA5CE20}`
    mapSecondarySidebarHospitalizations.innerHTML = object.properties.data.hospitalizations[mapYearSelector.value]
    mapSecondarySidebarDeaths.innerHTML = object.properties.data.deaths[mapYearSelector.value]
    mapSecondarySidebarPopulation.innerHTML = object.properties.population
    mapSecondarySidebarSVI.innerHTML = object.properties.data.SVI[mapYearSelector.value]
    mapSecondarySidebarProportionUninsured.innerHTML = object.properties.data.proportion_uninsured[mapYearSelector.value]
    mapSecondarySidebarMedianIncome.innerHTML = object.properties.data.median_income[mapYearSelector.value] 
}