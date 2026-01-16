import { callSpatialResolutionChange, visViewUpdate } from "./infoManager.js";

export const selectorDOMElements = {
  geographicResolutionSelector: document.getElementById("map-region-selector")
    .innerHTML.replaceAll('\n', '').replace(/\s+/g, ' ').trim(),
  tempotalComparisonSelector: document.getElementById(
    "surveillance-time-window-switch"
  ).innerHTML.replaceAll('\n', '').replace(/\s+/g, ' ').trim(),
  riskIndexSelector: document.getElementById("map-outcome-variable-selector")
    .innerHTML.replaceAll('\n', '').replace(/\s+/g, ' ').trim(),
  diseaseSector: document.getElementById("map-disease-selector-container")
    .innerHTML.replaceAll('\n', '').replace(/\s+/g, ' ').trim(),
};

console.log(selectorDOMElements)
document
  .getElementById("map-region-selector")
  .addEventListener("sl-change", (e) => {
    callSpatialResolutionChange();
  });

function init() {
  visViewUpdate();
}

init();
