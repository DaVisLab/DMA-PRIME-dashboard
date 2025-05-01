
// Map interactions
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


mapTimeframeSelector.addEventListener("sl-change", () => {
    dataVersion++
    redraw()
})

mapSecondarySidebarClose.addEventListener("sl-focus", function(event) {
    mapAndMinorSidebar.setAttribute("position", 100)
    mobileClinicInfoPanel.removeAttribute("active")
    redraw()
})

// map functions
function mobileClinicClick(object) {
    mapAndMinorSidebar.setAttribute("position", 80)
    mobileClinicInfoPanel.setAttribute("active", "")
    
    mapSecondarySidebarOrgName.innerHTML = object.org_name
    mapSecondarySidebarEventDate.value = typeof(object.event_date) == "object" ? d3.timeFormat("%a, %b %d, %Y")(object.event_date.toDate()) : object.event_date
    mapSecondarySidebarEventAddress.value = object.site_address
    mapSecondarySidebarEventType.value = object.type
    mapSecondarySidebarEventPatients.value = object.num_epic_patients
    mapSecondarySidebarEventNonClinicalAttendants.value = object['num_non-clinical_attendees']
    mapSecondarySidebarEventStaff.value = object.staff_members_present
    mapSecondarySidebarEventNotes.value = object.notes
    mapSecondarySidebarEventPOC.value = object.POC_name
    mapSecondarySidebarEventPOCContact.value = object.POC_contact_info

}
