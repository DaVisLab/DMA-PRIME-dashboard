import {
  unitHeight,
  returnSortedData,
  returnFilteredDataByName,
} from "./smallMultiple-utils.js";

import { showMapTooltip } from "./map-interactions.js";

import { selectedItems, redraw } from "./map.js";
import {
  getCurrentControlState,
  resolveRespiratoryControlState,
} from "./utils/controlState_utils.js";
import {
  buildWeeklyTimeline,
  getCombinedWeeklyDates,
  getNearestDateIndex,
} from "./utils/time_utils.js";

const MONTH_CHANGE_WEEKS = 4;
const SVG_MARGIN = { top: 10, right: 20, bottom: 0, left: 0 };
const TREND_COLORS = {
  increasing: "red",
  decreasing: "green",
  neutral: "gray",
};

let isSmallMultipleClicked = false;
let latestSmallMultipleData = [];
let resizeHandlerAttached = false;
let pendingSmallMultipleRender = false;
let lastSmallMultipleDrawWidth = 0;
let latestSmallMultipleRequestId = 0;

function getValueOfInterest(
  valueType,
  featureProperties,
  allowImputations,
  population,
) {
  if (!allowImputations && featureProperties.historical.imputed) {
    return null;
  }

  const historicalVals = featureProperties.historical.values;
  const projectedVals = featureProperties.projected.values;
  const vals = historicalVals.concat(projectedVals);

  if (valueType === "percentDifference") {
    return vals.map((current, i, arr) => {
      if (current == null || isNaN(current)) {
        return null;
      }

      if (
        i === 0 ||
        arr[i - 1] === 0 ||
        arr[i - 1] == null ||
        isNaN(arr[i - 1])
      ) {
        return null;
      }

      return ((current - arr[i - 1]) / Math.abs(arr[i - 1])) * 100;
    });
  }

  if (valueType === "rate") {
    return vals.map((value) => {
      if (value == null || !population) return null;
      return (value / population) * 1000;
    });
  }

  return vals;
}

function getFeatureDisplayInfo(featureProperties, spatialResolution) {
  if (spatialResolution === "state") {
    return { id: featureProperties.id, name: featureProperties.id };
  }

  if (spatialResolution === "region") {
    return { id: featureProperties.Region, name: featureProperties.Region };
  }

  if (spatialResolution === "county") {
    return {
      id: featureProperties.NAME,
      name: featureProperties.NAME,
      countyName: featureProperties.NAME,
    };
  }

  if (spatialResolution === "zcta") {
    return {
      id: featureProperties.ZCTA,
      name: featureProperties.ZCTA,
      zipName: featureProperties.ZCTA,
      countyName: featureProperties.county,
    };
  }

  if (spatialResolution === "facility") {
    return {
      id: featureProperties.display_name,
      name: featureProperties.display_name,
    };
  }

  return { id: featureProperties.NAME, name: featureProperties.NAME };
}

function normalizeFeatureId(id) {
  return String(id).replaceAll("-", " ").replaceAll(" ", "_");
}

function applyResolvedMapControlState() {
  const state = resolveRespiratoryControlState(
    metadata,
    getCurrentControlState({
      diseaseEl: mapDiseaseSelector,
      geographicUnitEl: mapGeographicUnitSelector,
      populationEl: mapPopulationSelector,
      outcomeEl: mapOutcomeVariableSelector,
    }),
  );

  mapGeographicUnitSelector.value = state.geographicUnit;
  mapPopulationSelector.value = state.population;
  mapOutcomeVariableSelector.value = state.outcomeVariable;

  return state;
}

