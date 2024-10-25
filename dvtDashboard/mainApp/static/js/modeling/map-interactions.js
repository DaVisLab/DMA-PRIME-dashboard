
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
    mobileHealthClinics = mobileHealthClinics.concat([mobileClinic])
    dataVersion++
    resetAddressInput()
    redraw()
}


    // center of map view
    // coords = [deckgl.viewState["default-view"].longitude, deckgl.viewState["default-view"].latitude]


function mobileClinicDrag(info, event) {
    mobileHealthClinics[info.index].lon = info.coordinate[0]
    mobileHealthClinics[info.index].lat = info.coordinate[1]
    dataVersion++

    return redraw()
}

function mobileClinicClick(index) {
    mapAndMinorSidebar.setAttribute("position", 80)
    mobileClinicInfoPanel.setAttribute("active", "")
    displayedMobileClinic = {'data': mobileHealthClinics[index], 'index': index}
    mobileClinicAddress.setAttribute("value", displayedMobileClinic.data.display_name) 
    mobileClinicLat.setAttribute("value", displayedMobileClinic.data.lat)
    mobileClinicLon.setAttribute("value", displayedMobileClinic.data.lon)
}

function updateLocationAddress(index, address) {
    fetch(`https://geocode.maps.co/search?q=${address}&api_key=***REMOVED***`).then(response => response.json()).then(function(data) {
        potentialLocations = data
        if (index == -1) {
            if(data.length >= 1) {
                mobileHealthClinics.push(data[0])
                mobileClinicClick(mobileHealthClinics.length - 1)
            }
        } else {
            if (data.length >= 1) {
                mobileHealthClinics[index] = data[0]
                mobileClinicClick(index)
            } else {
                mobileClinicAddress.setAttribute("value", mobileHealthClinics[index].display_name) 
            }
        }
        dataVersion++
        redraw()
    })
}

function updateLocationCoords(index, lat, lon) {
    fetch(`https://geocode.maps.co/reverse?lat=${lat}&lon=${lon}&api_key=***REMOVED***`).then(response => response.json()).then(function(data) {
        if (index == -1) {
            mobileHealthClinics.push(data)
            mobileClinicClick(mobileHealthClinics.length - 1)
        } else {
            mobileHealthClinics[index] = data
            mobileClinicClick(index)
        }
        dataVersion++
        redraw()
        mobileClinicAddress.setAttribute("value", data.display_name) 
        mobileClinicLat.setAttribute("value", data.lat)
        mobileClinicLon.setAttribute("value", data.lon)
    })
}

function resizeTextAreaHeight(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}