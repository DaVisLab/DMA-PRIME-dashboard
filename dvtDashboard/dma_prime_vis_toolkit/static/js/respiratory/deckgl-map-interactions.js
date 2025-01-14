import { map, zctaData, redraw } from "/static/js/respiratory/deckgl-map.js"

mapResetButton.addEventListener("click", () => {
    // reset map zoom and center
    map.flyTo({
        center: [-81, 33.65],
        zoom: 7,
        essential: true // this animation is considered essential with respect to prefers-reduced-motion
    })

    // unselect zcta if applicable: clear highlight, remove tooltip

    redraw()
})

mapRateSwitch.addEventListener("sl-change", (event) => {
    dataVersion++

    // update legend title
    // if (mapRateSwitch.value == "rate"){
    //     d3.select("#map-legend-title")
    //         .text("Current Week's Hospitalization Rates by ZCTA")
    // } else {
    //     d3.select("#map-legend-title")
    //         .text("Current Week's Hospitalizations by ZCTA")
    // }

    // update tooltip
    // if (focusZCTA != null) {
    //     mapTooltipWidth = Math.max(500, width * .3)
    //     mapTooltipHeight = mapTooltipWidth * .65    
    //     drawTooltip(d3.select(`#map-${focusZCTA}-group`).datum(), d3.select("#map-tooltip-div"), mapTooltipHeight, mapTooltipWidth, mapRateSwitch.value == "rate")
    // }

    redraw()

})

mapDataSourceSelector.addEventListener("sl-change", (event) => {
    dataVersion++
    redraw()
})

mapDiseaseSelector.addEventListener("sl-change", (event) => {
    dataVersion++
    redraw()

    // update tooltip
    // if (focusZCTA != null) {
    //     mapTooltipWidth = Math.max(500, width * .3)
    //     mapTooltipHeight = mapTooltipWidth * .65    
    //     drawTooltip(d3.select(`#map-${focusZCTA}-group`).datum(), d3.select("#map-tooltip-div"), mapTooltipHeight, mapTooltipWidth, mapRateSwitch.value == "rate")
    // }
})

mapIncludeImputations.addEventListener("sl-change", () => {
    dataVersion++
    redraw()
})


// adding/removing icons
// hospitalIconsToggle.addEventListener("sl-change", () => {
//     // toggle hospital icons
//     if (hospitalIconsToggle.checked) {
//         checked.push("hospital")
//     } else {
//         checked = checked.filter(check => check !== "hospital")
//     }
//     dataVersion++
//     redraw()
// })
// cdapIconsToggle.addEventListener("sl-change", () => {
//     // toggle cdap icons
//     if (cdapIconsToggle.checked) {
//         checked.push("CDAP")
//     } else {
//         checked = checked.filter(check => check !== "CDAP")
//     }
//     dataVersion++
//     redraw()
// })
// mobileClinicIconsToggle.addEventListener("sl-change", () => {
//     // toggle mhc icons
//     if (mobileClinicIconsToggle.checked) {
//         checked.push("mobile_health_clinic")
//     } else {
//         checked = checked.filter(check => check !== "mobile_health_clinic")
//     }
//     dataVersion++
//     redraw()
// })
// communityPartnerIconsToggle.addEventListener("sl-change", () => {
//     // toggle community partner icons
//     if (communityPartnerIconsToggle.checked) {
//         checked.push("community_partner")
//     } else {
//         checked = checked.filter(check => check !== "community_partner")
//     }
//     dataVersion++
//     redraw()
// })