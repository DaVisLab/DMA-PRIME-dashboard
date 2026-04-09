import {
  getCenter,
  drawStateHospitalizations,
} from "/static/js/respiratory/script.js";

import { getCurDateValueFromFeature } from "/static/js/respiratory/utils/dataProcessing_utils.js";

import {
  unknownColor,
  populationColorMap,
} from "/static/js/respiratory/utils/colors.js";

import {
  drawTooltip,
  showSimpleGeoTooltip,
} from "/static/js/respiratory/tooltip.js";

import {
  facility_dataProcessing,
  call_data,
} from "/static/js/respiratory/utils/dataProcessing_utils.js";

import { getDateWithOffset } from "/static/js/helper.js";

const { GeoJsonLayer, IconLayer, TextLayer, MapboxOverlay } = deck;

export {
  map,
  popup,
  selectedItems,
  deckOverlay,
  redraw,
  updateMapTitle,
  updateMapTooltip,
  updateMapOutcomeVariableOptions,
  updateMapPopulationOptions,
  updateMapGeographicUnitOptions,
};

const MAP_CENTER = [-81, 33.65];
const MAP_ZOOM = 7;
const FACILITY_ICON_MAPPING = {
  marker: { x: 0, y: 0, width: 1128, height: 992, mask: true },
};
const LEGEND_MARGINS = {
  top: 12,
  bottom: 16,
  left: 8,
  right: 8,
};

const icons = {
  data: await d3.csv("/data/health-care-facility"),
  iconAtlas: "/static/assets/Icons/icon-pack.png",
  iconMapping: await d3.json("/static/assets/Icons/icon-pack.json"),
};

const selectedItems = {
  feature: undefined,
  icons: [],
};

let choroplethColorMap = d3
  .scaleLinear()
  .domain([0, 1])
  .range(["white", populationColorMap.general_population])
  .unknown(unknownColor)
  .nice();

const map = new maplibregl.Map({
  container: "map-div",
  style:
    "https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json",
  center: MAP_CENTER,
  zoom: MAP_ZOOM,
});

await Promise.allSettled([
  customElements.whenDefined("sl-select"),
  customElements.whenDefined("sl-option"),
  customElements.whenDefined("sl-button"),
  customElements.whenDefined("sl-resize-observer"),
  customElements.whenDefined("sl-tooltip"),
  customElements.whenDefined("sl-radio-group"),
  customElements.whenDefined("sl-radio-button"),
]);

await new Promise((resolve) => {
  map.once("load", resolve);
});

const popup = new maplibregl.Popup({
  focusAfterOpen: false,
  closeOnClick: false,
});

const deckOverlay = new MapboxOverlay({
  interleaved: true,
  getCursor: ({ isHovering, isDragging }) => {
    if (isHovering) return "pointer";
    if (isDragging) return "grabbing";
    return "grab";
  },
});

let regionData;
let mapGeographicUnit = mapGeographicUnitSelector.value;
let mapPopulation = mapPopulationSelector.value;
let mapOutcomeVariable = mapOutcomeVariableSelector.value;

const getFontFamily = () =>
  getComputedStyle(document.head)
    .getPropertyValue("--sl-font-sans")
    .replace(/\s/g, "")
    .split(",");

const getSelectedOptionHtml = (selectEl, value) =>
  d3.select(selectEl).select(`*[value="${value}"]`).html();

const setLoadingVisible = (visible) => {
  d3.select("#map-loading-div").style(
    "visibility",
    visible ? "visible" : "hidden",
  );
  d3.selectAll("#map-loading-div circle").classed("animate", visible);
};

const isGeographicChoroplethUnit = (unit) =>
  ["state", "region", "county", "zcta"].includes(unit);

const getSelectedFeatureId = () => selectedItems.feature?.properties?.id;

