import {
  populationColorMap,
  unknownColor,
  getFeatureValue,
  getAllValuesFromFeature,
  getAllFeaturesValue,
  drawTooltip,
  drawStateHospitalizations,
} from "/static/js/respiratory/script.js";

import {
  unitHeight,
  pin_icon_path,
  getCombinedBBox,
  moveSmallMultipleUnitToROI,
  resetSmallMultipleUnitPosition,
} from "./smallMultiple-utils.js";

import {
  targetMapsAndLayersByCurrentSpatialResolution,
  highlightLine,
  dehighlightLine,
} from "../maps/map-utiles.js";

import { maps } from "../mapManager.js";

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

function drawingSmallMultipleUnit(svg, data, dateInfo) {
  console.log(data);
  svg
    .attr("id", `small-multiple-${data.nameID}`)
    .attr("class", `small-multiple-unit small-multiple-item-${data.nameID}`)
    .attr("isROI", "false")
    .on("mouseover", function () {
      let targets = targetMapsAndLayersByCurrentSpatialResolution();

      highlightLine(targets.targetMap, targets.targetLayer.lineLayerID, [
        data.nameID,
        ...maps.regionOfInterest,
      ]);
    })
    .on("mouseout", function () {
      let targets = targetMapsAndLayersByCurrentSpatialResolution();

      dehighlightLine(
        targets.targetMap,
        targets.targetLayer.lineLayerID,
        maps.regionOfInterest
      );
    });

  let pinIcon = svg
    .append("path")
    .attr("class", "pin-feature")
    .attr("d", pin_icon_path)
    .attr("stroke", "gray")
    .style("stroke-width", 0.8)
    .style("transform", "scale(0.8)")
    .attr("x", 1)
    .attr("y", 3);

  let textPlace = svg
    .append("text")
    .text(data.name)
    .attr("x", +pinIcon.attr("x") + pinIcon.node().getBBox().width + 5)
    .attr("y", +pinIcon.attr("y") + pinIcon.node().getBBox().height / 2)
    .attr("font-size", 10)
    .attr("fill", "black")
    .attr("font-weight", "bold")
    .style("font-style", "italic");

  const box = getCombinedBBox(textPlace, pinIcon);

  svg
    .append("rect")
    .attr("class", "pin-button")
    .attr("x", box.minX)
    .attr("y", box.minY)
    .attr("width", box.width)
    .attr("height", box.height)
    .attr("fill", "white")
    .attr("opacity", 0)
    .style("cursor", "pointer")
    .on("click", function () {
      let selectionROI = d3.select(`#small-multiple-${data.id}`);

      if (!maps.regionOfInterest.includes(data.id)) {
        moveSmallMultipleUnitToROI(selectionROI, data.id);
        maps.regionOfInterest.push(data.id);
      } else {
        resetSmallMultipleUnitPosition(data.id);
        maps.regionOfInterest = maps.regionOfInterest.filter(
          (d) => d !== data.id
        );
      }
    });
  // console.log(data);

  const dataValues = data.properties.final_historical_disease_risk_index;

  if (dataValues.length == 0) {
    svg.style("background-color", "gray");
    return;
  }

  const yearlySplittedDateInfo = {};
  // let values = data.data.values;
  // const processed = dataValues.map((d, i) => ({ x: i, y: d }));

  dateInfo.forEach((d, i) => {
    const [yy, mm, dd] = d.split("-").map(Number);
    yearlySplittedDateInfo[yy] = yearlySplittedDateInfo[yy] || [];
    yearlySplittedDateInfo[yy].push(i);
  });

  const yearKeys = Object.keys(yearlySplittedDateInfo);
  const maxYear = Math.max(...yearKeys);

  const margin = { top: 10, right: 60, bottom: 0, left: 0 };
  const width = svg.node().clientWidth;
  const height = svg.node().clientHeight;

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  let processed;
  let line;
  let x, y;

  for (const year of yearKeys) {
    const indices = yearlySplittedDateInfo[year];

    const yearDataValues = indices.map((idx) => dataValues[idx]);

    // console.log(yearDataValues);
    const transformedDataInfo = indices.map((d) => {
      const [yy, mm, dd] = dateInfo[d].split("-").map(Number);
      return new Date(2020, mm - 1, dd);
    });

    processed = yearDataValues.map((d, i) => ({
      x: transformedDataInfo[i],
      y: d,
    }));

    x = d3
      .scaleTime()
      // .domain(d3.extent(processed, (d) => d.x))
      .domain([new Date(2020, 0, 1), new Date(2020, 11, 31)])
      .range([0, innerWidth]);

    y = d3
      .scaleLinear()
      .domain([
        d3.min([0, d3.min(processed, (d) => d.y)]),
        d3.max(processed, (d) => d.y),
      ])
      .nice()
      .range([margin.top + innerHeight, margin.top]);

    line = d3
      .line()
      .defined((d) => d.y !== null && !isNaN(d.y))
      .x((d) => x(d.x))
      .y((d) => y(d.y));

    svg
      .append("path")
      .datum(processed)
      .attr("fill", "none")
      .attr("stroke", () => {
        if (year == maxYear) {
          return "#1f77b4";
        } else {
          return "gray";
        }
      })
      .attr("stroke-width", () => {
        if (year == maxYear) {
          return "2";
        } else {
          return "0.5";
        }
      })
      .attr("stroke-opacity", () => {
        if (year == maxYear) {
          return "1";
        } else {
          return "0.5";
        }
      })
      .attr("d", line);
  }

  const last2 = processed.slice(-2).filter((d) => d.y !== null);
  const trend = trendStrict(last2.map((d) => d.y));

  svg
    .append("path")
    .datum(last2)
    .attr("fill", "none")
    .attr("stroke", trend === 1 ? "red" : trend === -1 ? "green" : "gray")
    .attr("stroke-width", 3)
    .attr("d", line);

  let lastPosCircle = svg
    .append("circle")
    .attr("cx", x(processed.length - 1))
    .attr("cy", y(dataValues.slice(-1)[0]))
    .attr("r", 3)
    .attr("stroke", "black")
    .attr("fill", trend === 1 ? "red" : trend === -1 ? "green" : "gray");

  const riskIndexGroup = svg.append("g").attr("class", "risk-index-group");

  const riskIndexText = riskIndexGroup
    .append("text")
    .attr("x", innerWidth + 10)
    .attr("y", +lastPosCircle.attr("cy"))
    .attr("font-size", 12)
    .attr("font-weight", "bold")
    // .attr("fill", trend === 1 ? "red" : trend === -1 ? "green" : "gray")
    .attr("fill", "black")
    .text(dataValues.slice(-1)[0].toFixed(2));

  const riskIndexTrend = riskIndexGroup
    .append("text")
    .attr("x", innerWidth + 10 + riskIndexText.node().getBBox().width + 5)
    .attr("y", +lastPosCircle.attr("cy"))
    .text(trend === 1 ? "↑" : trend === -1 ? "↓" : "→")
    .attr("font-size", 16)
    .style("font-weight", "bold")
    .attr("fill", trend === 1 ? "red" : trend === -1 ? "green" : "gray");

  return svg;
}

export function drawingSmallMultiples(dataBySpace, dateInfo) {
  const svgContainer = document.getElementById(
    "respiratory-smallMultiples-container"
  );

  svgContainer.innerHTML = "";

  //   const unitHeight = unitHeight;
  const unitWidth = svgContainer.clientWidth;

  dataBySpace = dataBySpace.sort(
    (a, b) =>
      b.properties.final_historical_disease_risk_index[
        b.properties.final_historical_disease_risk_index.length - 1
      ] -
      a.properties.final_historical_disease_risk_index[
        a.properties.final_historical_disease_risk_index.length - 1
      ]
  );
  // console.log(dataBySpace);
  // console.log(dateInfo);

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

    drawingSmallMultipleUnit(svg, data, dateInfo.weekly);
  }
}
