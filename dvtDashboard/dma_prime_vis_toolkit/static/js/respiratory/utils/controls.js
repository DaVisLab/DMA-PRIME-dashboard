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
    testDiseaseOutcomeDipendency();
    testDiseaseOutcomeDipendencyOnGridView();
  }
});

function _controlReset(popEl, geoEl, outEl, disEl) {
  disEl.querySelectorAll("sl-option").forEach((opt) => {
    // if (opt.value == "respiratory_diseases") {
    //   opt.style.display = "none";
    // } else {
    //   opt.style.display = "";
    // }
    opt.style.display = "";
  });

  popEl.querySelectorAll("sl-option").forEach((opt) => {
    opt.style.display = "";
    // console.log(opt.value);
    // if (opt.value == "heath_system") {
    //   opt.style.display = "none";
    // } else {
    //   opt.style.display = "";
    // }
  });

  geoEl.querySelectorAll("sl-option").forEach((opt) => {
    opt.style.display = "";
  });
  outEl.querySelectorAll("sl-option").forEach((opt) => {
    opt.style.display = "";
  });
}

function _controlDependecyTest(popEl, geoEl, outEl, disEl) {
  _controlReset(popEl, geoEl, outEl, disEl);

  if (geoEl.value == "facility") {
    document.getElementById("map-facility-option-container").style.display = "";
    // document.getElementById("grid-facility-option-container").style.display =
    //   "";
  } else {
    document.getElementById("map-facility-option-container").style.display =
      "none";
    // document.getElementById("grid-facility-option-container").style.display =
    //   "none";
  }

  if (disEl.value == "respiratory_diseases") {
    if (geoEl.value != "facility") {
      geoEl.value = "facility";

      geoEl.dispatchEvent(
        new CustomEvent("sl-change", {
          bubbles: true,
        }),
      );
      return;
    }

    if (popEl.value !== "health_system") {
      popEl.value = "health_system";
      popEl.dispatchEvent(new CustomEvent("sl-change", { bubbles: true }));
      return;
    }

    // 2) geographic unit: only SC
    geoEl.querySelectorAll("sl-option").forEach((opt) => {
      if (opt.value === "facility") {
        opt.style.display = "";
      } else {
        opt.style.display = "none";
      }
    });

    popEl.querySelectorAll("sl-option").forEach((opt) => {
      if (opt.value === "health_system") {
        opt.style.display = "";
      } else {
        opt.style.display = "none";
      }
    });
  } else {
    // 1) population:
    popEl.querySelectorAll("sl-option").forEach((opt) => {
      if (opt.value === "general_population") {
        opt.style.display = "";
      } else {
        opt.style.display = "none";
      }
    });

    if (popEl.value !== "general_population") {
      popEl.value = "general_population";
      popEl.dispatchEvent(new CustomEvent("sl-change", { bubbles: true }));
    }

    // 2) geographic unit: only SC
    geoEl.querySelectorAll("sl-option").forEach((opt) => {
      if (opt.value === "state") {
        opt.style.display = "";
      } else if (
        opt.value == "region" &&
        popEl.value == "general_population" &&
        outEl.value == "inpatient_hospitalizations"
      ) {
        // exception
        // -1 influenza -> turn region on
        opt.style.display = "";
      } else {
        opt.style.display = "none";
      }
    });

    outEl.querySelectorAll("sl-option").forEach((opt) => {
      // console.log(opt.value);
      if (opt.value === "all_hospitalizations" && opt.style.display != "none") {
        // opt.style.display = "";
        opt.style.display = "none";
      } else if (outEl.value === "all_hospitalizations") {
        outEl.value = "inpatient_hospitalizations";
        outEl.dispatchEvent(new CustomEvent("sl-change", { bubbles: true }));
      } else {
        // opt.style.display = "none";
      }
    });

    geoEl.querySelectorAll("sl-option").forEach((option) => {
      if (
        geoEl.value != "state" &&
        outEl.value != "inpatient_hospitalizations"
      ) {
        geoEl.value = "state";
        geoEl.dispatchEvent(new CustomEvent("sl-change", { bubbles: true }));
        return;
      }
    });
  }
}

function _testDiseaseOutcomeDipendency(
  disEl,
  outcomeOptions,
  tooltips,
  populationTooltips,
) {
  const diseases = metadata.diseases;

  if (disEl.value == "respiratory_diseases") {
    return;
  }

  function updateOutcomeTooltips() {
    const selectedKey = disEl.value;
    const selectedLabel = diseases[selectedKey] ?? selectedKey;

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

  function updateOutcomeOptions() {
    const selectedKey = disEl.value;
    const selectedLabel = diseases[selectedKey] ?? selectedKey;

    outcomeOptions.forEach((t) => {
      if (t.innerHTML.includes("Attributable ED Visits")) {
        t.innerHTML = `% ${selectedLabel}-Attributable ED Visits`;
      }
    });
  }

  updateOutcomeTooltips();
  updateOutcomeOptions();
}

window._controlDependecyTest = _controlDependecyTest;
window._testDiseaseOutcomeDipendency = _testDiseaseOutcomeDipendency;

export function controlDependencyTest() {
  testDiseaseOutcomeDipendency();

  const popEl = document.getElementById("map-population-selector");
  const geoEl = document.getElementById("map-geographic-unit-selector");
  const outEl = document.getElementById("map-outcome-variable-selector");
  const disEl = document.getElementById("map-disease-selector");

  _controlDependecyTest(popEl, geoEl, outEl, disEl);
}

export function controlDependencyTestOnGridView() {
  testDiseaseOutcomeDipendencyOnGridView();

  const popEl = document.getElementById("grid-population-selector");
  const geoEl = document.getElementById("grid-geographic-unit-selector");
  const outEl = document.getElementById("grid-outcome-variable-selector");
  const disEl = document.getElementById("grid-disease-selector");

  _controlDependecyTest(popEl, geoEl, outEl, disEl);
}

function testDiseaseOutcomeDipendency() {
  const diseaseSelect = document.getElementById("map-disease-selector");
  const outcomeOptions = document.querySelectorAll(".map-outcome-option");
  const tooltips = document.querySelectorAll(".map-outcome-tooltip");
  const populationTooltips = document.querySelectorAll(
    ".map-population-tooltip",
  );

  _testDiseaseOutcomeDipendency(
    diseaseSelect,
    outcomeOptions,
    tooltips,
    populationTooltips,
  );
}

function testDiseaseOutcomeDipendencyOnGridView() {
  const diseaseSelect = document.getElementById("grid-disease-selector");
  const outcomeOptions = document.querySelectorAll(".grid-outcome-option");
  const tooltips = document.querySelectorAll(".grid-outcome-tooltip");
  const populationTooltips = document.querySelectorAll(
    ".grid-population-tooltip",
  );

  _testDiseaseOutcomeDipendency(
    diseaseSelect,
    outcomeOptions,
    tooltips,
    populationTooltips,
  );
}
