
export {getColorTheme, drawSimpleMap, drawSimpleBoundaryMap}

let zipGeoJson = null;
let countyGeoJson = null;
let countyPopulationJson = null;
let zipPopulationJson = null;
let prevRegionType = null;
let mapTurfPolygonHistory = [];

const spatialHierarchy = {
  state: 1,
  region: 2,
  county: 3,
  zcta: 4,
};

function cssSafe(s) {
  return String(s).replace(/[^a-z0-9\-_]/gi, "_");
}

function loadGeoJSON() {
  return fetch("static/assets/GeoJSON/tl_2024_sc_zcta_simplified.json")
    .then((response) => response.json())
    .then((data) => {
      zipGeoJson = data;
    });
}

function loadCountyGeoJSON() {
  return fetch("static/assets/GeoJSON/tl_2024_sc_county_simplified.json")
    .then((response) => response.json())
    .then((data) => {
      countyGeoJson = data;
    });
}

function loadCountyPopulationJSON() {
  return fetch("static/assets/dyhan-population-data/SC_county_population.json")
    .then((response) => response.json())
    .then((data) => {
      countyPopulationJson = data;
    });
}

function loadZIPPopulationJSON() {
  return fetch("static/assets/dyhan-population-data/SC_zip_population.json")
    .then((response) => response.json())
    .then((data) => {
      zipPopulationJson = data;
    });
}

function getColorTheme(vals, feature = null) {
  let min, max;
  if (feature == null) {
    [min, max] = d3.extent(vals);
  } else {
    let curValues = vals.map((d) => +d[feature]).filter(Number.isFinite);

    [min, max] = d3.extent(curValues);
  }

  let colorDataType = document.getElementById("data-type-picker").value;
  let colorScaleType = document.getElementById("scale-type-picker").value;

  if (colorDataType == "sequential") {
    if (colorScaleType == "continuous") {
      // test red
      return d3.scaleSequential(d3.interpolateReds).domain([min, max]);
    } else {
      return d3.scaleQuantize().domain([min, max]).range(d3.schemeReds[5]);
    }
  } else if (colorDataType == "divergent") {
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
    document.getElementById("scale-type-picker").value = "discrete";
    return d3
      .scaleQuantize()
      .domain([min, max])
      .range(["#e41a1c", "#377eb8", "#4daf4a", "#984ea3", "#ff7f00"]);
  }

  return d3.scaleSequential(d3.interpolateViridis).domain([min, max]);
}
const dataTypePicker = document.getElementById("data-type-picker");
const scaleTypePicker = document.getElementById("scale-type-picker");
let prevGeoInfo;
let curGeoInfo;
let colorDataType;
let colorScaleType;

// let svg = d3
//   .select("#test-div")
//   .append("svg")
//   .attr("width", 800)
//   .attr("height", 800);

// Promise.all([
//   loadGeoJSON(),
//   loadCountyGeoJSON(),
//   loadCountyPopulationJSON(),
//   loadZIPPopulationJSON(),
// ])
//   .then(() => {
//     // console.log(d3.select("#mapRegionSelector"));
//     // console.log(mapRegionSelector.value)
//     prevRegionType = mapRegionSelector.value;

//     prevGeoInfo = null;
//     colorDataType = dataTypePicker.value;
//     colorScaleType = scaleTypePicker.value;

//     curGeoInfo = {
//       type: mapRegionSelector.value,
//       geoJson: mapRegionSelector.value == "zcta" ? zipGeoJson : countyGeoJson,
//       populationJson:
//         mapRegionSelector.value == "zcta"
//           ? zipPopulationJson
//           : countyPopulationJson,
//     };

//     drawSimpleAnimationMap(curGeoInfo, prevGeoInfo);
//   })
//   .catch(console.error);

// dataTypePicker.addEventListener("sl-change", (e) => {
//   console.log(e.target.value);
// });

// [dataTypePicker, scaleTypePicker].forEach((selecter) => {
//   selecter.addEventListener("sl-change", (e) => {
//     svg.selectAll("*").remove();

//     if (selecter == dataTypePicker) {
//       if (e.target.value == "categorical") {
//         scaleTypePicker.value = "discrete";
//         colorDataType = e.target.value;
//       }
//     }

