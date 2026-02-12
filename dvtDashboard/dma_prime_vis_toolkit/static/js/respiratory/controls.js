controlDependencyTest();
controlDependencyTestOnGridView();

export function controlDependencyTest() {
  const disabledRegions = ["county", "zcta", "facility"];

  document
    .getElementById("map-population-selector")
    .querySelectorAll("sl-option")
    .forEach((option) => {
      if (option.value == "general_population") {
        //do nothing
      } else {
        option.style.display = "none";
      }
    });

  document
    .getElementById("map-geographic-unit-selector")
    .querySelectorAll("sl-option")
    .forEach((option) => {
      if (option.value == "state") {
        //do nothing
      } else {
        option.style.display = "none";
      }
    });

  let selectedPopulation = document.getElementById(
    "map-population-selector",
  ).value;
  const selectEl = document.getElementById("map-geographic-unit-selector");
  const outcomeSelectEl = document.getElementById(
    "map-outcome-variable-selector",
  );
  const diseaseSelectEl = document.getElementById("map-disease-selector");

  // test population dependency
  if (selectedPopulation === "general_population") {
    // 1. test population - region dependency
    selectEl.querySelectorAll("sl-option").forEach((option) => {
      if (
        disabledRegions.includes(option.value) &&
        option.style.display != "none"
      ) {
        option.style.display = "none";

        if (selectEl.value === option.value) {
          selectEl.value = "region";
          selectEl.dispatchEvent(
            new CustomEvent("sl-change", { bubbles: true }),
          );
        }
      }
    });

    // 2. test population - outcome dependency
    outcomeSelectEl.querySelectorAll("sl-option").forEach((option) => {
      if (
        option.value == "all_hospitalizations" &&
        option.style.display != "none"
      ) {
        option.style.display = "none";
        outcomeSelectEl.value = "inpatient_hospitalizations";
        outcomeSelectEl.dispatchEvent(
          new CustomEvent("sl-change", { bubbles: true }),
        );
      }
    });

    // 3. test population - disease dependency
    diseaseSelectEl.querySelectorAll("sl-option").forEach((option) => {
      // console.log(option.value);
      if (
        "respiratory_diseases" == option.value &&
        option.style.display != "none"
      ) {
        option.style.display = "none";
        diseaseSelectEl.value = "influenza";
        diseaseSelectEl.dispatchEvent(
          new CustomEvent("sl-change", { bubbles: true }),
        );
      }
    });
  } else {
    selectEl.querySelectorAll("sl-option").forEach((option) => {
      option.style.display = "";
    });

    outcomeSelectEl.querySelectorAll("sl-option").forEach((option) => {
      option.style.display = "";
    });

    diseaseSelectEl.querySelectorAll("sl-option").forEach((option) => {
      option.style.display = "";
    });
  }
}



export function controlDependencyTestOnGridView() {
  const disabledRegions = ["county", "zcta", "facility"];
  document
    .getElementById("grid-population-selector")
    .querySelectorAll("sl-option")
    .forEach((option) => {
      if (option.value == "general_population") {
        //do nothing
      } else {
        option.style.display = "none";
      }
    });

  document
    .getElementById("grid-geographic-unit-selector")
    .querySelectorAll("sl-option")
    .forEach((option) => {
      if (option.value == "state") {
        //do nothing
      } else {
        option.style.display = "none";
      }
    });

  let selectedPopulation = document.getElementById(
    "grid-population-selector",
  ).value;
  const selectEl = document.getElementById("grid-geographic-unit-selector");
  const outcomeSelectEl = document.getElementById(
    "grid-outcome-variable-selector",
  );
  const diseaseSelectEl = document.getElementById("grid-disease-selector");

  // test population dependency
  if (selectedPopulation === "general_population") {
    // 1. test population - region dependency
    selectEl.querySelectorAll("sl-option").forEach((option) => {
      if (
        disabledRegions.includes(option.value) &&
        option.style.display != "none"
      ) {
        option.style.display = "none";

        if (selectEl.value === option.value) {
          selectEl.value = "region";
          selectEl.dispatchEvent(
            new CustomEvent("sl-change", { bubbles: true }),
          );
        }
      }
    });

    // 2. test population - outcome dependency
    outcomeSelectEl.querySelectorAll("sl-option").forEach((option) => {
      if (
        option.value == "all_hospitalizations" &&
        option.style.display != "none"
      ) {
        option.style.display = "none";
        outcomeSelectEl.value = "inpatient_hospitalizations";
        outcomeSelectEl.dispatchEvent(
          new CustomEvent("sl-change", { bubbles: true }),
        );
      }
    });

    // 3. test population - disease dependency
    diseaseSelectEl.querySelectorAll("sl-option").forEach((option) => {
      // console.log(option.value);
      if (
        "respiratory_diseases" == option.value &&
        option.style.display != "none"
      ) {
        option.style.display = "none";
        diseaseSelectEl.value = "influenza";
        diseaseSelectEl.dispatchEvent(
          new CustomEvent("sl-change", { bubbles: true }),
        );
      }
    });
  } else {
    selectEl.querySelectorAll("sl-option").forEach((option) => {
      option.style.display = "";
    });

    outcomeSelectEl.querySelectorAll("sl-option").forEach((option) => {
      option.style.display = "";
    });

    diseaseSelectEl.querySelectorAll("sl-option").forEach((option) => {
      option.style.display = "";
    });
  }
}
