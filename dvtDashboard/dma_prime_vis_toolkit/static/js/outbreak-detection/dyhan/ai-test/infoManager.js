import { getOutbreakDataBySpatialResoultionIn } from "../utils.js";
import { drawVegaMap } from "./drawVegaMap.js";
// import {  validateVegaLite } from "./helper.js";
import { drawVegaSmallMultiples } from "./drawVegaSmallMultiples.js";
import { selectorDOMElements } from "./DOMInit.js";
import { drawD3SmallMultiples } from "./drawD3SmallMultiples.js";
import { drawD3Map } from "./drawD3Map.js";
import { inferAllDates } from "../utils.js";
import { computeStatistics, systemSpecification } from "./helper.js";

export const data = {};

export async function getOutbreakData(spatialResolution, temporalResolution) {
  let data = await getOutbreakDataBySpatialResoultionIn(spatialResolution);
  console.log(data);

  const tempData = data.features;
  const areaNames = tempData.map((d) => d.name);
  const diseaseNames = Object.keys(tempData[0].properties.data);
  // console.log(areaNames);
  // console.log(diseaseNames);

  const dataRestructured = [];
  const timeMeta = data.metadata;

  const inferredDates = inferAllDates({
    t2: timeMeta.end_date,
    yearlyValues: data.features[0].properties.data.adenovirus.yearly,
    monthlyValues: data.features[0].properties.data.adenovirus.monthly,
    weeklyValues: data.features[0].properties.data.adenovirus.weekly,
  });

  for (const area of areaNames) {
    const areaData = tempData.find((d) => d.name === area).properties.data;

    for (const disease of diseaseNames) {
      const diseaseData = areaData[disease][temporalResolution];

      // console.log(diseaseData)

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

  data.metadata.inferred_dates = inferredDates;

  return [data, dataRestructured];
  // drawTableView(data.regionData.features, "table-view-container-aiPage");
}

function drawDataTable(data) {
  // console.log(data);
  // console.log(data[0]);
  // console.log(Object.keys(data[0]));
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
    "map-region-selector",
  );

  const temporalResolutionSelector = document.getElementById(
    "surveillance-time-window-switch",
  );
  const deseaseSelector = "adenovirus";
  // document.getElementById(
  //   "map-region-selector",
  // );

  const spatialResolution = spatialResolutionSelector.value;
  const temporalResolution = temporalResolutionSelector.value;
  const diseaseOfInterest = "adenovirus";

  const [mapData, tableData] = await getOutbreakData(
    spatialResolution,
    temporalResolution,
  );

  data.spatialData = mapData;
  console.log(mapData);

  // data.tableData = curData;

  // drawDataTable(curData);
  // const mapView = await drawVegaMap(mapData, "map-container");

  for (const data of mapData.features) {
    data.properties.valueOfInterest =
      data["properties"]["data"][diseaseOfInterest][temporalResolution];
  }

  //// the following code snippet is for saving statistics of data to deliver ai server
  //// for AI to know the data distribution and do better inference
  //// it may not be necessary if we use RAG
  // const dataContext = structuredClone(mapData.features);

  // console.log(dataContext)

  // dataContext.forEach((item) => {
  //   console.log(item);
  //   delete item.geometry;
  //   delete item.id;
  //   delete item.feature;
  //   item.valueOfInterest_latest =
  //     item.properties.valueOfInterest[
  //       item.properties.valueOfInterest.length - 1
  //     ];
  //   item.dataStatistics = computeStatistics(item.properties.valueOfInterest);
  //   item.last7values = item.properties.valueOfInterest.slice(-7);
  //   item.diseaseOfInterest = diseaseOfInterest;
  //   item.regionResolution = spatialResolution;
  //   item.temporalResolution = temporalResolution;
  //   delete item.properties;
  // });

  // systemSpecification.dataContext = dataContext;

  // console.log(dataContext)
  drawD3Map(mapData, "map-container");

  drawD3SmallMultiples(
    mapData.features,
    mapData.metadata.inferred_dates,
    "smallMultiples-container",
    diseaseOfInterest,
    temporalResolution,
  );

  // const smView = await drawVegaSmallMultiples(
  //   mapData,
  //   "smallMultiples-container",
  // );

  // // When hoverRegion changes in the chart, update highlightRegion in the map
  // smView.addSignalListener("hoverRegion", async (_name, value) => {
  //   // console.log(value);
  //   // value is either null or an object with the selected fields
  //   const region = value && value.name ? value.name : null;

  //   if (region == null) {
  //     mapView.signal("highlightRegion", "");
  //     return;
  //   }

  //   mapView.signal("highlightRegion", region[0]);
  //   await mapView.runAsync();
  // });

  // console.log(tempAIResponse);
  // presentAIResponse(tempAIResponse);
}