//     if (selecter == scaleTypePicker) {
//       colorScaleType = e.target.value;
//     }

//     console.log(curGeoInfo);
//     drawSimpleMap(curGeoInfo);
//   });
// });

// mapRegionSelector.addEventListener("sl-change", (e) => {
//   svg.selectAll("*").remove();

//   prevGeoInfo = {
//     type: prevRegionType,
//     geoJson: prevRegionType == "zcta" ? zipGeoJson : countyGeoJson,
//     populationJson:
//       prevRegionType == "zcta" ? zipPopulationJson : countyPopulationJson,
//   };

//   curGeoInfo = {
//     type: e.target.value,
//     geoJson: e.target.value == "zcta" ? zipGeoJson : countyGeoJson,
//     populationJson:
//       e.target.value == "zcta" ? zipPopulationJson : countyPopulationJson,
//   };

//   drawSimpleAnimationMap(curGeoInfo, prevGeoInfo);

//   prevRegionType = e.target.value;
// });

function drawSimpleAnimationMap(curGeoInfo, prevGeoInfo) {
  if (prevGeoInfo == null) {
    drawSimpleMap(curGeoInfo);
    return;
  }

  // 1. get which geoInfo is hierarhically higher rank
  const curGeoRank = spatialHierarchy[curGeoInfo.type];
  const prevGeoRank = spatialHierarchy[prevGeoInfo.type];

  const higherRankGeoInfo = curGeoRank < prevGeoRank ? curGeoInfo : prevGeoInfo;
  const lowerRankGeoInfo = curGeoRank > prevGeoRank ? curGeoInfo : prevGeoInfo;

  // console.log(lowerRankGeoInfo.populationJson)
  // console.log(d3.groups(lowerRankGeoInfo.populationJson, f=>f.county))

  const mapHigh2LowArea = {};
  const higherRankRegions = higherRankGeoInfo.geoJson.features.map(
    (item) => item.properties.NAME
  );

  for (let region of higherRankRegions) {
    mapHigh2LowArea[region] = lowerRankGeoInfo.populationJson
      .filter((item) => item[higherRankGeoInfo.type] == region)
      .map((item) => item["zip"]);
  }

  const projection = d3.geoMercator().fitSize([800, 800], curGeoInfo.geoJson);
  const path = d3.geoPath(projection);

  // cur geo json setting
  const curGeojson = curGeoInfo.geoJson;
  const curPopulationJson = curGeoInfo.populationJson;

  const curColorTheme = getColorTheme(curPopulationJson, "population");

  legendContinuous("#legend", curColorTheme, { title: "Value", ticks: 6 });

  // prev geo json setting
  const prevGeojson = prevGeoInfo.geoJson;

  const prevColorTheme = getColorTheme(
    prevGeoInfo.populationJson,
    "population"
  );

  // Layer per region
  const gRegions = svg.append("g").attr("class", "regions");
  const gRegion = gRegions
    .selectAll("g.region")
    .data(higherRankRegions)
    .join("g")
    .attr("class", (d) => `region region-${cssSafe(d)}`);

  if (curGeoInfo.type == higherRankGeoInfo.type) {
    // drill up
  } else {
    // drill down

    // For each region, create county paths (stroke) and invisible fill paths to fade in
    gRegion.each(function (d) {
      const g = d3.select(this);

      const lowerRegionNames = mapHigh2LowArea[d];

      const feats = lowerRankGeoInfo.geoJson.features.filter((item) =>
        lowerRegionNames.includes(+item.properties.ZCTA)
      );

      // stroke paths (for "draw" effect)
      g.selectAll("path.county")
        .data(feats)
        .join("path")
        .attr("class", "county")
        .attr("d", path)
        .attr("fill", "None")
        .attr("stroke", "black")
        .attr("stroke-width", 0.7);
      // .attr("stroke", regionColors(regionName));

      // fill paths to fade in after stroke draws
      g.selectAll("path.county-fill")
        .data(feats)
        .join("path")
        .attr("class", "county-fill")
        .attr("d", path)
        .attr("fill-opacity", 0)
        // .attr("fill", "red");
        .attr("fill", (d) => {
          if (curGeoInfo.type == "zcta") {
            return curColorTheme(
              curPopulationJson.find((p) => +p.zip === +d.properties.ZCTA)
                ?.population
            );
          } else {
            return curColorTheme(
              curPopulationJson.find((p) => p.county === d.properties.NAME)
                ?.population
            );
          }
        });
    });

    // --- animation controller ---
    const gap0 = 600; // ms: delay between counties *within* a region
    const gapDecay = 0.7;

    function animate({ simultaneous = true } = {}) {
      // region start offset: 0 for simultaneous; else stagger by index
      const regionStart = (ri) => 0;

      gRegion.each(function (d, ri) {
        const lowerRegionNames = mapHigh2LowArea[d];

        const feats = lowerRankGeoInfo.geoJson.features.filter((item) =>
          lowerRegionNames.includes(+item.properties.ZCTA)
        );

        // order counties within a region (e.g., by area descending so big shapes first)
        const ordered = feats
          .map((f, i) => ({
            f,
            i,
            val: curGeoInfo.populationJson.filter(
              (p) => f.properties.ZCTA == p.zip
            )[0].population,
          }))
          .sort((r1, r2) => r2.val - r1.val)
          .map((d) => d.f);

        const n = ordered.length;

        const schedule = new Array(n);

        let t = regionStart(ri);

        for (let i = 0; i < n; i++) {
          schedule[i] = t; // i번째 시작 시각
          t += gap0 * Math.pow(gapDecay, i);
        }

        const countiesFill = d3
          .select(this)
          .selectAll("path.county-fill")
          .data(ordered, (d) => d.properties.ZCTA);

        countiesFill
          .attr("fill-opacity", 0)
          .transition()
          .delay((d, i) => schedule[i])
          // .delay((d, i) => schedule[i] + 0.7 * drawDur0 * Math.pow(durDecay, i))
          .duration(250)
          .attr("fill-opacity", 1);
      });
    }

    // initial run: simultaneous per-region sequences
    animate({ simultaneous: true });
  }

  //   const color = d3.scaleSequential(d3.interpolateViridis).domain([0, 100]);

  // --- 3) Draw the GeoJSON features ---

  // const turfPolys = geojson.features.map((f) => {
  //   if (f.geometry.type == "Polygon") {
  //     return turf.polygon(f.geometry.coordinates, f.properties);
  //   } else {
  //     // console.log(f)
  //     // return turf.polygon(f.geometry.coordinates[0], f.properties);
  //     return turf.multiPolygon(f.geometry.coordinates, f.properties);
  //   }
  // });

  // const firstDelay = 150;
  // const decay = 0.7;

  // const layer = svg.append("g").attr("class", "subregions");
  // const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // DrawSubRegions(firstDelay, decay);

  // turfPolys.sort((r1, r2) => {
  //   return (
  //     curGeoInfo.populationJson.filter((p) => r2.properties.NAME == p.county)[0]
  //       .population -
  //     curGeoInfo.populationJson.filter((p) => r1.properties.NAME == p.county)[0]
  //       .population
  //   );
  // });

  async function DrawSubRegions(firstDelay, decay) {
    let gap = firstDelay;

    for (let i = 0; i < turfPolys.length; i++) {
      await sleep(gap);

      layer
        .append("path")
        .datum(turfPolys[i])
        .attr("d", path)
        .attr("fill", (d) => {
          if (curGeoInfo.type == "zcta") {
            return color(
              populationJson.find((p) => +p.zip === +d.properties.ZCTA)
                ?.population
            );
          } else {
            return color(
              populationJson.find((p) => p.county === d.properties.NAME)
                ?.population
            );
          }
        })
        .attr("stroke", "#222")
        .attr("stroke-width", 0.6)
        .attr("opacity", 0)
        .attr("transform", "scale(0.9)")
        .transition()
        .duration(500)
        .ease(d3.easeCubicOut) // easing within each reveal
        .attr("opacity", 1)
        .attr("transform", "scale(1)");

      gap *= decay;
    }
  }
}

