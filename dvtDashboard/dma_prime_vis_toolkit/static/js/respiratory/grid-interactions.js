import {
  drawStateHospitalizations,
  drawLargeStateHospitalizations,
} from "/static/js/respiratory/script.js";

import {
  updateGrid,
  sortGridItems,
  filterGridItems,
  setupGridTooltip,
  updateGridOutcomeVariableOptions,
  updateGridPopulationOptions,
  updateGridGeographicUnitOptions,
} from "/static/js/respiratory/grid.js";

import {
  setMapDiseaseSelectorValue,
  setMapGeographicUnitSelectorValue,
  setMapPopulationSelectorValue,
  setMapOutcomeVariableSelectorValue,
  setMapFacilityUnitSelectorValue,
  setMapTypeSwitchValue,
} from "/static/js/respiratory/map-interactions.js";

gridContainerResizer.addEventListener("sl-resize", updateGrid);

gridCloseTtpsButton.addEventListener("click", () => {
  d3.selectAll(".grid-container > sl-tooltip").each(function (_) {
    this.open = false;
  });
});

gridFacilityUnitSelector.addEventListener("change", async () => {
  updateGrid();

  const facilityUnitSelected = document.querySelector(
    'input[name="grid-facilityOptionGroup"]:checked',
  )?.value;

  // update map view
  setMapFacilityUnitSelectorValue(facilityUnitSelected);
});

gridTypeSwitch.addEventListener("sl-change", (event) => {
  d3.select(gridContainer)
    .selectAll("sl-tooltip[open]")
    .each(function (d, i) {
      setupGridTooltip(d3.select(this), true);
    });

  d3.select(gridMainLegend)
    .select("text")
    .text(
      d3
        .select(gridTypeSwitch)
        .select(`*[value="${gridTypeSwitch.value}"]`)
        .html(),
    );
  drawStateHospitalizations(
    gridDiseaseSelector.value,
    gridTypeSwitch.value,
    gridStateHospitalizationsSvg,
    gridStateHospitalizationsSubtitle,
  );

  if (gridTypeSwitch.value == "percentDifference") {
    d3.select(gridSecondaryLegend).style("display", "initial");
  } else {
    d3.select(gridSecondaryLegend).style("display", "none");
  }
  updateGrid();

  // update map view
  setMapTypeSwitchValue(gridTypeSwitch.value);
});

gridDiseaseSelector.addEventListener("sl-change", async (event) => {
  await updateGridGeographicUnitOptions();

  d3.select(gridContainer)
    .selectAll("sl-tooltip[open]")
    .each(function (d, i) {
      setupGridTooltip(d3.select(this), true);
    });
  updateGrid(true);
  drawStateHospitalizations(
    gridDiseaseSelector.value,
    gridTypeSwitch.value,
    gridStateHospitalizationsSvg,
    gridStateHospitalizationsSubtitle,
  );

  // update map view
  setMapDiseaseSelectorValue(gridDiseaseSelector.value);
});

gridGeographicUnitSelector.addEventListener("sl-change", async (event) => {
  await updateGridPopulationOptions();
  gridGeographicUnit = gridGeographicUnitSelector.value;
  updateGrid(true);

  // update map view
  setMapGeographicUnitSelectorValue(gridGeographicUnit);
});

gridPopulationSelector.addEventListener("sl-change", async (event) => {
  await updateGridOutcomeVariableOptions();
  gridPopulation = gridPopulationSelector.value;

  d3.select(gridContainer)
    .selectAll("sl-tooltip[open]")
    .each(function (d, i) {
      setupGridTooltip(d3.select(this), true);
    });
  updateGrid();

  // update map view
  setMapPopulationSelectorValue(gridPopulation);
});

gridOutcomeVariableSelector.addEventListener("sl-change", (event) => {
  gridOutcomeVariable = gridOutcomeVariableSelector.value;

  d3.select(gridContainer)
    .selectAll("sl-tooltip[open]")
    .each(function (d, i) {
      setupGridTooltip(d3.select(this), true);
    });
  updateGrid();

  // update map view
  setMapOutcomeVariableSelectorValue(gridOutcomeVariable);
});

gridIncludeImputations.addEventListener("sl-change", updateGrid);

gridSort.addEventListener("sl-change", (event) => {
  sortGridItems();
});

gridTextFilter.addEventListener("sl-input", filterGridItems);
gridTextFilter.addEventListener("clear", filterGridItems);

gridStateHospitalizationsResizer.addEventListener("sl-resize", () => {
  drawStateHospitalizations(
    gridDiseaseSelector.value,
    gridTypeSwitch.value,
    gridStateHospitalizationsSvg,
    gridStateHospitalizationsSubtitle,
  );
});

gridStateHospitalizationsSvg.addEventListener("click", () => {
  gridStateHospitalizationsLarge.show();
});

gridStateHospitalizationsLargeResizer.addEventListener("sl-resize", () => {
  drawLargeStateHospitalizations(
    gridDiseaseSelector.value,
    gridTypeSwitch.value,
    gridStateHospitalizationsLargeSvg,
    gridStateHospitalizationsLargeSubtitle,
  );
});

export function setGridDiseaseSelectorValue(value) {
  if (value == gridDiseaseSelector.value) return;

  gridDiseaseSelector.value = value;
  gridDiseaseSelector.dispatchEvent(
    new CustomEvent("sl-change", {
      bubbles: true,
    }),
  );
}

export function setGridGeographicUnitSelectorValue(value) {
  if (value == gridGeographicUnitSelector.value) return;

  gridGeographicUnitSelector.value = value;
  gridGeographicUnitSelector.dispatchEvent(
    new CustomEvent("sl-change", {
      bubbles: true,
    }),
  );
}

export function setGridPopulationSelectorValue(value) {
  if (value == gridPopulationSelector.value) return;

  gridPopulationSelector.value = value;
  gridPopulationSelector.dispatchEvent(
    new CustomEvent("sl-change", {
      bubbles: true,
    }),
  );
}

export function setGridOutcomeVariableSelectorValue(value) {
  if (value == gridOutcomeVariableSelector.value) return;

  gridOutcomeVariableSelector.value = value;
  gridOutcomeVariableSelector.dispatchEvent(
    new CustomEvent("sl-change", {
      bubbles: true,
    }),
  );
}

export function setGridFacilityUnitSelectorValue(value) {
  const facilityUnitSelected = document.querySelector(
    'input[name="grid-facilityOptionGroup"]:checked',
  )?.value;

  if (value == facilityUnitSelected) return;

  document.getElementById(`grid-facility-option-${value}`).checked = true;

  gridFacilityUnitSelector.dispatchEvent(
    new CustomEvent("change", {
      bubbles: true,
    }),
  );
}

export function setGridTypeSwitchValue(value) {
  if (value == gridTypeSwitch.value) return;

  gridTypeSwitch.value = value;
  gridTypeSwitch.dispatchEvent(
    new CustomEvent("sl-change", {
      bubbles: true,
    }),
  );
}
