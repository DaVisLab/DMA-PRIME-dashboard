import {
  unitHeight,
  pin_icon_path,
  getCombinedBBox,
  moveSmallMultipleUnitToROI,
  resetSmallMultipleUnitPosition,
  returnSortedData,
  returnFilteredDataByName,
} from "./smallMultiple-utils.js";

import { showMapTooltip } from "./map-interactions.js";

import { selectedItems, redraw } from "./map.js";
// import { maps } from "../mapManager.js";

async function getSpatialData() {
  const mapSpatialResoultion = mapGeographicUnitSelector.value;

  const mapDiseaseSelected = mapDiseaseSelector.value;

  const mapDataSourceSelector = mapPopulationSelector.value;

  const mapOutcomeSelector = mapOutcomeVariableSelector.value;

  let regionData = await d3.json(
    `/data/respiratory/${mapSpatialResoultion}/${mapDiseaseSelected}?data_version=current&${parseInt(
      Math.random() * 9999999999
    )}`
  );

  console.log(regionData);
  // let imputedDataAvailable =regionData.features.filter(d=>{
  //   const data = d.properties.data;

  //   const generalPopulationData = data["general_population"] || {};
  //   const healthSystyemData = data["health_system"] || {};

    
  //   let hasImputed = false;

  //   if(Object.keys(generalPopulationData).length>0)
  //     Object.keys(generalPopulationData).forEach((outcomeVar)=>{
  //       const outcomeData = generalPopulationData[outcomeVar];
  //       if (outcomeData.historical.imputed || outcomeData.projected.imputed) {
  //         hasImputed = true;
  //       }
  //     })

  //   if(Object.keys(healthSystyemData).length > 0 )
  //     Object.keys(healthSystyemData).forEach((outcomeVar)=>{
  //       const outcomeData = generalPopulationData[outcomeVar];
  //       if (outcomeData.historical.imputed || outcomeData.projected.imputed) {
  //         hasImputed = true;
  //       }
  //     })

  //   return hasImputed;
  // })

  // console.log(imputedDataAvailable)



  let valueTypeSwitch = document.getElementById("map-type-switch").value;
  let allowImputations = document.getElementById(
    "map-include-imputations"
  ).checked;

  function getValueOfInterest(valueType, featureProperties, allowImputations) {
    // console.log(featureProperties);
    if (!allowImputations && featureProperties.historical.imputed) {
      return null;
    }

    let historicalVals = featureProperties.historical.values;
    let projectedVals = featureProperties.projected.values;
    let vals = historicalVals.concat(projectedVals);

    let transformed;

    if (valueType === "percentDifference") {
      // Percent difference from the previous week for each element
      transformed = vals.map((current, i, arr) => {
        if (
          i === 0 ||
          arr[i - 1] === 0 ||
          arr[i - 1] == null ||
          isNaN(arr[i - 1])
        ) {
          return null; // or 0, depending on how you want to handle the first item
        }
        const prev = arr[i - 1];

        return ((current - prev) / Math.abs(prev)) * 100;
      });
    } else if (valueType === "rate") {
      // Convert each value to rate per 1,000 people
      transformed = vals.map((v) => (v / scPopulation) * 1000);
    } else if (valueType === "count") {
      // Raw counts (no transformation)
      transformed = vals;
    } else {
      // Default: no transformation
      transformed = vals;
    }
    return transformed;
  }

  // console.log(regionData);

  return regionData.features.map((d) => {
    let returnValue = {
      name: d.properties.NAME,
      stateName: null,
      countyName: null,
      zipName: null,
      data: null,
      dataObject: d,
    };

    if (mapSpatialResoultion == "state") {
      returnValue.id = d.properties.id;
      returnValue.name = d.properties.id;
    } else if (mapSpatialResoultion == "region") {
      returnValue.id = d.properties.Region;
      returnValue.name = d.properties.Region;
    } else if (mapSpatialResoultion == "county") {
      returnValue.id = d.properties.NAME;
      returnValue.name = d.properties.NAME;
      returnValue.countyName = d.properties.NAME;
    } else if (mapSpatialResoultion == "zcta") {
      returnValue.id = d.properties.ZCTA;
      returnValue.name = d.properties.ZCTA;
      returnValue.zipName = d.properties.ZCTA;
      returnValue.countyName = d.properties.county;
    } else if (mapSpatialResoultion == "facility") {
      returnValue.id = d.properties.display_name;
      returnValue.name = d.properties.display_name;
    }

    returnValue.id = returnValue.id
      // .toLowerCase()
      .replaceAll("-", " ")
      .replaceAll(" ", "_");
    returnValue.data = getValueOfInterest(
      valueTypeSwitch,
      d.properties.data[mapDataSourceSelector][mapOutcomeSelector],
      allowImputations
    );

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

let isSmallMultipleClicked = false;

function drawingSmallMultipleUnit(svg, data) {
  // console.log(data);
  svg
    .attr("id", `small-multiple-${data.id}`)
    .attr("class", `small-multiple-unit small-multiple-item-${data.id}`)
    .attr("isROI", "false")
    .on("mouseover", function () {
      if (isSmallMultipleClicked) return;

      selectedItems.feature = data.dataObject;
      dataVersion++;
      redraw();
    })
    .on("mouseout", function () {
      if (isSmallMultipleClicked) return;

      selectedItems.feature = undefined;
      dataVersion++;
      redraw();
    })
    .on("click", function () {
      let dataObject = data.dataObject;

      if (isSmallMultipleClicked) {
        showMapTooltip(dataObject);
      } else {
        selectedItems.feature = undefined;

        showMapTooltip(dataObject);
      }

      isSmallMultipleClicked = !isSmallMultipleClicked;
    });

  let textPlace = svg
    .append("text")
    .text(data.name)
    .attr("x", 12)
    .attr("y", 12)
    .attr("font-size", 10)
    .attr("fill", "black")
    .style("font-style", "italic");

  if (data.data.length == 0) {
    svg.style("background-color", "gray");
    return;
  }

  //   console.log(data);
  // let values = data.data.values;
  const processed = data.data.map((d, i) => ({ x: i, y: d }));

  const margin = { top: 10, right: 20, bottom: 0, left: 0 };
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
    .domain([
      d3.min([0, d3.min(processed, (d) => d.y)]),
      d3.max(processed, (d) => d.y),
    ])
    .nice()
    .range([height, margin.top]);

  const line = d3
    .line()
    .defined((d) => d.y !== null && !isNaN(d.y))
    .x((d) => x(d.x))
    .y((d) => y(d.y));

  svg
    .append("path")
    .datum(processed)
    .attr("fill", "none")
    .attr("stroke", "#1f77b4")
    .attr("stroke-width", 1)
    .attr("d", line);

  const last7 = processed.slice(-7).filter((d) => d.y !== null);
  const trend = trendStrict(last7.map((d) => d.y));

  //   const processed_last10 = processed.slice(-7);

  svg
    .append("path")
    .datum(last7)
    .attr("fill", "none")
    .attr("stroke", trend === 1 ? "green" : trend === -1 ? "red" : "gray")
    .attr("stroke-width", 3)
    .attr("d", line);

  svg
    .append("circle")
    .attr("cx", x(processed.length - 1))
    .attr("cy", y(data.data.slice(-1)[0]))
    .attr("r", 3)
    .attr("stroke", "black")
    .attr("fill", trend === 1 ? "green" : trend === -1 ? "red" : "gray");

  return svg;
}

function drawingSmallMultiples(dataBySpace) {
  const svgContainer = document.getElementById(
    "respiratory-smallMultiples-container"
  );

  svgContainer.innerHTML = "";

  //   const unitHeight = unitHeight;
  const unitWidth = svgContainer.clientWidth;

  // if (listOrder === "value-high") {
  //   dataBySpace.sort((a, b) => {
  //     let aLast = a.data.slice().reverse().find((d) => d != null);
  //     let bLast = b.data.slice().reverse().find((d) => d != null);

  for (const data of dataBySpace) {
    // check whether the item is already positioned in ROI component

    // if not draw new small multiple unit
    let svgUnitContainer = d3
      .select("#respiratory-smallMultiples-container")
      .append("div")
      .style("border-bottom", "2px solid lightgray")
      .style("height", unitHeight + "px")
      .style("width", unitWidth + "px")
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

  const filteredDataByName = returnFilteredDataByName(diseaseDataBySpace);
  const sortedData = returnSortedData(filteredDataByName);

  // console.log(diseaseDataBySpace);
  drawingSmallMultiples(sortedData);

  window.addEventListener("resize", () => {
    drawingSmallMultiples(sortedData);
  });

  // const ro = new ResizeObserver(() => {
  //   drawingSmallMultiples(diseaseDataBySpace);
  // });

  // ro.observe(d3.select("#respiratory-smallMultiples-container").node());
}

function callInitSmallMultipleView() {
  initSmallMultipleView();

  [
    mapTypeSwitch,
    mapDiseaseSelector,
    mapGeographicUnitSelector,
    mapPopulationSelector,
    mapOutcomeVariableSelector,
    mapIncludeImputations,
  ].forEach((el) => {
    el.addEventListener("sl-change", (event) => {
      initSmallMultipleView();
    });
  });

  document
    .getElementById("sortSelecter")
    .addEventListener("change", (event) => {
      initSmallMultipleView();
    });

  document.getElementById("filterInput").addEventListener("input", (event) => {
    initSmallMultipleView();
  });
}
