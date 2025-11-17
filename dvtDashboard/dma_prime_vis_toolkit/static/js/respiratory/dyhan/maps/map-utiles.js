export function initMap(
  map,
  divComponent,
  options = { panning: false, zooming: false }
) {
  const el = divComponent.querySelector(".maplibregl-ctrl-bottom-right");
  if (el) el.innerHTML = "";

  map.dragRotate.disable();
  if (options.panning === false) {
    map.dragPan.disable();
  }

  if (options.zooming === false) {
    map.scrollZoom.disable();
    map.doubleClickZoom.disable();
  }
}

export function highlightLine(map, layer, lineId) {
  map.setPaintProperty(layer, "line-color", [
    "case",
    ["==", ["get", "id"], lineId],
    "blue",
    "gray",
  ]);

  map.setPaintProperty(layer, "line-width", [
    "case",
    ["==", ["get", "id"], lineId],
    2,
    0.5,
  ]);
}

export function dehighlightLine(map, layer) {
  map.setPaintProperty(layer, "line-color", "gray");
  map.setPaintProperty(layer, "line-width", 0.5);
}

export function dehighlightArea(map, layer, areaID) {
  map.setPaintProperty(layer, "fill-opacity", [
    "case",
    ["==", ["get", "id"], areaID],
    0,
    0.7,
  ]);
}

export function removeDehighlightArea(map, layer) {
  map.setPaintProperty(layer, "fill-opacity", 0);
}

export function dehighlightLineComplete(map, layer) {
  map.setPaintProperty(layer, "line-color", "gray");
  map.setPaintProperty(layer, "line-width", 0);
}

export async function getSpatialData(space_resolution = "region") {
  const mapSpatialResoultion = space_resolution;

  const mapDiseaseSelector = document.getElementById(
    "map-disease-selector"
  ).value;

  const mapDataSourceSelector = document.getElementById(
    "map-data-source-selector"
  ).value;

  let regionData = await d3.json(
    `/data/respiratory/${mapSpatialResoultion}/${mapDiseaseSelector}?data_version=current&${parseInt(
      Math.random() * 9999999999
    )}`
  );

  return regionData.features.map((d) => {
    if (mapSpatialResoultion == "state") {
    } else if (mapSpatialResoultion == "region") {
      d.properties.id = d.properties.Region;
    } else if (mapSpatialResoultion == "county") {
      d.properties.id = d.properties.NAME;
    } else if (mapSpatialResoultion == "zcta") {
      d.properties.id = d.properties.ZCTA;
    }
    d.properties.projected_value =
      d.properties.data.health_system.positive_tests.projected.values[1];
    return d;
  });
}

export function fillAreaGeoJSONLayer(map, sourceID, layerID, paintOptions) {
  // fill area
  map.addLayer({
    id: layerID,
    type: "fill",
    source: sourceID,
    paint: {
      //   "fill-color": "#088",
      "fill-color": paintOptions["fill-color"],
      "fill-opacity": paintOptions["fill-opacity"] != undefined
        ? paintOptions["fill-opacity"]
        : 1,
    },
  });
}

export function drawLineGeoJSONLayer(
  map,
  sourceID,
  layerID,
  paintOptions
) {
  // draw line
  map.addLayer({
    id: layerID,
    type: "line", // Or 'fill', 'line', 'symbol' depending on your GeoJSON type
    source: sourceID,
    paint: {
      "line-width": paintOptions["line-width"]
        ? paintOptions["line-width"]
        : 0.5,
      "line-color": paintOptions["line-color"]
        ? paintOptions["line-color"]
        : "gray",
    },
  });
}
