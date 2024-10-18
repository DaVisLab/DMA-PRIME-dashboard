
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

mapAddMobileHealthClinic.addEventListener("click", addMobileClinic)

function addMobileClinic() {
    coords = [deckgl.viewState["default-view"].longitude, deckgl.viewState["default-view"].latitude]
    mobileHealthClinics = mobileHealthClinics.concat([{position: coords, color: [255, 0, 0], radius: 100}])
    dataVersion++
    redraw()
}