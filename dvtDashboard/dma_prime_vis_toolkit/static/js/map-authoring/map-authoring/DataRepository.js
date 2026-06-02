export const DATA_LEVELS = Object.freeze({
  REGION: "region",
  DIVISION: "division",
  STATE: "state",
  COUNTY: "county",
  ZCTA: "zcta",
});

export const OUTBREAK_DATA_ROOT = "/data/outbreak-detection";
export const OUTBREAK_OUTCOME_COLUMN = "encounters";
export const SC_COUNTY_TO_REGION_URL =
  "/static/assets/GeoJSON/SC_county_to_region.json";
export const SC_ZIP_TO_COUNTY_URL =
  "/static/assets/GeoJSON/SC_zip_to_county.json";
export const ALL_DISEASES_VARIABLE_ID = "all_diseases";
export const DEFAULT_DATA_VARIABLE_ID = ALL_DISEASES_VARIABLE_ID;

const DEFAULT_DISEASES = [
  { "disease-name": "adenovirus", "display-name": "Adenovirus" },
  { "disease-name": "covid-19", "display-name": "COVID-19" },
  { "disease-name": "influenza", "display-name": "Influenza" },
  { "disease-name": "rsv", "display-name": "RSV" },
];

const outbreakDataCache = new Map();
const referenceDataCache = new Map();
const GEOMETRY_SIMPLIFY_TOLERANCE_BY_LEVEL = Object.freeze({
  [DATA_LEVELS.REGION]: 0.0015,
  [DATA_LEVELS.COUNTY]: 0.0015,
  [DATA_LEVELS.ZCTA]: 0.003,
});

export const DATA_VARIABLES = buildDiseaseVariables();

export function getDataVariableById(variableId = DEFAULT_DATA_VARIABLE_ID) {
  return (
    DATA_VARIABLES.find((variable) => variable.id === variableId) ??
    DATA_VARIABLES.find(
      (variable) => variable.id === DEFAULT_DATA_VARIABLE_ID,
    ) ??
    DATA_VARIABLES[0]
  );
}

export function getDatasetLevelForGeoResolution(geoResolution) {
  if (geoResolution === "REGION") return DATA_LEVELS.REGION;
  if (geoResolution === "STATE") return DATA_LEVELS.COUNTY;
  if (geoResolution === "COUNTY") return DATA_LEVELS.ZCTA;
  if (geoResolution === "COUNTRY") return DATA_LEVELS.STATE;
  if (geoResolution === "DIVISION") return DATA_LEVELS.DIVISION;

  return DATA_LEVELS.REGION;
}

export async function loadGeojsonWithDataset({
  level,
  variableId = DEFAULT_DATA_VARIABLE_ID,
  featureFilter = null,
}) {
  const geojson = await loadOutbreakGeojsonForLevel(level);
  const detachedGeojson = cloneGeojsonForDataJoin(geojson, featureFilter);

  return applyDatasetToGeojson(detachedGeojson, { level, variableId });
}

export async function applyDatasetToGeojson(
  geojson,
  { level, variableId = DEFAULT_DATA_VARIABLE_ID },
) {
  const normalizedLevel = normalizeLevel(level);
  const variable = getDataVariableById(variableId);

  geojson.features.forEach((feature) => {
    normalizeOutbreakFeature(feature, normalizedLevel);
    const valuesByDisease = getLatestValuesByDisease(feature.properties.data);
    const selectedValue = valuesByDisease[variable.id] ?? null;

    DATA_VARIABLES.forEach((dataVariable) => {
      feature.properties[dataVariable.id] = valuesByDisease[dataVariable.id] ?? null;
    });

    feature.properties = {
      ...feature.properties,
      datasetLevel: normalizedLevel,
      datasetVariable: variable.id,
      datasetVariableLabel: variable.label,
      datasetKey: getDatasetFeatureKey(feature.properties, normalizedLevel),
      Data_Value: selectedValue,
      Data_Value_Unit: "latest outbreak detection value",
      [variable.id]: selectedValue,
    };
  });

  return geojson;
}

