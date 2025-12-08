import { drawStateHospitalizations } from "/static/js/respiratory/script.js";
export { map, popup, selectedItems, deckOverlay, 
    redraw, updateMapTitle, updateMapTooltip,
    updateMapOutcomeVariableOptions, updateMapPopulationOptions, updateMapGeographicUnitOptions
 }

var icons = {
    data: await d3.csv('/data/health-care-facility'),
    iconAtlas: '/static/assets/Icons/icon-pack.png',
    iconMapping: await d3.json('/static/assets/Icons/icon-pack.json'),
}
  

var selectedItems = {
    "feature": undefined,
    "icons": []
}

// For discrete-binned choropleth, store the current bin edges for legend rendering

await Promise.allSettled([ // wait for following to be defined/load in
    customElements.whenDefined('sl-select'),
    customElements.whenDefined('sl-option'),
    customElements.whenDefined('sl-button'),
])

var regionData = await d3.json(`/data/respiratory/${mapGeographicUnitSelector.value}/${mapDiseaseSelector.value}?data_version=${metadata.data_version}&${parseInt(Math.random()*9999999999)}`)

drawStateHospitalizations(mapDiseaseSelector.value, mapTypeSwitch.value, mapStateHospitalizationsSvg, mapStateHospitalizationsSubtitle)