async function getSpatialData() {
  applyResolvedMapControlState();

  const mapSpatialResolution = mapGeographicUnitSelector.value;
  const mapDiseaseSelected = mapDiseaseSelector.value;
  const mapDataSourceSelector = mapPopulationSelector.value;
  const mapOutcomeSelector = mapOutcomeVariableSelector.value;

  let regionData;

  try {
    regionData = await d3.json(
      `/data/respiratory/${mapSpatialResolution}/${mapDiseaseSelected}?data_version=${metadata.data_version}&${parseInt(
        Math.random() * 9999999999,
      )}`,
    );
  } catch (error) {
    return [];
  }

  if (!Array.isArray(regionData?.features)) {
    return [];
  }

  if (mapSpatialResolution === "facility") {
    const facilityUnitSelected = document.querySelector(
      'input[name="map-facilityOptionGroup"]:checked',
    )?.value;

    if (facilityUnitSelected === "individual-unit") {
      regionData.features = regionData.features.filter(
        (item) =>
          item.properties.id.toLowerCase() !== "musc" &&
          item.properties.id.toLowerCase() !== "prisma",
      );
    } else {
      regionData.features = regionData.features.filter(
        (item) =>
          item.properties.id.toLowerCase() ===
          facilityUnitSelected.toLowerCase(),
      );
    }
  }

  const valueTypeSwitch = document.getElementById("map-type-switch").value;
  const allowImputations = document.getElementById(
    "map-include-imputations",
  ).checked;

  return regionData.features.map((feature) => {
    const featureInfo = getFeatureDisplayInfo(
      feature.properties,
      mapSpatialResolution,
    );
    const returnValue = {
      stateName: null,
      countyName: null,
      zipName: null,
      ...featureInfo,
      data: null,
      dataObject: feature,
    };

    returnValue.id = normalizeFeatureId(returnValue.id);

    try {
      const featureData =
        feature.properties.data[mapDataSourceSelector][mapOutcomeSelector];
      returnValue.data = getValueOfInterest(
        valueTypeSwitch,
        featureData,
        allowImputations,
        feature.properties.population,
      );
      returnValue.dates = getCombinedWeeklyDates(featureData);
    } catch (error) {
      returnValue.data = [];
      returnValue.dates = [];
    }

    return returnValue;
  });
}

function getTimelineSliderWidth() {
  const slider = document.getElementById("time-animation-slider");
  const sliderWidth = slider?.getBoundingClientRect().width;

  return Number.isFinite(sliderWidth) && sliderWidth > 0 ? sliderWidth : null;
}

function getSmallMultipleYScaleMode() {
  return (
    document.querySelector('input[name="smallMultipleYScale"]:checked')
      ?.value || "normalized"
  );
}

function getSmallMultipleContainer() {
  return document.getElementById("respiratory-smallMultiples-container");
}

function getSmallMultipleContainerWidth() {
  const container = getSmallMultipleContainer();
  if (!container) return 0;

  const style = getComputedStyle(container);
  const horizontalPadding =
    (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);

  return Math.max(container.clientWidth - horizontalPadding, 0);
}

function redrawLatestSmallMultiples() {
  drawingSmallMultiples(latestSmallMultipleData);
}

function getYDomain(values) {
  const finiteValues = values.filter((value) => Number.isFinite(value));

  if (!finiteValues.length) return null;

  const domainMin = d3.min([0, d3.min(finiteValues)]);
  const domainMax = d3.max(finiteValues);

  if (domainMin === domainMax) {
    const padding = domainMax === 0 ? 1 : Math.abs(domainMax) * 0.1;
    return [domainMin - padding, domainMax + padding];
  }

  return [domainMin, domainMax];
}

function getSharedYDomain(dataBySpace) {
  return getYDomain(
    dataBySpace.flatMap((data) => (Array.isArray(data.data) ? data.data : [])),
  );
}

function getSliderDate() {
  const slider = document.getElementById("time-animation-slider");
  if (!slider) return null;

  const timelineStartDate = window.startShortHistory || window.firstDate;
  const timelineDates = buildWeeklyTimeline(timelineStartDate, window.lastDate);
  const sliderIndex = Math.min(
    Math.max(Number(slider.value) || 0, 0),
    timelineDates.length - 1,
  );

  return timelineDates[sliderIndex] || null;
}

