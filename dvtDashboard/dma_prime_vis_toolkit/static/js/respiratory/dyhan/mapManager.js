import { initMap, getSpatialData } from "./maps/map-utiles.js";
import { drawRegionMap } from "./maps/map-regionLevel.js";
import { drawCountyMap } from "./maps/map-countyLevel.js";
import { drawZipMap } from "./maps/map-zipLevel.js";
export const maps = {};

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
  maps.region_map = returnSCMaps("state-map-div");

  maps.county_map = returnSCMaps("county-map-div");

  maps.zip_map = returnSCMaps("zip-map-div");

  Object.values(maps).forEach(async (map) => {
    map.on("load", function () {
      map.resize();
    });
  });

  const regional_data = await getSpatialData();
  const county_data = await getSpatialData("county");
  const zip_data = await getSpatialData("zcta");

  maps.regional_data = regional_data;
  maps.county_data = county_data;
  maps.zip_data = zip_data;

  maps.layers = {
    region_map_layer: {
      sourceID: "regional-data",
      fillLayerID: "region-fill-layer",
      lineLayerID: "region-boundary-layer",
    },
    county_map_layer: {
      sourceID: "county-data",
      fillLayerID: "county-fill-layer",
      lineLayerID: "county-boundary-layer",
    },
    zip_map_layer: {
      sourceID: "zip-data",
      fillLayerID: "zip-fill-layer",
      lineLayerID: "zip-boundary-layer",
    },
  };

  drawRegionMap(maps.region_map, regional_data, maps);
  drawCountyMap(maps.county_map, county_data, maps);
  drawZipMap(maps.zip_map, zip_data, maps);

  // console.log(maps.regional_data);
}

await Promise.allSettled([
  // wait for following to be defined/load in
  customElements.whenDefined("sl-select"),
  customElements.whenDefined("sl-option"),
  customElements.whenDefined("sl-button"),
]);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", async () => drawMap());
} else {
  (async () => drawMap())();
}
