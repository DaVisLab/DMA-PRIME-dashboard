const d3 = window.d3;

// Shared helpers for bubble-map IDs, color scales, legends, and geometry math.
const stateMap = new Map([
  ["Alabama", "AL"],
  ["Alaska", "AK"],
  ["Arizona", "AZ"],
  ["Arkansas", "AR"],
  ["California", "CA"],
  ["Colorado", "CO"],
  ["Connecticut", "CT"],
  ["Delaware", "DE"],
  ["Florida", "FL"],
  ["Georgia", "GA"],
  ["Hawaii", "HI"],
  ["Idaho", "ID"],
  ["Illinois", "IL"],
  ["Indiana", "IN"],
  ["Iowa", "IA"],
  ["Kansas", "KS"],
  ["Kentucky", "KY"],
  ["Louisiana", "LA"],
  ["Maine", "ME"],
  ["Maryland", "MD"],
  ["Massachusetts", "MA"],
  ["Michigan", "MI"],
  ["Minnesota", "MN"],
  ["Mississippi", "MS"],
  ["Missouri", "MO"],
  ["Montana", "MT"],
  ["Nebraska", "NE"],
  ["Nevada", "NV"],
  ["New Hampshire", "NH"],
  ["New Jersey", "NJ"],
  ["New Mexico", "NM"],
  ["New York", "NY"],
  ["North Carolina", "NC"],
  ["North Dakota", "ND"],
  ["Ohio", "OH"],
  ["Oklahoma", "OK"],
  ["Oregon", "OR"],
  ["Pennsylvania", "PA"],
  ["Rhode Island", "RI"],
  ["South Carolina", "SC"],
  ["South Dakota", "SD"],
  ["Tennessee", "TN"],
  ["Texas", "TX"],
  ["Utah", "UT"],
  ["Vermont", "VT"],
  ["Virginia", "VA"],
  ["Washington", "WA"],
  ["West Virginia", "WV"],
  ["Wisconsin", "WI"],
  ["Wyoming", "WY"],
  ["District Of Columbia", "DC"],
]);

function getStandardizedName(str) {
  return String(str ?? "")
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
export function getAbbreviationFromFullName(stateName) {
  const standardizedName = getStandardizedName(stateName);

  if (stateMap.has(standardizedName)) {
    return stateMap.get(standardizedName);
  }

  return null;
}

export function makeViewportCenterGetter(svgEl, el) {
  // Returns center in "viewport coords", accounting for the current zoom/pan.
  return () => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;

    const pt = svgEl.createSVGPoint();
    pt.x = cx;
    pt.y = cy;

    const ctm = svgEl.getScreenCTM();
    if (!ctm) return [0, 0];

    const pSvg = pt.matrixTransform(ctm.inverse());

    const t = d3.zoomTransform(svgEl);
    return [t.invertX(pSvg.x), t.invertY(pSvg.y)];
  };
}

export function getMagnitude(vector) {
  const sumOfSquares = vector.reduce(
    (sum, component) => sum + component * component,
    0,
  );
  return Math.sqrt(sumOfSquares);
}

export function getUnitVector(p, c) {
  const [x1, y1] = p;
  const [x2, y2] = c;
  const vector = [x2 - x1, y2 - y1];

  const magnitude = getMagnitude(vector);
  if (magnitude === 0) return [0, 0];
  const unitVector = vector.map((component) => component / magnitude);

  return unitVector;
}

function getPositiveLogDomain(values) {
  const positives = values
    .map((d) => +d)
    .filter((d) => Number.isFinite(d) && d > 0);

  if (!positives.length) return [0, 1];

  let [min, max] = d3.extent(positives);
  min = Math.log10(safeMinPos(min, max));
  max = Math.log10(max);

  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) return [min, min + 1];
  return [min, max];
}

export function getColorTheme(
  vals,
  colorDataType,
  colorScaleType,
  feature = null,
) {
  const values =
    feature === null ? vals : vals.map((d) => d?.[feature]);

  const [min, max] = getPositiveLogDomain(values);

  if (colorDataType === "sequential") {
    if (colorScaleType === "continuous") {
      return d3.scaleSequential(d3.interpolateReds).domain([min, max]);
    } else {
      return d3.scaleQuantize().domain([min, max]).range(d3.schemeReds[5]);
    }
  } else if (colorDataType === "diverging") {
    if (colorScaleType === "continuous") {
      return d3
        .scaleDiverging()
        .domain([min, (min + max) / 2, max])
        .interpolator(d3.interpolateRgbBasis(["blue", "white", "red"]));
    } else {
      return d3
        .scaleQuantize()
        .domain([min, max])
        .range(d3.schemeRdBu[5].reverse());
    }
  } else {
    return d3
      .scaleQuantize()
      .domain([min, max])
      .range(["#e41a1c", "#377eb8", "#4daf4a", "#984ea3", "#ff7f00"]);
  }
}
const EPS = 1e-9;

