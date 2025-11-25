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

export function drawTableView(dataBySpace, containerId = "table-view-container") {
  const container = document.getElementById(containerId);
  
  if (!container) {
    console.error(`Container ${containerId} not found`);
    return;
  }

  console.log(dataBySpace)
  // Sort data by final risk index (descending)
  const sortedData = dataBySpace.sort(
    (a, b) =>
      b.properties.final_historical_disease_risk_index[
        b.properties.final_historical_disease_risk_index.length - 1
      ] -
      a.properties.final_historical_disease_risk_index[
        a.properties.final_historical_disease_risk_index.length - 1
      ]
  );

  // Create table HTML
  let tableHTML = `
    <table class="table table-sm table-hover" style="font-size: 0.85rem;">
      <thead class="table-light" style="position: sticky; top: 0; z-index: 1;">
        <tr>
          <th style="width: 25%;">Location</th>
          <th style="width: 30%; text-align: center;">Trend Visualization</th>
          <th style="width: 15%; text-align: center;">Risk Index</th>
          <th style="width: 15%; text-align: center;">Trend</th>
          <th style="width: 15%; text-align: center;">Change Rate</th>
        </tr>
      </thead>
      <tbody>
  `;

  sortedData.forEach((data, index) => {
    const dataValues = data.properties.final_historical_disease_risk_index;
    
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
        <td style="font-weight: bold; font-style: italic;">
         ${data.name}
        </td>
        <td style="text-align: center; padding: 2px;">
          <svg id="sparkline-${data.id}" class="sparkline" width="120" height="30"></svg>
        </td>
        <td style="text-align: center; font-weight: bold;">
          ${currentValue.toFixed(2)}
        </td>
        <td style="text-align: center; font-weight: bold; color: ${trendColor}; font-size: 1.2rem;">
          ${trendIcon}
        </td>
        <td style="text-align: center; color: ${trendColor}; font-weight: ${Math.abs(changeRate) > 10 ? 'bold' : 'normal'};">
          ${changeRate > 0 ? '+' : ''}${changeRate.toFixed(1)}%
        </td>
      </tr>
    `;
  });

  tableHTML += `
      </tbody>
    </table>
  `;

  container.innerHTML = tableHTML;

  // Draw D3 sparklines for each row
  drawSparklines(sortedData);

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

function setupTableEventListeners() {
  const rows = document.querySelectorAll('.table-row');
  
  rows.forEach(row => {
    row.addEventListener('click', function() {
      const id = this.getAttribute('data-id');
      
      if (!maps.regionOfInterest.includes(id)) {
        maps.regionOfInterest.push(id);
        this.style.backgroundColor = '#e3f2fd';
      } else {
        maps.regionOfInterest = maps.regionOfInterest.filter(d => d !== id);
        this.style.backgroundColor = '';
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
window.highlightTableRow = function(id) {
  const targets = targetMapsAndLayersByCurrentSpatialResolution();
  
  if (targets && targets.targetMap && targets.targetLayer) {
    highlightLine(targets.targetMap, targets.targetLayer.lineLayerID, [
      id,
      ...maps.regionOfInterest,
    ]);
  }
};

window.dehighlightTableRow = function(id) {
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
export function drawTableViewSortedByValue(dataBySpace, containerId = "table-view-container") {
  drawTableView(dataBySpace, containerId);
}

export function drawTableViewSortedByIncrease(dataBySpace, containerId = "table-view-container") {
  const container = document.getElementById(containerId);
  
  if (!container) {
    console.error(`Container ${containerId} not found`);
    return;
  }

  console.log(dataBySpace)
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
