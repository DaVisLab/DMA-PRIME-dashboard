const {DeckGL, IconLayer, FlyToInterpolator} = deck;

var mobileHealthClinics = [
]

let dataVersion = 0

const deckgl = new DeckGL({
    container: document.getElementById("map-div"),
    mapStyle: 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json',
  initialViewState: {
    longitude: -80.75,
    latitude: 33.8,
    zoom: 7
  },
  controller: true,
  pickingRadius: 10,
});

redraw();

function redraw() {
  deckgl.setProps({
    layers: [
    new IconLayer({
      id: 'mobile-health-clinic',
      data: mobileHealthClinics,
      iconAtlas: 'https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/icon-atlas.png',
      iconMapping: 'https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/icon-atlas.json',
      getPosition: d => [+d.coords.lon, +d.coords.lat],
      getColor: [255, 0, 0],
      getIcon: d => 'marker',
      sizeScale: 15,
      pickable: true,
      parameters: {
        depthTest: false
      },
      autoHighlight: true,
      highlightColor: [255, 200, 0],
      onDragStart: (info, event) => { deckgl.setProps({controller: {dragPan: false}}) },
      onDrag: mobileClinicDrag,
      onDragEnd: (info, event) => { 
        deckgl.setProps({controller: true}); 
        updateLocationCoords(info.index, lat=mobileHealthClinics[info.index].coords.lat, lon=mobileHealthClinics[info.index].coords.lon) },
      onClick: (info, event) => mobileClinicClick(info.index),
      updateTriggers: {
        getPosition: {dataVersion}
      },
      
    })
      ]})
    return true
}