import {
  populationColorMap,
  unknownColor,
  getCenter,
  getFeatureValue,
  getAllFeaturesValue,
  drawTooltip,
  drawStateHospitalizations,
} from "/static/js/respiratory/script.js";

import {
  facility_dataProcessing,
  call_data,
} from "/static/js/respiratory/utils/dataProcessing_utils.js";

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

let choroplethDiscreteEdges = null;

let choroplethColorMap = d3
  .scaleLinear()
  .domain([0, 1])
  .range(["white", populationColorMap.general_population])
  .unknown(unknownColor)
  .nice();

const map = new maplibregl.Map({
  container: "map-div",
  style: "https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json",
  center: MAP_CENTER,
  zoom: MAP_ZOOM,
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
  d3.select("#map-loading-div").style("visibility", visible ? "visible" : "hidden");
  d3.selectAll("#map-loading-div circle").classed("animate", visible);
};

const isGeographicChoroplethUnit = (unit) =>
  ["state", "region", "county", "zcta"].includes(unit);

const getSelectedFeatureId = () =>
  selectedItems.feature?.properties?.id;

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
    getLineColor: [64, 64, 64],
    updateTriggers: {
      data: [mapGeographicUnitSelector.value, dataVersion],
      getFillColor: [
        mapGeographicUnitSelector.value,
        mapOutcomeVariableSelector.value,
        dataVersion,
      ],
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

const getFacilityLabelLayer = (regionData) =>
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
  });

const getGeographicLabelLayer = (regionData) => {
  const unit = mapGeographicUnitSelector.value;

  return new TextLayer({
    id: "labels",
    data: regionData.features,
    getPosition: (d) => getCenter(d),
    getText:
      unit === "facility"
        ? (d) => d.properties.display_name
        : (d) => d.properties.id.toString(),
    maxWidth: 10,
    getAlignmentBaseline: "center",
    getTextAnchor: "middle",
    getColor: [0, 0, 0],
    background: true,
    getBackgroundColor:
      unit === "facility" ? [255, 255, 255, 128] : [255, 255, 255, 32],
    backgroundBorderRadius: unit === "facility" ? 10 : 2,
    backgroundPadding: unit === "facility" ? [2, 2] : [4, 4],
    getSize:
      unit === "facility"
        ? 12
        : unit === "zcta"
          ? Math.min(Math.max(8, map.getZoom() * 1.5), 16)
          : 16,
    fontFamily: getFontFamily(),
    collisionGroup: "labels",
    collisionTestProps: { sizeScale: 2.5 },
    updateTriggers: {
      getSize: [map.getZoom()],
    },
  });
};
await Promise.allSettled([
  customElements.whenDefined("sl-select"),
  customElements.whenDefined("sl-option"),
  customElements.whenDefined("sl-button"),
]);

await new Promise((resolve) => map.once("load", resolve));
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

