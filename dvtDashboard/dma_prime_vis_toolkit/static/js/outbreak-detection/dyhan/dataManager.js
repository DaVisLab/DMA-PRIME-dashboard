import { smallMultipleManager } from "./smallMultipleManager.js";
import { mapManager } from "./mapManager.js";
import { drawTableView } from "./tableView.js";
import { generateCheckboxListForRiskIndexPanel, setRiskIndexByDiseaseInPanel } from "./sidebarManager.js";
import  {getOutbreakDataBySpatialResoultionIn} from "./utils.js"
import { inferAllDates } from "./utils.js";

export const outbreak_data = {
  region: null,
  county: null,
  zcta: null,
};

async function getRiskIndexBySpatialResoultionIn(mapSpatialResoultion) {
  const data = await getOutbreakDataBySpatialResoultionIn(mapSpatialResoultion);

  const surveillanceTimeWindowSwitch = document.getElementById(
    "surveillance-time-window-switch"
  );
  await customElements.whenDefined("sl-radio-group");
  await surveillanceTimeWindowSwitch.updateComplete;

  const surveillanceTimeWindow = surveillanceTimeWindowSwitch.value;
  // get historical normalized risk index for all time points
  const historicalDiseaseStats = {};

  const timeMeta = data.metadata;
  const tempData = data.features[0].properties.data.adenovirus;

  const inferredDates = inferAllDates({
    t2: timeMeta.end_date,
    yearlyValues: tempData.yearly,
    monthlyValues: tempData.monthly,
    weeklyValues: tempData.weekly,
  });


  // Collect all historical values for each disease and time point
  data.features.forEach((d) => {
    const dataKeys = Object.keys(d.properties.data);

    for (let key of dataKeys) {
      if (!historicalDiseaseStats[key]) {
        historicalDiseaseStats[key] = {};
      }

      const curDiseaseData = d.properties.data[key];
      const curSurveillanceWindowData = curDiseaseData[surveillanceTimeWindow];

      // For each time point, collect values across all features
      curSurveillanceWindowData.forEach((value, timeIdx) => {
        if (!historicalDiseaseStats[key][timeIdx]) {
          historicalDiseaseStats[key][timeIdx] = { values: [] };
        }

        if (!isNaN(value)) {
          historicalDiseaseStats[key][timeIdx].values.push(Math.max(0, value));
        }
      });
    }
  });

  // Calculate min and max for each disease at each time point
  for (let key in historicalDiseaseStats) {
    for (let timeIdx in historicalDiseaseStats[key]) {
      const values = historicalDiseaseStats[key][timeIdx].values;
      historicalDiseaseStats[key][timeIdx].min = Math.min(...values);
      historicalDiseaseStats[key][timeIdx].max = Math.max(...values);
    }
  }

  // Normalize historical data
  data.features.forEach((d) => {
    d.properties.historical_disease_risk_index_normalized = {};

    const dataKeys = Object.keys(d.properties.data);

    for (let key of dataKeys) {
      const curDiseaseData = d.properties.data[key];
      const curSurveillanceWindowData = curDiseaseData[surveillanceTimeWindow];

      d.properties.historical_disease_risk_index_normalized[key] =
        curSurveillanceWindowData.map((value, timeIdx) => {
          const min = historicalDiseaseStats[key][timeIdx].min;
          const max = historicalDiseaseStats[key][timeIdx].max;

          // Min-max normalization to [0, 1]
          return max !== min ? (value - min) / (max - min) : 0;
        });
    }

    // Combine normalized values across all diseases
    const timeSeriesLength =
      dataKeys.length > 0
        ? d.properties.historical_disease_risk_index_normalized[dataKeys[0]]
            .length
        : 0;

    d.properties.final_historical_disease_risk_index = [];

    // For each time point, sum across all diseases
    for (let timeIdx = 0; timeIdx < timeSeriesLength; timeIdx++) {
      let sumAtTimePoint = 0;

      for (let key of dataKeys) {
        sumAtTimePoint +=
          d.properties.historical_disease_risk_index_normalized[key][timeIdx] ??
          0;
      }

      d.properties.final_historical_disease_risk_index.push(sumAtTimePoint);
    }
  });
  
  console.log(data)
  data.metadata.inferred_dates = inferredDates;
 
  return data;
}

async function getOutbreakDataAll() {
  //   outbreak_data.state = await getRiskIndexBySpatialResoultionIn("state");
  outbreak_data.region = await getRiskIndexBySpatialResoultionIn("region");
  // console.log(data)
  outbreak_data.county = await getRiskIndexBySpatialResoultionIn("county");
  outbreak_data.zcta = await getRiskIndexBySpatialResoultionIn("zcta");

  console.log(outbreak_data)
  // console.log(Object.keys(outbreak_data.region.features[0].properties));
  // console.log(Object.keys(outbreak_data.region.features[0].properties.data));
  // generateCheckboxListForRiskIndexPanel(outbreak_data.region.features[0].properties.final_historical_disease_risk_index);
  setRiskIndexByDiseaseInPanel(outbreak_data.region);

  smallMultipleManager.data = outbreak_data;
  smallMultipleManager.initSmallMultipleView(outbreak_data);

  mapManager.data = outbreak_data;
  mapManager.callInitMapViews(outbreak_data);

  console.log(outbreak_data);
  drawTableView(outbreak_data.region.features);
  // d3.select("#map-loading-div").style("visibility", "hidden")
  // d3.selectAll("#map-loading-div circle").classed("animate", false)
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => getOutbreakDataAll());
} else {
  getOutbreakDataAll();
}
