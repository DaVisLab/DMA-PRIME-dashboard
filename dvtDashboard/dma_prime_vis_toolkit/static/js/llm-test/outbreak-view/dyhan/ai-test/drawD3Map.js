import { data } from "./infoManager.js";
import { summarizeVegaLiteSpecGeneral } from "./helper.js";

export function makePath(width, height, geojson, projName = "mercator") {
  const projections = {
    mercator: d3.geoMercator(),
    naturalEarth1: d3.geoNaturalEarth1(),
    albersUsa: d3.geoAlbersUsa(), // best for US states/counties
    identity: d3.geoIdentity().reflectY(true),
  };

  const projection = projections[projName] || projections.mercator;
  console.log(projection);
  console.log(
    "projection scale/translate:",
    projection.scale(),
    projection.translate(),
  );

  projection.fitSize([width, height], geojson);
  // const projection = d3.geoMercator().fitSize([width, height], geojson);
  return d3.geoPath(projection);
}

export async function drawD3Map(
  spatialData,
  containerID,
  { projection: projName = "identity", mapStyle = {} } = {},
) {
  console.log("Drawing D3 Map...");
  const visContainer = document.getElementById(containerID);

  const containerSizeInfo = visContainer.getBoundingClientRect();
  const height = containerSizeInfo.height;
  const width = containerSizeInfo.width;

  d3.select(visContainer).selectAll("*").remove();

  const svg = d3
    .select(visContainer)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const features =
    spatialData.type === "FeatureCollection"
      ? spatialData.features
      : [spatialData];

  // Path generator
  const path = makePath(width, height, spatialData, projName);
  console.log(features);

  // ---- Draw ----
  svg.selectAll("*").remove(); // clear previous

  const g = svg.append("g").attr("class", "geomap");

  const vals = spatialData.features
    .map((d) => d.properties.valueOfInterest)
    .flat();

  const colorTheme = getColorTheme(vals, "sequential", "category");

  g.selectAll("path.geom")
    .data(features)
    .join("path")
    .attr("class", "geom")
    .attr("id", (d) => {
      return `map-path-${d.nameID}`;
    })
    .attr("d", path)
    .attr("fill", (d) => {
      const latestVal =
        d.properties.valueOfInterest[d.properties.valueOfInterest.length - 1];
      return colorTheme(latestVal);
    })
    .attr("stroke", "black")
    .attr("stroke-width", 1)
    .on("mouseover", (event, d) => {
      const targetID = `map-path-${d.nameID}`;
      highlightArea(targetID);
    })
    .on("mouseleave", (event, d) => {
      const targetID = `map-path-${d.nameID}`;
      dehighlightArea(targetID);
    });

  function highlightArea(targetID) {
    d3.selectAll(`path.geom`).sort(function (a, b) {
      const isA = targetID.includes(a.nameID);
      const isB = targetID.includes(b.nameID);
      return isA === isB ? 0 : isA ? 1 : -1;
    });

    d3.select(`#${targetID}`).attr("stroke", "blue");
  }

  function dehighlightArea(targetID) {
    d3.select(`#${targetID}`).attr("stroke", "black");
  }
  return { svg, g, path };
}

export function getColorTheme(
  vals,
  colorDataType,
  colorScaleType,
  feature = null,
) {
  let min, max;

  // console.log(vals);

  if (feature == null) {
    vals = vals
      .filter(Number.isFinite)
      .filter((d) => d > 0 && d !== null && d !== undefined);
    [min, max] = d3.extent(vals);
  } else {
    let curValues = vals
      .map((d) => +d[feature])
      .filter(Number.isFinite)
      .filter((d) => d > 0 && d !== null && d !== undefined);
  }

  if (colorDataType == "sequential") {
    if (colorScaleType == "continuous") {
      // test red
      return d3.scaleSequential(d3.interpolateReds).domain([min, max]);
    } else {
      return d3.scaleQuantize().domain([min, max]).range(d3.schemeReds[5]);
    }
  } else if (colorDataType == "diverging") {
    if (colorScaleType == "continuous") {
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