function getCurrentDataIndex(
  dates,
  dataLength,
  targetDate = window.respiratoryAnimationDate || window.currentDate,
) {
  const timelineDates = Array.isArray(dates) ? dates : [];

  if (!timelineDates.length || !dataLength) return 0;

  return Math.min(
    getNearestDateIndex(timelineDates, targetDate),
    dataLength - 1,
  );
}

function getMonthChangeRate(processed, index) {
  const currentValue = processed[index]?.y;
  const previousValue = processed[index - MONTH_CHANGE_WEEKS]?.y;

  if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue)) {
    return null;
  }

  if (previousValue === 0) {
    return null;
  }

  return ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
}

function getMonthChangeColor(changeRate) {
  if (!Number.isFinite(changeRate)) return TREND_COLORS.neutral;
  if (changeRate > 0) return TREND_COLORS.increasing;
  if (changeRate < 0) return TREND_COLORS.decreasing;
  return TREND_COLORS.neutral;
}

function formatMonthChangeRate(changeRate) {
  if (!Number.isFinite(changeRate)) return "N/A";

  const absRate = Math.abs(changeRate);
  const decimals = absRate >= 100 ? 0 : 1;
  return `${changeRate > 0 ? "+" : ""}${changeRate.toFixed(decimals)}%`;
}

