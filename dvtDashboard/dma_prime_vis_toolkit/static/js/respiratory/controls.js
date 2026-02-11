controlDependencyTest();

export function controlDependencyTest() {
  const disabledRegions = ["county", "zcta", "facility"];

  let selectedPopulation = document.getElementById(
    "map-population-selector",
  ).value;

  const selectEl = document.getElementById("map-geographic-unit-selector");

  if (selectedPopulation === "general_population") {
    selectEl.querySelectorAll("sl-option").forEach((option) => {
      if (disabledRegions.includes(option.value)) {
        // option.disabled = true;
        // option.attributes["visibility"] = "hidden";
        option.style.display = "none"; 

        if (selectEl.value === option.value) {
          selectEl.value = "region";
          selectEl.dispatchEvent(
            new CustomEvent("sl-change", { bubbles: true }),
          );
        }
      }
    });
  } else {
    selectEl.querySelectorAll("sl-option").forEach((option) => {
      if (disabledRegions.includes(option.value)) {
        // option.disabled = false;
        // option.attributes["visibility"] = "visible";
        option.style.display = ""; 
      }
    });
  }
}
