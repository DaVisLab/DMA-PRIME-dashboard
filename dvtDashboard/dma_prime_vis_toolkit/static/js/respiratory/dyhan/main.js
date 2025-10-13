import {
  case1,
  case2,
  case3,
  case4,
  case5,
  case6,
  case7,
  case8,
  case9,
  case10,
  case11,
  case12,
  case13,
  case14,
  case15,
  case16,
} from "/static/js/respiratory/dyhan/boundaryAnimationTest.js";

import {
  getColorTheme,
  drawSimpleMap,
  drawSimpleBoundaryMap,
} from "/static/js/respiratory/dyhan/simpleMap.js";

let zipGeoJson = null;
let countyGeoJson = null;
let countyPopulationJson = null;
let zipPopulationJson = null;
let prevRegionType = null;
let mapTurfPolygonHistory = [];

const spatialHierarchy = {
  state: 1,
  region: 2,
  county: 3,
  zcta: 4,
};

function cssSafe(s) {
  return String(s).replace(/[^a-z0-9\-_]/gi, "_");
}

function loadGeoJSON() {
  return fetch("static/assets/GeoJSON/tl_2024_sc_zcta_simplified.json")
    .then((response) => response.json())
    .then((data) => {
      zipGeoJson = data;
    });
}

function loadCountyGeoJSON() {
  return fetch("static/assets/GeoJSON/tl_2024_sc_county_simplified.json")
    .then((response) => response.json())
    .then((data) => {
      countyGeoJson = data;
    });
}

function loadCountyPopulationJSON() {
  return fetch("static/assets/dyhan-population-data/SC_county_population.json")
    .then((response) => response.json())
    .then((data) => {
      countyPopulationJson = data;
    });
}

function loadZIPPopulationJSON() {
  return fetch("static/assets/dyhan-population-data/SC_zip_population.json")
    .then((response) => response.json())
    .then((data) => {
      zipPopulationJson = data;
    });
}

let svg = d3
  .select("#test-div")
  .append("svg")
  .attr("width", 800)
  .attr("height", 800);

let svg2 = d3
  .select("#test-div")
  .append("svg")
  .attr("width", 800)
  .attr("height", 800);

Promise.all([
  loadGeoJSON(),
  loadCountyGeoJSON(),
  loadCountyPopulationJSON(),
  loadZIPPopulationJSON(),
])
  .then(() => {
    let curGeoInfo = {
      type: mapRegionSelector.value,
      geoJson: mapRegionSelector.value == "zcta" ? zipGeoJson : countyGeoJson,
      populationJson:
        mapRegionSelector.value == "zcta"
          ? zipPopulationJson
          : countyPopulationJson,
    };

    drawSimpleBoundaryMap(svg, curGeoInfo);
    // drawSimpleBoundaryMap(svg2, curGeoInfo);
  })
  .catch(console.error);

// dataTypePicker.addEventListener("sl-change", (e) => {
//   console.log(e.target.value);
// });

mapRegionSelector.addEventListener("sl-change", (e) => {
  console.log("ff");
  svg.selectAll("*").remove();
  svg2.selectAll("*").remove();

  const transitionTime = +document.getElementById("transition-time-picker").value;
  console.log(transitionTime);

  case1(svg.node(), countyGeoJson, zipGeoJson, transitionTime);
//   case8(svg2.node(), countyGeoJson, zipGeoJson);

  //
  //   prevGeoInfo = {
  //     type: prevRegionType,
  //     geoJson: prevRegionType == "zcta" ? zipGeoJson : countyGeoJson,
  //     populationJson:
  //       prevRegionType == "zcta" ? zipPopulationJson : countyPopulationJson,
  //   };
  //   curGeoInfo = {
  //     type: e.target.value,
  //     geoJson: e.target.value == "zcta" ? zipGeoJson : countyGeoJson,
  //     populationJson:
  //       e.target.value == "zcta" ? zipPopulationJson : countyPopulationJson,
  //   };
  //   drawSimpleAnimationMap(curGeoInfo, prevGeoInfo);
  //   prevRegionType = e.target.value;
});
