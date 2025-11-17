import {
  initMap,
  highlightLine,
  dehighlightLine,
  dehighlightLineComplete,
  dehighlightArea,
  removeDehighlightArea,
  drawLineGeoJSONLayer,
  fillAreaGeoJSONLayer,
} from "./map-utiles.js";

export function drawZipMap(targetMap, featuresDataBySpace, maps) {
  // Add any initialization logic here
  initMap(targetMap, {
    panning: true,
    zooming: true,
  });

  // const featuresDataBySpace = await getSpatialData("zcta");
  const featuresDataBySpace_region = maps.regional_data;
  const featuresDataBySpace_county = maps.county_data;

  let values = featuresDataBySpace.map(
    (d) =>
      d.properties.data["health_system"]["positive_tests"]["projected"][
        "values"
      ][1]
  );

  const color = d3
    .scaleLinear()
    .domain(d3.extent(values)) // input values
    .range(["white", "red"]); // output color range

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
    // // Create and add a popup
    // new maplibregl.Popup()
    //     .setLngLat(coordinates)
    //     .setHTML('<h3>' + properties.name + '</h3>' + properties.description)
    //     .addTo(map);
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

      highlightLine(
        targetMap,
        maps.layers.zip_map_layer.lineLayerID,
        features.properties.id
      );
      // // Create and add a popup
      // new maplibregl.Popup()
      //     .setLngLat(coordinates)
      //     .setHTML('<h3>' + properties.name + '</h3>' + properties.description)
      //     .addTo(map);
    }
  );

  targetMap.on(
    "mouseout",
    maps.layers.zip_map_layer.fillLayerID,
    () => {
      dehighlightLine(targetMap, maps.layers.zip_map_layer.lineLayerID);
    }
    //   function (e) {
    //   targetMap.setPaintProperty("my-geojson-layer2", "line-color", "gray");
    // }
  );
}
