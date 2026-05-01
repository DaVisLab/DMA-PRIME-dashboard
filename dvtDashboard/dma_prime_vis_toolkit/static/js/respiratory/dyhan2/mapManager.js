import { addMapLegendTitle, getSpatialData,  } from "./maps/map-utiles.js";
// import { drawRegionMap } from "./maps/map-regionLevel.js";
// import { drawCountyMap } from "./maps/map-countyLevel.js";
// import { drawZipMap } from "./maps/map-zipLevel.js";
import { drawMapLayers } from "./maps/drawMapLayers.js";
export let maps = {};

function returnSCMaps(divID) {
  return new maplibregl.Map({
    container: divID,
    style:
      "https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json",
    center: [-80.3, 33.5],
    zoom: 5.5,
  });
}

async function drawMap() {
  document.getElementById("loading-spinner").style.visibility = "visible";

  const mapSpatialResoultion = document.getElementById(
    "map-resolution-selector"
  ).value;
  
  maps = {};
  maps.baseMap = returnSCMaps("focus-map-div");
  maps.spatialResolution = mapSpatialResoultion;
  maps.regionOfInterest = [];
  addMapLegendTitle(mapSpatialResoultion);

  maps.baseMap.on("load", function () {
    maps.baseMap.resize();
  });

  const healthData_bySpatialResolution = await getSpatialData(mapSpatialResoultion);

  maps.healthData_bySpatialResolution = healthData_bySpatialResolution;

  maps.layers = {
      sourceID: "map-date",
      fillLayerID: "map-fill-layer",
      lineLayerID: "map-boundary-layer",
      symbolLayerID: "map-symbol-layer",
  }

  drawMapLayers(maps.baseMap, healthData_bySpatialResolution, maps);
  // console.log(maps.regional_data);
  document.getElementById("loading-spinner").style.visibility = "hidden";
}

await Promise.allSettled([
  // wait for following to be defined/load in
  customElements.whenDefined("sl-select"),
  customElements.whenDefined("sl-option"),
  customElements.whenDefined("sl-button"),
]);

function callInitMap() {
  drawMap();

  document
    .getElementById("map-resolution-selector")
    .addEventListener("sl-change", (event) => {
      drawMap();
    });

  document
    .getElementById("map-disease-selector")
    .addEventListener("sl-change", (event) => {
      drawMap();
    });

  document
    .getElementById("map-data-source-selector")
    .addEventListener("sl-change", (event) => {
      drawMap();
    });

  document
    .getElementById("map-type-switch")
    .addEventListener("sl-change", (event) => {
      drawMap();
    });

  document
    .getElementById("map-include-imputations")
    .addEventListener("sl-change", (event) => {
      drawMap();
    });

  document
    .getElementById("map-data-variable-selector")
    .addEventListener("sl-change", (event) => {
      drawMap();
    });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () =>
    callInitMap()
  );
} else {
  (async () => callInitMap())();
}
