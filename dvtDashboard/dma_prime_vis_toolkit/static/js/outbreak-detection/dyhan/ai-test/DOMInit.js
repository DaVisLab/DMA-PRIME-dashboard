import { callSpatialResolutionChange, visViewUpdate } from "./infoManager.js";

import { tempAIResponse } from "./helper.js";
import { presentAIResponse } from "./aiPromptManager.js";

export const selectorDOMElements = {
  geographicResolutionSelector: document
    .getElementById("map-region-selector")
    .innerHTML.replaceAll("\n", "")
    .replace(/\s+/g, " ")
    .trim(),
  temporalComparisonSelector: document
    .getElementById("surveillance-time-window-switch")
    .innerHTML.replaceAll("\n", "")
    .replace(/\s+/g, " ")
    .trim(),
  riskIndexSelector: document
    .getElementById("map-outcome-variable-selector")
    .innerHTML.replaceAll("\n", "")
    .replace(/\s+/g, " ")
    .trim(),
  diseaseSector: document
    .getElementById("map-disease-selector-container")
    .innerHTML.replaceAll("\n", "")
    .replace(/\s+/g, " ")
    .trim(),
};

export function returnSelectorDOMElementsWithCurVals() {
  const returnSelectorContext = {};

  returnSelectorContext["geoGraphicResolution"] = {};
  returnSelectorContext["geoGraphicResolution"].selectors =
    selectorDOMElements["geographicResolutionSelector"];
  returnSelectorContext["geoGraphicResolution"].curValue =
    document.getElementById("map-region-selector").value;

  returnSelectorContext["temporalComparisonSelector"] = {};
  returnSelectorContext["temporalComparisonSelector"].selectors =
    selectorDOMElements["temporalComparisonSelector"];
  returnSelectorContext["temporalComparisonSelector"].curValue =
    document.getElementById("surveillance-time-window-switch").value;

  returnSelectorContext["riskIndexSelector"] = {};
  returnSelectorContext["riskIndexSelector"].selectors =
    selectorDOMElements["riskIndexSelector"];
  returnSelectorContext["riskIndexSelector"].curValue = document.getElementById(
    "map-outcome-variable-selector"
  ).value;

  returnSelectorContext["diseaseSector"] = {};
  returnSelectorContext["diseaseSector"].selectors =
    selectorDOMElements["diseaseSector"];
  returnSelectorContext["diseaseSector"].curValue = getSelectedDiseases();

  return returnSelectorContext;
}

// console.log(selectorDOMElements)
document
  .getElementById("map-region-selector")
  .addEventListener("sl-change", (e) => {
    callSpatialResolutionChange();
  });

function init() {
  visViewUpdate();

  console.log(tempAIResponse);
  presentAIResponse(tempAIResponse);
}

init();

function getSelectedDiseases() {
  const allChecked = document.getElementById(
    "map-all-disease-selector"
  ).checked;

  if (allChecked) {
    return [...document.querySelectorAll(".disease-checkbox")].map((cb) =>
      cb.getAttribute("disease")
    );
  }

  return [...document.querySelectorAll(".disease-checkbox")]
    .filter((cb) => cb.checked)
    .map((cb) => cb.getAttribute("disease"));
}
