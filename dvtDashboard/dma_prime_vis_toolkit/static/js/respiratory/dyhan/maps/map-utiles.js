import { maps } from "../mapManager.js";

export function initMap(map, options = { panning: false, zooming: false }) {
  document
    .querySelectorAll(".maplibregl-ctrl-bottom-right")
    .forEach((d) => d.remove());

  map.dragRotate.disable();
  if (options.panning === false) {
    map.dragPan.disable();
  }

  if (options.zooming === false) {
    map.scrollZoom.disable();
    map.doubleClickZoom.disable();
  }
}

export function highlightLine(map, layer, ROIs) {
  map.setPaintProperty(layer, "line-color", [
    "case",
    ["in", ["get", "id"], ["literal", ROIs]],
    "blue",
    "gray",
  ]);

  // map.setPaintProperty(layer, "line-color", [
  //   "case",
  //   ["==", ["get", "id"], lineId],
  //   "blue",
  //   "gray",
  // ]);

  // map.setPaintProperty(layer, "line-width", [
  //   "case",
  //   ["==", ["get", "id"], lineId],
  //   2,
  //   0.5,
  // ]);

  map.setPaintProperty(layer, "line-width", [
    "case",
    ["in", ["get", "id"], ["literal", ROIs]],
    2,
    0.5,
  ]);
}

// export function dehighlightLine(map, layer) {
//   map.setPaintProperty(layer, "line-color", "gray");
//   map.setPaintProperty(layer, "line-width", 0.5);
// }

export function dehighlightLine(map, layer, ROIs) {

  // map.setPaintProperty(layer, "line-color", "gray");
  // map.setPaintProperty(layer, "line-width", 0.5);

  map.setPaintProperty(layer, "line-color", [
    "case",
    ["in", ["get", "id"], ["literal", ROIs]],
    "blue",
    "gray",
  ]);

  map.setPaintProperty(layer, "line-width", [
    "case",
    ["in", ["get", "id"], ["literal", ROIs]],
    2,
    0.5,
  ]);
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

  const mapOutcomeSelector = document.getElementById(
    "map-data-variable-selector"
  ).value;

  let regionData = await d3.json(
    `/data/respiratory/${mapSpatialResoultion}/${mapDiseaseSelector}?data_version=current&${parseInt(
      Math.random() * 9999999999
    )}`
  );

  let valueTypeSwitch = document.getElementById("map-type-switch").value;
  let allowImputations = document.getElementById(
    "map-include-imputations"
  ).checked;

  function getValueOfInterest(valueType, featureProperties, allowImputations) {
    if (!allowImputations && featureProperties.projected.imputed) {
      return null;
    }

    let vals = featureProperties.projected.values;

    if (valueType == "percentDifference") {
      let thisWeekDatum = parseFloat(vals.at(-1));
      let lastWeekDatum = parseFloat(vals.at(-2));

      return ((thisWeekDatum - lastWeekDatum) / Math.abs(lastWeekDatum)) * 100;
    } else if (valueType == "rate") {
      return (vals.at(-1) / scPopulation) * 1000;
    } else if (valueType == "count") {
      // count
      return vals.at(-1);
    } else {
      //default
      return vals.at(-1);
    }
  }

  return regionData.features.map((d) => {
    if (mapSpatialResoultion == "state") {
    } else if (mapSpatialResoultion == "region") {
      d.properties.id = d.properties.Region;
      d.properties.name = d.properties.Region;
    } else if (mapSpatialResoultion == "county") {
      d.properties.id = d.properties.NAME;
      d.properties.name = d.properties.NAME;
    } else if (mapSpatialResoultion == "zcta") {
      d.properties.id = d.properties.ZCTA;
      d.properties.name = d.properties.ZCTA;
    }

    d.properties.id = d.properties.id.toLowerCase().replaceAll(" ", "_");
    d.properties.projected_value = getValueOfInterest(
      valueTypeSwitch,
      d.properties.data[mapDataSourceSelector][mapOutcomeSelector],
      allowImputations
    );

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
      "fill-color": paintOptions["fill-color"],
      "fill-opacity":
        paintOptions["fill-opacity"] != undefined
          ? paintOptions["fill-opacity"]
          : 1,
    },
  });
}

export function drawLineGeoJSONLayer(map, sourceID, layerID, paintOptions) {
  // draw line
  map.addLayer({
    id: layerID,
    type: "line", // Or 'fill', 'line', 'symbol' depending on your GeoJSON type
    source: sourceID,
    paint: {
      "line-color": paintOptions["line-color"]
        ? paintOptions["line-color"]
        : "gray",
      "line-width":
        paintOptions["line-width"] !== undefined
          ? paintOptions["line-width"]
          : 0.5,
    },
  });
}

export function targetMapsAndLayersByCurrentSpatialResolution() {
  const mapSpatialResoultion = document.getElementById(
    "map-resolution-selector"
  ).value;

  if (mapSpatialResoultion == "region") {
    return {
      targetMap: maps.region_map,
      targetLayer: maps.layers.region_map_layer,
    };
  } else if (mapSpatialResoultion == "county") {
    return {
      targetMap: maps.county_map,
      targetLayer: maps.layers.county_map_layer,
    };
  } else if (mapSpatialResoultion == "zcta") {
    return {
      targetMap: maps.zip_map,
      targetLayer: maps.layers.zip_map_layer,
    };
  }
}
