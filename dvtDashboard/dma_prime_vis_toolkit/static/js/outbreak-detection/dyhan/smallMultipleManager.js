import { drawingSmallMultiples } from "./smallMultiples/smallMultiples-main.js";

export const smallMultipleManager = {
  data: null,
  initSmallMultipleView: async function (data) {
    const mapResolutionSelector = document.getElementById(
      "map-resolution-selector"
    );

    await customElements.whenDefined("sl-select");
    await mapResolutionSelector.updateComplete;

    const mapResolutionSelected = mapResolutionSelector.value;

    // console.log(mapResolutionSelected);
    // console.log(data);
    drawingSmallMultiples(data[mapResolutionSelected].features);
  },
  callInitSmallMultipleView: function (data) {
    this.initSmallMultipleView(data);

    document
      .getElementById("map-resolution-selector")
      .addEventListener("sl-change", (event) => {
        this.callInitSmallMultipleView(data);
      });
  },
};