function drawSimpleMap(curGeoInfo) {
  const projection = d3.geoMercator().fitSize([800, 800], curGeoInfo.geoJson);
  const path = d3.geoPath(projection);

  const geojson = curGeoInfo.geoJson;
  const populationJson = curGeoInfo.populationJson;

  // Build a continuous color scale (Viridis)
  const values = populationJson
    .map((d) => +d.population)
    .filter(Number.isFinite);
  const [min, max] = d3.extent(values);

  const color = getColorTheme(populationJson, "population");

  //   const color = d3.scaleSequential(d3.interpolateViridis).domain([0, 100]);
  legendContinuous("#legend", color, { title: "Value", ticks: 6 });
  // --- 3) Draw the GeoJSON features ---

  const turfPolys = geojson.features.map((f) => {
    if (f.geometry.type == "Polygon") {
      return turf.polygon(f.geometry.coordinates, f.properties);
    } else {
      // console.log(f)
      // return turf.polygon(f.geometry.coordinates[0], f.properties);
      return turf.multiPolygon(f.geometry.coordinates, f.properties);
    }
  });

  svg
    .selectAll("path.feature")
    .data(turfPolys)
    .join("path")
    // .attr("class", (d) => {
    //   return `feature zip-${d.properties.ZCTA}`;
    // })
    .attr("d", (d) => path(d))
    // .attr("fill", "lightgrey")
    .attr("fill", (d) => {
      if (curGeoInfo.type == "zcta") {
        return color(
          populationJson.find((p) => +p.zip === +d.properties.ZCTA)?.population
        );
      } else {
        return color(
          populationJson.find((p) => p.county === d.properties.NAME)?.population
        );
      }
    })
    .attr("stroke", "white");
}

