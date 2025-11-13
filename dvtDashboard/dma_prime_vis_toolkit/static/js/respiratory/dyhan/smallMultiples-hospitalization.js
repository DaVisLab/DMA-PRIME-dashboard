import {
  populationColorMap,
  unknownColor,
  getFeatureValue,
  getAllValuesFromFeature,
  getAllFeaturesValue,
  drawTooltip,
  drawStateHospitalizations,
} from "/static/js/respiratory/script.js";

// var regionData = await d3.json(`/data/respiratory/${gridGeographicUnitSelector.value}/${gridDiseaseSelector.value}?data_version=${metadata.data_version}&${parseInt(Math.random() * 9999999999)}`)

async function getSpatialData() {
  const mapSpatialResoultion = document.getElementById(
    "map-resolution-selector"
  ).value;

  const mapDiseaseSelector = document.getElementById(
    "map-disease-selector"
  ).value;

  console.log(mapDiseaseSelector);

  let regionData = await d3.json(
    `/data/respiratory/${mapSpatialResoultion}/${mapDiseaseSelector}?data_version=current&${parseInt(
      Math.random() * 9999999999
    )}`
  );

  return regionData;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", callInitSmallMultipleView);
} else {
  callInitSmallMultipleView();
}

async function initSmallMultipleView() {
  const diseaseDataBySpace = await getSpatialData();

  console.log(diseaseDataBySpace)
  //   drawingHospitalizationInfo(hositalizationData);

  //   const ro = new ResizeObserver(() => {
  //     drawingHospitalizationInfo(hositalizationData);
  //   });

  //   ro.observe(d3.select("#state-hospitalizations-svg").node().parentElement);
}

function callInitSmallMultipleView() {
  initSmallMultipleView();

  document
    .getElementById("map-resolution-selector")
    .addEventListener("sl-change", (event) => {
      initSmallMultipleView();
    });

  document
    .getElementById("map-disease-selector")
    .addEventListener("sl-change", (event) => {
      initSmallMultipleView();
    });
}