function formatCurrentValue(value) {
  if (!Number.isFinite(value)) return "N/A";

  const valueType = document.getElementById("map-type-switch")?.value;

  if (valueType === "percentDifference") {
    const decimals = Math.abs(value) >= 100 ? 0 : 1;
    return `${value > 0 ? "+" : ""}${value.toFixed(decimals)}%`;
  }

  if (valueType === "rate") {
    return value.toLocaleString(undefined, {
      maximumFractionDigits: Math.abs(value) >= 10 ? 1 : 2,
    });
  }

  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function buildIndicatorData(processed, dates, line, x, y) {
  const monthChangeRates = processed.map((_, index) =>
    getMonthChangeRate(processed, index),
  );

  return {
    dates,
    points: processed.map((d, index) => ({
      x: x(index),
      y: Number.isFinite(d.y) ? y(d.y) : null,
    })),
    monthChangeRates,
    monthChangeColors: monthChangeRates.map(getMonthChangeColor),
    monthChangeLabels: monthChangeRates.map(formatMonthChangeRate),
    currentValueLabels: processed.map((d) => formatCurrentValue(d.y)),
    tailPaths: processed.map((_, index) => {
      const tail = processed
        .slice(Math.max(0, index - MONTH_CHANGE_WEEKS), index + 1)
        .filter((d) => d.y !== null && !Number.isNaN(d.y));

      return tail.length >= 2 ? line(tail) : null;
    }),
  };
}

function updateSmallMultipleDateDots(
  targetDate = window.respiratoryAnimationDate || window.currentDate,
) {
  d3.selectAll(".small-multiple-current-date-dot").each(function (dotData) {
    if (!dotData?.points?.length) return;

    const currentDataIndex = getCurrentDataIndex(
      dotData.dates,
      dotData.points.length,
      targetDate,
    );

    const point = dotData.points[currentDataIndex];
    const color = dotData.monthChangeColors[currentDataIndex] || "gray";
    const changeLabel = dotData.monthChangeLabels[currentDataIndex] || "N/A";
    const currentValueLabel =
      dotData.currentValueLabels[currentDataIndex] || "N/A";

    d3.select(this)
      .attr("cx", point.x)
      .attr("cy", Number.isFinite(point.y) ? point.y : 0)
      .attr("fill", color)
      .attr("display", Number.isFinite(point.y) ? "initial" : "none");

    const parent = d3.select(this.parentNode);

    parent
      .select(".small-multiple-current-date-tail")
      .attr("d", dotData.tailPaths[currentDataIndex])
      .attr("stroke", color)
      .attr("display", dotData.tailPaths[currentDataIndex] ? "initial" : "none");

    parent
      .select(".small-multiple-month-change-value")
      .text(changeLabel)
      .attr("fill", color);

    parent.select(".small-multiple-current-value").text(currentValueLabel);
  });
}

window.updateRespiratorySmallMultipleDots = updateSmallMultipleDateDots;
document.addEventListener("respiratory-time-change", (event) => {
  updateSmallMultipleDateDots(event.detail?.date || window.currentDate);
});

const timeAnimationSlider = document.getElementById("time-animation-slider");
if (timeAnimationSlider) {
  const updateDotsFromSlider = () => {
    const sliderDate = getSliderDate();
    if (sliderDate) {
      updateSmallMultipleDateDots(sliderDate);
    }
  };

  timeAnimationSlider.addEventListener("input", updateDotsFromSlider);
  timeAnimationSlider.addEventListener("change", updateDotsFromSlider);
}

function drawingSmallMultipleUnit(svg, data, sharedYDomain = null) {
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
      if (!isSmallMultipleClicked) {
        selectedItems.feature = undefined;
      }

      showMapTooltip(data.dataObject);
      isSmallMultipleClicked = !isSmallMultipleClicked;
    });

  svg
    .append("text")
    .text(data.name)
    .attr("x", 12)
    .attr("y", 12)
    .attr("font-size", 10)
    .attr("fill", "black")
    .style("font-style", "italic");

  if (data.data.length === 0) {
    svg.style("background-color", "gray");
    return;
  }

  const processed = data.data.map((d, i) => ({ x: i, y: d }));
  const finiteValues = processed
    .map((d) => d.y)
    .filter((value) => Number.isFinite(value));

  if (!finiteValues.length) {
    svg.style("background-color", "gray");
    return;
  }

  const width = svg.node().clientWidth;
  const height = svg.node().clientHeight;
  const timelineSliderWidth = getTimelineSliderWidth();

  const chartWidth = timelineSliderWidth
    ? Math.min(timelineSliderWidth, width - SVG_MARGIN.left)
    : width - SVG_MARGIN.left - SVG_MARGIN.right;

  const x = d3
    .scaleLinear()
    .domain([0, processed.length - 1])
    .range([0, chartWidth]);

  const yDomain = sharedYDomain || getYDomain(finiteValues);

  const y = d3
    .scaleLinear()
    .domain(yDomain)
    .nice()
    .range([height, SVG_MARGIN.top]);

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

  const indicatorData = buildIndicatorData(processed, data.dates, line, x, y);
  const currentDataIndex = getCurrentDataIndex(
    data.dates,
    processed.length,
    window.respiratoryAnimationDate || window.currentDate,
  );
  const currentPoint = indicatorData.points[currentDataIndex];
  const currentColor =
    indicatorData.monthChangeColors[currentDataIndex] || "gray";
  const currentMonthChangeLabel =
    indicatorData.monthChangeLabels[currentDataIndex] || "N/A";
  const currentValueLabel =
    indicatorData.currentValueLabels[currentDataIndex] || "N/A";

  //   const processed_last10 = processed.slice(-7);

  svg
    .append("path")
    .datum(indicatorData)
    .attr("class", "small-multiple-current-date-tail")
    .attr("fill", "none")
    .attr("stroke", currentColor)
    .attr("stroke-width", 3)
    .attr("d", indicatorData.tailPaths[currentDataIndex])
    .attr(
      "display",
      indicatorData.tailPaths[currentDataIndex] ? "initial" : "none",
    );

  svg
    .append("circle")
    .datum(indicatorData)
    .attr("class", "small-multiple-current-date-dot")
    .attr("cx", currentPoint.x)
    .attr("cy", Number.isFinite(currentPoint.y) ? currentPoint.y : 0)
    .attr("r", 3)
    .attr("stroke", "black")
    .attr("fill", currentColor)
    .attr("display", Number.isFinite(currentPoint.y) ? "initial" : "none");

  const valueComponentX = chartWidth;
  const valueComponentWidth = Math.max(width - valueComponentX, 0);
  const valueComponent = svg
    .append("g")
    .attr("class", "small-multiple-month-change")
    .attr("transform", `translate(${valueComponentX}, 0)`)
    .attr("display", valueComponentWidth >= 28 ? "initial" : "none");

  valueComponent
    .append("text")
    .attr("class", "small-multiple-current-value")
    .attr("x", valueComponentWidth / 2)
    .attr("y", 15)
    .attr("text-anchor", "middle")
    .attr("font-size", "0.7rem")
    .attr("font-weight", "700")
    .attr("fill", "#222")
    .text(currentValueLabel);

  valueComponent
    .append("text")
    .attr("class", "small-multiple-month-change-value")
    .attr("x", valueComponentWidth / 2)
    .attr("y", 28)
    .attr("text-anchor", "middle")
    .attr("font-size", "0.6rem")
    .attr("font-weight", "700")
    .attr("fill", currentColor)
    .text(currentMonthChangeLabel);

  return svg;
}