const safeMinPos = (min, max) => {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return 1;
  if (max <= 0) return 1;
  if (min <= 0) return Math.min(max, EPS);
  return min;
};

export function drawColorLegend(
  svgEl,
  colorTheme,
  {
    title = "",
    width = 300,
    height = 60,
    margin = { top: 6, right: 12, bottom: 24, left: 12 },
    ticks = 5,
    tickFormat = undefined,
    orient = "horizontal",
  } = {},
) {
  if (!svgEl || !colorTheme) return;

  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;
  const g = svgEl;

  const dom = colorTheme.domain();

  const d0 = dom[0],
    d1 = dom[dom.length - 1];

  const defs = g.append("defs");
  const gradId = "grad-" + Math.random().toString(36).slice(2);

  const grad = defs.append("linearGradient").attr("id", gradId);
  if (orient === "horizontal") {
    grad.attr("x1", "0%").attr("x2", "100%").attr("y1", "0%").attr("y2", "0%");
  } else {
    grad.attr("x1", "0%").attr("x2", "0%").attr("y1", "100%").attr("y2", "0%");
  }

  const N = 128;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const v = d0 + t * (d1 - d0);
    grad
      .append("stop")
      .attr("offset", `${t * 100}%`)
      .attr("stop-color", colorTheme(v));
  }

  if (orient === "horizontal") {
    const barH = Math.min(16, h / 2);
    g.append("rect")
      .attr("x", 0)
      .attr("y", 12)
      .attr("width", w)
      .attr("height", barH)
      .attr("fill", `url(#${gradId})`)
      .attr("stroke", "#333")
      .attr("stroke-width", 0.3);

    const x = d3.scaleLinear().domain([d0, d1]).range([0, w]);
    const ax =
      typeof tickFormat === "function"
        ? d3.axisBottom(x).ticks(ticks).tickFormat(tickFormat)
        : d3.axisBottom(x).ticks(ticks, tickFormat);
    g.append("g")
      .attr("transform", `translate(0, ${12 + barH})`)
      .call(ax);
  } else {
    const barW = 16,
      x0 = 0,
      y0 = 0;
    g.append("rect")
      .attr("x", x0)
      .attr("y", y0)
      .attr("width", barW)
      .attr("height", h)
      .attr("fill", `url(#${gradId})`)
      .attr("stroke", "#333")
      .attr("stroke-width", 0.3);

    const y = d3.scaleLinear().domain([d0, d1]).range([h, 0]);
    const ay =
      typeof tickFormat === "function"
        ? d3.axisRight(y).ticks(ticks).tickFormat(tickFormat)
        : d3.axisRight(y).ticks(ticks, tickFormat);
    g.append("g")
      .attr("transform", `translate(${x0 + barW}, 0)`)
      .call(ay);
  }
}

function stringToHtmlId(str) {
  // Replace non-alphanumeric characters (except hyphens and underscores) with a hyphen
  let id = String(str ?? "").toLowerCase().replace(/[^a-z0-9-_]+/g, "-");

  // Trim leading and trailing hyphens
  id = id.replace(/^-+|-+$/g, "");

  // Ensure the ID doesn't start with a number (prefix with a letter if needed)
  if (/^[0-9]/.test(id)) {
    id = "id-" + id;
  }

  return id;
}

export function preprocessingGeoJSON(geo, mapResolution) {
  geo.features.forEach((d) => {
    d.properties.ID = stringToHtmlId(getNameByMapResolution(d, mapResolution));
  });

  return geo;
}

export const getNameByMapResolution = (d, mapResolution) => {
  if (mapResolution === "REGION" || mapResolution === "DIVISION") {
    return `${d.properties?.id ?? d.properties?.name ?? d.properties?.NAME}`;
  }

  if (mapResolution === "all state in US" || mapResolution === "COUNTRY") {
    return getNameForStateJSON(d);
  }
  if (
    mapResolution === "all counties in US" ||
    mapResolution === "US county" ||
    mapResolution === "STATE"
  ) {
    return getNameForCountyMap(d);
  }

  if (
    mapResolution === "all zips in US" ||
    mapResolution === "US zip" ||
    mapResolution === "COUNTY"
  ) {
    return getNameForZipcodeMap(d);
  }

  return null;
};

const getNameForStateJSON = (d) => {
  return `${d.properties.NAME ?? d.properties.name ?? d.properties.id}`;
};

const getNameForCountyMap = (d) => {
  return `${
    d.properties?.id ??
    `${d.properties?.STATEFP ?? d.id}-${d.properties?.COUNTYFP ?? d.id}`
  }`;
};

const getNameForZipcodeMap = (d) => {
  return `${
    d.properties.id ??
    d.properties.ZCTA5CE10 ??
    d.properties.ZCTA5CE ??
    d.properties.name
  }`;
};
