
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

mapAddMobileHealthClinic.addEventListener("click", () => addressInputPopup.show())

// idk words are hard
addressInput.addEventListener("sl-change", function(event) {
    addressInputMenu.innerHTML = ""
    address = addressInput.value
    fetch(`https://geocode.maps.co/search?q=${address}&api_key=***REMOVED***`).then(response => response.json()).then(function(data) {
        potentialLocations = data
        if (data.length < 1) {
            menu = d3.select(addressInputMenu)
            menu.append("sl-menu-item")
                .html("No location could be found for this address")
        } else if (data.length == 1) {
            addMobileClinic(data[0])
        } else {
            menu = d3.select(addressInputMenu)
            menu.selectAll("sl-menu-item")
                .data(data)
                .enter()
                .append("sl-menu-item")
                .html(d => d.display_name)
        }
    })
})

addressInputMenu.addEventListener("sl-select", function(event) {
    clinicLocation = d3.select(event.detail.item)
    addMobileClinic(clinicLocation.datum())
})

mobileClinicAddress.addEventListener("sl-change", function(event) {
    index = -1
    if (displayedMobileClinic) {
        index = displayedMobileClinic.index
    }
    updateLocationAddress(index, mobileClinicAddress.value)
})

mobileClinicLat.addEventListener("sl-change", mobileClinicInfoPanelCoordUpdate)

mobileClinicLon.addEventListener("sl-change", mobileClinicInfoPanelCoordUpdate)

function mobileClinicInfoPanelCoordUpdate() {
    lat = 0
    if (mobileClinicLat.value) {
        lat = mobileClinicLat.value
    }
    lon = 0
    if (mobileClinicLon.value) {
        lon = mobileClinicLon.value
    }
    index = -1
    if (displayedMobileClinic) {
        index = displayedMobileClinic.index
    }
    updateLocationCoords(index, lat=lat, lon=lon)
}

mobileClinicRemove.addEventListener("click", function(event) {
    mobileHealthClinics.splice(displayedMobileClinic.index, 1);
    displayedMobileClinic = null
    dataVersion++
    redraw()
    mobileClinicAddress.setAttribute("value", "") 
    mobileClinicLat.setAttribute("value", "")
    mobileClinicLon.setAttribute("value", "")
})

mapSecondarySidebarClose.addEventListener("sl-focus", function(event) {
    mapAndMinorSidebar.setAttribute("position", 100)
    mobileClinicInfoPanel.removeAttribute("active")
})

function resetAddressInput() {
    addressInput.value = ""
    addressInputMenu.innerHTML = ""
    addressInputPopup.hide()
    potentialLocations = null
}

// map functions
function addMobileClinic(mobileClinic) {
    mobileHealthClinics = mobileHealthClinics.concat([{"coords": {"lat": mobileClinic.lat, "lon": mobileClinic.lon}, "osm": mobileClinic}])
    dataVersion++
    resetAddressInput()
    updateMobileClinicInfoPanel()
    redraw()
}


    // center of map view
    // coords = [deckgl.viewState["default-view"].longitude, deckgl.viewState["default-view"].latitude]


function mobileClinicDrag(info, event) {
    mobileHealthClinics[info.index].coords.lon = info.coordinate[0]
    mobileHealthClinics[info.index].coords.lat = info.coordinate[1]
    dataVersion++

    return redraw()
}

function mobileClinicClick(index) {
    mapAndMinorSidebar.setAttribute("position", 80)
    mobileClinicInfoPanel.setAttribute("active", "")
    displayedMobileClinic = {"coords": {"lat": mobileHealthClinics[index].coords.lat, "lon": mobileHealthClinics[index].coords.lon}, 'osm': mobileHealthClinics[index].osm, 'index': index}
    updateMobileClinicInfoPanel()
}

function updateMobileClinicInfoPanel() {
    if (displayedMobileClinic == null && mobileHealthClinics.length) {
        displayedMobileClinic = mobileHealthClinics.at(-1)
    }
    if (typeof displayedMobileClinic !== 'undefined' && displayedMobileClinic != null) {
        mobileClinicAddress.setAttribute("value", displayedMobileClinic.osm.display_name) 
        mobileClinicLat.setAttribute("value", displayedMobileClinic.coords.lat)
        mobileClinicLon.setAttribute("value", displayedMobileClinic.coords.lon)
    }
}

function updateLocationAddress(index, address) {
    fetch(`https://geocode.maps.co/search?q=${address}&api_key=***REMOVED***`).then(response => response.json()).then(function(data) {
        potentialLocations = data
        if (index == -1) {
            if(data.length >= 1) {
                mobileHealthClinics.push({"coords": {"lat": data[0].lat, "lon": data[0].lon}, "osm": data[0]})
                mobileClinicClick(mobileHealthClinics.length - 1)
            }
        } else {
            if (data.length >= 1) {
                mobileHealthClinics[index] = {"coords": {"lat": data[0].lat, "lon": data[0].lon}, "osm": data[0]}
                mobileClinicClick(index)
            }
        }
        updateMobileClinicInfoPanel()
        dataVersion++
        redraw()
    })
}

function updateLocationCoords(index, lat, lon) {
    mobileHealthClinics[index].coords = {"lat": lat, "lon": lon}
    fetch(`https://geocode.maps.co/reverse?lat=${lat}&lon=${lon}&api_key=***REMOVED***`).then(response => response.json()).then(function(data) {
        if (index == -1) {
            mobileHealthClinics.push({"coords": {"lat": lat, "lon": lon}, "osm": data})
            mobileClinicClick(mobileHealthClinics.length - 1)
        } else {
            if(data.display_name != mobileHealthClinics[index].osm.display_name) {
                mobileHealthClinics[index].osm = data
            }
            mobileClinicClick(index)
        }
        updateMobileClinicInfoPanel()
        dataVersion++
        redraw()
    })
}

function resizeTextAreaHeight(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}