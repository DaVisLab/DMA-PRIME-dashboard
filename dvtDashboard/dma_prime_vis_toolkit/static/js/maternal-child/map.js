const MAP_CENTER = [-81, 33.65];
const MAP_ZOOM = 7;
const MAP_MIN_ZOOM = 2;
const MAP_MAX_ZOOM = 11;
const MAP_BOUNDS = [
  [-90.0, 26.0],
  [-72.0, 40.0],
];
const FACILITY_ICON_MAPPING = {
  marker: { x: 0, y: 0, width: 1128, height: 992, mask: true },
};
const LEGEND_MARGINS = {
  top: 12,
  bottom: 16,
  left: 8,
  right: 8,
};

const map = new maplibregl.Map({
  container: "map-div",
  style:
    "https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json",
  center: MAP_CENTER,
  zoom: MAP_ZOOM,
  minZoom: MAP_MIN_ZOOM,
  maxZoom: MAP_MAX_ZOOM,
  maxBounds: MAP_BOUNDS,
  bearing: 0,
  pitch: 0,
  dragRotate: false,
  pitchWithRotate: false,
});

const ZCTA_SOURCE_ID = "zcta";
const ZCTA_FILL_LAYER_ID = "zcta-fill";
const ZCTA_OUTLINE_LAYER_ID = "zcta-outline";
const ZCTA_HOVER_OUTLINE_LAYER_ID = "zcta-hover-outline";
const CONDITION_SELECTOR_ID = "maternal-child-condition";
const YEAR_SELECTOR_ID = "maternal-child-year";
const NO_DATA_COLOR = "#d1d5db";
let zctaGeoJson = null;
let latestMaternalChildData = null;
let maternalChildLegend = null;
let zctaTooltip = null;
let hoveredZCTA = null;
let tooltipContentKey = null;
let pendingTooltipPoint = null;
let tooltipAnimationFrame = null;

function buildZCTAGeoDataUrl(geographic_resolution) {
  return `/data/map/${geographic_resolution}`;
}

async function drawDataOnMap() {
  const response = await fetch(buildZCTAGeoDataUrl("zcta"));

  if (!response.ok) {
    throw new Error(`Unable to load maternal-child data: ${response.status}`);
  }

  zctaGeoJson = await response.json();
  const displayGeoJson = getMaternalChildDisplayGeoJson();

  if (map.getSource(ZCTA_SOURCE_ID)) {
    map.getSource(ZCTA_SOURCE_ID).setData(displayGeoJson);
    return;
  }

  map.addSource(ZCTA_SOURCE_ID, {
    type: "geojson",
    data: displayGeoJson,
  });

  map.addLayer({
    id: ZCTA_FILL_LAYER_ID,
    type: "fill",
    source: ZCTA_SOURCE_ID,
    paint: {
      "fill-color": ["get", "color"],
      "fill-opacity": 0.7,
    },
  });

  map.addLayer({
    id: ZCTA_OUTLINE_LAYER_ID,
    type: "line",
    source: ZCTA_SOURCE_ID,
    paint: {
      "line-color": "#1e293b",
      "line-width": 1,
    },
  });

  map.addLayer({
    id: ZCTA_HOVER_OUTLINE_LAYER_ID,
    type: "line",
    source: ZCTA_SOURCE_ID,
    paint: {
      "line-color": [
        "case",
        ["boolean", ["feature-state", "hover"], false],
        "#111827",
        "rgba(17, 24, 39, 0)",
      ],
      "line-opacity": [
        "case",
        ["boolean", ["feature-state", "hover"], false],
        0.95,
        0,
      ],
      "line-width": [
        "case",
        ["boolean", ["feature-state", "hover"], false],
        3,
        0,
      ],
    },
  });

  setupZCTAInteractions();

  if (window.latestMaternalChildData?.data) {
    latestMaternalChildData = window.latestMaternalChildData.data;
    updateMaternalChildChoropleth();
  }

  drawDiscreteColorLegend(latestMaternalChildData);
}

map.on("load", () => {
  drawDataOnMap();
});

window.addEventListener("maternal-child-data-loaded", (event) => {
  latestMaternalChildData = event.detail?.data ?? null;
  updateMaternalChildChoropleth();
});

function updateMaternalChildChoropleth() {
  if (!zctaGeoJson || !map.getSource(ZCTA_SOURCE_ID)) {
    return;
  }

  map.getSource(ZCTA_SOURCE_ID).setData(getMaternalChildDisplayGeoJson());
  tooltipContentKey = null;

  if (hoveredZCTA) {
    setZCTAFeatureHover(hoveredZCTA, true);
  }

  drawDiscreteColorLegend(latestMaternalChildData);
}

