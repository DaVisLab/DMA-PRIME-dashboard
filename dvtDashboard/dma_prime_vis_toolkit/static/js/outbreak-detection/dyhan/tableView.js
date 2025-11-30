import {
  targetMapsAndLayersByCurrentSpatialResolution,
  highlightLine,
  dehighlightLine,
} from "./maps/map-utiles.js";

import { maps } from "./mapManager.js";

function calculateTrend(arr) {
  if (arr.length < 2) return 0;

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

function calculateChangeRate(arr) {
  if (arr.length < 2) return 0;
  const last = arr[arr.length - 1];
  const previous = arr[arr.length - 2];

  if (previous === 0) return last > 0 ? 100 : 0;
  return ((last - previous) / previous) * 100;
}

export function drawTableView(
  dataBySpace,
  containerId = "table-view-container",
  presorted = false,
  sortState = null
) {
  const container = document.getElementById(containerId);

  if (!container) {
    console.error(`Container ${containerId} not found`);
    return;
  }

  const diseasesFeatures = Object.keys(dataBySpace[0].properties.data);
  console.log(diseasesFeatures);

  console.log(dataBySpace);
  // If caller did not pass a presorted array, sort by final risk index (descending) by default
  let sortedData;
  if (presorted) {
    // Caller provided the sorted array
    sortedData = dataBySpace;
  } else {
    sortedData = dataBySpace
      .slice()
      .sort(
        (a, b) =>
          b.properties.final_historical_disease_risk_index[
            b.properties.final_historical_disease_risk_index.length - 1
          ] -
          a.properties.final_historical_disease_risk_index[
            a.properties.final_historical_disease_risk_index.length - 1
          ]
      );
  }

  // Create table HTML
  // Create table HTML with horizontal scrolling and sticky first three columns
  const col0Width = 40; // checkbox
  const col1Width = 100; // location
  const col2Width = 100; // risk
  const otherColWidth = 80; // width for disease/trend/change columns

  const minTableWidth =
    col0Width +
    col1Width +
    col2Width +
    (diseasesFeatures.length + 2) * otherColWidth;

  let tableHTML = `
    <div id="${containerId}-wrapper" style="overflow-x:auto; width:100%; padding:0px">
    <table class="table table-sm table-hover sticky-table" style="font-size: 0.85rem; table-layout: fixed; min-width: ${minTableWidth}px;">
      <thead class="table-light" style="position: sticky; top: 0; z-index: 1;">
        <tr>
          <th class="sticky col-0" style="width: ${col0Width}px; min-width: ${col0Width}px; max-width: ${col0Width}px;"></th>
          <th class="sortable-header sticky col-1" data-sort-key="location" style="width: ${col1Width}px; min-width: ${col1Width}px;">Location <span class="sort-indicator"></span></th>
          <th class="sortable-header sticky col-2" data-sort-key="risk" style="width: ${col2Width}px; min-width: ${col2Width}px; text-align: center;">Risk Index <span class="sort-indicator"></span></th>
  `;

  for (let disease of diseasesFeatures) {
    const safeTitle = ("" + disease).replace(/"/g, "&quot;");
    tableHTML += `
          <th style="width: 10%; text-align: center;" class="sortable-header" data-sort-key="risk-${disease}">
            <div style="font-weight: normal; max-width:80px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:inline-block; vertical-align:middle;" title="${safeTitle}">
              <span class="sort-indicator">${disease} </span>
            </div>
          </th>`;
  }

  // add trailing headers for trend and change columns, then open tbody
  tableHTML += `
          <th style="width: ${otherColWidth}px; text-align: center;">Social Variables <span class="sort-indicator"></span></th>
          <th style="width: ${otherColWidth}px; text-align: center;">... <span class="sort-indicator"></span></th>
        </tr>
      </thead>
      <tbody>`;
  // <th style="width: 30%; text-align: center;" class="sortable-header" data-sort-key="trendVis">Trend Visualization <span class="sort-indicator"></span></th>

  sortedData.forEach((data, index) => {
    const dataValues = data.properties.final_historical_disease_risk_index;
    const diseaseDataValues =
      data.properties.historical_disease_risk_index_normalized;

    if (dataValues.length === 0) return;

    const currentValue = dataValues[dataValues.length - 1];
    const trend = calculateTrend(dataValues.slice(-2));
    const changeRate = calculateChangeRate(dataValues.slice(-2));

    const trendIcon = trend === 1 ? "↑" : trend === -1 ? "↓" : "→";
    const trendColor = trend === 1 ? "red" : trend === -1 ? "green" : "gray";

    tableHTML += `
      <tr 
        class="table-row" 
        data-id="${data.id}"
        style="cursor: pointer;"
        onmouseover="window.highlightTableRow('${data.id}')"
        onmouseout="window.dehighlightTableRow('${data.id}')"
      >
      <td class="sticky col-0" style="font-weight: bold; font-style: italic;">
          <input
            type="checkbox"
            class="row-select-checkbox"
            data-id="${data.id}"
          />
        </td>
        <td class="sticky col-1" style="font-weight: bold; font-style: italic;">${
          data.name
        } </td>
        
        <td class="sticky col-2" style="text-align: center; font-weight: bold;">${currentValue.toFixed(
          2
        )}(<span style="color: ${trendColor}">${
      changeRate > 0 ? "+" : ""
    }${changeRate.toFixed(1)}</span>)</td>
    `;

    for (let disease of diseasesFeatures) {
      const curDiseaseRiskIndex = diseaseDataValues[disease];
      const currentValue = curDiseaseRiskIndex[dataValues.length - 1];
      const trend = calculateTrend(curDiseaseRiskIndex.slice(-2));
      const changeRate = calculateChangeRate(curDiseaseRiskIndex.slice(-2));
      const trendColor = trend === 1 ? "red" : trend === -1 ? "green" : "gray";
    
      tableHTML += `<td  style="text-align: left;">${currentValue.toFixed(
        2
      )}(<span style="color: ${trendColor}">${
        changeRate > 0 ? "+" : ""
      }${changeRate.toFixed(1)}</span>)</td>
      `;
    }

    tableHTML += " </tr>";

    // <td style="text-align: center; padding: 2px;">
    //   <svg id="sparkline-${data.id}" class="sparkline" width="120" height="30"></svg>
    // </td>
  });

  tableHTML += `
      </tbody>
    </table>
  `;

  // inject sticky column styles once per container
  const styleId = `${containerId}-sticky-styles`;
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement("style");
    styleEl.id = styleId;
    styleEl.textContent = `
      #${containerId}-wrapper { overflow-x: auto; }
      #${containerId}-wrapper .sticky { position: sticky; background: white; }
      #${containerId}-wrapper thead th.sticky { top: 0; }
      #${containerId}-wrapper .sticky.col-0 { left: 0px; z-index: 4; }
      #${containerId}-wrapper .sticky.col-1 { left: ${col0Width}px; z-index: 3; }
      #${containerId}-wrapper .sticky.col-2 { left: ${
      col0Width + col1Width
    }px; z-index: 2; }
      #${containerId}-wrapper td.sticky, #${containerId}-wrapper th.sticky { box-shadow: 2px 0 2px -1px rgba(0,0,0,0.08); }
    `;
    document.head.appendChild(styleEl);
  }

  container.innerHTML = tableHTML;

  // After rendering the table, setup header sorting controls
  setupHeaderSorting(dataBySpace, containerId, sortState);

  // Draw D3 sparklines for each row
  // drawSparklines(sortedData);

  // Add event listeners
  setupTableEventListeners();
}

function drawSparklines(dataBySpace) {
  dataBySpace.forEach((data) => {
    const dataValues = data.properties.final_historical_disease_risk_index;

    if (dataValues.length === 0) return;

    const svg = d3.select(`#sparkline-${data.id}`);
    const width = 120;
    const height = 30;
    const margin = { top: 2, right: 2, bottom: 2, left: 2 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Prepare data
    const processed = dataValues.map((d, i) => ({ x: i, y: d }));

    // Create scales
    const x = d3
      .scaleLinear()
      .domain([0, processed.length - 1])
      .range([margin.left, innerWidth]);

    const y = d3
      .scaleLinear()
      .domain([
        d3.min([0, d3.min(processed, (d) => d.y)]),
        d3.max(processed, (d) => d.y),
      ])
      .nice()
      .range([innerHeight, margin.top]);

    // Create line generator
    const line = d3
      .line()
      .defined((d) => d.y !== null && !isNaN(d.y))
      .x((d) => x(d.x))
      .y((d) => y(d.y));

    // Draw main line
    svg
      .append("path")
      .datum(processed)
      .attr("fill", "none")
      .attr("stroke", "#1f77b4")
      .attr("stroke-width", 1)
      .attr("d", line);

    // Draw last 2 points with trend color
    const last2 = processed.slice(-2).filter((d) => d.y !== null);
    const trend = calculateTrend(last2.map((d) => d.y));
    const trendColor = trend === 1 ? "red" : trend === -1 ? "green" : "gray";

    if (last2.length >= 2) {
      svg
        .append("path")
        .datum(last2)
        .attr("fill", "none")
        .attr("stroke", trendColor)
        .attr("stroke-width", 2)
        .attr("d", line);
    }

    // Draw last point
    const lastPoint = processed[processed.length - 1];
    svg
      .append("circle")
      .attr("cx", x(lastPoint.x))
      .attr("cy", y(lastPoint.y))
      .attr("r", 2)
      .attr("fill", trendColor)
      .attr("stroke", "white")
      .attr("stroke-width", 0.5);
  });
}

// Compute a sortable value for a given data record and sort key
function getSortValue(data, key) {
  const values = data.properties.final_historical_disease_risk_index || [];
  switch (key) {
    case "location":
      return (data.name || "").toLowerCase();
    case "trendVis":
      // Use mean value as a proxy for sparkline sorting
      if (values.length === 0) return -Infinity;
      return values.reduce((s, v) => s + (v || 0), 0) / values.length;
    case "risk":
      return values.length ? values[values.length - 1] : -Infinity;
    case "trend":
      return calculateTrend(values.slice(-2));
    case "change":
      return calculateChangeRate(values.slice(-2));
    default:
      return 0;
  }
}

// Add click handlers to table headers to allow sorting by column
function setupHeaderSorting(
  originalData,
  containerId,
  initialSortState = null
) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const headers = container.querySelectorAll(".sortable-header");

  headers.forEach((header) => {
    header.style.cursor = "pointer";
    // restore indicator from initial sort state if provided
    const key = header.getAttribute("data-sort-key");
    if (initialSortState && initialSortState.key === key) {
      header.dataset.direction = initialSortState.direction;
      header.querySelector(".sort-indicator").textContent =
        initialSortState.direction === "asc" ? "▲" : "▼";
    }

    header.addEventListener("click", function (e) {
      const sortKey = this.getAttribute("data-sort-key");
      const currentDir = this.dataset.direction === "asc" ? "asc" : "desc";
      const newDir = currentDir === "asc" ? "desc" : "asc";

      // clear indicators on other headers
      headers.forEach((h) => {
        if (h !== this) h.dataset.direction = "";
        const ind = h.querySelector(".sort-indicator");
        if (ind) ind.textContent = "";
      });

      this.dataset.direction = newDir;
      const indicator = this.querySelector(".sort-indicator");
      if (indicator) indicator.textContent = newDir === "asc" ? "▲" : "▼";

      // Create a sorted copy of the original data
      const sorted = originalData.slice().sort((a, b) => {
        const av = getSortValue(a, sortKey);
        const bv = getSortValue(b, sortKey);

        // If sorting strings, compare differently
        if (typeof av === "string" || typeof bv === "string") {
          if (av < bv) return newDir === "asc" ? -1 : 1;
          if (av > bv) return newDir === "asc" ? 1 : -1;
          return 0;
        }

        // Numeric compare
        if (isNaN(av) || isNaN(bv)) return 0;
        return newDir === "asc" ? av - bv : bv - av;
      });

      // Re-render using the sorted array and mark as presorted
      drawTableView(sorted, containerId, true, {
        key: sortKey,
        direction: newDir,
      });
    });
  });
}

function setupTableEventListeners() {
  const rows = document.querySelectorAll(".table-row");
  const checkboxes = document.querySelectorAll(".row-select-checkbox");

  // Row click toggles selection and keeps checkbox in sync
  rows.forEach((row) => {
    row.addEventListener("click", function () {
      const id = this.getAttribute("data-id");

      if (!maps.regionOfInterest.includes(id)) {
        maps.regionOfInterest.push(id);
        this.style.backgroundColor = "#e3f2fd";
      } else {
        maps.regionOfInterest = maps.regionOfInterest.filter((d) => d !== id);
        this.style.backgroundColor = "";
      }

      // Sync checkbox state
      const cb = this.querySelector(".row-select-checkbox");
      if (cb) cb.checked = maps.regionOfInterest.includes(id);

      updateMapHighlight();
    });
  });

  // Checkbox change toggles selection but does not bubble to row click
  checkboxes.forEach((cb) => {
    cb.addEventListener("change", function (e) {
      e.stopPropagation();
      const id = this.getAttribute("data-id");

      if (this.checked) {
        if (!maps.regionOfInterest.includes(id)) maps.regionOfInterest.push(id);
        const row = document.querySelector(`.table-row[data-id="${id}"]`);
        if (row) row.style.backgroundColor = "#e3f2fd";
      } else {
        maps.regionOfInterest = maps.regionOfInterest.filter((d) => d !== id);
        const row = document.querySelector(`.table-row[data-id="${id}"]`);
        if (row) row.style.backgroundColor = "";
      }

      updateMapHighlight();
    });
  });
}

function updateMapHighlight() {
  const targets = targetMapsAndLayersByCurrentSpatialResolution();

  if (targets && targets.targetMap && targets.targetLayer) {
    highlightLine(
      targets.targetMap,
      targets.targetLayer.lineLayerID,
      maps.regionOfInterest
    );
  }
}

// Global functions for hover events
window.highlightTableRow = function (id) {
  const targets = targetMapsAndLayersByCurrentSpatialResolution();

  if (targets && targets.targetMap && targets.targetLayer) {
    highlightLine(targets.targetMap, targets.targetLayer.lineLayerID, [
      id,
      ...maps.regionOfInterest,
    ]);
  }
};

window.dehighlightTableRow = function (id) {
  const targets = targetMapsAndLayersByCurrentSpatialResolution();

  if (targets && targets.targetMap && targets.targetLayer) {
    dehighlightLine(
      targets.targetMap,
      targets.targetLayer.lineLayerID,
      maps.regionOfInterest
    );
  }
};

// Export for use in other modules
export function drawTableViewSortedByValue(
  dataBySpace,
  containerId = "table-view-container"
) {
  drawTableView(dataBySpace, containerId);
}

export function drawTableViewSortedByIncrease(
  dataBySpace,
  containerId = "table-view-container"
) {
  const container = document.getElementById(containerId);

  if (!container) {
    console.error(`Container ${containerId} not found`);
    return;
  }

  console.log(dataBySpace);
  // Sort data by change rate (descending)
  const sortedData = dataBySpace.sort((a, b) => {
    const aValues = a.properties.final_historical_disease_risk_index;
    const bValues = b.properties.final_historical_disease_risk_index;

    const aChangeRate = calculateChangeRate(aValues.slice(-2));
    const bChangeRate = calculateChangeRate(bValues.slice(-2));

    return bChangeRate - aChangeRate;
  });

  // Use the same drawing logic
  drawTableView(sortedData, containerId);
}
