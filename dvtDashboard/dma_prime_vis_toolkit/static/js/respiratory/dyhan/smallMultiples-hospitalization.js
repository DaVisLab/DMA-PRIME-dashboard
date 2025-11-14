import {
  populationColorMap,
  unknownColor,
  getFeatureValue,
  getAllValuesFromFeature,
  getAllFeaturesValue,
  drawTooltip,
  drawStateHospitalizations,
} from "/static/js/respiratory/script.js";

async function getSpatialData() {
  const mapSpatialResoultion = document.getElementById(
    "map-resolution-selector"
  ).value;

  const mapDiseaseSelector = document.getElementById(
    "map-disease-selector"
  ).value;

  const mapDataSourceSelector = document.getElementById(
    "map-data-source-selector"
  ).value;

  let regionData = await d3.json(
    `/data/respiratory/${mapSpatialResoultion}/${mapDiseaseSelector}?data_version=current&${parseInt(
      Math.random() * 9999999999
    )}`
  );

  console.log(regionData);
  console.log(mapSpatialResoultion);
  return regionData.features.map((d) => {
    let returnValue = {
      name: d.properties.NAME,
      stateName: null,
      countyName: null,
      zipName: null,
      data: null,
    };

    if (mapSpatialResoultion == "state") {
    } else if (mapSpatialResoultion == "region") {
    } else if (mapSpatialResoultion == "county") {
      returnValue.name = d.properties.NAME;
      returnValue.countyName = d.properties.NAME;
    } else if (mapSpatialResoultion == "zcta") {
      returnValue.name = d.properties.ZCTA;
      returnValue.zipName = d.properties.ZCTA;
      returnValue.countyName = d.properties.county;
    }

    if (mapDataSourceSelector == "health-system")
      returnValue.data =
        d.properties.data["health_system"]["all_encounters"]["historical"];
    else
      returnValue.data =
        d.properties.data["general_population"]["all_encounters"]["historical"];

    return returnValue;
  });
}

function trendStrict(arr) {
  if (arr.length < 2) return "not enough data";

  let increasing = true;
  let decreasing = true;

  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > arr[i - 1]) decreasing = false;
    if (arr[i] < arr[i - 1]) increasing = false;
  }

  if (increasing) return 1;
  if (decreasing) return -1;
  return 0;
}

function drawingSmallMultipleUnit(svg, data) {
  console.log(data);

  svg.attr("id", `small-multiple-${data.name.replaceAll(" ", "-")}`);
  // space label
  svg
    .append("text")
    .text(data.name)
    .attr("x", 5)
    .attr("y", 12)
    .attr("font-size", 10)
    .attr("fill", "black")
    .style("font-style", "italic");

  if (data.data.values.length == 0) {
    svg.style("background-color", "gray");
    return;
  }

  // let values = data.data.values;
  const processed = data.data.values.map((d, i) => ({ x: i, y: d }));

  const margin = { top: 10, right: 10, bottom: 0, left: 0 };
  const width = svg.node().clientWidth;
  const height = svg.node().clientHeight;

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const x = d3
    .scaleLinear()
    .domain([0, processed.length - 1])
    .range([0, innerWidth]);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(processed, (d) => d.y)])
    .nice()
    .range([height, margin.top]);

  const line = d3
    .line()
    .x((d) => x(d.x))
    .y((d) => y(d.y));

  svg
    .append("path")
    .datum(processed)
    .attr("fill", "none")
    .attr("stroke", "#1f77b4")
    .attr("stroke-width", 1)
    .attr("d", line);

  const trend = trendStrict(data.data.values.slice(-7));
  const processed_last10 =  processed.slice(-7);

  svg
    .append("path")
    .datum(processed_last10)
    .attr("fill", "none")
    .attr("stroke", trend === 1 ? "green" : trend === -1 ? "red" : "gray")
    .attr("stroke-width", 3)
    .attr("d", line);

  svg
    .append("circle")
    .attr("cx", x(processed.length - 1))
    .attr("cy", y(data.data.values.slice(-1)[0]))
    .attr("r", 3)
    .attr("stroke", "black")
    .attr("fill", trend === 1 ? "green" : trend === -1 ? "red" : "gray");
}

function drawingSmallMultiples(dataBySpace) {
  const svgContainer = document.getElementById(
    "respiratory-smallMultiples-container"
  );

  svgContainer.innerHTML = "";

  const unitHeight = 40;
  const unitWidth = svgContainer.clientWidth;

  console.log(dataBySpace);

  for (const data of dataBySpace) {
    // console.log(data);
    // // svgContainer
    let svgUnitContainer = d3
      .select("#respiratory-smallMultiples-container")
      .append("div")
      .style("border-bottom", "2px solid lightgray")
      .style("height", unitHeight + "px")
      .style("width", unitWidth + "px")
      // .style("background-color", "red")
      .style("margin-bottom", "0.2rem");

    let svg = svgUnitContainer
      .append("svg")
      .attr("height", unitHeight)
      .attr("width", unitWidth);

    drawingSmallMultipleUnit(svg, data);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", callInitSmallMultipleView);
} else {
  callInitSmallMultipleView();
}

async function initSmallMultipleView() {
  const diseaseDataBySpace = await getSpatialData();

  console.log(diseaseDataBySpace);
  drawingSmallMultiples(diseaseDataBySpace);

  const ro = new ResizeObserver(() => {
    drawingSmallMultiples(diseaseDataBySpace);
  });

  ro.observe(d3.select("#respiratory-smallMultiples-container"));
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

  document
    .getElementById("map-data-source-selector")
    .addEventListener("sl-change", (event) => {
      initSmallMultipleView();
    });
}
