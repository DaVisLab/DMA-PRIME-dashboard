
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
    mapSecondarySidebarEventDate.innerHTML = typeof(object.event_date) == "object" ? d3.utcFormat("%a, %b %d, %Y")(object.event_date.toDate()) : object.event_date
    mapSecondarySidebarEventAddress.innerHTML = object.site_address
    mapSecondarySidebarEventType.innerHTML = object.type
    mapSecondarySidebarEventPatients.innerHTML = object.num_epic_patients
    mapSecondarySidebarEventNonClinicalAttendants.innerHTML = object['num_non-clinical_attendees']
    mapSecondarySidebarEventStaff.innerHTML = object.staff_members_present
    mapSecondarySidebarEventNotes.innerHTML = object.notes
    mapSecondarySidebarEventPOC.innerHTML = object.POC_name
    mapSecondarySidebarEventPOCContact.innerHTML = object.POC_contact_info    
}
