import { data } from "./infoManager.js";
import { summarizeVegaLiteSpecGeneral } from "./helper.js";
export async function drawVegaMap(spatialData, containerID) {
  console.log("Drawing Vega Map...");
  const mapContainer = document.getElementById("map-container");
  var containerSizeInfo = mapContainer.getBoundingClientRect();
  var height = containerSizeInfo.height;
  var width = containerSizeInfo.width;
  //   mapContainer.innerHTML = ""; // Clear previous content

  console.log(spatialData);
  const vegaSpec = {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    width: width,
    height: height,
    autosize: { type: "fit", contains: "padding" },
    data: {
      values: spatialData.features,
    },
    projection: {
      type: "identity",
      reflectY: true,
    },
    transform: [
      { calculate: "datum.properties.data.adenovirus.weekly", as: "weekly" },
      { filter: "isValid(datum.weekly)" },
      { flatten: ["weekly"], as: ["adenovirus value"] },
      {
        joinaggregate: [
          { op: "mean", field: "adenovirus value", as: "avg_value" },
        ],
        groupby: ["properties.id"],
      },
      // keep only one row per region
      { window: [{ op: "row_number", as: "rn" }], groupby: ["properties.id"] },
      { filter: "datum.rn === 1" },
    ],
    layer: [
      // 1) Base filled choropleth layer (your original)
      {
        mark: { type: "geoshape", stroke: "white", strokeWidth: 1 },
        encoding: {
          color: {
            field: "avg_value",
            type: "quantitative",
            title: "Adenovirus",
            scale: { scheme: "reds" },
          },
          tooltip: [
            { field: "properties.Region", type: "nominal", title: "Region" },
            {
              field: "avg_value",
              type: "quantitative",
              title: "Average Adenovirus",
            },
          ],
        },
      },
    ],
    // mark: { type: "geoshape", stroke: "white", strokeWidth: 1 },

    // encoding: {
    //   color: {
    //     field: "avg_value",
    //     type: "quantitative",
    //     title: "Adenovirus",
    //     scale: { scheme: "reds" },
    //   },
    //   tooltip: [
    //     { field: "properties.Region", type: "nominal", title: "Region" },
    //     {
    //       field: "adenovirus value",
    //       type: "quantitative",
    //       title: "Adenovirus Value",
    //     },
    //   ],
    // },
    config: {
      view: { stroke: null },
    },
  };

  const vegaSpec2 = vegaLite.compile(vegaSpec).spec;
  const vegaView = new vega.View(vega.parse(vegaSpec2))
    .initialize("#" + containerID)
    .run();

  // Access the transformed data (use the original source data name)
  //   const transformedData = vegaView.data("data_0"); // Default name if not specified
  const transformedData = structuredClone(vegaView.data("data_0")); // Default name if not specified

  transformedData.forEach((data) => {
    delete data.geometry;
    delete data.properties;
    delete data["weekly"];
    data.__proto__ = null;
  });

  console.log(transformedData);
  //   console.log(vegaView.data("source_0"));
  const pngDataUrl = await vegaView.toImageURL("png", 2);

  data.mapVegaSpecs = {
    originalMapVegaSpec: vegaSpec,
    mapViewPng: pngDataUrl,
    mapSpecStructure: summarizeVegaLiteSpecGeneral(vegaSpec),
    transformedData: transformedData,
  };

  console.log(data);
  //   vegaEmbed("#" + containerID, vegaSpec, { actions: true })
  //     .then((result) => {
  //       // result.view is the Vega View instance
  //       const view = result.view;
  //       const transformedData = view.data("source_0");
  //       console.log(transformedData);
  //       // The data processing happens asynchronously.
  //       // Wait until the view has fully rendered or data has processed.
  //       //   view.runAsync().then(() => {
  //       //     // console.log(view.data);
  //       //     // const preprocessedData = view.data("source_0");

  //       //     // console.log("Preprocessed Data:", preprocessedData);
  //       //     const names = Object.keys(view.getState().data);
  //       //     console.log("Datasets:", names);

  //       //     // Find dataset that includes avg_value
  //       //     const target = names.find((n) => {
  //       //       const rows = view.data(n);
  //       //       return rows?.length && rows[0] && "avg_value" in rows[0];
  //       //     });

  //       //     console.log("Dataset with avg_value:", target);
  //       //     console.log("Rows:", view.data(target).slice(0, 5));
  //       //   });
  //     })
  //     .catch(console.error);
}