async function loadOutbreakGeojsonForLevel(level) {
  const normalizedLevel = normalizeLevel(level);
  const dataVersion = getMapAuthoringConfig().data_version ?? "current";
  const cacheKey = `${normalizedLevel}:${OUTBREAK_OUTCOME_COLUMN}:${dataVersion}`;

  if (!outbreakDataCache.has(cacheKey)) {
    const params = new URLSearchParams({ data_version: dataVersion });
    const url = `${OUTBREAK_DATA_ROOT}/${normalizedLevel}/${OUTBREAK_OUTCOME_COLUMN}?${params.toString()}`;

    outbreakDataCache.set(
      cacheKey,
      fetch(url).then(async (response) => {
        if (!response.ok) throw new Error(`Failed to load ${url}`);
        const data = await response.json();
        const references = await loadReferenceDataForLevel(normalizedLevel);

        data.features = (data.features ?? []).filter(
          (feature) => feature.geometry?.type !== "Point",
        );
        data.features.forEach((feature) => {
          normalizeOutbreakFeature(feature, normalizedLevel, references);
          rewindFeatureGeometryForD3(feature);
          simplifyFeatureGeometry(feature, normalizedLevel);
        });
        return data;
      }),
    );
  }

  return outbreakDataCache.get(cacheKey);
}

function buildDiseaseVariables() {
  const diseases = normalizeDiseaseMetadata();

  return [
    {
      id: ALL_DISEASES_VARIABLE_ID,
      value: ALL_DISEASES_VARIABLE_ID,
      label: "All Disease",
      shortLabel: "All Disease",
    },
    ...diseases.map((disease) => ({
      id: disease.id,
      value: disease.id,
      label: disease.label,
      shortLabel: formatCompactDiseaseLabel(disease.label),
    })),
  ];
}

function normalizeDiseaseMetadata() {
  const diseases = getMapAuthoringConfig().diseases;
  const source =
    Array.isArray(diseases) && diseases.length ? diseases : DEFAULT_DISEASES;

  return source
    .map((disease) => {
      const id =
        disease?.["disease-name"] ??
        disease?.diseaseName ??
        disease?.id ??
        disease?.value;
      if (!id) return null;

      return {
        id,
        label:
          disease?.["display-name"] ??
          disease?.displayName ??
          disease?.label ??
          formatDiseaseLabel(id),
      };
    })
    .filter(Boolean);
}

function getLatestValuesByDisease(data = {}) {
  const diseaseVariables = DATA_VARIABLES.filter(
    (variable) => variable.id !== ALL_DISEASES_VARIABLE_ID,
  );
  const values = {};

  diseaseVariables.forEach((variable) => {
    values[variable.id] = latestDiseaseValue(data[variable.id]);
  });

  const finiteValues = Object.values(values).filter(Number.isFinite);
  values[ALL_DISEASES_VARIABLE_ID] = finiteValues.length
    ? finiteValues.reduce((sum, value) => sum + value, 0)
    : null;

  return values;
}

function latestDiseaseValue(diseaseData = {}) {
  return (
    latestFiniteValue(diseaseData.weekly) ??
    latestFiniteValue(diseaseData.monthly) ??
    latestFiniteValue(diseaseData.yearly) ??
    null
  );
}

function latestFiniteValue(values) {
  if (!Array.isArray(values)) return null;

  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = Number(values[index]);
    if (Number.isFinite(value)) return value;
  }

  return null;
}

function normalizeOutbreakFeature(feature, level, references = {}) {
  feature.properties = { ...(feature.properties ?? {}) };
  const properties = feature.properties;

  if (level === DATA_LEVELS.REGION) {
    const regionName =
      properties.Region ??
      properties.regionName ??
      properties.name ??
      properties.NAME;
    const regionId = toId(regionName ?? properties.id);

    properties.Region = regionName;
    properties.regionName = regionName;
    properties.regionId = regionId;
    properties.id = regionId;
    properties.name = regionName;
    return;
  }

  if (level === DATA_LEVELS.COUNTY) {
    const countyName =
      properties.countyName ??
      properties.NAME ??
      properties.name ??
      properties.county;
    const countyId = toId(countyName ?? properties.id);
    const parentRegion =
      properties.parentRegion ??
      properties.Region ??
      properties.region ??
      getReferenceValue(references.countyToRegion, countyName);

    properties.countyName = countyName;
    properties.countyId = countyId;
    properties.parentRegion = parentRegion;
    properties.parentRegionId = toId(parentRegion);
    properties.id = countyId;
    properties.name = countyName;
    return;
  }

  if (level === DATA_LEVELS.ZCTA) {
    const zctaName =
      properties.zipName ??
      properties.ZCTA ??
      properties.ZCTA5CE10 ??
      properties.ZCTA5CE ??
      properties.name;
    const zctaId = toId(zctaName ?? properties.id);
    const parentCountyName =
      properties.parentCountyName ??
      properties.countyName ??
      properties.county ??
      getReferenceValue(references.zipToCounty, zctaName);
    const parentRegion =
      properties.parentRegion ??
      getReferenceValue(references.countyToRegion, parentCountyName);

    properties.ZCTA = zctaName;
    properties.zipName = zctaName;
    properties.zctaId = zctaId;
    properties.parentCountyName = parentCountyName;
    properties.parentCountyId = toId(parentCountyName);
    properties.parentRegion = parentRegion;
    properties.parentRegionId = toId(parentRegion);
    properties.id = zctaId;
    properties.name = zctaName;
  }
}