function getMaternalChildDisplayGeoJson() {
  if (!zctaGeoJson) {
    return {
      type: "FeatureCollection",
      features: [],
    };
  }

  if (!latestMaternalChildData) {
    return applyMaternalChildDataToGeoJson(zctaGeoJson, {});
  }

  return applyMaternalChildDataToGeoJson(zctaGeoJson, latestMaternalChildData);
}

function getColorForValue(value, minValue, maxValue) {
  if (!Number.isFinite(value)) {
    return NO_DATA_COLOR;
  }

  if (minValue === maxValue) {
    return "#fc9272";
  }

  const normalized = (value - minValue) / (maxValue - minValue);

  if (normalized <= 0.2) return "#fff5f0";
  if (normalized <= 0.4) return "#fcbba1";
  if (normalized <= 0.6) return "#fc9272";
  if (normalized <= 0.8) return "#fb6a4a";

  return "#cb181d";
}

function applyMaternalChildDataToGeoJson(geojson, data) {
  const values = Object.values(data)
    .map((datum) => getMetricValue(datum))
    .filter((value) => Number.isFinite(value));
  const minValue = values.length > 0 ? Math.min(...values) : null;
  const maxValue = values.length > 0 ? Math.max(...values) : null;

  return {
    ...geojson,
    features: geojson.features.map((feature) => {
      const zcta = getFeatureZCTA(feature);
      const datum = data[zcta];
      const value = getMetricValue(datum);
      const mapColor = getMapColor(datum);
      const mapGroup = getMapGroup(datum);
      const hasValue = Number.isFinite(value);

      return {
        ...feature,
        id: zcta || feature.id,
        properties: {
          ...feature.properties,
          color:
            mapColor ??
            (hasValue && minValue !== null && maxValue !== null
              ? getColorForValue(value, minValue, maxValue)
              : NO_DATA_COLOR),
          map_group: mapGroup,
          value: hasValue ? value : null,
        },
      };
    }),
  };
}

function setupZCTAInteractions() {
  map.on("mousemove", ZCTA_FILL_LAYER_ID, (event) => {
    const feature = event.features?.[0];

    if (!feature) {
      hideZCTATooltip();
      setHoveredZCTA(null);
      return;
    }

    const zcta = getFeatureZCTA(feature);

    if (!zcta) {
      hideZCTATooltip();
      setHoveredZCTA(null);
      return;
    }

    setHoveredZCTA(zcta);
    map.getCanvas().style.cursor = "pointer";
    updateZCTATooltip(feature, event);
  });

  map.on("mouseleave", ZCTA_FILL_LAYER_ID, () => {
    map.getCanvas().style.cursor = "";
    hideZCTATooltip();
    setHoveredZCTA(null);
  });
}

function setHoveredZCTA(zcta) {
  const nextZCTA = zcta || null;

  if (hoveredZCTA === nextZCTA) {
    return;
  }

  if (hoveredZCTA) {
    setZCTAFeatureHover(hoveredZCTA, false);
  }

  hoveredZCTA = nextZCTA;

  if (hoveredZCTA) {
    setZCTAFeatureHover(hoveredZCTA, true);
  }
}

function setZCTAFeatureHover(zcta, hover) {
  if (
    !zcta ||
    !map.getSource(ZCTA_SOURCE_ID) ||
    !map.getLayer(ZCTA_HOVER_OUTLINE_LAYER_ID)
  ) {
    return;
  }

  map.setFeatureState({ source: ZCTA_SOURCE_ID, id: zcta }, { hover });
}

function updateZCTATooltip(feature, event) {
  const tooltip = ensureZCTATooltip();
  const zcta = getFeatureZCTA(feature);
  const controlState = getMaternalChildControlState();
  const contentKey = JSON.stringify([zcta, controlState.condition, controlState.year]);

  if (tooltipContentKey !== contentKey) {
    tooltip.innerHTML = getZCTATooltipHTML(
      feature.properties ?? {},
      controlState,
    );
    tooltipContentKey = contentKey;
  }

  tooltip.style.display = "block";
  tooltip.style.opacity = "1";
  scheduleZCTATooltipPosition(getTooltipPoint(event));
}

