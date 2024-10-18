const {DeckGL, IconLayer, FlyToInterpolator} = deck;

var mobileHealthClinics = [
//   [7.7405,46.0125]
    {position: [-122.45, 37.8], color: [255, 0, 0], radius: 100},
    {position: [-115, 37.8], color: [255, 0, 0], radius: 100}

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
      getPosition: d => d.position,
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
      onDrag: (info, event) => {
        mobileHealthClinics[info.index].position = info.coordinate
        dataVersion++

        return redraw()
      },
      onDragEnd: (info, event) => { deckgl.setProps({controller: true}) },
      updateTriggers: {
        getPosition: {dataVersion}
      },
      
    })
      ]})
    return true
}