import {
  initMap,
  highlightLine,
  dehighlightLine,
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

export function drawZipMap(targetMap, featuresDataBySpace, maps) {
  // Add any initialization logic here
  initMap(targetMap, {
    panning: true,
    zooming: true,
  });

  // const featuresDataBySpace = await getSpatialData("zcta");
  const featuresDataBySpace_region = maps.regional_data;
  const featuresDataBySpace_county = maps.county_data;

  let values = featuresDataBySpace.map((d) => d.properties.projected_value);

  targetMap.addSource(maps.layers.zip_map_layer.sourceID, {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: featuresDataBySpace,
    },
  });

  fillAreaGeoJSONLayer(
    targetMap,
    maps.layers.zip_map_layer.sourceID,
    maps.layers.zip_map_layer.fillLayerID,
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

  const colorXScale = addMapColorSchemeInfo("zcta", color);

  drawLineGeoJSONLayer(
    targetMap,
    maps.layers.zip_map_layer.sourceID,
    maps.layers.zip_map_layer.lineLayerID,
    {
      "line-width": 0.5,
      "line-color": "gray",
    }
  );

  // add regional boundaries
  targetMap.addSource(maps.layers.region_map_layer.sourceID, {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: featuresDataBySpace_region,
    },
  });

  fillAreaGeoJSONLayer(
    targetMap,
    maps.layers.region_map_layer.sourceID,
    maps.layers.region_map_layer.fillLayerID,
    {
      "fill-color": "lightgray",
      "fill-opacity": 0.0,
    }
  );

  drawLineGeoJSONLayer(
    targetMap,
    maps.layers.region_map_layer.sourceID,
    maps.layers.region_map_layer.lineLayerID,
    {
      "line-width": 0.0,
      "line-color": "gray",
    }
  );

  // add county boundaries
  targetMap.addSource(maps.layers.county_map_layer.sourceID, {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: featuresDataBySpace_county,
    },
  });

  fillAreaGeoJSONLayer(
    targetMap,
    maps.layers.county_map_layer.sourceID,
    maps.layers.county_map_layer.fillLayerID,
    {
      "fill-color": "lightgray",
      "fill-opacity": 0.0,
    }
  );

  drawLineGeoJSONLayer(
    targetMap,
    maps.layers.county_map_layer.sourceID,
    maps.layers.county_map_layer.lineLayerID,
    {
      "line-width": 0.0,
      "line-color": "gray",
    }
  );

  // Add interaction events
  targetMap.on("click", maps.layers.zip_map_layer.fillLayerID, function (e) {
    // Access the clicked feature's data
    const features = e.features[0];
    const coordinates = features.geometry.coordinates;
    const properties = features.properties;

    // console.log(features.properties.id);
    //

    if (!maps.regionOfInterest.includes(features.properties.id)) {
      const smallMultipleId = d3.select(
        `#small-multiple-${features.properties.id}`
      );
      moveSmallMultipleUnitToROI(smallMultipleId, features.properties.id);

      maps.regionOfInterest.push(features.properties.id);
    } else {
      maps.regionOfInterest = maps.regionOfInterest.filter(
        (d) => d !== features.properties.id
      );
      resetSmallMultipleUnitPosition(features.properties.id);
    }

    // if (features.properties.clicked === true) {
    //   features.properties.clicked = false;
    // } else {
    //   features.properties.clicked = true;
    // }
  });

  targetMap.on(
    "mousemove",
    maps.layers.zip_map_layer.fillLayerID,
    function (e) {
      // Access the clicked feature's data
      const features = e.features[0];
      const coordinates = features.geometry.coordinates;
      const properties = features.properties;
      // console.log(features);

      highlightLine(targetMap, maps.layers.zip_map_layer.lineLayerID, [
        features.properties.id,
        ...maps.regionOfInterest,
      ]);

      // console.log(features.properties.id);
      highlightSmallMultipleUnit(`#small-multiple-${features.properties.id}`);

      // show label indicator
      // console.log(e.features[0].properties.projected_value);

      let legendIndicator = d3.select("#zcta-legend-hover-indicator-group");
      legendIndicator
        .attr(
          "transform",
          `translate(${colorXScale(
            e.features[0].properties.projected_value
          )}, 0)`
        )
        .style("opacity", 1);
      legendIndicator
        .select("text")
        .text(`${e.features[0].properties.projected_value}`);
    }
  );

  targetMap.on(
    "mouseout",
    maps.layers.zip_map_layer.fillLayerID,
    () => {
      dehighlightLine(
        targetMap,
        maps.layers.zip_map_layer.lineLayerID,
        maps.regionOfInterest
      );
      // dehighlightLine(targetMap, maps.layers.zip_map_layer.lineLayerID);
      deHighlightSmallMultipleUnit();
      d3.select("#zcta-legend-hover-indicator-group").style("opacity", 0);
    }
    //   function (e) {
    //   targetMap.setPaintProperty("my-geojson-layer2", "line-color", "gray");
    // }
  );
}
