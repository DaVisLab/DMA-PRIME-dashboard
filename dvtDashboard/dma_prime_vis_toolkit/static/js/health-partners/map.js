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

function redraw(highlightIndex=-1) {
  hIndex = highlightIndex == null ? deckgl.layerManager.layers[0].props.highlightedObjectIndex : highlightIndex
  deckgl.setProps({
    layers: [
    new IconLayer({
      id: 'mobile-health-clinic',
      data: d3.json('/data/mobile-health-clinic-events').then(data => {
        data.forEach((datum, index) => {
          try {
            if (data[index].event_date.length >= 10) {
              data[index].event_date = dayjs.tz(data[index].event_date) 
            }
          } catch (RangeError) {
            console.log(data[index].event_date, "was not able to be parsed")
          }  
        })
        return data
      }),
      iconAtlas: '/data/icon-pack/png',
      iconMapping: '/data/icon-pack/json',
      getPosition: d => {return [+d.site_lon, +d.site_lat]},
      getColor: [255, 0, 0],
      getIcon: d => 'mobile_health_clinic',
      getSize: d => dateCutoff.isBefore(dayjs.tz(d.event_date)) ? 15 : 0,
      highlightedObjectIndex: hIndex,
      highlightColor: [255, 200, 0],
      pickable: true,
      parameters: {
        depthTest: false
      },
      onClick: function(info, event) {redraw(info.index); mobileClinicClick(info.object)},
      updateTriggers: {
        getPosition: {dataVersion}
      },
      
    })
      ]})
    return true
}

function isVisible(event) {
  recent = dateCutoff.isBefore(dayjs.tz(event.event_date))
  hasCoords = event.event_lon 
}