function ensureZCTATooltip() {
  if (zctaTooltip) {
    return zctaTooltip;
  }

  const mapContainer = ensureMapContainerPosition();
  zctaTooltip = document.createElement("div");
  zctaTooltip.id = "maternal-child-zcta-tooltip";
  zctaTooltip.style.position = "absolute";
  zctaTooltip.style.left = "0";
  zctaTooltip.style.top = "0";
  zctaTooltip.style.zIndex = "3";
  zctaTooltip.style.display = "none";
  zctaTooltip.style.padding = "8px 10px";
  zctaTooltip.style.border = "1px solid rgba(15, 23, 42, 0.16)";
  zctaTooltip.style.borderRadius = "6px";
  zctaTooltip.style.background = "rgba(255, 255, 255, 0.96)";
  zctaTooltip.style.boxShadow = "0 8px 20px rgba(15, 23, 42, 0.16)";
  zctaTooltip.style.color = "#0f172a";
  zctaTooltip.style.fontFamily = "var(--sl-font-sans, sans-serif)";
  zctaTooltip.style.fontSize = "12px";
  zctaTooltip.style.lineHeight = "1.35";
  zctaTooltip.style.pointerEvents = "none";
  zctaTooltip.style.willChange = "transform";

  mapContainer.appendChild(zctaTooltip);
  return zctaTooltip;
}

function hideZCTATooltip() {
  if (!zctaTooltip) {
    return;
  }

  zctaTooltip.style.display = "none";
  zctaTooltip.style.opacity = "0";
  tooltipContentKey = null;
  pendingTooltipPoint = null;

  if (tooltipAnimationFrame !== null && window.cancelAnimationFrame) {
    window.cancelAnimationFrame(tooltipAnimationFrame);
  }

  tooltipAnimationFrame = null;
}

function scheduleZCTATooltipPosition(point) {
  if (!point) {
    return;
  }

  pendingTooltipPoint = point;

  if (tooltipAnimationFrame !== null) {
    return;
  }

  if (window.requestAnimationFrame) {
    tooltipAnimationFrame = window.requestAnimationFrame(
      applyZCTATooltipPosition,
    );
    return;
  }

  applyZCTATooltipPosition();
}

function applyZCTATooltipPosition() {
  tooltipAnimationFrame = null;

  if (!zctaTooltip || !pendingTooltipPoint) {
    return;
  }

  const x = Math.round(pendingTooltipPoint.x + 12);
  const y = Math.round(pendingTooltipPoint.y + 12);
  zctaTooltip.style.transform = `translate(${x}px, ${y}px)`;
}

function getTooltipPoint(event) {
  if (event.point) {
    return event.point;
  }

  if (event.lngLat && typeof map.project === "function") {
    return map.project(event.lngLat);
  }

  return null;
}

function getZCTATooltipHTML(properties, controlState) {
  const zcta = escapeHTML(getFeatureZCTA({ properties }) || "Unknown ZCTA");
  const value = formatTooltipValue(properties.value);
  const group = escapeHTML(properties.map_group || "No map group");
  const condition = escapeHTML(controlState.condition || "No condition selected");
  const year = escapeHTML(controlState.year || "No year selected");

  return `<b>ZCTA:</b> ${zcta}<br/>
         <div><b>Condition:</b> ${condition}<br/>
         <b>Year:</b> ${year}<br/>
         <b>Observed Cases:</b> ${value} (${group})</div>`;
}

function getMaternalChildControlState() {
  const controlState = window.maternalChildOptionValue?.getControlState?.();

  if (controlState) {
    return {
      condition: controlState.condition ?? "",
      year: controlState.year ?? "",
    };
  }

  return {
    condition: getSelectedControlRawValue(CONDITION_SELECTOR_ID),
    year: getSelectedControlRawValue(YEAR_SELECTOR_ID),
  };
}

function getSelectedControlRawValue(selectorId) {
  const selector = document.getElementById(selectorId);

  if (!selector) {
    return "";
  }

  const helper = window.maternalChildOptionValue;

  if (helper?.getSelectedRawValue) {
    return helper.getSelectedRawValue(selector);
  }

  const selectedValue = selector.value || selector.getAttribute("value") || "";
  const selectedOption = Array.from(selector.querySelectorAll("sl-option")).find(
    (option) => option.getAttribute("value") === selectedValue,
  );

  return selectedOption?.dataset.rawValue
    ?? selector.dataset.rawValue
    ?? selectedValue;
}