const getChoroplethLayer = (regionData) =>
  new GeoJsonLayer({
    id: "respiratory_choropleth",
    depthTest: false,
    pickable: true,
    data: regionData,
    stroked: true,
    filled: true,
    pointType: "circle+text",
    getFillColor: (d) => getColor(d),
    lineWidthMinPixels: 0.75,
    getLineWidth: 20,
    // getLineColor: [64, 64, 64],
    getLineColor: [255, 255, 255],
    updateTriggers: {
      data: [mapGeographicUnitSelector.value, dataVersion],
      getFillColor: [
        mapGeographicUnitSelector.value,
        mapOutcomeVariableSelector.value,
        dataVersion,
      ],
    },
    onHover: (info) => {
      showSimpleGeoTooltip(info);
    },
  });

const getFacilityBackgroundLayer = (regionData) =>
  new GeoJsonLayer({
    id: "respiratory_facility_background",
    depthTest: false,
    pickable: false,
    data: regionData,
    pointType: "icon",
    iconAtlas: "/static/assets/Icons/health-facility-icon.png",
    iconMapping: FACILITY_ICON_MAPPING,
    getIconSize: 95,
    getIcon: () => "marker",
    getIconColor: () => [0, 0, 0, 255],
    iconSizeMinPixels: 20,
    updateTriggers: {
      data: [mapGeographicUnitSelector.value, dataVersion],
    },
  });

const getFacilityLayer = (regionData) =>
  new GeoJsonLayer({
    id: "respiratory_facility",
    depthTest: false,
    pickable: true,
    data: regionData,
    pointType: "icon",
    iconAtlas: "/static/assets/Icons/health-facility-icon.png",
    iconMapping: FACILITY_ICON_MAPPING,
    getIconSize: 80,
    getIcon: () => "marker",
    getIconColor: (d) => getColor(d),
    iconSizeMinPixels: 10,
    updateTriggers: {
      data: [mapGeographicUnitSelector.value, dataVersion],
      getIconColor: [
        mapGeographicUnitSelector.value,
        mapOutcomeVariableSelector.value,
        dataVersion,
      ],
    },
  });

const getFacilityIconOverlayLayer = () =>
  new IconLayer({
    id: "hospital-and-cdap",
    data: icons.data,
    iconAtlas: icons.iconAtlas,
    iconMapping: icons.iconMapping,
    getPosition: (d) => [+d.longitude, +d.latitude],
    getIcon: (d) => (selectedItems.icons.includes(d.type) ? d.type : null),
    getSize: 15,
    pickable: true,
    parameters: {
      depthTest: false,
    },
    updateTriggers: {
      getIcon: [
        hospitalIconsToggle.checked,
        mobileClinicIconsToggle.checked,
        communityPartnerIconsToggle.checked,
      ],
    },
  });

d3.selectAll(".map-option").attr("disabled", null);

d3.select(popup.getElement()).style("color", "var(--sl-color-neutral-0)");

map.addControl(deckOverlay);
map.addControl(new maplibregl.NavigationControl());
map.setMaxPitch(0);

regionData = await call_data(
  mapGeographicUnitSelector.value,
  mapDiseaseSelector.value,
  metadata.data_version,
);

window.onload = async () => {
  await redraw(true, false, true);
};

// setTimeout(() => {
//   // Force a resize after initial load to ensure proper rendering
//   redraw(false, false, false);
// }, 5000);

requestAnimationFrame(() => {
  map.resize();
  redraw(true, true);
});

drawStateHospitalizations(
  mapDiseaseSelector.value,
  mapTypeSwitch.value,
  mapStateHospitalizationsSvg,
  mapStateHospitalizationsSubtitle,
);

