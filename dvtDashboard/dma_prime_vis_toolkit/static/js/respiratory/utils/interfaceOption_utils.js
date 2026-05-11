import {
  getAvailableGeographicUnits,
  getAvailableOutcomeVariables,
  getAvailablePopulations,
} from "./controlState_utils.js";

function dispatchSelectionChange(element) {
  element.dispatchEvent(new CustomEvent("sl-change", { bubbles: true }));
}

function ensureSelectedValue(element, availableValues, shouldDispatch = true) {
  if (!availableValues.length || availableValues.includes(element.value)) {
    return;
  }

  element.value = availableValues[0];
  if (shouldDispatch) {
    dispatchSelectionChange(element);
  }
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

export function updateOutcomeOptions(
  view,
  outEl,
  disEl,
  geoEl,
  popEl,
  options = {},
) {
  const availableOutcomeVariables = getAvailableOutcomeVariables(
    metadata,
    disEl.value,
    geoEl.value,
    popEl.value,
  );

  appendTooltipOptions(
    `#${view}-outcome-variable-selector`,
    `${view}-outcome-tooltip`,
    `${view}-outcome-option`,
    availableOutcomeVariables,
    metadata.outcome_variables,
    metadata.outcome_variables_tooltips,
  );

  ensureSelectedValue(
    outEl,
    availableOutcomeVariables,
    options.dispatchSelectionChange ?? true,
  );
}

export function updatePopulationOptions(
  view,
  outEl,
  disEl,
  geoEl,
  popEl,
  options = {},
) {
  const availablePopulations = getAvailablePopulations(
    metadata,
    disEl.value,
    geoEl.value,
  );

  appendTooltipOptions(
    `#${view}-population-selector`,
    `${view}-population-tooltip`,
    `${view}-population-option`,
    availablePopulations,
    metadata.populations,
    metadata.populations_tooltips,
  );

  ensureSelectedValue(
    popEl,
    availablePopulations,
    options.dispatchSelectionChange ?? true,
  );
}

export function updateGeographicOptions(
  view,
  outEl,
  disEl,
  geoEl,
  popEl,
  options = {},
) {
  const availableGeographicUnits = getAvailableGeographicUnits(
    metadata,
    disEl.value,
  );

  appendPlainOptions(
    `#${view}-geographic-unit-selector`,
    `${view}-geographic-unit-option`,
    availableGeographicUnits,
    metadata.region_sizes,
  );

  ensureSelectedValue(
    geoEl,
    availableGeographicUnits,
    options.dispatchSelectionChange ?? true,
  );
}