function getDatasetFeatureKey(properties = {}, level) {
  if (level === DATA_LEVELS.REGION) return properties.regionId ?? properties.id;
  if (level === DATA_LEVELS.COUNTY) return properties.countyId ?? properties.id;
  if (level === DATA_LEVELS.ZCTA) return properties.zctaId ?? properties.id;

  return properties.id ?? properties.name ?? null;
}

function cloneGeojsonForDataJoin(geojson, featureFilter = null) {
  const features =
    geojson?.type === "FeatureCollection" ? geojson.features : [geojson];
  const filteredFeatures =
    typeof featureFilter === "function"
      ? features.filter((feature) => featureFilter(feature))
      : features;

  return {
    ...geojson,
    type: "FeatureCollection",
    features: filteredFeatures.filter(Boolean).map((feature) => ({
      ...feature,
      properties: { ...(feature.properties ?? {}) },
    })),
  };
}

function rewindFeatureGeometryForD3(feature) {
  const geometry = feature?.geometry;
  if (!geometry) return;

  if (geometry.type === "Polygon") {
    rewindPolygonForD3(geometry.coordinates);
    return;
  }

  if (geometry.type === "MultiPolygon") {
    geometry.coordinates.forEach(rewindPolygonForD3);
  }
}

function rewindPolygonForD3(polygonCoordinates = []) {
  polygonCoordinates.forEach((ring, ringIndex) => {
    const area = getPlanarRingSignedArea(ring);
    if (!Number.isFinite(area) || area === 0) return;

    const isClockwise = area < 0;
    const shouldBeClockwise = ringIndex === 0;

    if (isClockwise !== shouldBeClockwise) ring.reverse();
  });
}

function simplifyFeatureGeometry(feature, level) {
  const tolerance = GEOMETRY_SIMPLIFY_TOLERANCE_BY_LEVEL[level] ?? 0;
  const geometry = feature?.geometry;
  if (!geometry || tolerance <= 0) return;

  if (geometry.type === "Polygon") {
    simplifyPolygonGeometry(geometry.coordinates, tolerance);
    return;
  }

  if (geometry.type === "MultiPolygon") {
    geometry.coordinates.forEach((polygon) =>
      simplifyPolygonGeometry(polygon, tolerance),
    );
  }
}

function simplifyPolygonGeometry(polygonCoordinates = [], tolerance) {
  polygonCoordinates.forEach((ring, ringIndex) => {
    const simplifiedRing = simplifyClosedRing(ring, tolerance);
    if (simplifiedRing.length >= 4) polygonCoordinates[ringIndex] = simplifiedRing;
  });
}

function simplifyClosedRing(ring = [], tolerance) {
  if (ring.length <= 8) return ring;

  const isClosed = areCoordinatePairsEqual(ring[0], ring[ring.length - 1]);
  const openRing = isClosed ? ring.slice(0, -1) : ring.slice();
  const simplified = simplifyDouglasPeucker(openRing, tolerance * tolerance);

  if (simplified.length < 3) return ring;
  if (isClosed) simplified.push([...simplified[0]]);

  return simplified;
}

