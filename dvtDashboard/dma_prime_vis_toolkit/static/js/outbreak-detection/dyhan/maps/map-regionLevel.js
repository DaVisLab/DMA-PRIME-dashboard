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

export function drawRegionMap(targetMap, featuresDataBySpace, maps) {
  initMap(targetMap);

  let values = featuresDataBySpace.map((d) => d.properties.projected_value);

  // featuresDataBySpace.forEach((d) => {
  //   let riskIndexValues = d.properties["final_historical_disease_risk_index"];
  //   values.push(riskIndexValues[riskIndexValues.length - 1]);
  //   d.properties.projected_value = riskIndexValues[riskIndexValues.length - 1];
  // });

  targetMap.addSource(maps.layers.region_map_layer.sourceID, {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: featuresDataBySpace,
    },
  });

  // const maxValue = d3.max(values);

  console.log(values);
  fillAreaGeoJSONLayer(
    targetMap,
    maps.layers.region_map_layer.sourceID,
    maps.layers.region_map_layer.fillLayerID,
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
    maps.layers.region_map_layer.sourceID,
    maps.layers.region_map_layer.lineLayerID,
    {
      "line-width": 0.5,
      "line-color": "gray",
    }
  );

  targetMap.on("click", maps.layers.region_map_layer.fillLayerID, function (e) {
    // Access the clicked feature's data
    const features = e.features[0];
    const coordinates = features.geometry.coordinates;
    const properties = features.properties;
    // // Create and add a popup
    // new maplibregl.Popup()
    //     .setLngLat(coordinates)
    //     .setHTML('<h3>' + properties.name + '</h3>' + properties.description)
    //     .addTo(map);

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
  });

  targetMap.on(
    "mousemove",
    maps.layers.region_map_layer.fillLayerID,
    function (e) {
      // Access the clicked feature's data
      const features = e.features[0];
      // const coordinates = features.geometry.coordinates;
      // const properties = features.properties;
      // console.log(features);

      highlightLine(targetMap, maps.layers.region_map_layer.lineLayerID, [
        features.properties.id,
        ...maps.regionOfInterest,
      ]);

      highlightLine(
        maps.county_map,
        maps.layers.region_map_layer.lineLayerID,
        features.properties.id
      );

      highlightLine(
        maps.zip_map,
        maps.layers.region_map_layer.lineLayerID,
        features.properties.id
      );

      dehighlightArea(
        maps.county_map,
        maps.layers.region_map_layer.fillLayerID,
        features.properties.id
      );

      dehighlightArea(
        maps.zip_map,
        maps.layers.region_map_layer.fillLayerID,
        features.properties.id
      );

      highlightSmallMultipleUnit(`#small-multiple-${features.properties.id}`);

      maps.zip_map.jumpTo({
        center: e.lngLat,
        duration: 50,
        zoom: 7,
      });

      let legendIndicator = d3.select("#region-legend-hover-indicator-group");
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

  targetMap.on("mouseout", maps.layers.region_map_layer.fillLayerID, () => {
    dehighlightLine(
      targetMap,
      maps.layers.region_map_layer.lineLayerID,
      maps.regionOfInterest
    );

    dehighlightLineComplete(
      maps.county_map,
      maps.layers.region_map_layer.lineLayerID
    );
    removeDehighlightArea(
      maps.county_map,
      maps.layers.region_map_layer.fillLayerID
    );

    dehighlightLineComplete(
      maps.zip_map,
      maps.layers.region_map_layer.lineLayerID
    );
    removeDehighlightArea(
      maps.zip_map,
      maps.layers.region_map_layer.fillLayerID
    );

    deHighlightSmallMultipleUnit();

    maps.zip_map.easeTo({
      center: [-80.3, 33.5],
      duration: 500,
      zoom: 5.5,
    });

    d3.select("#region-legend-hover-indicator-group").style("opacity", 0);
  });
}
