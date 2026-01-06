import { getOutbreakDataBySpatialResoultionIn } from "../utils.js";
import { drawTableView } from "../tableView.js";

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

  return dataRestructured;
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
    fixedHeader: true
  });
}

let curData = await getOutbreakData();
data.tableData = curData;

drawDataTable(curData);
