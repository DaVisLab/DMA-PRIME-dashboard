import { data } from "./infoManager.js";
import { summarizeVegaLiteSpecGeneral } from "./helper.js";

export async function drawVegaSmallMultiples(spatialData, containerID) {
  console.log("Drawing Vega Small multiples...");
  const visContainer = document.getElementById(containerID);

  const containerSizeInfo = visContainer.getBoundingClientRect();
  const height = containerSizeInfo.height;
  const width = containerSizeInfo.width;

  const unitHeight = 50;

  console.log(spatialData);
  let smallMultipleData = [];
  spatialData.features.forEach((d) => {
    const name = d.name;
    const values = d.properties.data.adenovirus.weekly;

    const transformedData = values.map((d, i) => {
      return {
        name: name,
        index: i,
        risk: d,
      };
    });
    smallMultipleData.push(...transformedData);
  });
  console.log(smallMultipleData);
  console.log(width);

  const vegaSpec = {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    data: {
      values: smallMultipleData,
    },
    // autosize: { type: "fit-x", contains: "padding" },

    facet: {
      row: {
        field: "name",
        type: "nominal",
        title: "",
      },
    },

    spec: {
      width: width,
      height: unitHeight,
      layer: [
        {
          params: [
            {
              name: "hoverRegion",
              select: {
                type: "point",
                fields: ["name"],
                on: "mouseover",
                clear: "mouseout",
              },
            },
          ],
          mark: { type: "rect", opacity: 0 },
          encoding: {
            // Give the rect an extent so it fills the panel.
            // These are "dummy" encodings that make the rect span the view.
            x: { field: "index", type: "quantitative", aggregate: "min" },
            x2: { field: "index", aggregate: "max" },
            y: { value: 0 },
            y2: { value: unitHeight },

            tooltip: { field: "name", type: "nominal" },
          },
        },
        {
          mark: { type: "line" },
          encoding: {
            x: { field: "index", type: "quantitative", axis: { title: null } },
            y: { field: "risk", type: "quantitative", axis: { title: null } },
          },
        },
      ],
    },
    resolve: {
      scale: {
        y: "independent",
      },
    },
  };

  const viewRes = await vegaEmbed("#" + containerID, vegaSpec, {
    actions: false,
  });
  const vegaView = viewRes.view;
  const transformedData = structuredClone(vegaView.data("data_0")); // Default name if not specified

  const viewSepcExcludingData = structuredClone(vegaSpec);
  viewSepcExcludingData.data = "removed for data privacy";

  console.log(viewSepcExcludingData);
  data.smallMultiplesBegaSpecs = {
    viewSpecStructure: viewSepcExcludingData,
  };
  //   ...
  return vegaView;
  //   return await vegaEmbed("#" + containerID, vegaSpec, { actions: false })
  //     .then(async (result) => {
  //       console.log(transformedData);
  //       //   const pngDataUrl = await vegaView.toImageURL("png", 2);
  //       //   transformedData.forEach((data) => {
  //       //     delete data.geometry;
  //       //     delete data.properties;
  //       //     delete data["weekly"];
  //       //     data.__proto__ = null;
  //       //   });

  //       //   data.mapVegaSpecs = {
  //       //     originalMapVegaSpec: vegaSpec,
  //       //     mapViewPng: pngDataUrl,
  //       //     mapSpecStructure: summarizeVegaLiteSpecGeneral(vegaSpec),
  //       //     transformedData: transformedData,
  //       //   };
  //     })
  //     .catch(console.error);
}
