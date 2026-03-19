export async function updateOutcomeVariableOptions(view, outEl, disEl, geoEl, popEl) {
  d3.selectAll(`.${view}-outcome-tooltip`).remove();

  var availableOutcomeVariables =
    metadata.available_models[disEl.value][geoEl.value][popEl.value];

console.log(metadata)
console.log(disEl.value)
console.log(geoEl.value)
console.log(popEl.value)
    console.log(availableOutcomeVariables)

  d3.select(mapOutcomeVariableSelector)
    .selectAll(`.${view}-outcome-tooltip`)
    .data(availableOutcomeVariables)
    .enter()
    .append("sl-tooltip")
    .attr("class", `.${view}-outcome-tooltip`)
    .attr("content", (d) => metadata.outcome_variables_tooltips[d])
    .attr("triger", "hover")
    .attr("hoist", "")
    .append("sl-option")
    .attr("class", `.${view}-outcome-option`)
    .attr("value", (d) => d)
    .html((d) => metadata.outcome_variables[d]);

  if (availableOutcomeVariables.includes(mapOutcomeVariable)) {
    // do nothing
  } else {
    mapOutcomeVariable = availableOutcomeVariables[0];
    outEl.value = mapOutcomeVariable;
  }
}
