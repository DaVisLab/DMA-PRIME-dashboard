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
    .attr("isROI", "false") // Custom state flag used elsewhere to track whether this unit has been moved into the "ROI" (region-of-interest) component.
    .on("mouseenter", (event, d) => {
      const targetMapID = `map-path-${data.nameID}`; // Coupling rule: small-multiple unit <-> map path share the same nameID-based id convention.
      d3.select(`#${targetMapID}`).dispatch("mouseover"); // Programmatically forwards hover to the corresponding map path so both views highlight in sync.
    })
    .on("mouseleave", (event, d) => {
      const targetMapID = `map-path-${data.nameID}`; // Must match the id convention used by the map layer (e.g., <path id="map-path-...">).
      d3.select(`#${targetMapID}`).dispatch("mouseleave"); // Forwards un-hover to reset map highlighting when leaving the small multiple.
    });

  const processed = data.properties.valueOfInterest.map((d, i) => ({
    x: i, // Uses the array index as the x-axis position (implicit time/order; date labels are handled elsewhere if needed).
    y: d,
  }));

  const margin = { top: 10, right: 20, bottom: 0, left: 10 };
  const width = svg.node().clientWidth; // Reads the rendered SVG size from the DOM (depends on the container layout, not just the attr width/height).

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
    .domain([0, processed.length - 1]) // x is defined over index positions (0..N-1), not actual timestamps.
    .range([0, innerWidth]);

  const y = d3
    .scaleLinear()
    .domain([
      d3.min([0, d3.min(processed, (d) => d.y)]), // Forces the baseline to include 0 even if all values are positive (visual comparability across units).
      d3.max(processed, (d) => d.y),
    ])
    .nice()
    .range([height, margin.top]); // Inverted y-range: larger values appear higher; margin.top reserves space for the label.

  const line = d3
    .line()
    .defined((d) => d.y !== null && !isNaN(d.y)) // Skips null/NaN points so missing data creates gaps instead of connecting across them.
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

  svgContainer.innerHTML = ""; // Hard reset: clears previously created div/svg nodes to avoid duplicates and stale event handlers.

  const unitWidth = svgContainer.clientWidth;

  // Sorts spaces by the latest value for the selected disease & temporal resolution (ranking small multiples by "current" intensity).
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
    let svgUnitContainer = d3
      .select(svgContainer)
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
