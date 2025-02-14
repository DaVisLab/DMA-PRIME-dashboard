import { map, brushes, thresholds, xScales, selectedZCTA, selectedCounty, zctaFeatures, countyData, redraw, updateHistogram, mobileClinicClick, clearBrushes, changeDisease } from "/static/js/opioid-hcv-hiv/map.js"

mapResetButton.addEventListener("click", () => {
    // reset map zoom and center
    map.flyTo({
        center: [-81, 33.65],
        zoom: 7,
        essential: true // this animation is considered essential with respect to prefers-reduced-motion
    })
    selectedZCTA.zcta = undefined
    selectedCounty.county = undefined
    redraw()
})

mapRateSwitch.addEventListener("sl-change", () => {
    dataVersion++
    updateHistogram("hospitalizations")
    updateHistogram("deaths")
    clearBrushes()
    redraw()
})

mapFilterResetButton.addEventListener("click", () => {
    // clear brushes on histograms that act as filters for map zctas
    Object.entries(brushes).forEach(brush => {
        var column = brush[0]
        d3.select(`#map-${column}-filter-brush`).call(brush[1].clear)
        thresholds[column] = xScales[column].domain()
    })
})

// options selection handling
mapDiseaseSelector.addEventListener("sl-change", changeDisease)

mapYearSelector.addEventListener("sl-change", yearChange)
function yearChange(event) {
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
}
yearChange()

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
    } else if(mapZctaCountySearch.value) {
        var county = countyData.features.find(d => mapZctaCountySearch.value.toLowerCase() == d.properties.NAME.toLowerCase())
        if (county) {
            selectedCounty.county = county
            redraw()
        }
    }
})

mapClearZctaSelection.addEventListener("click", () => {
    selectedZCTA.zcta = undefined
    redraw()
})

mapClearCountySelection.addEventListener("click", () => {
    selectedCounty.county = undefined
    redraw()
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
    zctaDiseaseInfoPanel.removeAttribute("active")
    redraw()
})

window.removeEventListener("keydown", swapTheme)
window.addEventListener("keydown", (event) => {
    if (event.key == "m" && document.activeElement.id !== "map-zcta-county-search") {
        if (Array.from(document.documentElement.classList).includes('sl-theme-light')) {
            document.documentElement.classList.remove('sl-theme-light')
            document.documentElement.classList.add('sl-theme-dark')
        } else {
            document.documentElement.classList.remove('sl-theme-dark')
            document.documentElement.classList.add('sl-theme-light')
        }
        changed = true
    }
});