function test(svg) {
  console.log("test");

  const g = svg.append("g");
  const bufferG = svg.append("g")

  const polyA = turf.polygon(
    [
      [
        [-2, -2],
        [3, -3],
        [3, 3],
        [-3, 3],
        [-2, -2],
      ],
    ],
    { name: "A" }
  );

  // B: a triangle a bit to the east/north
  const polyB = turf.polygon(
    [
      [
        [-0.5, 0.0], // move further west
        [1.0, 2.0], // move further east/north
        [0.7, -2.0], // move further south
        [-0.5, 0.0], // close ring
      ],
    ],
    { name: "B" }
  );

  const projection = d3.geoIdentity(); // simple
  const path = d3.geoPath(projection);

  // UI elements
  const radiusEl = document.getElementById("radius");
  const rvalEl = document.getElementById("rval");

  const featuresToFit = [polyA, polyB];

  projection.fitExtent(
    [
      [10, 10],
      [790, 790],
    ],
    turf.featureCollection(featuresToFit)
  );

  function draw(bufferKm) {
    g.selectAll("*").remove();

    // 1) Make buffer around B
    const bufferedB = turf.buffer(polyB, bufferKm, {
      units: "kilometers",
      steps: 64,
    });

    const clipped = turf.intersect(bufferedB, polyA);

    const isCovered = turf.booleanContains(bufferedB, polyA);

    if (isCovered) {
      console.log("all covered");
    }

    // 4) Draw the ring (white) or fallback buffer
    g.append("path")
      .attr("d", path(clipped))
      .attr("fill", "blue")
      .attr("stroke", "red")
      .attr("stroke-width", 1.5);

    // 5) Draw B (inside) as blue
    g.append("path")
      .attr("d", path(polyB))
      .attr("fill", "blue")
      .attr("stroke", "blue")
      .attr("stroke-width", 1.5);

    // (Optional) Draw A so you can see both shapes
    g.append("path")
      .attr("d", path(polyA))
      .attr("fill", "rgba(76,175,80,0.45)")
      .attr("stroke", "white")
      .attr("stroke-width", 1.5);
  }

  function recompute() {
    const km = +radiusEl.value;
    rvalEl.textContent = km;
    draw(km);
  }

  // Initial render + slider
  recompute();
  radiusEl.addEventListener("input", recompute);
}

let zipGeoJson = null;
let countyGeoJson = null;

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

let svg = d3
  .select("#test-div")
  .append("svg")
  .attr("width", 800)
  .attr("height", 800);

Promise.all([loadGeoJSON(), loadCountyGeoJSON()])
  .then(() => {
    testWork(zipGeoJson, countyGeoJson);
  })
  .catch(console.error);

function testWork(zipGeoJson, countyGeoJson) {
  // draw zip data
  console.log(zipGeoJson);
  console.log(countyGeoJson);
  // Mercator projection is fine here; coordinates are [lon, lat].
  // Fit the projection to the FeatureCollection so it fills the viewport nicely.
  // const projection = d3.geoIdentity().fitSize([800, 800], zipGeoJson);
  const projection = d3.geoMercator().fitSize([800, 800], zipGeoJson);
  const path = d3.geoPath(projection);

  // --- 3) Draw the GeoJSON features ---
  svg
    .selectAll("path.feature")
    .data(zipGeoJson.features)
    .join("path")
    .attr("class", (d) => {
      return `feature zip-${d.properties.ZCTA}`;
    })
    .attr("d", (d) => path(d))
    .attr("fill", "lightgrey")
    .attr("stroke", "white");

  // --- 4) Make Turf polygons from features (and a buffer example) ---
  // Convert each feature's geometry into a Turf polygon (though your features already are valid GeoJSON).
  const turfPolys = zipGeoJson.features.map((f) => {
    if (f.geometry.type == "Polygon") {
      return turf.polygon(f.geometry.coordinates, f.properties);
    } else {
      return turf.polygon(f.geometry.coordinates[0], f.properties);
    }
  });

  const newBerryGeoJson = countyGeoJson.features.find((f) => {
    return f.properties.NAME == "Newberry";
  });
  const turfNewBerry = turf.polygon(newBerryGeoJson.geometry.coordinates, newBerryGeoJson.properties);

  const radiusEl = document.getElementById("radius");
  const rvalEl = document.getElementById("rval");
  const g = svg.append("g");
  const bufferG = svg.append("g")
  // 29108

  let zip_29108 = turfPolys.find((p) => p.properties.ZCTA == "29108");
  let zip_29126 = turfPolys.find((p) => p.properties.ZCTA == "29126");
  let zip_29075 = turfPolys.find((p) => p.properties.ZCTA == "29075");
  let zip_29127 = turfPolys.find((p) => p.properties.ZCTA == "29127");
  let zip_29145 = turfPolys.find((p) => p.properties.ZCTA == "29145");
  let zip_29355 = turfPolys.find((p) => p.properties.ZCTA == "29355");
  let zip_29178 = turfPolys.find((p) => p.properties.ZCTA == "29178");

   [zip_29126, zip_29075, zip_29127, zip_29145, zip_29355, zip_29178].forEach((z, i) => {
      g.append("path")
        .attr("d", path(z))
        .attr("fill", "blue")
        .attr("stroke", "white")
        .attr("stroke-width", 1.5)
        .attr("fill-opacity", Math.random() * 0.6 + 0.2);
    });

  function draw(bufferKm) {
    bufferG.selectAll("*").remove();

    // 1) Make buffer around B
    const bufferedB = turf.buffer(zip_29108, bufferKm, {
      units: "kilometers",
      steps: 64,
    });

    const clipped = turf.intersect(bufferedB, turfNewBerry);

    const bufferedFixed = turf.rewind(clipped, { reverse: true });

    // const ring = turf.difference(bufferedB, zip_29108);

    // const clipped = turf.intersect(bufferedFixed, turfNewBerry);

    // const isCovered = turf.booleanContains(bufferedB, polyA);

    // if (isCovered) {
    //   console.log("all covered");
    // }

    

    // 5) Draw B (inside) as blue
    // bufferG.append("path")
    //   .attr("d", path(zip_29108))
    //   .attr("fill", "blue")
    //   .attr("stroke", "blue")
    //   .attr("stroke-width", 1.5);

   

    // 4) Draw the ring (white) or fallback buffer
    bufferG.append("path")
    .attr("class", "test")
      .attr("d", path(bufferedFixed))
      .attr("fill", "blue")
      .attr("fill-opacity", 1)
      .attr("stroke", "None")
      .attr("stroke-width", 1.5)
      .attr("fill-rule", "evenodd")
      .on("mouseover", (d)=>{
        console.log("test")
      })

      bufferG.append("path")
      .attr("d", path(turfNewBerry))
      .attr("fill", "None")
      .attr("stroke", "red")
      .attr("stroke-width", 1.5);
  }

  function recompute() {
    const km = +radiusEl.value;
    rvalEl.textContent = km;
    draw(km);
  }

  // Initial render + slider
  recompute();
  radiusEl.addEventListener("input", recompute);
}