async function redraw(
  resetWarnings = false,
  fetchData = false,
  center = false,
) {
  updateMapTitle();

  if (fetchData) {
    setLoadingVisible(true);

    regionData = await call_data(
      mapGeographicUnitSelector.value,
      mapDiseaseSelector.value,
      metadata.data_version,
    );

    if (mapGeographicUnitSelector.value === "facility") {
      const facilityUnitSelected = document.querySelector(
        'input[name="map-facilityOptionGroup"]:checked',
      )?.value;

      regionData.features = facility_dataProcessing(
        regionData.features,
        facilityUnitSelected,
      );
    }
  }

  if (resetWarnings) {
    updateMapWarnings();
  }

  updateChoropleth(
    regionData,
    mapTypeSwitch.value,
    mapPopulationSelector.value,
    mapOutcomeVariableSelector.value,
    mapIncludeImputations.checked,
  );

  drawLegend();

  const layers = [];

  if (isGeographicChoroplethUnit(mapGeographicUnitSelector.value)) {
    layers.push(getChoroplethLayer(regionData));
  } else if (
    mapGeographicUnitSelector.value === "facility" &&
    document.querySelector('input[name="map-facilityOptionGroup"]:checked')
      ?.value !== "individual-unit"
  ) {
    layers.push(getChoroplethLayer(regionData));
  } else {
    layers.push(
      new GeoJsonLayer({
        id: "county_outline",
        pickable: false,
        data: d3.json("/data/map/county"),
        stroked: true,
        filled: false,
        lineWidthMinPixels: 1,
        getLineWidth: 10,
        // getLineColor: [128, 128, 128],
        getLineColor: [128, 128, 128],
      }),
      new GeoJsonLayer({
        id: "state_outline",
        pickable: false,
        data: d3.json("/data/map/state"),
        stroked: true,
        filled: false,
        lineWidthMinPixels: 1,
        getLineWidth: 20,
        getLineColor: [64, 64, 64],
      }),
      getFacilityBackgroundLayer(regionData),
      getFacilityLayer(regionData),
      new TextLayer({
        id: "text_labels",
        data: regionData.features,
        getPosition: (d) => {
          const coords = getCenter(d);
          return [coords[0], coords[1]];
        },
        getText: (d) => d.properties.display_name,
        getPixelOffset: () => [0, 35],
        maxWidth: 10,
        getAlignmentBaseline: "center",
        getTextAnchor: "middle",
        getColor: [0, 0, 0],
        background: true,
        getBackgroundColor: [255, 255, 255, 0],
        backgroundBorderRadius: 10,
        backgroundPadding: [2, 2],
        getSize: (d) => getTextSize(d),
        fontFamily: getFontFamily(),
        collisionGroup: "text_labels",
        collisionTestProps: { sizeScale: 2.5 },
        updateTriggers: {
          data: [dataVersion],
          getSize: [dataVersion],
        },
      }),
    );
  }

  if (selectedItems.icons.length) {
    layers.push(getFacilityIconOverlayLayer());
  }

  if (mapOptionsGeographicLabelsToggle.checked) {
    if (mapGeographicUnitSelector.value === "facility") {
      layers.push(
        new TextLayer({
          id: "labels",
          data: regionData.features,
          getPosition: (d) => getCenter(d),
          getText: (d) => d.properties.display_name,
          maxWidth: 10,
          getAlignmentBaseline: "center",
          getTextAnchor: "middle",
          getColor: [0, 0, 0],
          background: true,
          getBackgroundColor: [255, 255, 255, 128],
          backgroundBorderRadius: 10,
          backgroundPadding: [2, 2],
          getSize: 12,
          fontFamily: getFontFamily(),
          collisionGroup: "labels",
          collisionTestProps: { sizeScale: 2.5 },
          updateTriggers: {
            getSize: [map.getZoom()],
          },
        }),
      );
    } else if (mapGeographicUnitSelector.value !== "state") {
      layers.push(
        new TextLayer({
          id: "labels",
          data: regionData.features,
          getPosition: (d) => getCenter(d),
          getText: (d) => d.properties.id.toString(),
          getAlignmentBaseline: "center",
          getTextAnchor: "middle",
          getColor: [0, 0, 0],
          background: true,
          getBackgroundColor: [255, 255, 255, 32],
          backgroundBorderRadius: 2,
          backgroundPadding: [4, 4],
          getSize:
            mapGeographicUnitSelector.value === "zcta"
              ? Math.min(Math.max(8, map.getZoom() * 1.5), 16)
              : 16,
          fontFamily: getFontFamily(),
          collisionGroup: "labels",
          collisionTestProps: { sizeScale: 2.5 },
          updateTriggers: {
            getSize: [map.getZoom()],
          },
        }),
      );
    }
  }

  deckOverlay.setProps({ layers });

  setLoadingVisible(false);

  if (center) {
    map.flyTo({
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      essential: true,
    });
  }
}

