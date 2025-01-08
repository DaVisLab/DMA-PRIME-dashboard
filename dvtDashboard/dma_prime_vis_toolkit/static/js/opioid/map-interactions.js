import { map, deckOverlay, brushes, thresholds, xScales, selectedZCTA, zctaFeatures, redraw, updateHistogram, mobileClinicClick } from "/static/js/opioid/map.js"

mapResetButton.addEventListener("click", () => {
    // reset map zoom and center
    map.flyTo({
        center: [-81, 33.65],
        zoom: 7,
        essential: true // this animation is considered essential with respect to prefers-reduced-motion
    })
    
})

mapRateSwitch.addEventListener("sl-change", () => {
    dataVersion++
    updateHistogram("hospitalizations")
    updateHistogram("deaths")
    Object.entries(brushes).forEach(brush => {
        column = brush[0]
        if (["hospitalizations", "deaths"].includes(column)) {
            d3.select(`#map-${column}-filter-brush`).call(brush[1].clear)
            thresholds[column] = xScales[column].domain()
        }
    })
    redraw()
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
    if (selectedZCTA.zcta) {
        mobileClinicClick(selectedZCTA.zcta)
    }
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

mapZctaCountySearch.addEventListener("sl-change", function(event) {
    var zctaValue = parseInt(mapZctaCountySearch.value)

    if (zctaValue) {
        mobileClinicClick(zctaFeatures.find(d => zctaValue == d.properties.ZCTA))
        redraw()
    } else {

    }
    var searchValue = mapZctaCountySearch.value
})

mapZctaCountySearch.addEventListener("sl-clear", function(event) {

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
        checked.push("mobile_health_clinic")
    } else {
        checked = checked.filter(check => check !== "mobile_health_clinic")
    }
    dataVersion++
    redraw()
})
communityPartnerIconsToggle.addEventListener("sl-change", () => {
    // toggle community partner icons
    if (communityPartnerIconsToggle.checked) {
        checked.push("community_partner")
    } else {
        checked = checked.filter(check => check !== "community_partner")
    }
    dataVersion++
    redraw()
})

// zcta details panel
mapSecondarySidebarClose.addEventListener("sl-focus", function(event) {
    selectedZCTA.zcta = undefined
    mapAndMinorSidebar.setAttribute("position", 100)
    mobileClinicInfoPanel.removeAttribute("active")
    redraw()
})