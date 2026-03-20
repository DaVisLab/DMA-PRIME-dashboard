export async function updateOutcomeOptions(view, outEl, disEl, geoEl, popEl) {
  d3.select(`#${view}-outcome-variable-selector`)
    .selectAll(`.${view}-outcome-tooltip`)
    .remove();

  let availableOutcomeVariables =
    metadata.available_models[disEl.value][geoEl.value][popEl.value];

  d3.select(`#${view}-outcome-variable-selector`)
    .selectAll(`.${view}-outcome-tooltip`)
    .data(availableOutcomeVariables)
    .enter()
    .append("sl-tooltip")
    .attr("class", `${view}-outcome-tooltip`)
    .attr("content", (d) => metadata.outcome_variables_tooltips[d])
    .attr("triger", "hover")
    .attr("hoist", "")
    .append("sl-option")
    .attr("class", `${view}-outcome-option`)
    .attr("value", (d) => d)
    .html((d) => metadata.outcome_variables[d]);

  if (availableOutcomeVariables.includes(outEl.value)) {
    // do nothing
  } else {
    // mapOutcomeVariable = availableOutcomeVariables[0];
    outEl.value = availableOutcomeVariables[0];
  }
}

export async function updatePopulationOptions(
  view,
  outEl,
  disEl,
  geoEl,
  popEl,
) {
  d3.select(`#${view}-population-variable-selector`)
    .selectAll(`.${view}-population-tooltip`)
    .remove();

  let availablePopulations = Object.keys(
    metadata.available_models[disEl.value][geoEl.value],
  );

  d3.select(`#${view}-population-variable-selector`)
    .selectAll(`.${view}-population-tooltip`)
    .data(availablePopulations)
    .enter()
    .append("sl-tooltip")
    .attr("class", `${view}-population-tooltip`)
    .attr("content", (d) => metadata.populations_tooltips[d])
    .attr("triger", "hover")
    .attr("hoist", "")
    .append("sl-option")
    .attr("class", `${view}-population-option`)
    .attr("value", (d) => d)
    .html((d) => metadata.populations[d]);

  if (availablePopulations.includes(popEl.value)) {
    // do nothing
  } else {
    popEl.value = availablePopulations[0];
  }
}

export async function updateGeographicOptions(
  view,
  outEl,
  disEl,
  geoEl,
  popEl,
) {
  d3.select(`#${view}-geographic-variable-selector`)
    .selectAll(`.${view}-geographic-unit-option`)
    .remove();

  // d3.selectAll(".map-geographic-unit-option").remove();

  let availableGeographicUnits = Object.keys(
    metadata.available_models[disEl.value],
  );

  // d3.select(mapGeographicUnitSelector)
  d3.select(`#${view}-geographic-unit-selector`)
    .selectAll(`.${view}-geographic-unit-option`)
    .data(availableGeographicUnits)
    .enter()
    .append("sl-option")
    .attr("class", `${view}-geographic-unit-option`)
    .attr("value", (d) => d)
    .html((d) => metadata.region_sizes[d]);

  if (availableGeographicUnits.includes(geoEl.value)) {
    // do nothing
  } else {
    geoEl.value = availableGeographicUnits[0];
  }
}