function getTextSize(feature) {
  const selectedId = selectedItems.feature?.properties?.id;
  if (
    selectedId &&
    selectedId.toUpperCase().replace("_", " ") === feature.properties.id
  ) {
    return 12;
  }

  return 0;
}

function getColor(feature) {
  const selectedId = getSelectedFeatureId();

  if (!selectedId || selectedId === feature.properties.id) {
    const population = mapPopulationSelector.value;
    const outcomeVariable = mapOutcomeVariableSelector.value;
    const imputations = mapIncludeImputations.checked;

    const value = getCurDateValueFromFeature(
      feature,
      population,
      outcomeVariable,
      mapTypeSwitch.value,
      imputations,
    );

    // console.log(value)
    const color =
      mapTypeSwitch.value === "percentDifference"
        ? !isNaN(value.at(-1))
          ? d3.rgb(choroplethColorMap(value.at(-1)))
          : d3.rgb("white")
        : d3.rgb(choroplethColorMap(value));

    return [color.r, color.g, color.b];
  }

  return [82, 82, 91];
}

function updateChoropleth(
  data,
  mapType,
  population,
  outcomeVariable,
  imputations = true,
) {
  if (mapType === "percentDifference") {
    choroplethColorMap = d3
      .scaleLinear()
      .domain([-100, -50, 0, 50, 100, 500])
      .range([
        d3.interpolateRdBu(1 - 0),
        d3.interpolateRdBu(1 - 0.25),
        d3.interpolateRdBu(1 - 0.5),
        d3.interpolateRdBu(1 - 0.7),
        d3.interpolateRdBu(1 - 0.82),
        d3.interpolateRdBu(1 - 1),
      ])
      .clamp(true)
      .unknown(unknownColor);
    return;
  }

  const values = [];

  for (const feature of data.features) {
    const { data } = feature.properties;
    const variableData = data[population][outcomeVariable];

    let historicalValues = variableData.historical.values.slice(-52);
    let projectedValues = variableData.projected.values.slice(-52);

    if (mapType === "rate") {
      historicalValues = historicalValues.map(
        (value) => (value / feature.properties.population) * 1000,
      );

      projectedValues = projectedValues.map(
        (value) => (value / feature.properties.population) * 1000,
      );
    }

    values.push(...historicalValues, ...projectedValues);
  }

  if (outcomeVariable === "rate_of_transmission") {
    const mix = d3.interpolateRgb(
      populationColorMap[population].historical,
      "red",
    );

    choroplethColorMap = d3
      .scaleLinear()
      .domain([0, 0.5, 1, Math.max(d3.max(values) || 0, 2)])
      .range([0, 1]) // normalize to [0,1]
      .interpolate(() => (t) => d3.interpolateRdBu(1 - t)) // reversed
      .unknown(unknownColor)
      .nice();

    return;
  }

  choroplethColorMap = d3
    // .scaleQuantize()
    .scaleLinear()
    .domain([0, d3.max(values) || 1])
    .range([0, 1]) // normalize to [0,1]
    .interpolate(() => (t) => d3.interpolateRdBu(1 - t)) // reversed
    .unknown(unknownColor)
    .nice();
}

