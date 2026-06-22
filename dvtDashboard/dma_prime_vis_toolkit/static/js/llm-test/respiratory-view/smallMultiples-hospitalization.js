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
  getFirstFiniteDateFromSeries,
  getLastFiniteDateFromSeries,
  getNearestDateIndex,
  getNearestTimelineIndexFromVisualRatio,
  getTimeFrameStartDate,
  getTimelineVisualPositionFromIndex,
  toValidDate,
} from "./utils/time_utils.js";
import { getTimelineLayoutMetrics } from "./utils/timelineLayout_utils.js";

const MONTH_CHANGE_WEEKS = 4;
const SVG_MARGIN = { top: 10, right: 20, bottom: 0, left: 0 };
const VALUE_COMPONENT_MIN_WIDTH = 28;
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
let mapHighlightedSmallMultipleId = null;

function ensureSmallMultipleHoverStyles() {
  if (document.getElementById("small-multiple-hover-styles")) return;

  const style = document.createElement("style");
  style.id = "small-multiple-hover-styles";
  style.textContent = `
    .small-multiple-unit-frame:hover {
      transform: scale(1.1) !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.16) !important;
      z-index: 10 !important;
    }

    .small-multiple-unit-frame:hover .small-multiple-title {
      font-weight: 700;
    }
  `;

  document.head.appendChild(style);
}

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
      `/recommendation/respiratory/${mapSpatialResolution}/${mapDiseaseSelected}?data_version=${metadata.data_version}&${parseInt(
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

function getDataItemVariableData(dataItem) {
  return dataItem?.dataObject?.properties?.data?.[mapPopulationSelector.value]?.[
    mapOutcomeVariableSelector.value
  ];
}

function getFirstFiniteDate(dataItem) {
  return getFirstFiniteDateFromSeries(dataItem?.dates, dataItem?.data);
}

function getLastFiniteDate(dataItem) {
  return getLastFiniteDateFromSeries(dataItem?.dates, dataItem?.data);
}

function getHistoricalEndDate(dataItem) {
  const variableData = getDataItemVariableData(dataItem);
  const historicalValues = variableData?.historical?.values;
  const historicalStart = getTimeFrameStartDate("historical", variableData);

  if (
    !historicalStart?.isValid?.() ||
    !Array.isArray(historicalValues) ||
    !historicalValues.length
  ) {
    return null;
  }

  return historicalStart.add(historicalValues.length - 1, "week").toDate();
}

function getTimelineBaseDataItem(dataBySpace) {
  return (Array.isArray(dataBySpace) ? dataBySpace : [])
    .filter((dataItem) => dataItem?.dates?.length && dataItem?.data?.length)
    .sort((a, b) => b.dates.length - a.dates.length)[0];
}

function getDataDrivenTimelineDates(dataBySpace) {
  const validData = (Array.isArray(dataBySpace) ? dataBySpace : []).filter(
    (dataItem) => getFirstFiniteDate(dataItem) && getLastFiniteDate(dataItem),
  );
  const baseDataItem = getTimelineBaseDataItem(validData);

  if (!baseDataItem) return [];

  const firstDates = validData.map(getFirstFiniteDate).filter(Boolean);
  const lastDates = validData.map(getLastFiniteDate).filter(Boolean);
  const dataStart = firstDates.length
    ? new Date(Math.max(...firstDates.map(Number)))
    : null;
  const requestedStart = toValidDate(
    window.startShortHistory || window.firstDate,
  );
  const timelineStart = new Date(
    Math.max(
      ...(requestedStart ? [requestedStart] : []).concat(dataStart || []),
    ),
  );
  const timelineEnd = lastDates.length
    ? new Date(Math.min(...lastDates.map(Number)))
    : null;

  if (!timelineStart || !timelineEnd || timelineStart > timelineEnd) {
    return [];
  }

  return baseDataItem.dates
    .map(toValidDate)
    .filter((date) => date && date >= timelineStart && date <= timelineEnd);
}

function getDataDrivenTimelineSplitDate(dataBySpace) {
  const splitDates = (Array.isArray(dataBySpace) ? dataBySpace : [])
    .map(getHistoricalEndDate)
    .filter(Boolean);

  if (!splitDates.length) return window.currentDate;

  return new Date(Math.min(...splitDates.map(Number)));
}

function getDefaultTimelineResetDate(dates) {
  if (!Array.isArray(dates) || !dates.length) return null;

  return dates[Math.max(0, dates.length - 4)];
}

function syncRespiratoryTimelineWithSmallMultiples(
  dataBySpace,
  { resetToCurrentDate = true } = {},
) {
  const dates = getDataDrivenTimelineDates(dataBySpace);

  if (!dates.length) return;

  const splitDate = getDataDrivenTimelineSplitDate(dataBySpace);
  const timelineConfig = {
    dates,
    splitDate,
    preferredDate: resetToCurrentDate
      ? getDefaultTimelineResetDate(dates)
      : window.respiratoryAnimationDate || splitDate,
  };

  window.respiratoryTimelineConfig = timelineConfig;
  window.respiratoryTimelineDates = dates;
  window.respiratoryTimelineCurrentDate = splitDate;

  if (window.updateRespiratoryTimelineDates?.(timelineConfig)) return;

  window.respiratoryAnimationDate =
    dates[getNearestDateIndex(dates, timelineConfig.preferredDate)];
}

function redrawLatestSmallMultiples() {
  drawingSmallMultiples(latestSmallMultipleData);
}

function getSmallMultipleChartLayout(width) {
  const { leftOffset, valueGap, valueWidth } = getTimelineLayoutMetrics();
  const timelineSliderWidth = getTimelineSliderWidth();
  const maxChartWidth = Math.max(
    width - leftOffset - valueGap - valueWidth,
    0,
  );
  const chartWidth = timelineSliderWidth
    ? Math.min(timelineSliderWidth, maxChartWidth)
    : maxChartWidth;
  const chartX = Math.min(
    leftOffset,
    Math.max(width - chartWidth - valueGap - valueWidth, 0),
  );
  const valueComponentX = chartX + chartWidth + valueGap;
  const valueComponentWidth = Math.max(width - valueComponentX, 0);

  return { chartWidth, chartX, valueComponentWidth, valueComponentX };
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

  const timelineDates = window.respiratoryTimelineDates?.length
    ? window.respiratoryTimelineDates
    : buildWeeklyTimeline(
        window.startShortHistory || window.firstDate,
        window.lastDate,
      );

  const sliderIndex = getNearestTimelineIndexFromVisualRatio(
    timelineDates,
    (Number(slider.value) || 0) / (Number(slider.max) || 1),
    window.respiratoryTimelineCurrentDate || window.currentDate,
  );

  return timelineDates[sliderIndex] || null;
}

function getCurrentDataIndex(
  dates,
  dataLength,
  targetDate =
    window.respiratoryAnimationDate ||
    window.respiratoryTimelineCurrentDate ||
    window.currentDate,
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
  targetDate =
    window.respiratoryAnimationDate ||
    window.respiratoryTimelineCurrentDate ||
    window.currentDate,
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
  updateSmallMultipleDateDots(
    event.detail?.date ||
      window.respiratoryTimelineCurrentDate ||
      window.currentDate,
  );
});

function setSmallMultipleHoverVisual(svgElement, isHovered) {
  const frame = d3.select(svgElement.parentNode);

  frame
    .style("transform", isHovered ? "scale(1.1)" : "scale(1)")
    .style(
      "box-shadow",
      isHovered ? "0 2px 8px rgba(0, 0, 0, 0.16)" : "none",
    )
    .style("z-index", isHovered ? "10" : "1");

  d3.select(svgElement)
    .select(".small-multiple-title")
    .attr("font-weight", isHovered ? 700 : 400);
}

function getSmallMultipleIdCandidates(feature) {
  const properties = feature?.properties || {};
  const candidates = [
    properties.id,
    properties.Region,
    properties.NAME,
    properties.ZCTA,
    properties.display_name,
  ];

  return [...new Set(candidates.filter(Boolean).map(normalizeFeatureId))];
}

function getSmallMultipleSvgForFeature(feature) {
  for (const id of getSmallMultipleIdCandidates(feature)) {
    const svg = document.getElementById(`small-multiple-${id}`);

    if (svg) return svg;
  }

  return null;
}

function clearMapHighlightedSmallMultiple() {
  if (!mapHighlightedSmallMultipleId) return;

  const svg = document.getElementById(mapHighlightedSmallMultipleId);

  if (svg) {
    setSmallMultipleHoverVisual(svg, false);
  }

  mapHighlightedSmallMultipleId = null;
}

window.highlightRespiratorySmallMultipleForFeature = (feature) => {
  const svg = getSmallMultipleSvgForFeature(feature);

  if (!svg) {
    clearMapHighlightedSmallMultiple();
    return;
  }

  if (mapHighlightedSmallMultipleId === svg.id) return;

  clearMapHighlightedSmallMultiple();
  setSmallMultipleHoverVisual(svg, true);
  mapHighlightedSmallMultipleId = svg.id;
};

window.clearRespiratorySmallMultipleMapHover = clearMapHighlightedSmallMultiple;

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
    .style("pointer-events", "auto");

  const svgNode = svg.node();

  d3.select(svgNode.parentNode)
    .on("mouseover", function (event) {
      if (this.contains(event.relatedTarget)) return;

      setSmallMultipleHoverVisual(svgNode, true);

      if (isSmallMultipleClicked) return;
      selectedItems.feature = data.dataObject;
      dataVersion++;
      redraw();
    })
    .on("mouseout", function (event) {
      if (this.contains(event.relatedTarget)) return;

      setSmallMultipleHoverVisual(svgNode, false);

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
    .attr("class", "small-multiple-title")
    .text(data.name)
    .attr("x", 12)
    .attr("y", 12)
    .attr("font-size", 10)
    .attr("font-weight", 400)
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
  const { chartWidth, chartX, valueComponentWidth, valueComponentX } =
    getSmallMultipleChartLayout(width);

  const x = d3
    .scaleLinear()
    .domain([0, processed.length - 1])
    .range([chartX, chartX + chartWidth]);
  const xPosition = (index) => {
    if (!data.dates?.length || data.dates.length !== processed.length) {
      return x(index);
    }

    return getTimelineVisualPositionFromIndex(
      data.dates,
      index,
      window.respiratoryTimelineCurrentDate || window.currentDate,
      chartWidth,
    ) + chartX;
  };

  const yDomain = sharedYDomain || getYDomain(finiteValues);

  const y = d3
    .scaleLinear()
    .domain(yDomain)
    .nice()
    .range([height, SVG_MARGIN.top]);

  const line = d3
    .line()
    .defined((d) => d.y !== null && !isNaN(d.y))
    .x((d) => xPosition(d.x))
    .y((d) => y(d.y));

  svg
    .append("path")
    .datum(processed)
    .attr("fill", "none")
    .attr("stroke", "#1f77b4")
    .attr("stroke-width", 1)
    .attr("d", line);

  const indicatorData = buildIndicatorData(
    processed,
    data.dates,
    line,
    xPosition,
    y,
  );
  const currentDataIndex = getCurrentDataIndex(
    data.dates,
    processed.length,
    window.respiratoryAnimationDate ||
      window.respiratoryTimelineCurrentDate ||
      window.currentDate,
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

  const valueComponent = svg
    .append("g")
    .attr("class", "small-multiple-month-change")
    .attr("transform", `translate(${valueComponentX}, 0)`)
    .attr(
      "display",
      valueComponentWidth >= VALUE_COMPONENT_MIN_WIDTH ? "initial" : "none",
    );

  valueComponent
    .append("text")
    .attr("class", "small-multiple-current-value")
    .attr("x", valueComponentWidth / 2)
    .attr("y", 15)
    .attr("text-anchor", "middle")
    .attr("font-size", "0.76rem")
    .attr("font-weight", "700")
    .attr("fill", "#222")
    .text(currentValueLabel);

  valueComponent
    .append("text")
    .attr("class", "small-multiple-month-change-value")
    .attr("x", valueComponentWidth / 2)
    .attr("y", 28)
    .attr("text-anchor", "middle")
    .attr("font-size", "0.56rem")
    .attr("font-weight", "700")
    .attr("fill", currentColor)
    .text(currentMonthChangeLabel);

  return svg;
}

function drawingSmallMultiples(dataBySpace) {
  const svgContainer = getSmallMultipleContainer();
  const unitWidth = getSmallMultipleContainerWidth();

  ensureSmallMultipleHoverStyles();

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
      .attr("class", "small-multiple-unit-frame")
      .style("border-bottom", "2px solid lightgray")
      .style("height", unitHeight + "px")
      .style("width", unitWidth + "px")
      .style("margin-bottom", "0.2rem")
      .style("position", "relative")
      .style("z-index", "1")
      .style("background", "white")
      .style("transform", "scale(1)")
      .style("transform-origin", "center center")
      .style("transition", "transform 160ms ease, box-shadow 160ms ease")
      .style("will-change", "transform")
      .style("pointer-events", "auto");

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

async function initSmallMultipleView({ resetToCurrentDate = true } = {}) {
  const requestId = ++latestSmallMultipleRequestId;
  const diseaseDataBySpace = await getSpatialData();
  if (requestId !== latestSmallMultipleRequestId) return;

  syncRespiratoryTimelineWithSmallMultiples(diseaseDataBySpace, {
    resetToCurrentDate,
  });

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
      initSmallMultipleView({ resetToCurrentDate: false });
    });

  document.getElementById("filterInput").addEventListener("input", (event) => {
    initSmallMultipleView({ resetToCurrentDate: false });
  });

  document
    .querySelectorAll('input[name="smallMultipleYScale"]')
    .forEach((el) => {
      el.addEventListener("change", () => {
        redrawLatestSmallMultiples();
      });
    });
}
