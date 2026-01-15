import { callSpatialResolutionChange, visViewUpdate } from "./infoManager.js";

document
  .getElementById("map-region-selector")
  .addEventListener("sl-change", (e) => {
    callSpatialResolutionChange();
  });

function init() {
  visViewUpdate();
}

init();