function drawLegend() {
  choroplethLegendSVG.innerHTML = "";

  d3.select(mapShapeLegend).attr(
    "display",
    mapGeographicUnitSelector.value === "facility" ? "initial" : "none",
  );

  if (mapTypeSwitch.value === "percentDifference") {
    const legendLength = 350;
    const legend = d3.select(choroplethLegendSVG).attr("overflow", "visible");

    legend.attr("width", legendLength).attr("height", 140);

    legend
      .append("text")
      .attr("x", legendLength / 2)
      .attr("y", 100 - em / 2)
      .attr("text-anchor", "middle")
      .style("font-size", "var(--sl-font-size-x-small)")
      .text(
        `Percent Change of ${getSelectedOptionHtml(
          mapDiseaseSelector,
          mapDiseaseSelector.value,
        )} from Last Week`,
      );

    const legendDomain = [-100, 500];
    const tickValues = [-100, -50, 0, 50, 100, 500];

    const percentScale = d3
      .scaleLinear()
      .domain(legendDomain)
      .range([0, legendLength]);

    const defs = legend.append("defs");
    const linearGradient = defs
      .append("linearGradient")
      .attr("id", "percent-diff-linear-gradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "0%");

    const sampleCount = 300;
    const [minVal, maxVal] = legendDomain;

    for (let i = 0; i <= sampleCount; i++) {
      const ratio = i / sampleCount;
      const value = minVal + ratio * (maxVal - minVal);

      linearGradient
        .append("stop")
        .attr("offset", `${ratio * 100}%`)
        .attr("stop-color", choroplethColorMap(value));
    }

    legend
      .append("rect")
      .attr("x", 0)
      .attr("y", 100)
      .attr("width", legendLength)
      .attr("height", 15)
      .attr("fill", "url(#percent-diff-linear-gradient)");

    const axis = legend
      .append("g")
      .attr("transform", "translate(0, 115)")
      .call(
        d3
          .axisBottom(percentScale)
          .tickValues(tickValues)
          .tickFormat((d) => `${d}%`),
      );

    axis.selectAll("text").attr("text-anchor", "middle");

    const otherColors = legend
      .append("g")
      .attr("transform", "translate(0, 80)");
    const others = [[unknownColor, "Unknown"]];

    others.forEach((d, i) => {
      const group = otherColors
        .append("g")
        .attr("transform", `translate(0, ${-(i + 1) * 20})`);

      group
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("height", 15)
        .attr("width", 15)
        .attr("fill", d[0])
        .attr("stroke", "black")
        .attr("stroke-width", 1);

      group
        .append("text")
        .attr("class", "legend-other-colors")
        .attr("x", 20)
        .attr("y", 7.5)
        .attr("dominant-baseline", "middle")
        .text(d[1]);
    });

    return;
  }

  const legendWidth = Math.max(mapDiv.clientWidth / 3, 340);
  const colorLegend = d3
    .select(choroplethLegendSVG)
    .attr("transform", null)
    .attr("width", legendWidth + LEGEND_MARGINS.left + LEGEND_MARGINS.right)
    .attr("height", 3 * em + LEGEND_MARGINS.top + LEGEND_MARGINS.bottom);

  const defs = colorLegend.append("defs");
  const linearGradient = defs
    .append("linearGradient")
    .attr("id", "linear-gradient")
    .attr("x1", "0%")
    .attr("y1", "0%")
    .attr("x2", "100%")
    .attr("y2", "0%");

  const domain = choroplethColorMap.domain();
  const minVal = d3.min(domain);
  const maxVal = d3.max(domain);

  d3.range(0, 1.0001, 0.02).forEach((t) => {
    const value = minVal + (maxVal - minVal) * t;
    linearGradient
      .append("stop")
      .attr("offset", `${t * 100}%`)
      .attr("stop-color", choroplethColorMap(value));
  });

  colorLegend
    .append("rect")
    .attr("class", "map-legend-background")
    .attr("width", legendWidth + LEGEND_MARGINS.left + LEGEND_MARGINS.right)
    .attr("height", 3 * em + LEGEND_MARGINS.top + LEGEND_MARGINS.bottom);

  const colorLegendContent = colorLegend
    .append("g")
    .attr("id", "map-color-legend-contents");

  colorLegendContent
    .append("rect")
    .style("fill", "url(#linear-gradient)")
    .attr("width", legendWidth)
    .attr("height", em)
    .attr("x", LEGEND_MARGINS.left)
    .attr("y", LEGEND_MARGINS.top);

  const xScale = d3
    .scaleLinear()
    .domain([minVal, maxVal])
    .range([0, legendWidth])
    .nice();

  const tickValues = d3.ticks(minVal, maxVal, 5);

  if (!tickValues.includes(maxVal)) {
    tickValues.push(maxVal);
  }

  if (!tickValues.includes(minVal)) {
    tickValues.unshift(minVal);
  }

  colorLegendContent
    .append("g")
    .attr("id", "map-color-legend-axis")
    .attr(
      "transform",
      `translate(${LEGEND_MARGINS.left} ${em + LEGEND_MARGINS.top})`,
    )
    .call(
      d3
        .axisBottom(xScale)
        .tickValues(tickValues)
        .tickFormat(d3.format(",.3~f")),
    );

  const dataVarString = getSelectedOptionHtml(
    mapOutcomeVariableSelector,
    mapOutcomeVariableSelector.value,
  );

  colorLegendContent
    .append("text")
    .attr("id", "map-legend-title")
    .attr("class", "map-legend title")
    .attr("x", legendWidth / 2 + LEGEND_MARGINS.left)
    .attr("y", 3 * em + LEGEND_MARGINS.top)
    .text(
      `Current Week's ${dataVarString} by ${metadata.region_sizes[mapGeographicUnitSelector.value]}`,
    );
}

function updateMapTitle() {
  const titleStart = `${getSelectedOptionHtml(mapTypeSwitch, mapTypeSwitch.value)} of ${getSelectedOptionHtml(
    mapDiseaseSelector,
    mapDiseaseSelector.value,
  )} ${getSelectedOptionHtml(mapOutcomeVariableSelector, mapOutcomeVariableSelector.value)} `;

  let titleEnd = "in South Carolina ";
  if (mapGeographicUnitSelector.value !== "state") {
    titleEnd += `by ${getSelectedOptionHtml(mapGeographicUnitSelector, mapGeographicUnitSelector.value)}`;
  }

  let newTitle;
  switch (mapTypeSwitch.value) {
    case "count":
      newTitle = titleStart + titleEnd;
      break;
    case "rate":
      newTitle = titleStart + "(per 1000 people) " + titleEnd;
      break;
    case "percentDifference":
      newTitle = titleStart + "from Last Week " + titleEnd;
      break;
    default:
      newTitle = titleStart + titleEnd;
      break;
  }

  let numOfProjections = 0;
  let projectionStartDate;

  console.log(regionData);
  console.log(metadata);

  const observation = `${mapDiseaseSelector.value}-${mapGeographicUnitSelector.value}-${mapPopulationSelector.value}-${mapOutcomeVariableSelector.value}`;
  const observationCreatedDate = metadata["observation_created_date"][observation];

  // for (const feature of regionData.features) {
  //   const thisData =
  //     feature.properties.data[mapPopulationSelector.value][
  //       mapOutcomeVariableSelector.value
  //     ];

  //   const hasProjection = thisData.projected.values.length;

  //   if (hasProjection) {
  //     projectionStartDate = thisData.projected.start_date;
  //     numOfProjections= Math.max(numOfProjections, thisData.projected.values.length);
  //   }
  // }

  // const lastProjectionData=getDateWithOffset(projectionStartDate, numOfProjections-1)

  if(observationCreatedDate)
    newTitle += `<br /> (Last Update: ${observationCreatedDate})`;
  mapTitle.innerHTML = newTitle;
}

function updateMapTooltip(featureProperties) {
  const ttpDiv = d3.select("#map-tooltip-div");
  const width = mapDiv.clientWidth;
  const mapTooltipWidth = Math.max(500, width * 0.3);
  const mapTooltipHeight = mapTooltipWidth * 0.65;

  const ttpSVG = ttpDiv
    .select(".tooltip-outer-svg")
    .attr("width", mapTooltipWidth)
    .attr("height", mapTooltipHeight);

  drawTooltip(
    featureProperties,
    ttpSVG,
    ttpDiv.select(".tooltip-header"),
    ttpDiv.select(".tooltip-footer"),
    mapPopulationSelector.value,
    mapOutcomeVariableSelector.value,
    mapTypeSwitch.value,
    false,
    false,
  );
}

function updateMapWarnings() {
  let noForecast = true;
  let noForecastThisWeek = true;
  let someForecastThisWeek = false;
  let allForecast = true;

  for (const feature of regionData.features) {
    const thisData =
      feature.properties.data[mapPopulationSelector.value][
        mapOutcomeVariableSelector.value
      ];

    const hasProjection = thisData.projected.values.length;

    // console.log(thisData.projected.values.length)

    if (noForecast) {
      const hasHistorical = thisData.historical.values.length;
      noForecast = !(hasHistorical || hasProjection);
    }

    if (noForecastThisWeek || allForecast) {
      const startECurr = dayjs(thisData.projected.start_date).isSame(
        currentDate,
      );

      console.log(thisData.projected.start_date);
      console.log(thisData.projected);
      // console.log(currentDate)
      // console.log(startECurr)

      if (hasProjection) {
        noForecastThisWeek = noForecastThisWeek && !startECurr;
        allForecast = allForecast && startECurr;
      }
    }
  }

  someForecastThisWeek = !(noForecastThisWeek || allForecast);

  mapNoForecastAlert.hide();
  mapNoForecastThisWeekAlert.hide();
  mapMixedForecastThisWeekAlert.hide();
  mapDisclaimer.innerHTML = "";

  if (noForecast) {
    mapNoForecastAlert.show();
    return;
  }

  if (noForecastThisWeek) {
    mapNoForecastThisWeekAlert.show();
  }

  if (someForecastThisWeek) {
    mapMixedForecastThisWeekAlert.show();
    mapDisclaimer.innerHTML =
      "Partial forecast submissions available for this week";
  }
}

async function updateMapGeographicUnitOptions() {
  d3.selectAll(".map-geographic-unit-option").remove();

  const availableGeographicUnits = Object.keys(
    metadata.available_models[mapDiseaseSelector.value],
  );

  d3.select(mapGeographicUnitSelector)
    .selectAll(".map-geographic-unit-option")
    .data(availableGeographicUnits)
    .enter()
    .append("sl-option")
    .attr("class", "map-geographic-unit-option")
    .attr("value", (d) => d)
    .html((d) => metadata.region_sizes[d]);

  if (!availableGeographicUnits.includes(mapGeographicUnit)) {
    mapGeographicUnit = availableGeographicUnits[0];
    mapGeographicUnitSelector.value = mapGeographicUnit;
  }

  await updateMapPopulationOptions();
}

async function updateMapPopulationOptions() {
  // todo
  // updatePopulationOptions

  d3.selectAll(".map-population-tooltip").remove();

  let availablePopulations;
  const availableForUnit =
    metadata.available_models[mapDiseaseSelector.value][
      mapGeographicUnitSelector.value
    ];

  if (availableForUnit) {
    availablePopulations = Object.keys(availableForUnit);
  } else {
    const firstGeographicUnit = Object.entries(
      metadata.available_models[mapDiseaseSelector.value],
    )[0];
    availablePopulations = firstGeographicUnit
      ? Object.keys(firstGeographicUnit[1])
      : [];
  }

  d3.select(mapPopulationSelector)
    .selectAll(".map-population-tooltip")
    .data(availablePopulations)
    .enter()
    .append("sl-tooltip")
    .attr("class", "map-population-tooltip")
    .attr("content", (d) => metadata.populations_tooltips[d])
    .attr("trigger", "hover")
    .attr("hoist", "")
    .append("sl-option")
    .attr("class", "map-population-option")
    .attr("value", (d) => d)
    .html((d) => metadata.populations[d]);

  if (!availablePopulations.includes(mapPopulation)) {
    mapPopulation = availablePopulations[0];
    mapPopulationSelector.value = mapPopulation;
  }

  await updateMapOutcomeVariableOptions();
}

async function updateMapOutcomeVariableOptions() {
  d3.selectAll(".map-outcome-tooltip").remove();

  const availableOutcomeVariables =
    metadata.available_models[mapDiseaseSelector.value][
      mapGeographicUnitSelector.value
    ][mapPopulationSelector.value] ?? [];

  d3.select(mapOutcomeVariableSelector)
    .selectAll(".map-outcome-tooltip")
    .data(availableOutcomeVariables)
    .enter()
    .append("sl-tooltip")
    .attr("class", "map-outcome-tooltip")
    .attr("content", (d) => metadata.outcome_variables_tooltips[d])
    .attr("trigger", "hover")
    .attr("hoist", "")
    .append("sl-option")
    .attr("class", "map-outcome-option")
    .attr("value", (d) => d)
    .html((d) => metadata.outcome_variables[d]);

  if (!availableOutcomeVariables.includes(mapOutcomeVariable)) {
    mapOutcomeVariable = availableOutcomeVariables[0];
    mapOutcomeVariableSelector.value = mapOutcomeVariable;
  }
}
