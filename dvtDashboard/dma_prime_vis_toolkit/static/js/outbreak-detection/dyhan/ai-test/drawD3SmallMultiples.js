import { data } from "./infoManager.js";
import {
  unitHeight,
  pin_icon_path,
  getCombinedBBox,
  moveSmallMultipleUnitToROI,
  resetSmallMultipleUnitPosition,
} from "../smallMultiples/smallMultiple-utils.js";

function drawingSmallMultipleUnit(svg, data) {
  svg
    .attr("id", `small-multiple-${data.nameID}`)
    .attr("class", `small-multiple-unit small-multiple-item-${data.nameID}`)
    .attr("isROI", "false")
          .on("mouseenter", (event, d) => {
        const targetMapID = `map-path-${data.nameID}`
        d3.select(`#${targetMapID}`).dispatch('mouseover')
      })
      .on("mouseleave", (event, d) => {
        
        const targetMapID = `map-path-${data.nameID}`
        d3.select(`#${targetMapID}`).dispatch('mouseleave')
      });

  const processed = data.properties.valueOfInterest.map((d, i) => ({
    x: i,
    y: d,
  }));

  const margin = { top: 10, right: 20, bottom: 0, left: 10 };
  const width = svg.node().clientWidth;
  const height = svg.node().clientHeight;

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  let textPlace = svg
    .append("text")
    .text(data.name)
    .attr("x", margin.left)
    .attr("y", margin.top)
    .attr("font-size", 10)
    .attr("fill", "black")
    .attr("font-weight", "bold")
    .style("font-style", "italic");

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

  return svg;
}

export function drawD3SmallMultiples(
  dataBySpace,
  dateInfo,
  containerID,
  diseaseOfInterest,
  temporalResolution,
) {
  console.log("Drawing D3 Small multiples...");

  const svgContainer = document.getElementById(containerID);

  svgContainer.innerHTML = "";

  //   const unitHeight = unitHeight;
  const unitWidth = svgContainer.clientWidth;

  dataBySpace = dataBySpace.sort(
    (a, b) =>
      b.properties["data"][diseaseOfInterest][temporalResolution][
        b.properties["data"][diseaseOfInterest][temporalResolution].length - 1
      ] -
      a.properties["data"][diseaseOfInterest][temporalResolution][
        a.properties["data"][diseaseOfInterest][temporalResolution].length - 1
      ],
  );

  for (const data of dataBySpace) {
    // check whether the item is already positioned in ROI component

    // if not draw new small multiple unit
    let svgUnitContainer = d3
      .select(svgContainer)
      .append("div")
      .style("border-bottom", "2px solid lightgray")
      .style("height", unitHeight + "px")
      .style("width", unitWidth + "px")
      .style("margin-bottom", "0.2rem")


    let svg = svgUnitContainer
      .append("svg")
      .attr("height", unitHeight)
      .attr("width", unitWidth)

    drawingSmallMultipleUnit(svg, data);
  }
}
