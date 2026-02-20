await Promise.allSettled([
  customElements.whenDefined("sl-select"),
  customElements.whenDefined("sl-option"),
]);

controlDependencyTest();
controlDependencyTestOnGridView();

document.addEventListener("DOMContentLoaded", async () => {
  // Wait until the Shoelace component is defined
  await Promise.allSettled([
    customElements.whenDefined("sl-select"),
    customElements.whenDefined("sl-option"),
  ]);

  const select = document.querySelector("sl-select");

  if (select) {
    controlDependencyTest();
    controlDependencyTestOnGridView();
    testTooltipDipendency();
  }
});

export function controlDependencyTest() {
  testTooltipDipendency();
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
function testTooltipDipendency() {
  const diseaseSelect = document.getElementById("map-disease-selector");
  const diseases = metadata.diseases;

  function updateOutcomeTooltips() {
    const selectedKey = diseaseSelect.value;
    const selectedLabel = diseases[selectedKey] ?? selectedKey;

    const tooltips = document.querySelectorAll(".map-outcome-tooltip");
    const populationTooltips = document.querySelectorAll(
      ".map-population-tooltip",
    );

    tooltips.forEach((t) => {
      if (!t.dataset.baseContent) t.dataset.baseContent = t.content || "";

      const base = t.dataset.baseContent;

      // Always derive from baseline
      t.content = base.replaceAll("{DISEASE}", selectedLabel);
      t.distance = "6";
      t.placement = "right";
      t.trigger = "hover";
    });

    populationTooltips.forEach((t) => {
      t.distance = "6";
      t.placement = "right";
      t.trigger = "hover";
    });
  }

  diseaseSelect.addEventListener("sl-change", () => {
    // If disease change triggers re-render elsewhere, delay one tick
    queueMicrotask(updateOutcomeTooltips);
    // or setTimeout(updateOutcomeTooltips, 0);
  });

  updateOutcomeTooltips();
}
