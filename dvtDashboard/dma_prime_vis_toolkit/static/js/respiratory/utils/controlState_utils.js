export function getSelectValue(element) {
  return element?.value || element?.getAttribute("value") || "";
}

export function getCurrentControlState({
  diseaseEl,
  geographicUnitEl,
  populationEl,
  outcomeEl,
}) {
  return {
    disease: getSelectValue(diseaseEl),
    geographicUnit: getSelectValue(geographicUnitEl),
    population: getSelectValue(populationEl),
    outcomeVariable: getSelectValue(outcomeEl),
  };
}

export function getControlStateKey(state) {
  return [
    state.disease,
    state.geographicUnit,
    state.population,
    state.outcomeVariable,
  ].join("|");
}

export function chooseAvailableValue(values, currentValue, preferredValues = []) {
  const preferredValue = preferredValues.find((value) => values.includes(value));

  if (preferredValue) return preferredValue;
  if (values.includes(currentValue)) return currentValue;

  return values[0] || "";
}

export function getAvailableGeographicUnits(metadata, disease) {
  return Object.keys(metadata.available_models?.[disease] ?? {});
}

export function getAvailablePopulations(metadata, disease, geographicUnit) {
  return Object.keys(
    metadata.available_models?.[disease]?.[geographicUnit] ?? {},
  );
}

export function getAvailableOutcomeVariables(
  metadata,
  disease,
  geographicUnit,
  population,
) {
  return (
    metadata.available_models?.[disease]?.[geographicUnit]?.[population] ?? []
  );
}

function setOptionVisibility(selectEl, visibleValues) {
  const visibleValueSet = new Set(visibleValues);

  selectEl.querySelectorAll("sl-option").forEach((option) => {
    const optionValue = getSelectValue(option);
    option.style.display = visibleValueSet.has(optionValue) ? "" : "none";
  });
}

function showAllOptions(selectEl) {
  selectEl.querySelectorAll("sl-option").forEach((option) => {
    option.style.display = "";
  });
}

export function applyRespiratoryOptionRestrictions({
  diseaseEl,
  geographicUnitEl,
  populationEl,
  outcomeEl,
}) {
  if (!diseaseEl || !geographicUnitEl || !populationEl || !outcomeEl) {
    return;
  }

  const disease = getSelectValue(diseaseEl);
  const geographicUnit = getSelectValue(geographicUnitEl);
  const population = getSelectValue(populationEl);
  const outcomeVariable = getSelectValue(outcomeEl);

  showAllOptions(diseaseEl);
  showAllOptions(geographicUnitEl);
  showAllOptions(populationEl);
  showAllOptions(outcomeEl);

  Array.from(document.getElementsByClassName("facility-option-container")).forEach(
    (element) => {
      element.style.display = geographicUnit === "facility" ? "" : "none";
    },
  );

  if (disease === "respiratory_diseases") {
    setOptionVisibility(geographicUnitEl, ["facility"]);
    setOptionVisibility(populationEl, ["health_system"]);
    return;
  }

  setOptionVisibility(populationEl, ["general_population"]);

  const visibleGeographicUnits =
    population === "general_population" &&
    outcomeVariable === "inpatient_hospitalizations"
      ? ["state", "region"]
      : ["state"];
  setOptionVisibility(geographicUnitEl, visibleGeographicUnits);

  outcomeEl.querySelectorAll("sl-option").forEach((option) => {
    if (getSelectValue(option) === "all_hospitalizations") {
      option.style.display = "none";
    }
  });
}

export function resolveRespiratoryControlState(metadata, currentState) {
  const disease = currentState.disease || "";
  const availableGeographicUnits = getAvailableGeographicUnits(
    metadata,
    disease,
  );
  const preferredGeographicUnits =
    disease === "respiratory_diseases"
      ? ["facility"]
      : currentState.geographicUnit === "facility"
        ? ["state", "region"]
        : [];

  let geographicUnit = chooseAvailableValue(
    availableGeographicUnits,
    currentState.geographicUnit,
    preferredGeographicUnits,
  );

  let availablePopulations = getAvailablePopulations(
    metadata,
    disease,
    geographicUnit,
  );
  const preferredPopulations =
    disease === "respiratory_diseases"
      ? ["health_system"]
      : ["general_population"];
  let population = chooseAvailableValue(
    availablePopulations,
    currentState.population,
    preferredPopulations,
  );

  let availableOutcomeVariables = getAvailableOutcomeVariables(
    metadata,
    disease,
    geographicUnit,
    population,
  );
  const preferredOutcomeVariables =
    disease === "respiratory_diseases"
      ? ["all_encounters"]
      : ["inpatient_hospitalizations", "positive_tests"];
  let outcomeVariable =
    availableOutcomeVariables.includes(currentState.outcomeVariable) &&
    currentState.outcomeVariable !== "all_hospitalizations"
      ? currentState.outcomeVariable
      : chooseAvailableValue(
          availableOutcomeVariables,
          currentState.outcomeVariable,
          preferredOutcomeVariables,
        );

  if (
    disease !== "respiratory_diseases" &&
    geographicUnit !== "state" &&
    outcomeVariable !== "inpatient_hospitalizations" &&
    availableGeographicUnits.includes("state")
  ) {
    geographicUnit = "state";
    availablePopulations = getAvailablePopulations(
      metadata,
      disease,
      geographicUnit,
    );
    population = chooseAvailableValue(
      availablePopulations,
      population,
      preferredPopulations,
    );
    availableOutcomeVariables = getAvailableOutcomeVariables(
      metadata,
      disease,
      geographicUnit,
      population,
    );
    outcomeVariable =
      availableOutcomeVariables.includes(outcomeVariable) &&
      outcomeVariable !== "all_hospitalizations"
        ? outcomeVariable
        : chooseAvailableValue(
            availableOutcomeVariables,
            outcomeVariable,
            preferredOutcomeVariables,
          );
  }

  return {
    disease,
    geographicUnit,
    population,
    outcomeVariable,
    availableGeographicUnits,
    availablePopulations,
    availableOutcomeVariables,
  };
}

export function isAvailableControlState(metadata, state) {
  return getAvailableOutcomeVariables(
    metadata,
    state.disease,
    state.geographicUnit,
    state.population,
  ).includes(state.outcomeVariable);
}

export function normalizeModelOutcome(outcomeVariable) {
  return outcomeVariable === "%_influenza-attributable_ed_visits"
    ? "attributable_ed_visits"
    : outcomeVariable;
}

export function getRespiratoryModelDataSrc({
  metadata,
  disease,
  geographicUnit,
  population,
  outcomeVariable,
  location,
  dataVersion,
}) {
  if (!location || !isAvailableControlState(metadata, {
    disease,
    geographicUnit,
    population,
    outcomeVariable,
  })) {
    return "";
  }

  const pathParts = [
    disease,
    geographicUnit,
    population,
    normalizeModelOutcome(outcomeVariable),
    location,
    dataVersion,
  ].map((value) => encodeURIComponent(String(value ?? "")));

  return `/data/respiratory/model/${pathParts.join("/")}`;
}

export function titleCaseWords(str) {
  return String(str)
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function getLocationsForGeographicUnit(metadata, geographicUnit) {
  if (geographicUnit === "state") {
    return ["SC"];
  }

  return Array.from(metadata[geographicUnit] ?? [])
    .sort()
    .map(titleCaseWords);
}
