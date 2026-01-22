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

const dictionaryToArrayOfObjects = (dictionary) => {
  return Object.keys(dictionary).map((key) => ({
    ...dictionary[key],
  }));
};
export function returnSelectorDOMElementsWithCurVals() {
  const returnSelectorContext = {};

  returnSelectorContext["geoGraphicResolution"] = {};
  returnSelectorContext["geoGraphicResolution"].id = "map-region-selector";
  returnSelectorContext["geoGraphicResolution"].options = getSlSelectOptions(
    document.getElementById("map-region-selector")
  );
  returnSelectorContext["geoGraphicResolution"].curValue =
    document.getElementById("map-region-selector").value;

  returnSelectorContext["temporalComparisonSelector"] = {};
  returnSelectorContext["temporalComparisonSelector"].id =
    "surveillance-time-window-switch";
  returnSelectorContext["temporalComparisonSelector"].options =
    getSlRadioGroupOptions(
      document.getElementById("surveillance-time-window-switch")
    );
  returnSelectorContext["temporalComparisonSelector"].curValue =
    document.getElementById("surveillance-time-window-switch").value;

  returnSelectorContext["riskIndexSelector"] = {};
  returnSelectorContext["riskIndexSelector"].id =
    "map-outcome-variable-selector";
  returnSelectorContext["riskIndexSelector"].options = getSlSelectOptions(
    document.getElementById("map-outcome-variable-selector")
  );
  returnSelectorContext["riskIndexSelector"].curValue = document.getElementById(
    "map-outcome-variable-selector"
  ).value;

  returnSelectorContext["diseaseSector"] = {};
  returnSelectorContext["diseaseSector"].id = "map-disease-selector-container";
  returnSelectorContext["diseaseSector"].options = getDiseaseOptions();

  returnSelectorContext["diseaseSector"].curValue = getSelectedDiseases();

  return dictionaryToArrayOfObjects(returnSelectorContext);
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

function getDiseaseOptions() {
  return [...document.querySelectorAll(".disease-checkbox")].map((cb) => {
    return {
      value: cb.getAttribute("disease"),
      // label: cb.getAttribute("disease"),
    };
  });
}

function getSlSelectOptions(selectEl) {
  return Array.from(selectEl.querySelectorAll("sl-option")).map((opt) => ({
    value: opt.value,
    // label: opt.textContent.trim(),
  }));
}

function getSlRadioGroupOptions(radioGroupEl) {
  return Array.from(radioGroupEl.querySelectorAll("sl-radio-button")).map(
    (btn) => ({
      value: btn.value,
      // label: btn.textContent.trim(),
    })
  );
}
