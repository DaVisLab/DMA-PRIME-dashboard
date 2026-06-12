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

const zctaTooltip = new maplibregl.Popup({
  closeButton: false,
  closeOnClick: false,
  offset: 10,
});
const NO_DATA_COLOR = "#d1d5db";
let zctaGeoJson = null;
let latestMaternalChildData = null;
let maternalChildLegend = null;

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

  if (map.getSource("zcta")) {
    map.getSource("zcta").setData(displayGeoJson);
    return;
  }

  map.addSource("zcta", {
    type: "geojson",
    data: displayGeoJson,
  });

  map.addLayer({
    id: "zcta-fill",
    type: "fill",
    source: "zcta",
    paint: {
      "fill-color": ["get", "color"],
      "fill-opacity": 0.7,
    },
  });

  map.addLayer({
    id: "zcta-outline",
    type: "line",
    source: "zcta",
    paint: {
      "line-color": "#1e293b",
      "line-width": 1,
    },
  });

  setupZCTATooltip();

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
  if (!zctaGeoJson || !map.getSource("zcta")) {
    return;
  }

  map.getSource("zcta").setData(getMaternalChildDisplayGeoJson());
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

function setupZCTATooltip() {
  map.on("mousemove", "zcta-fill", (event) => {
    const feature = event.features?.[0];

    if (!feature) {
      zctaTooltip.remove();
      return;
    }

    map.getCanvas().style.cursor = "pointer";
    zctaTooltip
      .setLngLat(event.lngLat)
      .setHTML(getZCTATooltipHTML(feature.properties ?? {}))
      .addTo(map);
  });

  map.on("mouseleave", "zcta-fill", () => {
    map.getCanvas().style.cursor = "";
    zctaTooltip.remove();
  });
}

function getZCTATooltipHTML(properties) {
  const zcta = escapeHTML(getFeatureZCTA({ properties }) || "Unknown ZCTA");
  const value = formatTooltipValue(properties.value);
  const group = escapeHTML(properties.map_group || "No map group");

  return `<div> <b>ZCTA:</b> ${zcta}<br/>
         <b>Value:</b> ${value} (${group})</div>`;
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

  const mapContainer = map.getContainer();

  if (getComputedStyle(mapContainer).position === "static") {
    mapContainer.style.position = "relative";
  }

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