function drawSimpleBoundaryMap(svg, curGeoInfo) {
  const projection = d3.geoMercator().fitSize([800, 800], curGeoInfo.geoJson);
  const path = d3.geoPath(projection);

  const geojson = curGeoInfo.geoJson;
  const populationJson = curGeoInfo.populationJson;


  // --- 3) Draw the GeoJSON features ---

  const turfPolys = geojson.features.map((f) => {
    if (f.geometry.type == "Polygon") {
      return turf.polygon(f.geometry.coordinates, f.properties);
    } else {
      // console.log(f)
      // return turf.polygon(f.geometry.coordinates[0], f.properties);
      return turf.multiPolygon(f.geometry.coordinates, f.properties);
    }
  });

  svg
    .selectAll("path.feature")
    .data(turfPolys)
    .join("path")
    // .attr("class", (d) => {
    //   return `feature zip-${d.properties.ZCTA}`;
    // })
    .attr("d", (d) => path(d))
    // .attr("fill", "lightgrey")
    .attr("fill", 'None')
    .attr("stroke", "black");
}

function legendContinuous(
  selector,
  color,
  {
    title = "",
    width = 300,
    height = 60,
    margin = { top: 6, right: 12, bottom: 24, left: 12 },
    ticks = 5,
    tickFormat = undefined,
    orient = "horizontal", // "horizontal" | "vertical"
  } = {}
) {
  const svg = d3.select(selector).attr("width", width).attr("height", height);
  svg.selectAll("*").remove();

  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;
  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  //   if (title) {
  //     g.append("text")
  //       .attr("x", 0)
  //       .attr("y", -2)
  //       .attr("font-size", 12)
  //       .attr("dominant-baseline", "hanging")
  //       .text(title);
  //   }

  // domain can be [min,max] or reversed
  const dom = color.domain();

  const d0 = dom[0],
    d1 = dom[dom.length - 1];

  const defs = svg.append("defs");
  const gradId = "grad-" + Math.random().toString(36).slice(2);

  const grad = defs.append("linearGradient").attr("id", gradId);
  if (orient === "horizontal") {
    grad.attr("x1", "0%").attr("x2", "100%").attr("y1", "0%").attr("y2", "0%");
  } else {
    grad.attr("x1", "0%").attr("x2", "0%").attr("y1", "100%").attr("y2", "0%");
  }

  // sample the scale to build smooth gradient stops
  const N = 128;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const v = d0 + t * (d1 - d0);
    grad
      .append("stop")
      .attr("offset", `${t * 100}%`)
      .attr("stop-color", color(v));
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
    const ax = d3.axisBottom(x).ticks(ticks, tickFormat);
    g.append("g")
      .attr("transform", `translate(0, ${12 + barH})`)
      .call(ax);
  } else {
    // vertical
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
    const ay = d3.axisRight(y).ticks(ticks, tickFormat);
    g.append("g")
      .attr("transform", `translate(${x0 + barW}, 0)`)
      .call(ay);
  }
}