function drawingSmallMultiples(dataBySpace) {
  const svgContainer = getSmallMultipleContainer();
  const unitWidth = getSmallMultipleContainerWidth();

  if (!svgContainer || unitWidth <= 0) {
    pendingSmallMultipleRender = true;
    return;
  }

  svgContainer.innerHTML = "";

  lastSmallMultipleDrawWidth = unitWidth;
  pendingSmallMultipleRender = false;
  const sharedYDomain =
    getSmallMultipleYScaleMode() === "shared"
      ? getSharedYDomain(dataBySpace)
      : null;

  for (const data of dataBySpace) {
    const svgUnitContainer = d3
      .select("#respiratory-smallMultiples-container")
      .append("div")
      .style("border-bottom", "2px solid lightgray")
      .style("height", unitHeight + "px")
      .style("width", unitWidth + "px")
      .style("margin-bottom", "0.2rem");

    const svg = svgUnitContainer
      .append("svg")
      .attr("height", unitHeight)
      .attr("width", unitWidth)
      .attr("overflow", "visible");

    drawingSmallMultipleUnit(svg, data, sharedYDomain);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", callInitSmallMultipleView);
} else {
  callInitSmallMultipleView();
}

async function initSmallMultipleView() {
  const requestId = ++latestSmallMultipleRequestId;
  const diseaseDataBySpace = await getSpatialData();
  if (requestId !== latestSmallMultipleRequestId) return;

  const filteredDataByName = returnFilteredDataByName(diseaseDataBySpace);
  const sortedData = returnSortedData(filteredDataByName);

  latestSmallMultipleData = sortedData;
  drawingSmallMultiples(sortedData);

  if (!resizeHandlerAttached) {
    window.addEventListener("resize", () => {
      redrawLatestSmallMultiples();
    });

    const svgContainer = getSmallMultipleContainer();
    if ("ResizeObserver" in window && svgContainer) {
      const observer = new ResizeObserver((entries) => {
        const width =
          entries[0]?.contentRect?.width || getSmallMultipleContainerWidth();

        if (
          width > 0 &&
          (pendingSmallMultipleRender ||
            Math.abs(width - lastSmallMultipleDrawWidth) > 1)
        ) {
          redrawLatestSmallMultiples();
        }
      });

      observer.observe(svgContainer);
    }

    document
      .getElementById("nav-bar")
      ?.addEventListener("sl-tab-show", (event) => {
        if (event.detail?.name === "map") {
          redrawLatestSmallMultiples();
        }
      });

    resizeHandlerAttached = true;
  }
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
      applyResolvedMapControlState();
      initSmallMultipleView();
    });
  });

  mapFacilityUnitSelector.addEventListener("change", (event) => {
    applyResolvedMapControlState();
    initSmallMultipleView();
  });

  document
    .getElementById("sortSelecter")
    .addEventListener("change", (event) => {
      initSmallMultipleView();
    });

  document.getElementById("filterInput").addEventListener("input", (event) => {
    initSmallMultipleView();
  });

  document
    .querySelectorAll('input[name="smallMultipleYScale"]')
    .forEach((el) => {
      el.addEventListener("change", () => {
        redrawLatestSmallMultiples();
      });
    });
}
