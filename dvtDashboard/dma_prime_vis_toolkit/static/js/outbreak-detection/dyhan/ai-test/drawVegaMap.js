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

    layer: [
      // 1) Base filled choropleth layer (your original)
      {
        transform: [
          {
            calculate: "datum.properties.data.adenovirus.weekly",
            as: "weekly",
          },
          { filter: "isValid(datum.weekly)" },
          { flatten: ["weekly"], as: ["adenovirus value"] },
          {
            joinaggregate: [
              { op: "mean", field: "adenovirus value", as: "avg_value" },
            ],
            groupby: ["properties.id"],
          },
          // keep only one row per region
          {
            window: [{ op: "row_number", as: "rn" }],
            groupby: ["properties.id"],
          },
          { filter: "datum.rn === 1" },
        ],
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
    config: {
      view: { stroke: null },
    },
  };

  console.log(data);

  vegaEmbed("#" + containerID, vegaSpec, { actions: true })
    .then(async (result) => {
      const vegaView = result.view;

      const transformedData = structuredClone(vegaView.data("data_0")); // Default name if not specified
      const pngDataUrl = await vegaView.toImageURL("png", 2);
      transformedData.forEach((data) => {
        delete data.geometry;
        delete data.properties;
        delete data["weekly"];
        data.__proto__ = null;
      });

      data.mapVegaSpecs = {
        originalMapVegaSpec: vegaSpec,
        mapViewPng: pngDataUrl,
        mapSpecStructure: summarizeVegaLiteSpecGeneral(vegaSpec),
        transformedData: transformedData,
      };
    })
    .catch(console.error);
}
