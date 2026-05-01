function dispatchSelectionChange(element) {
  element.dispatchEvent(new CustomEvent("sl-change", { bubbles: true }));
}

function ensureSelectedValue(element, availableValues) {
  if (!availableValues.length || availableValues.includes(element.value)) {
    return;
  }

  element.value = availableValues[0];
  dispatchSelectionChange(element);
}

function labelFrom(dictionary, value) {
  return dictionary?.[value] ?? value;
}

function appendTooltipOptions(
  selector,
  tooltipClass,
  optionClass,
  values,
  labels,
  tooltips,
) {
  d3.select(selector).selectAll(`.${tooltipClass}`).remove();

  const wrappers = d3
    .select(selector)
    .selectAll(`.${tooltipClass}`)
    .data(values)
    .enter()
    .append("sl-tooltip")
    .attr("class", tooltipClass)
    .attr("content", (d) => labelFrom(tooltips, d))
    .attr("trigger", "hover")
    .attr("hoist", "");

  wrappers
    .append("sl-option")
    .attr("class", optionClass)
    .attr("value", (d) => d)
    .html((d) => labelFrom(labels, d));
}

function appendPlainOptions(selector, optionClass, values, labels) {
  d3.select(selector).selectAll(`.${optionClass}`).remove();

  d3.select(selector)
    .selectAll(`.${optionClass}`)
    .data(values)
    .enter()
    .append("sl-option")
    .attr("class", optionClass)
    .attr("value", (d) => d)
    .html((d) => labelFrom(labels, d));
}

function getAvailableOutcomes(disEl, geoEl, popEl) {
  return metadata.available_models?.[disEl.value]?.[geoEl.value]?.[popEl.value] ?? [];
}

function getAvailablePopulations(disEl, geoEl) {
  return Object.keys(metadata.available_models?.[disEl.value]?.[geoEl.value] ?? {});
}

function getAvailableGeographicUnits(disEl) {
  return Object.keys(metadata.available_models?.[disEl.value] ?? {});
}

export async function updateOutcomeOptions(view, outEl, disEl, geoEl, popEl) {
  const availableOutcomeVariables = getAvailableOutcomes(disEl, geoEl, popEl);

  appendTooltipOptions(
    `#${view}-outcome-variable-selector`,
    `${view}-outcome-tooltip`,
    `${view}-outcome-option`,
    availableOutcomeVariables,
    metadata.outcome_variables,
    metadata.outcome_variables_tooltips,
  );

  ensureSelectedValue(outEl, availableOutcomeVariables);
}

export async function updatePopulationOptions(
  view,
  outEl,
  disEl,
  geoEl,
  popEl,
) {
  const availablePopulations = getAvailablePopulations(disEl, geoEl);

  appendTooltipOptions(
    `#${view}-population-variable-selector`,
    `${view}-population-tooltip`,
    `${view}-population-option`,
    availablePopulations,
    metadata.populations,
    metadata.populations_tooltips,
  );

  ensureSelectedValue(popEl, availablePopulations);
}

export async function updateGeographicOptions(
  view,
  outEl,
  disEl,
  geoEl,
  popEl,
) {
  const availableGeographicUnits = getAvailableGeographicUnits(disEl);

  appendPlainOptions(
    `#${view}-geographic-unit-selector`,
    `${view}-geographic-unit-option`,
    availableGeographicUnits,
    metadata.region_sizes,
  );

  ensureSelectedValue(geoEl, availableGeographicUnits);
}