function formatTooltipValue(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "No data";
  }

  return escapeHTML(
    Number.isInteger(numericValue)
      ? String(numericValue)
      : String(Math.round(numericValue * 100) / 100),
  );
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getMetricValue(datum) {
  if (datum && typeof datum === "object") {
    return Number(datum.metric_value);
  }

  return Number(datum);
}

function getMapColor(datum) {
  if (!datum || typeof datum !== "object") {
    return null;
  }

  return datum.map_color ?? datum["map_color:"] ?? null;
}

function getMapGroup(datum) {
  if (!datum || typeof datum !== "object") {
    return null;
  }

  return datum.map_group ?? null;
}

function ensureMapContainerPosition() {
  const mapContainer = map.getContainer();

  if (getComputedStyle(mapContainer).position === "static") {
    mapContainer.style.position = "relative";
  }

  return mapContainer;
}

function getLegendEntries(data) {
  const colorOrder = {
    "#BDBDBD": 0, // 회색
    "#FEE5D9": 1,
    "#FCBBA1": 2,
    "#FB6A4A": 3,
    "#CB181D": 4, // 가장 진한 빨강
  };

  const entriesByGroup = new Map();

  Object.values(data ?? {}).forEach((datum) => {
    const group = getMapGroup(datum);
    const color = getMapColor(datum);

    if (!group || !color || entriesByGroup.has(group)) {
      return;
    }

    entriesByGroup.set(group, { color, group });
  });

  return Array.from(entriesByGroup.values()).sort(
    (a, b) => colorOrder[a.color] - colorOrder[b.color],
  );
}

function ensureDiscreteLegend() {
  if (maternalChildLegend) {
    return maternalChildLegend;
  }

  const mapContainer = ensureMapContainerPosition();

  maternalChildLegend = document.createElement("div");
  maternalChildLegend.id = "maternal-child-map-legend";
  maternalChildLegend.style.position = "absolute";
  maternalChildLegend.style.left = "12px";
  maternalChildLegend.style.bottom = "12px";
  maternalChildLegend.style.zIndex = "2";
  maternalChildLegend.style.maxWidth = "240px";
  maternalChildLegend.style.padding = "10px 12px";
  maternalChildLegend.style.border = "1px solid rgba(15, 23, 42, 0.16)";
  maternalChildLegend.style.borderRadius = "8px";
  maternalChildLegend.style.background = "rgba(255, 255, 255, 0.92)";
  maternalChildLegend.style.boxShadow = "0 8px 20px rgba(15, 23, 42, 0.14)";
  maternalChildLegend.style.color = "#0f172a";
  maternalChildLegend.style.fontFamily = "var(--sl-font-sans, sans-serif)";
  maternalChildLegend.style.fontSize = "12px";
  maternalChildLegend.style.lineHeight = "1.25";
  maternalChildLegend.style.pointerEvents = "none";

  mapContainer.appendChild(maternalChildLegend);
  return maternalChildLegend;
}

function drawDiscreteColorLegend(data) {
  const legend = ensureDiscreteLegend();
  const entries = getLegendEntries(data);

  if (entries.length === 0) {
    legend.replaceChildren();
    legend.style.display = "none";
    return;
  }

  legend.style.display = "block";

  const title = document.createElement("div");
  title.textContent = "Map group";
  title.style.fontWeight = "600";
  title.style.marginBottom = "8px";

  const list = document.createElement("div");
  list.style.display = "grid";
  list.style.gap = "6px";

  entries.forEach(({ color, group }) => {
    const row = document.createElement("div");
    row.style.display = "grid";
    row.style.gridTemplateColumns = "14px minmax(0, 1fr)";
    row.style.alignItems = "center";
    row.style.gap = "8px";

    const swatch = document.createElement("span");
    swatch.style.width = "14px";
    swatch.style.height = "14px";
    swatch.style.border = "1px solid rgba(15, 23, 42, 0.24)";
    swatch.style.background = color;

    const label = document.createElement("span");
    label.textContent = group;
    label.style.overflowWrap = "anywhere";

    row.append(swatch, label);
    list.appendChild(row);
  });

  legend.replaceChildren(title, list);
}

function getFeatureZCTA(feature) {
  const properties = feature.properties ?? {};

  return String(
    properties.ZCTA ??
      properties.zcta ??
      properties.ZCTA5CE10 ??
      properties.ZCTA5CE ??
      properties.GEOID ??
      "",
  );
}

window.maternalChildMap = {
  getDisplayGeoJson: getMaternalChildDisplayGeoJson,
  getLatestData: () => latestMaternalChildData,
  updateChoropleth: updateMaternalChildChoropleth,
};
