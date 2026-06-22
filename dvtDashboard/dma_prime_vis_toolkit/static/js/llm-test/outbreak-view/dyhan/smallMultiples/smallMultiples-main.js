import {
  unitHeight,
  pin_icon_path,
  expansion_icon_path,
} from "./smallMultiple-utils.js";

import { drawLineChartByYearSplited } from "../drawLineChartByYearSplited.js";
import { showPopupLineChart } from "../popupChart.js";

import {
  targetMapsAndLayersByCurrentSpatialResolution,
  highlightLine,
  dehighlightLine,
} from "../maps/map-utiles.js";

import { maps } from "../mapManager.js";

function drawingSmallMultipleUnit(svg, data, dateInfo) {
  // console.log(data);
  const margin = { top: 10, right: 60, bottom: 0, left: 0 };
  const width = svg.node().clientWidth;
  const height = svg.node().clientHeight;

  const startMonth = +document.getElementById("monthRange").value;

  svg.innerHTML = ""; // Clear previous content

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

      d3.select(this).select(`.pin-wrap`).style("visibility", "visible");
      d3.select(this).select(`.expansion-wrap`).style("visibility", "visible");
    })
    .on("mouseout", function () {
      let targets = targetMapsAndLayersByCurrentSpatialResolution();

      dehighlightLine(
        targets.targetMap,
        targets.targetLayer.lineLayerID,
        maps.regionOfInterest,
      );

      d3.select(this).select(`.pin-wrap`).style("visibility", "hidden");
      d3.select(this).select(`.expansion-wrap`).style("visibility", "hidden");
    });

  // 1) Create groups (so transforms are clean)
  const gPin = svg
    .append("g")
    .attr("class", "pin-wrap")
    .attr("id", `pin-wrap-${data.nameID}`)
    .style("visibility", "hidden")
    .style("pointer-events", "bounding-box")
    .style("cursor", "pointer")
    .on("click", (d) => {
      console.log("pin icon mouseover");
    });

  const gExp = svg
    .append("g")
    .attr("class", "expansion-wrap")
    .attr("id", `expansion-wrap-${data.nameID}`)
    .style("visibility", "hidden")
    .style("pointer-events", "bounding-box")
    .style("cursor", "pointer")
    .on("click", (event) => {
      event.stopPropagation(); // prevent "click outside" handler from immediately closing
      showPopupLineChart(data, dateInfo);

      document
        .getElementById("popupMonthRange")
        .addEventListener("change", () => {
          showPopupLineChart(data, dateInfo);
        });
    });

  // 2) Append paths inside groups
  const pinPath = gPin
    .append("path")
    .attr("class", "pin-feature")
    .attr("d", pin_icon_path)
    .attr("fill", "gray")
    .attr("stroke", "gray")
    .attr("stroke-width", 0.8);

  const expPath = gExp
    .append("path")
    .attr("class", "expansion-feature")
    .attr("d", expansion_icon_path)
    .attr("fill", "gray")
    .attr("stroke", "gray")
    .attr("stroke-width", 0.8);

  // 3) Scale factors
  const s = 0.8;

  // 4) Measure LOCAL bboxes (before transforms)
  const pb = pinPath.node().getBBox();
  const eb = expPath.node().getBBox();

  // Choose an anchor position for the pin group in the parent SVG
  const pinX = 0;
  const pinY = 0;

  // 5) Place pin: translate so its bbox top-left becomes (pinX, pinY), then scale
  gPin.attr(
    "transform",
    `translate(${pinX - pb.x}, ${pinY - pb.y}) scale(${s})`,
  );

  // 6) Compute pin right edge and pin centerY in parent coords (after scaling)
  const pinRightX = pinX + pb.width * s;
  const pinCenterY = pinY + (pb.height * s) / 2;

  // 7) Place expansion icon to the right, and align centers
  const gap = 5;
  const expX = pinRightX + gap;
  const expY = pinCenterY - (eb.height * s) / 2;

  // Translate expansion so its bbox top-left becomes (expX, expY), then scale
  gExp.attr(
    "transform",
    `translate(${expX - eb.x * s}, ${expY - eb.y * s}) scale(${s})`,
  );

  let textPlace = svg
    .append("text")
    .text(data.name)
    .attr("x", -30)
    .attr("y", pinCenterY + pb.y)
    .attr("font-size", 10)
    .attr("fill", "black")
    .attr("font-weight", "bold")
    .style("font-style", "italic");

  textPlace.attr(
    "x",
    width - margin.right - textPlace.node().getBBox().width - 5,
  ); // Update x after text is rendered to get accurate width

  // const box = getCombinedBBox(textPlace, pinIcon);

  // svg
  //   .append("rect")
  //   .attr("class", "pin-button")
  //   .attr("x", box.minX)
  //   .attr("y", box.minY)
  //   .attr("width", box.width)
  //   .attr("height", box.height)
  //   .attr("fill", "white")
  //   .attr("opacity", 0)
  //   .style("cursor", "pointer")
  //   .on("click", function () {
  //     let selectionROI = d3.select(`#small-multiple-${data.id}`);

  //     if (!maps.regionOfInterest.includes(data.id)) {
  //       moveSmallMultipleUnitToROI(selectionROI, data.id);
  //       maps.regionOfInterest.push(data.id);
  //     } else {
  //       resetSmallMultipleUnitPosition(data.id);
  //       maps.regionOfInterest = maps.regionOfInterest.filter(
  //         (d) => d !== data.id,
  //       );
  //     }
  //   });
  // console.log(data);

  const { _, trend } = drawLineChartByYearSplited(
    svg,
    data,
    dateInfo,
    startMonth,
    margin,
  );

  const riskIndexGroup = svg.append("g").attr("class", "risk-index-group");
  const lastPosCircle = svg.select("circle");
  const dataValues = data.properties.final_historical_disease_risk_index;
  const innerWidth = width - margin.left - margin.right;

  const riskIndexText = riskIndexGroup
    .append("text")
    .attr("x", innerWidth + 10)
    .attr("y", +lastPosCircle.attr("cy"))
    .attr("font-size", 12)
    .attr("font-weight", "bold")
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
    "respiratory-smallMultiples-container",
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
      ],
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
