import { getOutbreakDataBySpatialResoultionIn } from "../utils.js";
import { drawVegaMap } from "./drawVegaMap.js";
// import {  validateVegaLite } from "./helper.js";
import { drawVegaSmallMultiples } from "./drawVegaSmallMultiples.js";
import { selectorDOMElements } from "./DOMInit.js";

export const data = {};

export async function getOutbreakData(spatialResolution) {
  let data = await getOutbreakDataBySpatialResoultionIn(spatialResolution);
  console.log(data);

  const tempData = data.features;
  const areaNames = tempData.map((d) => d.name);
  const diseaseNames = Object.keys(tempData[0].properties.data);
  // console.log(areaNames);
  // console.log(diseaseNames);

  const dataRestructured = [];

  for (const area of areaNames) {
    const areaData = tempData.find((d) => d.name === area).properties.data;

    for (const disease of diseaseNames) {
      const diseaseData = areaData[disease]["weekly"];

      for (let i = 0; i < diseaseData.length; i++) {
        dataRestructured.push({
          area: area,
          disease: disease,
          timestamp: i,
          value: diseaseData[i],
        });
      }
    }
  }

  return [data, dataRestructured];
  // drawTableView(data.regionData.features, "table-view-container-aiPage");
}

function drawDataTable(data) {
  console.log(data);
  console.log(data[0]);
  console.log(Object.keys(data[0]));
  const columns = Object.keys(data[0]).map((k) => ({
    title: k,
    data: k,
  }));

  $("#table-component").DataTable({
    destroy: true,
    data,
    columns,
    pageLength: 50,
    fixedHeader: true,
  });
}

// let [spatialData, curData] = await getOutbreakData("region");

// console.log(spatialData);
// console.log(curData);

export function callSpatialResolutionChange() {
  visViewUpdate();
  selectorDOMElements["geographicResolutionSelector"] = document
    .getElementById("map-region-selector")
    .innerHTML.replaceAll("\n", "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function visViewUpdate() {
  const spatialResolutionSelector = document.getElementById(
    "map-region-selector"
  );
  const spatialResolution = spatialResolutionSelector.value;
  const [mapData, tableData] = await getOutbreakData(spatialResolution);

  data.spatialData = mapData;
  // data.tableData = curData;

  // drawDataTable(curData);
  const mapView = await drawVegaMap(mapData, "map-container");
  const smView = await drawVegaSmallMultiples(
    mapData,
    "smallMultiples-container"
  );

  // When hoverRegion changes in the chart, update highlightRegion in the map
  smView.addSignalListener("hoverRegion", async (_name, value) => {
    // console.log(value);
    // value is either null or an object with the selected fields
    const region = value && value.name ? value.name : null;

    if (region == null) {
      mapView.signal("highlightRegion", "");
      return;
    }

    mapView.signal("highlightRegion", region[0]);
    await mapView.runAsync();
  });

  // console.log(tempAIResponse);
  // presentAIResponse(tempAIResponse);
}
