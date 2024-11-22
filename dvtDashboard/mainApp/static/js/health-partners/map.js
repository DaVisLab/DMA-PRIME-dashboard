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
  console.log("help")
  d3.json('/data/mobile-health-clinic-events').then(data => console.log(data))
  deckgl.setProps({
    layers: [
    new IconLayer({
      id: 'mobile-health-clinic',
      data: d3.json('/data/mobile-health-clinic-events'),
      iconAtlas: '/icon-pack/png',
      iconMapping: '/icon-pack/json',
      getPosition: d => {console.log(d); return [+d.site_lon, +d.site_lat]},
      getColor: [255, 0, 0],
      getIcon: d => 'mobile_health_clinic',
      sizeScale: 15,
      pickable: true,
      parameters: {
        depthTest: false
      },
      autoHighlight: true,
      highlightColor: [255, 200, 0],
      // onDragStart: (info, event) => { deckgl.setProps({controller: {dragPan: false}}) },
      // onDrag: mobileClinicDrag,
      // onDragEnd: (info, event) => { 
      //   deckgl.setProps({controller: true}); 
      //   updateLocationCoords(info.index, lat=mobileHealthClinics[info.index].coords.lat, lon=mobileHealthClinics[info.index].coords.lon) },
      // onClick: (info, event) => mobileClinicClick(info.index),
      updateTriggers: {
        getPosition: {dataVersion}
      },
      
    })
      ]})
    return true
}