function simplifyDouglasPeucker(points, sqTolerance) {
  if (points.length <= 2) return points;

  const keep = new Uint8Array(points.length);
  const stack = [[0, points.length - 1]];
  keep[0] = 1;
  keep[points.length - 1] = 1;

  while (stack.length) {
    const [first, last] = stack.pop();
    let maxSqDistance = 0;
    let indexToKeep = 0;

    for (let index = first + 1; index < last; index += 1) {
      const sqDistance = getSqSegDist(points[index], points[first], points[last]);
      if (sqDistance > maxSqDistance) {
        indexToKeep = index;
        maxSqDistance = sqDistance;
      }
    }

    if (maxSqDistance > sqTolerance) {
      keep[indexToKeep] = 1;
      stack.push([first, indexToKeep], [indexToKeep, last]);
    }
  }

  return points.filter((_, index) => keep[index]);
}

function getSqSegDist(point, start, end) {
  let x = Number(start?.[0]);
  let y = Number(start?.[1]);
  let dx = Number(end?.[0]) - x;
  let dy = Number(end?.[1]) - y;

  if (dx !== 0 || dy !== 0) {
    const t =
      ((Number(point?.[0]) - x) * dx + (Number(point?.[1]) - y) * dy) /
      (dx * dx + dy * dy);

    if (t > 1) {
      x = Number(end?.[0]);
      y = Number(end?.[1]);
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  dx = Number(point?.[0]) - x;
  dy = Number(point?.[1]) - y;

  return dx * dx + dy * dy;
}

function areCoordinatePairsEqual(a, b) {
  return Number(a?.[0]) === Number(b?.[0]) && Number(a?.[1]) === Number(b?.[1]);
}

function getPlanarRingSignedArea(ring = []) {
  let area = 0;

  for (
    let index = 0, prevIndex = ring.length - 1;
    index < ring.length;
    prevIndex = index, index += 1
  ) {
    const [prevX, prevY] = ring[prevIndex] ?? [];
    const [x, y] = ring[index] ?? [];

    area += Number(prevX) * Number(y) - Number(x) * Number(prevY);
  }

  return area / 2;
}

async function loadReferenceDataForLevel(level) {
  if (level === DATA_LEVELS.COUNTY) {
    return {
      countyToRegion: await loadJsonOnce(SC_COUNTY_TO_REGION_URL),
    };
  }

  if (level === DATA_LEVELS.ZCTA) {
    const [countyToRegion, zipToCounty] = await Promise.all([
      loadJsonOnce(SC_COUNTY_TO_REGION_URL),
      loadJsonOnce(SC_ZIP_TO_COUNTY_URL),
    ]);

    return { countyToRegion, zipToCounty };
  }

  return {};
}

async function loadJsonOnce(url) {
  if (!referenceDataCache.has(url)) {
    referenceDataCache.set(
      url,
      fetch(url).then(async (response) => {
        if (!response.ok) throw new Error(`Failed to load ${url}`);
        return response.json();
      }),
    );
  }

  return referenceDataCache.get(url);
}

function normalizeLevel(level) {
  const normalized = String(level ?? "").toLowerCase();
  if (normalized === DATA_LEVELS.REGION) return DATA_LEVELS.REGION;
  if (normalized === DATA_LEVELS.COUNTY) return DATA_LEVELS.COUNTY;
  if (normalized === DATA_LEVELS.ZCTA || normalized === "zip") {
    return DATA_LEVELS.ZCTA;
  }

  return DATA_LEVELS.REGION;
}

function getMapAuthoringConfig() {
  if (typeof window !== "undefined" && window.mapAuthoringConfig) {
    return window.mapAuthoringConfig;
  }
  if (typeof globalThis !== "undefined" && globalThis.mapAuthoringConfig) {
    return globalThis.mapAuthoringConfig;
  }

  return {};
}

function toId(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getReferenceValue(referenceMap = {}, key) {
  const lookup = referenceMap ?? {};
  const normalizedKey = toId(key).replaceAll("-", "_");
  const directValue = lookup[key] ?? lookup[normalizedKey];
  if (directValue !== undefined) return directValue;

  const matchedKey = Object.keys(lookup).find(
    (candidateKey) => toId(candidateKey) === toId(key),
  );

  return matchedKey ? lookup[matchedKey] : undefined;
}

function formatDiseaseLabel(id) {
  return String(id ?? "")
    .split("-")
    .filter(Boolean)
    .map((part) =>
      part.length <= 3
        ? part.toUpperCase()
        : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(" ");
}

function formatCompactDiseaseLabel(label) {
  const words = String(label ?? "").split(/\s+/).filter(Boolean);
  if (words.length <= 3) return label;

  return `${words.slice(0, 3).join(" ")}...`;
}