async function redraw(resetWarnings = false, fetchData = false, center = false) {
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
        'input[name="facilityOptionGroup"]:checked',
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
    document.querySelector('input[name="facilityOptionGroup"]:checked')?.value !==
      "individual-unit"
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

    const value = getFeatureValue(
      feature,
      population,
      outcomeVariable,
      mapTypeSwitch.value,
      imputations,
    );

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
      .scaleThreshold()
      .domain([-100, -50, 0, 50, 100, 500])
      .range(d3.reverse(d3.schemeRdBu[8]).slice(1))
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
    choroplethDiscreteEdges = null;

    const mix = d3.interpolateRgb(
      populationColorMap[population].historical,
      "red",
    );

    choroplethColorMap = d3
      .scaleLinear()
      .domain([0, 0.5, 1, Math.max(d3.max(values) || 0, 2)])
      .range(["white", "#648FFF", mix(0.5), "red"])
      .unknown(unknownColor)
      .nice();

    return;
  }

  choroplethColorMap = d3
    .scaleQuantize()
    .domain([0, d3.max(values) || 1])
    .range(
      d3.quantize(
        d3.interpolateRgb("white", populationColorMap[population].historical),
        5,
      ),
    )
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
    const colors = d3.reverse(d3.schemeRdBu[8]).slice(1);
    const labels = [-100, -50, 0, 50, 100, 500];
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

    legend
      .append("g")
      .attr("transform", "translate(0, 100)")
      .selectAll("rect")
      .data(colors)
      .enter()
      .append("rect")
      .attr("x", (d, i) => (legendLength * i) / colors.length)
      .attr("y", 0)
      .attr("width", legendLength / colors.length)
      .attr("height", 15)
      .attr("fill", (d) => d);

    legend
      .append("g")
      .attr("transform", "translate(0, 100)")
      .selectAll("text")
      .data(labels)
      .enter()
      .append("text")
      .attr("class", "map-legend")
      .attr("x", (d, i) => (legendLength * (i + 1)) / colors.length)
      .attr("y", 15 + em * 0.75)
      .attr("text-anchor", "middle")
      .html((d) => `${d}%`);

    const otherColors = legend.append("g").attr("transform", "translate(0, 80)");
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

  if (mapOutcomeVariableSelector.value !== "rate_of_transmission") {
    const edges =
      choroplethDiscreteEdges && choroplethDiscreteEdges.length === 6
        ? choroplethDiscreteEdges
        : (() => {
            const domain = choroplethColorMap.domain?.() ?? [0];
            const maxVal = Array.isArray(domain) && domain.length ? Math.max(0, d3.max(domain)) : 0;
            const step = maxVal / 5 || 1;
            return d3.range(6).map((i) => i * step);
          })();

    const bins = choroplethColorMap
      .range()
      .map((color, i) => ({ color, x0: edges[i], x1: edges[i + 1] }));

    const xScale = d3
      .scaleLinear()
      .domain([edges[0], edges.at(-1)])
      .range([0, legendWidth]);

    const content = colorLegend
      .append("g")
      .attr("transform", "translate(0, 8)")
      .attr("id", "map-color-legend-contents");

    content
      .selectAll("rect.bin")
      .data(bins)
      .enter()
      .append("rect")
      .attr("class", "bin")
      .attr("x", (d) => LEGEND_MARGINS.left + xScale(d.x0))
      .attr("y", LEGEND_MARGINS.top)
      .attr("width", (d) => Math.max(1, xScale(d.x1) - xScale(d.x0)))
      .attr("height", em)
      .attr("fill", (d) => d.color);

    const tickValues = edges;
    const numberFormatter = d3.format(",.3~f");

    const axisG = content
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
          .tickFormat(numberFormatter),
      );

    axisG
      .selectAll("text")
      .attr("text-anchor", (d, i) =>
        i === 0 ? "start" : i === tickValues.length - 1 ? "end" : "middle",
      );

    const dataVarString = getSelectedOptionHtml(
      mapOutcomeVariableSelector,
      mapOutcomeVariableSelector.value,
    );

    content
      .append("text")
      .attr("id", "map-legend-title")
      .attr("class", "map-legend title")
      .attr("x", legendWidth / 2 + LEGEND_MARGINS.left)
      .attr("y", 3 * em + LEGEND_MARGINS.top)
      .text(
        `Current Week's ${dataVarString} by ${metadata.region_sizes[mapGeographicUnitSelector.value]}`,
      );

    return;
  }

  const defs = colorLegend.append("defs");
  const linearGradient = defs.append("linearGradient");

  linearGradient
    .attr("id", "linear-gradient")
    .attr("x1", "0%")
    .attr("y1", "0%")
    .attr("x2", "100%")
    .attr("y2", "0%");

  linearGradient
    .append("stop")
    .attr("id", "linear-gradient-stop-0")
    .attr("offset", "0%")
    .attr("stop-color", "white");

  if (mapOutcomeVariableSelector.value === "rate_of_transmission") {
    linearGradient
      .append("stop")
      .attr("id", "linear-gradient-stop-1")
      .attr("offset", `${(0.9 / choroplethColorMap.domain().at(-1)) * 100}%`)
      .attr("stop-color", choroplethColorMap.range().at(1));
  }

  linearGradient
    .append("stop")
    .attr("id", "linear-gradient-stop-1")
    .attr("offset", "100%")
    .attr("stop-color", choroplethColorMap.range().at(-1));

  colorLegend
    .append("rect")
    .attr("class", "map-legend-background")
    .attr("width", legendWidth + LEGEND_MARGINS.left + LEGEND_MARGINS.right)
    .attr("height", 3 * em + LEGEND_MARGINS.top + LEGEND_MARGINS.bottom);

  const colorLegendContent = colorLegend.append("g").attr("id", "map-color-legend-contents");

  colorLegendContent
    .append("rect")
    .style("fill", "url(#linear-gradient)")
    .attr("width", legendWidth)
    .attr("height", em)
    .attr("x", LEGEND_MARGINS.left)
    .attr("y", LEGEND_MARGINS.top);

  colorLegendContent
    .append("g")
    .attr("id", "map-color-legend-axis")
    .attr(
      "transform",
      `translate(${LEGEND_MARGINS.left} ${em + LEGEND_MARGINS.top})`,
    )
    .call(
      d3
        .axisBottom(
          d3
            .scaleLinear(d3.extent(choroplethColorMap.domain()), [0, legendWidth])
            .nice(),
        )
        .ticks(6),
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

    if (noForecast) {
      const hasHistorical = thisData.historical.values.length;
      noForecast = !(hasHistorical || hasProjection);
    }

    if (noForecastThisWeek || allForecast) {
      const startECurr = dayjs(thisData.projected.start_date).isSame(currentDate);

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
    mapDisclaimer.innerHTML = "Partial forecast submissions available for this week";
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
  d3.selectAll(".map-population-tooltip").remove();

  let availablePopulations;
  const availableForUnit =
    metadata.available_models[mapDiseaseSelector.value][mapGeographicUnitSelector.value];

  if (availableForUnit) {
    availablePopulations = Object.keys(availableForUnit);
  } else {
    const firstGeographicUnit = Object.entries(
      metadata.available_models[mapDiseaseSelector.value],
    )[0];
    availablePopulations = firstGeographicUnit ? Object.keys(firstGeographicUnit[1]) : [];
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
    metadata.available_models[mapDiseaseSelector.value][mapGeographicUnitSelector.value][
      mapPopulationSelector.value
    ] ?? [];

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