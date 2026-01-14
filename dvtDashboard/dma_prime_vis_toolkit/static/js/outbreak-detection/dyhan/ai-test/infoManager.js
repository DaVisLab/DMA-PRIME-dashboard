import { getOutbreakDataBySpatialResoultionIn } from "../utils.js";
import { drawTableView } from "../tableView.js";
import { drawVegaMap } from "./drawVegaMap.js";
import { tempAIResponse } from "./helper.js";
import { validateVegaLite } from "./helper.js";

export const data = {};

async function getOutbreakData() {
  data.regionData = await getOutbreakDataBySpatialResoultionIn("region");
  console.log(data.regionData);

  const tempData = data.regionData.features;
  const areaNames = tempData.map((d) => d.name);
  const diseaseNames = Object.keys(tempData[0].properties.data);
  console.log(areaNames);
  console.log(diseaseNames);

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

  return [data.regionData, dataRestructured];
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

let [spatialData, curData] = await getOutbreakData();

console.log(spatialData);
console.log(curData);

data.spatialData = spatialData;
data.tableData = curData;

drawDataTable(curData);
drawVegaMap(spatialData, "map-container");

console.log(tempAIResponse);
presentAIResponse(tempAIResponse);

async function presentAIResponse(response) {
  let responseEl = document.getElementById("ai-response");

  let factItems = response.facts
    .map(
      (fact) => `<div id="${fact.id}">
      <div style="font-weight: bold;">${fact.title}</div> 
      ${fact.statement}
      <hr/>
      </div>`
    )
    .join("");

  responseEl.innerHTML = `${factItems}`;

  response.highlight_patches.forEach(async (d) => {
    const highligh_id = d.fact_id;
    const corresponsidingFactId = `F${highligh_id.replace("F", "")}`;

    const factEl = document.getElementById(corresponsidingFactId);

    factEl.addEventListener("mouseover", async () => {
      const highlightedVegaSpec = structuredClone(
        data.mapVegaSpecs.originalMapVegaSpec
      );

      // Modify the spec to highlight patches
      highlightedVegaSpec.layer = highlightedVegaSpec.layer || [];
      highlightedVegaSpec.layer.push(...d.patch.layer);
      await vegaEmbed("#map-container", highlightedVegaSpec, {
        actions: true,
      });
    });

    factEl.addEventListener("mouseout", async () => {
      await vegaEmbed("#map-container", data.mapVegaSpecs.originalMapVegaSpec, {
        actions: true,
      });
    });
  });

  response.optional_additional_charts.forEach((d) => {
    const chart_id = d.chart_id;
    const corresponsidingFactId = `F${chart_id.replace("C", "")}`;

    const factEl = document.getElementById(corresponsidingFactId);
    const width = factEl.getBoundingClientRect().width;
    const height = factEl.getBoundingClientRect().height;
    d.width = width / 2;
    d.height = height;

    factEl.addEventListener("mouseover", async () => {
      let validation = validateVegaLite(d);

      console.log("Validation result:", validation);
      await vegaEmbed(
        `#ai-generated-helper-vis-container`,
        // vegaSpec,
        d,
        { actions: false }
      );
    });

    factEl.addEventListener("mouseout", async () => {
      document.getElementById("ai-generated-helper-vis-container").innerHTML =
        "";
    });
  });
}
