import {
  initMap,
  highlightLine,
  dehighlightLine,
  highlightSymbol,
  dehighlightSymbol,
  dehighlightLineComplete,
  dehighlightArea,
  removeDehighlightArea,
  drawLineGeoJSONLayer,
  fillAreaGeoJSONLayer,
  addMapColorSchemeInfo,
} from "./map-utiles.js";

import {
  highlightSmallMultipleUnit,
  deHighlightSmallMultipleUnit,
  moveSmallMultipleUnitToROI,
  resetSmallMultipleUnitPosition,
} from "../smallMultiples/smallMultiple-utils.js";

export function drawMapLayers(targetMap, featuresDataBySpace, maps) {
  const map = targetMap;

  initMap(targetMap, { panning: true, zooming: true });

  let values = featuresDataBySpace.map((d) => d.properties.projected_value);

  console.log(values);

  targetMap.addSource(maps.layers.sourceID, {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: featuresDataBySpace,
    },
  });

  const maxValue = d3.max(values);

  if (maps.spatialResolution != "facility") {
    addBoundaryLayers(targetMap, maps, values);
  } else {
    addHealthFacilityLayer(targetMap, maps, values);
  }
}

function addBoundaryLayers(targetMap, maps, values) {
  fillAreaGeoJSONLayer(
    targetMap,
    maps.layers.sourceID,
    maps.layers.fillLayerID,
    {
      "fill-color": [
        "interpolate",
        ["linear"],
        ["get", "projected_value"], // properties.value
        0,
        "#ffffff",
        d3.max(values),
        "#ff0000",
      ],
    }
  );

  const color = d3
    .scaleLinear()
    .domain(d3.extent(values)) // input values
    .range(["white", "red"]); // output color range

  const colorXScale = addMapColorSchemeInfo("region", color);

  drawLineGeoJSONLayer(
    targetMap,
    maps.layers.sourceID,
    maps.layers.lineLayerID,
    {
      "line-width": 0.5,
      "line-color": "gray",
    }
  );

  targetMap.on("mousemove", maps.layers.fillLayerID, function (e) {
    // Access the clicked feature's data
    const features = e.features[0];

    highlightLine(targetMap, maps.layers.lineLayerID, [
      features.properties.id,
      ...maps.regionOfInterest,
    ]);

    highlightSmallMultipleUnit(`#small-multiple-${features.properties.id}`);

    let legendIndicator = d3.select("#region-legend-hover-indicator-group");
    legendIndicator
      .attr(
        "transform",
        `translate(${colorXScale(e.features[0].properties.projected_value)}, 0)`
      )
      .style("opacity", 1);

    legendIndicator
      .select("text")
      .text(`${e.features[0].properties.projected_value}`);
  });

  targetMap.on("mouseout", maps.layers.fillLayerID, () => {
    dehighlightLine(targetMap, maps.layers.lineLayerID, maps.regionOfInterest);

    deHighlightSmallMultipleUnit();

    d3.select("#region-legend-hover-indicator-group").style("opacity", 0);
  });
}

function addHealthFacilityLayer(targetMap, maps, values) {
  // Add a simple test icon (SVG) as an image for symbol layers
  const svgIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" version="1.0" viewBox="423.44 302.24 264.14 358.08"><path d="M534.1 303.5c-10.2 2-29.3 8.1-36.6 11.7-38 19.1-63 52-72.2 94.8-2.5 11.9-2.5 38.1.1 50 4.6 21.4 11.5 36.7 24.7 55 15.6 21.6 41.3 57.5 71.7 100 16.7 23.4 31.2 43.3 32.2 44.3 1.9 2.1.3 4.1 23.5-28.3 6.5-9.1 14.6-20.3 18-25s16.3-22.5 28.5-39.5c12.3-17.1 27.4-38 33.6-46.5 16.3-22.5 23.4-37.7 28.1-60 2.5-11.8 2.5-38.2 0-50-8.5-39.5-29.5-69.3-63.3-89.6-11.2-6.7-22.4-11.2-37.9-15.1-12.7-3.1-38.5-4.1-50.4-1.8m48.1 22.3c39.8 10.6 70 39.9 81.2 78.6 15.1 51.8-10 107.9-58.8 131.6-19 9.2-36.8 12.6-57.9 10.9-16.1-1.3-26.6-4.3-41.4-11.8-29.5-14.9-50.2-40.9-58.2-73.1-2.7-10.6-3.3-15.7-3.2-27.8.2-51.5 36.3-96.7 86.6-108.5 10.9-2.6 11.1-2.6 28-2.2 12.2.2 17.8.8 23.7 2.3"/><path d="M527 382.5V405h-44v58h44v44h58v-44h44v-58h-44v-45h-58z"/></svg>
    `;

  const img = new Image();
  img.onload = () => {
    try {
      if (!targetMap.hasImage || !targetMap.hasImage("health-system")) {
        targetMap.addImage("health-system", img, { sdf: true });
      }
    } catch (err) {
      // map.hasImage may not exist in some maplibre versions, attempt add anyway
      try {
        targetMap.addImage("health-system", img, { sdf: true });
      } catch (e) {
        console.warn("addImage failed", e);
      }
    }

    console.log(maps);

    // Add a symbol layer to draw the icon for all features (use filter if needed)
    if (!targetMap.getLayer || !targetMap.getLayer("health-system-layer")) {
      try {
        targetMap.addLayer({
          id: maps.layers.symbolLayerID,
          type: "symbol",
          source: maps.layers.sourceID,
          layout: {
            "icon-image": "health-system",
            "icon-size": 0.15,
            "icon-allow-overlap": true,
            "text-field": ["get", "display_name"],
            "text-size": 0,
            "text-allow-overlap": true,
            "text-anchor": "center",
              "text-offset": [0, -2],      // shift up
          },
          paint: {
            "icon-color": "#cccccc",
            "icon-halo-color": "black",
            "icon-halo-width": 2,
            "icon-halo-blur": 3,
            // [
            //   "case",
            //   ["has", "projected_value"], // Check if the property exists
            //   "red",
            //   "#cccccc", // Fallback color if the property is missing
            // ],
          },
        });
      } catch (e) {
        console.warn("addLayer health-system-layer failed", e);
      }
    }
  };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgIcon);

  targetMap.on("mousemove", maps.layers.symbolLayerID, function (e) {
    // // Access the clicked feature's data
    const features = e.features[0];

    console.log(features.properties.id)
    highlightSymbol(targetMap, maps.layers.symbolLayerID, [
      features.properties.id,
      ...maps.regionOfInterest,
    ]);

    highlightSmallMultipleUnit(`#small-multiple-${features.properties.id}`);

  });

  targetMap.on("mouseleave", maps.layers.symbolLayerID, () => {
    // dehighlightLine(targetMap, maps.layers.lineLayerID, maps.regionOfInterest);
    dehighlightSymbol(targetMap, maps.layers.symbolLayerID, maps.regionOfInterest);
    deHighlightSmallMultipleUnit();

    // d3.select("#region-legend-hover-indicator-group").style("opacity", 0);
  });
}
