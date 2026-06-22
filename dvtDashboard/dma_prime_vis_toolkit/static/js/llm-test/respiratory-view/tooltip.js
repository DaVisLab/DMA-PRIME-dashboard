import {
  unknownColor,
  dataSourceColorMap,
  populationColorMap,
} from "/static/js/respiratory/utils/colors.js";

import {
  getCurDateValueFromFeature,
  getAllValuesFromFeature,
} from "/static/js/respiratory/utils/dataProcessing_utils.js";

import {
  getDateKey,
  getLastFiniteWeeklyDate,
  hasFiniteTimelineValue,
} from "/static/js/respiratory/utils/time_utils.js";

// visualization variables
var formatInt = d3.format(".0f");
var formatDate = d3.timeFormat("%b %d, %Y");
var ttpHistoryWidthPercentage = 3 / 4;

export function drawTooltip(
  d,
  ttpSVG,
  header,
  footer,
  population,
  outcomeVariable,
  panelType,
  grid = false,
  allDates = false,
  extraSources = [],
  smallPopupData = [],
) {
  // The beginning bits
  var geographicUnit;

  if (grid) {
    geographicUnit = gridGeographicUnitSelector.value;
  } else {
    geographicUnit = mapGeographicUnitSelector.value;
  }

  var historicalDatesArray = allDates ? allHistoricalDates : shortHistoryDates;
  var featureData = JSON.parse(JSON.stringify(d));
  var identifier = featureData.id;
  var data = featureData.data[population][outcomeVariable];

  data.projected.start_date = parseDate(data.projected.start_date);
  data.historical.start_date = d3.timeDay.offset(
    data.projected.start_date,
    -7 * data.historical.values.length,
  );

  data.historical.values = alignWeeklyValuesToDates(
    data.historical.values,
    data.historical.start_date,
    historicalDatesArray,
  );

  if (data.extra.health_system != undefined && allDates) {
    data.extra.health_system = validateFeatureDataLength(
      data.extra.health_system,
      historicalDatesArray.length,
      metadata.short_history_dates.length -
        smallPopupData.extra.health_system.length,
    );
  }

  if (data.extra.RFA != undefined && allDates) {
    data.extra.RFA = validateFeatureDataLength(
      data.extra.RFA,
      historicalDatesArray.length,
      metadata.short_history_dates.length - smallPopupData.extra.RFA.length,
    );
  }

  const projectedLastFiniteDate = getLastFiniteWeeklyDate(
    data.projected.start_date,
    data.projected.values,
  );

  const projectedLastFiniteIndex = projectedLastFiniteDate
    ? Math.max(
        0,
        dayjs(projectedLastFiniteDate).diff(
          dayjs(data.projected.start_date),
          "week",
        ),
      )
    : -1;
  // get dimensions
  var ttpHeight = ttpSVG.node().clientHeight;
  var ttpWidth = ttpSVG.node().clientWidth;
  var outcomeVariableString = metadata["outcome_variables"][outcomeVariable];

  const diseaseVariable = mapDiseaseSelector.value;
  const diseaseVariableString = metadata["diseases"][diseaseVariable];

  var regionInfo = header.select(".tooltip-region-info");
  regionInfo.node().innerHTML = "";

  if (geographicUnit != "state") {
    regionInfo
      .append("p")
      .attr("class", "ttp-location-name")
      .html(`${metadata.region_sizes[geographicUnit]}: ${identifier}`);
  } else {
    regionInfo
      .append("p")
      .attr("class", "ttp-location-name")
      .html("South Carolina");
  }

  if (geographicUnit == "zcta") {
    // TODO: Make county names display correctly (e.g. McCormick instead of Mccormick)
    regionInfo
      .append("p")
      .html(
        `County: ${
          featureData.county[0].toUpperCase() + featureData.county.substring(1)
        }`,
      );
  }

  if (geographicUnit == "facility") {
    regionInfo.style("flex-direction", "column");
    regionInfo.style("align-items", "center");

    const facilityUnitSelected = document.querySelector(
      'input[name="map-facilityOptionGroup"]:checked',
    )?.value;

    if (facilityUnitSelected == "individual-unit") {
      regionInfo
        .select(".ttp-location-name")
        .html(`${featureData.display_name} (${featureData.facility_type})`);
    } else {
      regionInfo.select(".ttp-location-name").html("");
    }

    regionInfo.append("p").html(`Health System: ${featureData.system}`);
  }

  var dataInfo = header.select(".tooltip-data-info");
  dataInfo.node().innerHTML = "";

  if (panelType == "rate") {
    dataInfo
      .append("p")
      .html(
        `Rate of ${outcomeVariableString} (per 1000 people) - ${diseaseVariableString}`,
      );
  } else {
    dataInfo
      .append("p")
      .html(`Count of ${outcomeVariableString} - ${diseaseVariableString}`);
  }

  if (data.historical.values.length) {
    var tooltipString = `${
      data["historical"].reported ? "Reported" : ""
    } ${outcomeVariableString} from ${formatDate(
      historicalDatesArray[0],
    )} to ${formatDate(historicalDatesArray.at(-1))}`;
    dataInfo.append("p").html(tooltipString);
  }

  if (projectedLastFiniteDate) {
    var tooltipString = `Projected ${outcomeVariableString} from ${formatDate(
      d3.timeDay.offset(data.projected.start_date, -6),
    )} to ${formatDate(projectedLastFiniteDate)}`;
    dataInfo.append("p").html(tooltipString);
  }

  // add buttons and legends
  var ttpLegend = footer.select(".tooltip-legend").html("");
  var ttpOptions = footer.select(".tooltip-options").html("");

  var ttpLegendGroup = ttpLegend
    .append("div")
    .attr("class", "tooltip-legend-group");

  // to use later
  ttpSVG.datum({ extraSources: extraSources });

  // create titles/subtitles
  Array("historical", "projected").forEach(function (e_p) {
    var ttpLegendGroupItem = ttpLegendGroup
      .append("div")
      .attr("class", `tooltip-legend-group-item ${e_p}`);

    ttpLegendGroupItem
      .append("sl-icon")
      .attr("name", "square-fill")
      .style("color", populationColorMap[population][e_p]);

    ttpLegendGroupItem
      .append("p")
      .attr("class", "tooltip-label")
      .attr("font-size", "var(--sl-font-size-small)")
      .attr("color", populationColorMap[population][e_p])
      .text(() => {
        var text = outcomeVariableString;
        if (e_p == "projected") {
          if (panelType == "percentDifference") {
            text = `Percent Change of ${text}`;
          } else {
            text += " (projected)";
          }
        } else {
          if (outcomeVariable == "all_hospitalizations") {
            text = " All Historical Hospitalizations";
          } else {
            text = " Historical " + text;
          }

          if (panelType == "percentDifference") {
            text = ` Percent Change of ${text}`;
          } else {
            if (
              outcomeVariable == "inpatient_hospitalizations" ||
              outcomeVariable == "%_influenza-attributable_ed_visits"
            ) {
              if (
                diseaseVariableString == "COVID-19" ||
                diseaseVariableString == "Respiratory Syncytial Virus (RSV)" ||
                diseaseVariableString == "Influenza (Flu)" ||
                diseaseVariableString ==
                  "Respiratory Diseases (COVID-19, Flu, RSV)"
              ) {
                text += " (reported)";
              }
            } else {
              text += data[e_p].reported ? " (reported)" : " (estimated)";
            }
          }
        }
        return text;
      })
      .style("transform", "translate(.5rem,0)");
  });

  if (panelType == "percentDifference") {
    ttpLegendGroup = ttpLegend
      .append("div")
      .attr("class", "tooltip-legend-group");

    var ttpLegendGroupItem = ttpLegendGroup
      .append("div")
      .attr("class", `tooltip-legend-group-item percent-change`);
    ttpLegendGroupItem
      .append("sl-icon")
      .attr("name", "dash-lg")
      .style("color", "#cccccc");
    ttpLegendGroupItem
      .append("p")
      .attr("class", "tooltip-label")
      .attr("font-size", "var(--sl-font-size-small)")
      .attr("color", "black")
      .text(() => {
        var text = outcomeVariableString;
        if (outcomeVariable == "all_hospitalizations") {
          text = " All Historical Hospitalizations";
        } else {
          text = " Historical " + text;
        }
        text += data["historical"].reported ? " (reported)" : " (estimated)";
        return text;
      });

    ttpLegendGroupItem = ttpLegendGroup
      .append("div")
      .attr("class", `tooltip-legend-group-item percent-change`);

    ttpLegendGroupItem
      .append("sl-icon")
      .attr("name", "dash-lg")
      .style("color", "#666666");
    ttpLegendGroupItem
      .append("p")
      .attr("class", "tooltip-label")
      .attr("font-size", "var(--sl-font-size-small)")
      .attr("color", "black")
      .text(() => {
        var text = outcomeVariableString;
        if (outcomeVariable == "all_hospitalizations") {
          text = " All Historical Hospitalizations";
        } else {
          text = " Historical " + text;
        }
        text += " (projected)";
        return text;
      });
  }

  if (!allDates) {
    // add button to expand to large ttp
    var expandPopupButton = ttpOptions
      // .select(".tooltip-expand")
      .append("sl-button")
      .attr("id", "expand-tooltip-btn")
      .attr("size", "small")
      .attr("variant", "default")
      .html("Expand Graph");

    expandPopupButton.on("click", function () {
      var largeTtp = d3.select(tooltipLarge);

      tooltipLarge.show().then(async () => {
        expandPopup(
          d,
          largeTtp,
          population,
          outcomeVariable,
          panelType,
          grid,
          data,
          identifier,
        );
      });
    });
  }

  if (
    [
      "all_hospitalizations",
      "inpatient_hospitalizations",
      "emergency_department_visits",
    ].includes(outcomeVariable)
  ) {
    function ttpOptionsHandler(extraSources, dataSource) {
      // toggle data source-var combo
      if (extraSources.includes(dataSource)) {
        extraSources.splice(extraSources.indexOf(dataSource), 1);
      } else {
        extraSources.push(dataSource);
      }

      drawTooltip(
        d,
        ttpSVG,
        header,
        footer,
        population,
        outcomeVariable,
        panelType,
        grid,
        allDates,
        extraSources,
        smallPopupData,
      );
    }

    Object.entries({
      health_system: "Health System",
      RFA: "RFA",
    })
      .entries()
      .forEach(function (entry) {
        var ds = entry[1][0];
        var dsS = entry[1][1];

        var buttonText = `${dsS} ${outcomeVariableString}`;
        if (extraSources.includes(ds)) {
          var ttpLegendGroup = ttpLegend
            .append("div")
            .attr("class", "tooltip-legend-group");

          var ttpLegendGroupItem = ttpLegendGroup
            .append("div")
            .attr("class", `tooltip-legend-group-item historical`);

          ttpLegendGroupItem
            .append("sl-icon")
            .attr("name", "square-fill")
            .style("color", dataSourceColorMap[ds]);

          ttpLegendGroupItem
            .append("p")
            .attr("class", "tooltip-label")
            .attr("font-size", "var(--sl-font-size-small)")
            .attr("color", dataSourceColorMap[ds])
            .text(() => ` ${buttonText} (reported)`);
          buttonText = "Remove " + buttonText;
        } else {
          buttonText = "Add " + buttonText;
        }

        var button = ttpOptions
          // .select(".tooltip-add-extra")
          .append("sl-button")
          .html(buttonText)
          .attr("size", "small");

        button.node().updateComplete.then(() => {
          var buttonBase = d3
            .select(button.node().shadowRoot)
            .select("[part=base]")
            .style("background-color", "white")
            .style("border-color", dataSourceColorMap[ds])
            .style("color", dataSourceColorMap[ds]);
        });

        var icon = button
          .append("sl-icon")
          .attr("slot", "prefix")
          .attr("name", "graph-up");

        if (data.extra[ds] && data.extra[ds].length) {
          button.on("click", () => {
            ttpOptionsHandler(extraSources, ds);
          });
          icon.style("color", dataSourceColorMap[ds]);
        } else {
          button.attr("disabled", true);
          icon.style("color", "var(--sl-color-gray-500)");
        }
      });
  }

  // Reset svg and get it ready for new viz
  ttpSVG.node().innerHTML = "";

  var dataPointTTP = ttpSVG
    .append("g")
    .attr("class", "data-point-ttp")
    .style("pointer-events", "none");
  var graphSVG = ttpSVG
    .append("svg")
    .attr("class", "tooltip-graph-svg")
    .attr("height", ttpHeight)
    .attr("width", ttpWidth);

  var yAxis = ttpSVG.append("g").attr("class", "y-axis");
  var xAxisHistorical = ttpSVG.append("g").attr("class", "x-axis-historical");
  var xAxisPrediction = ttpSVG.append("g").attr("class", "x-axis-prediction");

  // create scales
  // apply rate if necessaryand figure find max y value
  var countMax = panelType == "rate" ? 1 / d.population : 0.0001; // so y scale is never 0-0

  Array("historical", "projected").forEach((e_p) => {
    if (panelType == "rate") {
      data[e_p]["values"] = data[e_p]["values"].map((d) =>
        !hasFiniteTimelineValue(d) ? NaN : (d / featureData.population) * 1000,
      );
    }
    countMax = d3.max([...data[e_p]["values"], countMax]);
  });

  extraSources.forEach((ds) => {
    if (panelType == "rate") {
      data["extra"][ds] = data["extra"][ds].map((d) =>
        !hasFiniteTimelineValue(d) ? NaN : (d / featureData.population) * 1000,
      );
    }
    countMax = d3.max([...data["extra"][ds], countMax]);
  });

  // figure out how much space is needed for the y-axis text
  var temp = ttpSVG
    .append("text")
    .text(d3.format(".2r")(countMax))
    .attr("x", 0)
    .attr("y", 0);

  var ttpMargins = {
    top: 2 * em,
    bottom: 2.5 * em,
    left: Math.max(20, temp.node().getBBox().width) + 2 * em,
    right: em,
  };
  var ttpGraphWidth = ttpWidth - ttpMargins.right - ttpMargins.left;

  // define scales
  var yScale = d3
    .scaleLinear()
    .domain([0, countMax])
    .nice()
    .range([ttpHeight - ttpMargins.bottom, ttpMargins.top]);

  let defs = graphSVG.append("defs");
  const clipPathId = `ttp-clip-path-def-${
    allDates ? "all-dates" : "short-history"
  }`;

  defs
    .append("clipPath")
    .attr("id", clipPathId)
    .attr("clipPathUnits", "userSpaceOnUse")
    .append("rect")
    .attr("x", ttpMargins.left)
    .attr("y", ttpMargins.top)
    .attr("width", ttpWidth - ttpMargins.right - ttpMargins.left)
    .attr("height", ttpHeight - ttpMargins.bottom - ttpMargins.top);

  if (panelType == "percentDifference") {
    var percentDifferenceHistoricalValues = getAllValuesFromFeature(
      featureData,
      population,
      outcomeVariable,
      panelType,
      "historical",
    );
    percentDifferenceHistoricalValues = alignWeeklyValuesToDates(
      percentDifferenceHistoricalValues,
      data.historical.start_date,
      historicalDatesArray,
    );

    var percentDifferenceProjectedValues = getAllValuesFromFeature(
      featureData,
      population,
      outcomeVariable,
      panelType,
      "projected",
    );

    let pdMax = d3.max([
      ...percentDifferenceHistoricalValues,
      ...percentDifferenceProjectedValues,
    ]);

    let pdMin = d3.min([
      ...percentDifferenceHistoricalValues,
      ...percentDifferenceProjectedValues,
    ]);

    pdMax = Math.min(pdMax, 500);

    temp.text(d3.format(".2r")("-100")).attr("x", 0).attr("y", 0);

    ttpMargins.right =
      ttpMargins.right + em + Math.max(20, temp.node().getBBox().width);

    var yScale2 = d3
      .scaleLinear()
      .domain([pdMin, pdMax])
      .nice()
      .range([ttpHeight - ttpMargins.bottom, ttpMargins.top])
      .clamp(true);

    yScale.domain([
      yScale.domain()[1] * (yScale2.domain()[0] / yScale2.domain()[1]),
      yScale.domain()[1],
    ]);
  }

  var xScaleHistorical = d3.scaleTime();

  if (allDates) {
    xScaleHistorical
      .domain([
        // d3.timeDay.offset(firstDate, -7),
        d3.timeDay.offset(historicalDatesArray[0], -7),
        allHistoricalDates[expectedAllHistoricalDataPoints - 1],
      ])
      .range([
        ttpMargins.left,
        ttpMargins.left + ttpGraphWidth * ttpHistoryWidthPercentage,
      ]);
  } else {
    xScaleHistorical
      .domain([
        d3.timeDay.offset(historicalDatesArray[0], -7),
        shortHistoryDates[expectedShortHistoryDataPoints - 1],
      ])
      .range([
        ttpMargins.left + 1,
        ttpMargins.left + ttpGraphWidth * ttpHistoryWidthPercentage,
      ]);
  }

  const currentWeekStartDate = data.projected.values.length
    ? d3.timeDay.offset(data.projected.start_date, -6)
    : d3.timeDay.offset(currentDate, -6);
  const projectedEndDate = projectedLastFiniteDate || lastDate;

  var xScaleForwardProjection = d3
    .scaleTime()
    .domain([currentWeekStartDate, projectedEndDate])
    .range([
      ttpMargins.left + ttpGraphWidth * ttpHistoryWidthPercentage,
      ttpWidth - ttpMargins.right,
    ]);

  var xScale = function (date) {
    if (dayjs(date).isBefore(currentWeekStartDate)) {
      return xScaleHistorical(date);
    } else {
      return xScaleForwardProjection(date);
    }
  };
  const visibleProjectedDates = projectedLastFiniteDate
    ? d3
        .range(projectedLastFiniteIndex + 1)
        .map((index) => d3.timeDay.offset(data.projected.start_date, 7 * index))
    : [];
  const predictionAxisDates = visibleProjectedDates.filter((date) =>
    dayjs(date).isSameOrBefore(projectedEndDate, "day"),
  );

  // visualize historical
  var historicalGroup = graphSVG.append("g").attr("class", "historical-group");

  if (allDates) {
    historicalGroup
      .append("path")
      .attr(
        "d",
        d3
          .area()
          .x((_, i) => xScale(historicalDatesArray[i]))
          .y0(panelType == "percentDifference" ? yScale2(0) : yScale(0))
          .y1((d) => {
            return panelType == "percentDifference" ? yScale2(d) : yScale(d);
          })
          // .defined((d) => d || d == 0)(
          .defined(hasFiniteTimelineValue)(
          panelType == "percentDifference"
            ? percentDifferenceHistoricalValues
            : data.historical.values,
        ),
      )
      .attr("fill", populationColorMap[population]["historical"]);
  } else {
    var historicalBarWidth = Math.ceil(
      (ttpGraphWidth * ttpHistoryWidthPercentage) / historicalDatesArray.length,
    );

    historicalGroup
      .append("g")
      .selectAll("rect")
      .data(
        panelType == "percentDifference"
          ? percentDifferenceHistoricalValues
          : data.historical.values,
      )
      .enter()
      .append("rect")
      .attr("class", "ttp-data-point")
      .attr("x", (_, i) => {
        return xScale(historicalDatesArray[i]);
      })
      .attr("y", (d) =>
        panelType == "percentDifference"
          ? d > 0
            ? Math.max(yScale2(d), yScale2(500))
            : yScale2(0)
          : yScale(d),
      )
      .attr("height", (d) =>
        panelType == "percentDifference"
          ? Math.abs(yScale2(0) - Math.max(yScale2(d), yScale2(500)))
          : yScale(0) - yScale(d),
      )
      .attr("width", historicalBarWidth)
      .attr("fill", populationColorMap[population]["historical"])
      .attr("transform", `translate(-${historicalBarWidth / 2}, 0)`)
      .on("mouseover", function (event, d) {
        if (hasFiniteTimelineValue(d)) {
          createDataPointTooltip(
            event,
            dataPointTTP,
            panelType,
            ttpHeight,
            ttpMargins,
            historicalDatesArray[0],
          );
        }
      })
      .on("mouseout", function () {
        dataPointTTP.html("");
      });
  }

  // draw box to highlight future projections
  if (projectedLastFiniteDate) {
    const projectionBridgeX = getForecastPointX(
      data.projected.start_date,
      -1,
      xScale,
    );
    const firstProjectionX = getForecastPointX(
      data.projected.start_date,
      0,
      xScale,
    );
    const projectionStartX = (projectionBridgeX + firstProjectionX) / 2;
    const projectionEndX = xScale(projectedLastFiniteDate);

    graphSVG
      .append("rect")
      .attr("class", "tooltip-prediction-highlighter")
      .attr("x", projectionStartX)
      .attr("y", ttpMargins.top)
      .attr("width", Math.max(projectionEndX - projectionStartX, 0))
      .attr("height", ttpHeight - ttpMargins.bottom - ttpMargins.top);
  }

  var predictiveGroup = graphSVG.append("g").attr("class", "predictive-group");
  let projectedTooltipValues = [];

  let lastHistoricalValueIndex = data.historical.values.findLastIndex(
    hasFiniteTimelineValue,
  );

  let projectedValues = [...data.projected.values];

  if (projectedValues.length && projectedLastFiniteDate) {
    if (
      dayjs(historicalDatesArray.at(lastHistoricalValueIndex)).isSame(
        d3.timeDay.offset(data.projected.start_date, -7),
      )
    ) {
      const currentHistoricalValue = Number(
        data.historical.values[lastHistoricalValueIndex],
      );
      const previousHistoricalValue = Number(
        data.historical.values[lastHistoricalValueIndex - 1],
      );
      const valueAppended =
        panelType != "percentDifference"
          ? data.historical.values[lastHistoricalValueIndex]
          : !Number.isFinite(currentHistoricalValue) ||
              !Number.isFinite(previousHistoricalValue) ||
              previousHistoricalValue === 0
            ? null
            : ((currentHistoricalValue - previousHistoricalValue) /
                Math.abs(previousHistoricalValue)) *
              100;

      if (panelType == "percentDifference") {
        percentDifferenceProjectedValues.splice(0, 0, valueAppended);
      } else {
        projectedValues.splice(0, 0, valueAppended);
      }
    } else {
      projectedValues.splice(0, 0, projectedValues[0]);
    }

    const values =
      panelType == "percentDifference"
        ? percentDifferenceProjectedValues
        : projectedValues;
    const projectedSegmentCount = Math.min(
      projectedLastFiniteIndex + 1,
      Math.max(values.length - 1, 0),
    );
    const projectedSegmentIndexes = d3.range(projectedSegmentCount);
    projectedTooltipValues = values.slice(1, projectedSegmentCount + 1);

    let areaPathForPrediction = predictiveGroup
      .selectAll("path")
      .data(projectedSegmentIndexes)
      .enter()
      .append("path")
      .attr("class", "ttp-data-point")
      // .attr("clip-path", `url(#${clipPathId})`)
      .attr("d", (_, i1) =>
        d3
          .area()
          .x((_, i2) => {
            return getForecastPointX(
              data.projected.start_date,
              i1 + i2 - 1,
              xScale,
            );
          })
          .y0(panelType == "percentDifference" ? yScale2(0) : yScale(0))
          .y1((d) =>
            panelType == "percentDifference" ? yScale2(d) : yScale(d),
          )
          .defined(hasFiniteTimelineValue)(
          values.slice(i1, i1 + 2),
        ),
      )
      .attr("fill", populationColorMap[population]["projected"])
      .on("mouseover", function (event, d) {
        if (hasFiniteTimelineValue(d)) {
          createDataPointTooltip(
            event,
            dataPointTTP,
            panelType,
            ttpHeight,
            ttpMargins,
            data.projected.start_date,
          );
        }
      })
      .on("mouseout", function () {
        dataPointTTP.html("");
      });

    if (
      data.projected.uncertainty_range &&
      data.projected.uncertainty_range.percentile25 != undefined &&
      data.projected.uncertainty_range.percentile25.length > 0
    ) {
      areaPathForPrediction.remove();

      predictiveGroup
        .selectAll("path")
        .data(projectedSegmentIndexes)
        // .data(projectedValues.slice(1)) // one segment per consecutive pair
        .enter()
        .append("path")
        .attr("class", "ttp-data-point")
        .attr("clip-path", `url(#${clipPathId})`)
        .attr("d", (_, i1) =>
          d3
            .line()
            .x((_, i2) =>
              getForecastPointX(
                data.projected.start_date,
                i1 + i2 - 1,
                xScale,
              ),
            )
            .y((d) =>
              panelType == "percentDifference" ? yScale2(d) : yScale(d),
            )
            .defined(hasFiniteTimelineValue)(
            values.slice(i1, i1 + 2),
          ),
        )
        .attr("fill", "none")
        .attr("stroke", populationColorMap[population]["projected"])
        .attr("stroke-width", 2)
        .on("mouseover", function (event, d) {
          if (hasFiniteTimelineValue(d)) {
            createDataPointTooltip(
              event,
              dataPointTTP,
              panelType,
              ttpHeight,
              ttpMargins,
              data.projected.start_date,
            );
          }
        })
        .on("mouseout", function () {
          dataPointTTP.html("");
        });

      const firstProjectedValue = data.projected.values[0];

      const uncertainty25 =
        panelType != "rate"
          ? data.projected.uncertainty_range.percentile25
          : data.projected.uncertainty_range.percentile25.map(
              (value) => (value / featureData.population) * 1000,
            );

      const uncertainty75 =
        panelType != "rate"
          ? data.projected.uncertainty_range.percentile75
          : data.projected.uncertainty_range.percentile75.map(
              (value) => (value / featureData.population) * 1000,
            );
      const uncertainty2_5 =
        panelType != "rate"
          ? data.projected.uncertainty_range.percentile2_5
          : data.projected.uncertainty_range.percentile2_5.map(
              (value) => (value / featureData.population) * 1000,
            );
      const uncertainty97_5 =
        panelType != "rate"
          ? data.projected.uncertainty_range.percentile97_5
          : data.projected.uncertainty_range.percentile97_5.map(
              (value) => (value / featureData.population) * 1000,
            );

      uncertainty25.unshift(firstProjectedValue);
      uncertainty75.unshift(firstProjectedValue);
      uncertainty2_5.unshift(firstProjectedValue);
      uncertainty97_5.unshift(firstProjectedValue);

      const n = Math.min(uncertainty2_5.length, projectedSegmentCount + 1);

      const band95 = d3
        .area()
        .x((_, i) =>
          getForecastPointX(data.projected.start_date, i - 1, xScale),
        )
        .y0((_, i) => {
          return panelType === "percentDifference"
            ? yScale2(0)
            : yScale(uncertainty2_5[i]);
        })
        .y1((_, i) => {
          return panelType === "percentDifference"
            ? yScale2(0)
            : yScale(uncertainty97_5[i]);
        })
        .defined(
          (_, i) => uncertainty2_5[i] != null && uncertainty97_5[i] != null,
        );

      const band50 = d3
        .area()
        .x((_, i) =>
          getForecastPointX(data.projected.start_date, i - 1, xScale),
        )
        .y0((_, i) => {
          return panelType === "percentDifference"
            ? yScale2(0)
            : yScale(uncertainty25[i]);
        })
        .y1((_, i) => {
          return panelType === "percentDifference"
            ? yScale2(0)
            : yScale(uncertainty75[i]);
        })
        .defined(
          (_, i) => uncertainty25[i] != null && uncertainty75[i] != null,
        );

      predictiveGroup
        .append("path")
        .datum(d3.range(n))
        .attr("class", "path-uncertainty-50")
        .attr("clip-path", `url(#${clipPathId})`)
        .attr("d", band50)
        .attr("fill", populationColorMap[population]["projected"])
        .attr("opacity", 0.5);

      predictiveGroup
        .append("path")
        .datum(d3.range(n))
        .attr("class", "path-uncertainty-95")
        .attr("clip-path", `url(#${clipPathId})`)
        .attr("d", band95)
        .attr("fill", populationColorMap[population]["projected"])
        .attr("opacity", 0.2);
    }

    // // marker for each datapoint on prediction line
    predictiveGroup
      .append("g")
      .selectAll("circle")
      .data(projectedTooltipValues)
      .enter()
      .append("circle")
      .attr("class", "ttp-data-point")
      .attr("clip-path", `url(#${clipPathId})`)
      .attr("r", 3)
      .attr("cx", (_, i) =>
        getForecastPointX(data.projected.start_date, i, xScale),
      )
      .attr("cy", (d) =>
        panelType == "percentDifference" ? yScale2(d) : yScale(d),
      )
      .style("opacity", (d) => (hasFiniteTimelineValue(d) ? 1 : 0))
      .attr("stroke", populationColorMap[population]["projected"])
      .on("mouseover", function (event, d) {
        if (hasFiniteTimelineValue(d)) {
          createDataPointTooltip(
            event,
            dataPointTTP,
            panelType,
            ttpHeight,
            ttpMargins,
            data.projected.start_date,
          );
        }
      })
      .on("mouseout", function () {
        dataPointTTP.html("");
      });
  }

  if (panelType == "percentDifference") {
    const visibleProjectedValues = data.projected.values.slice(
      0,
      visibleProjectedDates.length,
    );

    graphSVG
      .append("path")
      .attr(
        "d",
        d3
          .line()
          .defined(hasFiniteTimelineValue)
          .x((_, i) => xScale(historicalDatesArray[i]))
          .y((d, i) => yScale(d))
          .curve(d3.curveMonotoneX)(data.historical.values),
      )
      .attr("class", "historical-path-percent-diff-type")
      .attr("stroke", "#cccccc")
      .attr("fill", "none")
      .attr("stroke-width", 2);

    graphSVG
      .append("path")
      .attr(
        "d",
        d3
          .line()
          .defined(hasFiniteTimelineValue)
          .x((_, i) =>
            i === 0
              ? xScale(historicalDatesArray[historicalDatesArray.length - 1])
              : getForecastPointX(data.projected.start_date, i - 1, xScale),
          )
          .y((d, i) => yScale(d))
          .curve(d3.curveMonotoneX)([
          data.historical.values[data.historical.values.length - 1],
          ...visibleProjectedValues,
        ]),
      )
      .attr("class", "projected-path-percent-diff-type")
      .attr("stroke", "#666666")
      .attr("fill", "none")
      .attr("stroke-width", 2);
  }

  // draw extra if selected
  extraSources.forEach((ds) => {
    // draw historical line chart
    historicalGroup
      .append("path")
      .attr(
        "d",
        d3
          .line()
          .x((_, i) => xScale(historicalDatesArray[i]))
          .y((d, i) => yScale(d))
          .defined((d) => d || d == 0)
          .curve(d3.curveMonotoneX)(data.extra[ds]),
      )
      .attr("stroke", dataSourceColorMap[ds])
      .attr("fill", "none")
      .attr("stroke-width", 3);
  });

  // draw axes
  xAxisHistorical // historical
    .attr("transform", `translate(0,${ttpHeight - ttpMargins.bottom})`)
    .call(
      d3
        .axisBottom(xScaleHistorical)
        .tickSize(4)
        .tickFormat((d, i) => {
          return xScaleHistorical.range()[1] - xScaleHistorical(d) > 2 * em
            ? d3.timeFormat("%b %Y")(d)
            : "";
        }),
    )
    .selectAll("text")
    .attr("class", "tooltip-label")
    .style("text-anchor", "end")
    .attr("fill", "var(--sl-color-neutral-1000)")
    .attr("transform", "rotate(-40)");

  xAxisPrediction //prediction
    .attr("transform", `translate(0,${ttpHeight - ttpMargins.bottom})`)
    .call(
      d3
        .axisBottom(xScaleForwardProjection)
        .tickValues([
          xScaleForwardProjection.domain()[0],
          ...predictionAxisDates,
        ])
        .tickSize(4)
        .tickFormat(d3.timeFormat("%d %b")),
    )
    .selectAll("text")
    .attr("class", "tooltip-label")
    .style("text-anchor", "end")
    .attr("fill", "var(--sl-color-neutral-1000)")
    .attr("transform", "rotate(-40)");

  xAxisPrediction
    .selectAll("path, line")
    .attr("stroke", "var(--sl-color-neutral-1000)");
  // display y-axis on the left

  const yAxisTitle = yAxis
    .append("text")
    .attr(
      "transform",
      `translate(${0.6 * em}, ${yScale(d3.mean(yScale.domain()))})rotate(-90)`,
    )
    .attr("text-anchor", "middle")
    .attr("fill", "var(--sl-color-neutral-1000)")
    .attr("font-size", "var(--sl-font-size-small)");

  // Use tspans for a line break in SVG text
  yAxisTitle
    .append("tspan")
    .attr("x", 0)
    .attr("dy", 0)
    .text(outcomeVariableString);
  yAxisTitle
    .append("tspan")
    .attr("x", 0)
    .attr("dy", "1.1em")
    .attr("font-size", "var(--sl-font-size-x-small)")
    .text(`(${diseaseVariableString})`);

  yAxis
    .append("g")
    .attr("transform", `translate(${ttpMargins.left},0)`)
    .call(d3.axisLeft(yScale).ticks(5).tickSize(4))
    .selectAll("text")
    .attr("class", "tooltip-label")
    .attr("fill", "var(--sl-color-neutral-1000)");
  yAxis.selectAll("path, line").attr("stroke", "var(--sl-color-neutral-1000)");

  if (panelType == "percentDifference") {
    yAxis.html("");

    let mainYAxis = yAxis.append("g");
    let lesserYAxis = yAxis.append("g");

    mainYAxis
      .append("text")
      .attr(
        "transform",
        `translate(${1.25 * em},${yScale(d3.mean(yScale.domain()))})rotate(-90)`,
      )
      .attr("text-anchor", "middle")
      .style("fill", populationColorMap[population]["historical"])
      .attr("font-size", "var(--sl-font-size-small)")
      .text("Percent Change");

    mainYAxis
      .append("g")
      .attr("transform", `translate(${ttpMargins.left},0)`)
      .call(d3.axisLeft(yScale2).ticks(5).tickSize(4))
      .selectAll("text")
      .attr("class", "tooltip-label")
      .style("fill", populationColorMap[population]["historical"]);

    mainYAxis
      .selectAll("path, line")
      .style("stroke", populationColorMap[population]["historical"]);

    const lesserYAxisTitle = lesserYAxis
      .append("text")
      .attr(
        "transform",
        `translate(${ttpWidth - 1 * em}, ${yScale(
          d3.mean(yScale.domain()),
        )})rotate(-90)`,
      )
      .attr("text-anchor", "middle")
      .attr("fill", "var(--sl-color-neutral-1000)")
      .attr("font-size", "var(--sl-font-size-small)");

    lesserYAxisTitle
      .append("tspan")
      .attr("x", 0)
      .attr("dy", 0)
      .text(outcomeVariableString);

    lesserYAxisTitle
      .append("tspan")
      .attr("x", 0)
      .attr("dy", "1.1em")
      .attr("font-size", "var(--sl-font-size-x-small)")
      .text(`(${diseaseVariableString})`);

    lesserYAxis
      .append("g")
      .attr("transform", `translate(${ttpWidth - ttpMargins.right},0)`)
      .call(d3.axisRight(yScale).ticks(5).tickSize(4))
      .selectAll("text")
      .attr("class", "tooltip-label")
      .attr("fill", "var(--sl-color-neutral-1000)");
    lesserYAxis
      .selectAll("path, line")
      .attr("stroke", "var(--sl-color-neutral-1000)");
  }

  const tooltipPoints = buildTooltipPoints({
    historicalDatesArray,
    historicalValues:
      panelType == "percentDifference"
        ? percentDifferenceHistoricalValues
        : data.historical.values,
    projectedStartDate: data.projected.start_date,
    projectedValues: projectedTooltipValues,
    xScale,
    getProjectedPointX: (index) =>
      getForecastPointX(data.projected.start_date, index, xScale),
  });
  const showNearestChartTooltip = function (event) {
    const [mouseX] = d3.pointer(event, graphSVG.node());
    const nearestPoint = getNearestTooltipPoint(tooltipPoints, mouseX);

    if (nearestPoint) {
      createDataPointTooltipAt(
        nearestPoint,
        dataPointTTP,
        panelType,
        ttpHeight,
        ttpMargins,
      );
    }
  };

  graphSVG.on("mouseleave", function () {
    dataPointTTP.html("");
  });

  graphSVG
    .append("rect")
    .attr("class", "tooltip-chart-hit-area")
    .attr("x", ttpMargins.left)
    .attr("y", ttpMargins.top)
    .attr("width", ttpWidth - ttpMargins.right - ttpMargins.left)
    .attr("height", ttpHeight - ttpMargins.bottom - ttpMargins.top)
    .attr("fill", "transparent")
    .attr("pointer-events", "all")
    .on("mouseover", showNearestChartTooltip)
    .on("mousemove", showNearestChartTooltip)
    .on("pointerenter", showNearestChartTooltip)
    .on("pointermove", showNearestChartTooltip)
    .on("click", showNearestChartTooltip);

  temp.remove();
}

function validateFeatureDataLength(featureData, targetLength, offset = 0) {
  if (featureData.length < targetLength) {
    let numToAdd = targetLength - offset - featureData.length;
    featureData = Array(numToAdd).fill(null).concat(featureData);
  }

  return featureData;
}

function alignWeeklyValuesToDates(values, startDate, targetDates) {
  const valueByDate = new Map();
  const start = dayjs(startDate);

  if (!start.isValid() || !Array.isArray(values)) {
    return (targetDates || []).map(() => null);
  }

  values.forEach((value, index) => {
    const date = start.add(index, "week").toDate();
    valueByDate.set(getDateKey(date), value);
  });

  return (targetDates || []).map((date) => {
    const dateKey = getDateKey(date);

    return valueByDate.has(dateKey) ? valueByDate.get(dateKey) : null;
  });
}

function getWeekCenterX(weekEndDate, xScale) {
  const weekStartDate = d3.timeDay.offset(weekEndDate, -6);

  return (xScale(weekStartDate) + xScale(weekEndDate)) / 2;
}

function getForecastPointX(projectedStartDate, projectedIndex, xScale) {
  const weekEndDate = d3.timeDay.offset(projectedStartDate, 7 * projectedIndex);

  if (projectedIndex <= 0) {
    return getWeekCenterX(weekEndDate, xScale);
  }

  const previousLabelDate = d3.timeDay.offset(
    projectedStartDate,
    7 * (projectedIndex - 1),
  );

  return (xScale(previousLabelDate) + xScale(weekEndDate)) / 2;
}

function buildTooltipPoints({
  historicalDatesArray,
  historicalValues,
  projectedStartDate,
  projectedValues,
  xScale,
  getProjectedPointX,
}) {
  const tooltipPoints = [];

  historicalValues.forEach((value, index) => {
    if (!hasFiniteTimelineValue(value)) return;

    const date = historicalDatesArray[index];
    const numericValue = Number(value);

    tooltipPoints.push({
      date,
      value: numericValue,
      x: xScale(date),
    });
  });

  projectedValues.forEach((value, index) => {
    if (!hasFiniteTimelineValue(value)) return;

    const date = d3.timeDay.offset(projectedStartDate, 7 * index);
    const numericValue = Number(value);

    tooltipPoints.push({
      date,
      value: numericValue,
      x: getProjectedPointX ? getProjectedPointX(index) : xScale(date),
    });
  });

  return tooltipPoints;
}

function getNearestTooltipPoint(tooltipPoints, mouseX) {
  if (!tooltipPoints.length) return null;

  return d3.least(tooltipPoints, (point) => Math.abs(point.x - mouseX));
}

function createDataPointTooltip(
  event,
  dataPointTTP,
  panelType,
  ttpHeight,
  ttpMargins,
  groupStartDate,
) {
  let thisDataPointShape = event.target;
  let dataShapeBBox = thisDataPointShape.getBBox();

  let date = d3.timeDay.offset(
    groupStartDate,
    7 *
      d3
        .select(thisDataPointShape.parentNode)
        .selectAll(".ttp-data-point")
        .nodes()
        .indexOf(thisDataPointShape),
  );

  let value = d3.select(thisDataPointShape).datum();

  createDataPointTooltipAt(
    {
      date,
      value,
      x: dataShapeBBox.x + dataShapeBBox.width / 2 + thisDataPointShape.getCTM().e,
    },
    dataPointTTP,
    panelType,
    ttpHeight,
    ttpMargins,
  );
}

function createDataPointTooltipAt(
  point,
  dataPointTTP,
  panelType,
  ttpHeight,
  ttpMargins,
) {
  if (!hasFiniteTimelineValue(point.value) || !point.date) return;
  const value = Number(point.value);

  dataPointTTP.html("");
  dataPointTTP.raise();

  let tooltipDateFormat = d3.timeFormat("%b %d");
  let dateStr = `${tooltipDateFormat(
    d3.timeDay.offset(point.date, -6),
  )} - ${tooltipDateFormat(point.date)}`;

  let valueStr =
    panelType == "rate"
      ? `${value.toFixed(3)} per 1000`
      : value.toFixed(3).toString();

  let valueTypeStr;
  switch (panelType) {
    case "count":
      valueTypeStr = "Count";
      break;
    case "rate":
      valueTypeStr = "Rate";
      break;
    case "percentDifference":
      valueTypeStr = "Percent Change";
      break;
    default:
      valueTypeStr = "Count";
      break;
  }

  var dx = point.x;
  var dy = 1 * em;

  dataPointTTP.append("text").text(dateStr).attr("x", dx).attr("y", dy);

  dataPointTTP
    .append("text")
    .text(`${valueTypeStr}: ${valueStr}`)
    .attr("x", dx)
    .attr("y", dy + 0.75 * em);

  dataPointTTP
    .append("line")
    .attr("stroke", "black")
    .attr("stroke-width", 1)
    .attr("x1", dx)
    .attr("y1", dy + 1 * em)
    .attr("x2", dx)
    .attr("y2", ttpHeight - ttpMargins.bottom);
}

async function expandPopup(
  d,
  largeTtp,
  population,
  outcomeVariable,
  panelType,
  grid,
  data,
  identifier,
) {
  let allExtendedData;
  if (grid) {
    allExtendedData = await d3.json(
      `/recommendation/respiratory/${gridGeographicUnitSelector.value}/${
        gridDiseaseSelector.value
      }/extended?data_version=${metadata.data_version}&${parseInt(
        Math.random() * 9999999999,
      )}`,
    );
  } else {
    allExtendedData = await d3.json(
      `/recommendation/respiratory/${mapGeographicUnitSelector.value}/${
        mapDiseaseSelector.value
      }/extended?data_version=${metadata.data_version}&${parseInt(
        Math.random() * 9999999999,
      )}`,
    );
  }

  let ttpData = structuredClone(d);
  ttpData.data = allExtendedData[identifier];

  drawTooltip(
    ttpData,
    largeTtp.select(".tooltip-outer-svg"),
    largeTtp.select(".tooltip-header"),
    largeTtp.select(".tooltip-footer"),
    population,
    outcomeVariable,
    panelType,
    grid,
    true,
    [],
    data,
  );
}

function initTooltip(
  header,
  footer,
  geographicUnit,
  identifier,
  panelType,
  outcomeVariableString,
  diseaseVariableString,
  data,
  historicalDatesArray,
) {
  var regionInfo = header.select(".tooltip-region-info");
  regionInfo.node().innerHTML = "";

  if (geographicUnit != "state") {
    regionInfo
      .append("p")
      .attr("class", "ttp-location-name")
      .html(`${metadata.region_sizes[geographicUnit]}: ${identifier}`);
  } else {
    regionInfo
      .append("p")
      .attr("class", "ttp-location-name")
      .html("South Carolina");
  }

  if (geographicUnit == "zcta") {
    // TODO: Make county names display correctly (e.g. McCormick instead of Mccormick)
    regionInfo
      .append("p")
      .html(
        `County: ${
          featureData.county[0].toUpperCase() + featureData.county.substring(1)
        }`,
      );
  }

  if (geographicUnit == "facility") {
    regionInfo.style("flex-direction", "column");
    regionInfo.style("align-items", "center");
    regionInfo.select(".ttp-location-name").html(
      `${featureData.display_name} (${featureData.facility_type})`,
      // `${metadata.region_sizes[geographicUnit]}: ${featureData.display_name} (${featureData.facility_type})`,
    );

    // regionInfo.append("br")
    regionInfo.append("p").html(`Health System: ${featureData.system}`);
  }

  var dataInfo = header.select(".tooltip-data-info");
  dataInfo.node().innerHTML = "";

  if (panelType == "rate") {
    dataInfo
      .append("p")
      .html(
        `Rate of ${outcomeVariableString} (per 1000 people) - ${diseaseVariableString}`,
      );
  } else {
    dataInfo
      .append("p")
      .html(`Count of ${outcomeVariableString} - ${diseaseVariableString}`);
  }

  if (data.historical.values.length) {
    var tooltipString = `${
      data["historical"].reported ? "Reported" : ""
    } ${outcomeVariableString} from ${formatDate(
      historicalDatesArray[0],
    )} to ${formatDate(historicalDatesArray.at(-1))}`;
    dataInfo.append("p").html(tooltipString);
  }

  const thisProjectedEndDate = getLastFiniteWeeklyDate(
    data.projected.start_date,
    data.projected.values,
  );

  if (thisProjectedEndDate) {
    var tooltipString = `Projected ${outcomeVariableString} from ${formatDate(
      d3.timeDay.offset(data.projected.start_date, -6),
    )} to ${formatDate(thisProjectedEndDate)}`;
    dataInfo.append("p").html(tooltipString);
  }

  // add buttons and legends
  var ttpLegend = footer.select(".tooltip-legend").html("");
  var ttpOptions = footer.select(".tooltip-options").html("");

  var ttpLegendGroup = ttpLegend
    .append("div")
    .attr("class", "tooltip-legend-group");
}

const getActiveTooltipDate = () =>
  window.respiratoryAnimationDate || window.currentDate;

function formatSimpleTooltipValue(value, panelType) {
  const displayValue = panelType === "percentDifference" ? value?.[2] : value;

  return Number.isFinite(displayValue) ? displayValue.toFixed(3) : "N/A";
}

export function showSimpleGeoTooltip(info) {
  const tooltip = document.getElementById("geo-tooltip");

  if (info.picked) {
    const parent = tooltip.parentElement;

    const style = window.getComputedStyle(parent);
    const paddingLeft = parseFloat(style.paddingLeft);
    tooltip.style.display = "block";
    const gap = 10; // mouse - tooltip gap

    const properties = info.object.properties;
    const tooltipDate = getActiveTooltipDate();

    const val = getCurDateValueFromFeature(
      info.object,
      mapPopulationSelector.value,
      mapOutcomeVariableSelector.value,
      mapTypeSwitch.value,
      mapIncludeImputations.checked,
      undefined,
      tooltipDate,
    );

    tooltip.innerText = `${properties.id}: ${formatSimpleTooltipValue(
      val,
      mapTypeSwitch.value,
    )} \n ${tooltipDate.toLocaleDateString()}`;
    const rect = tooltip.getBoundingClientRect();

    tooltip.style.left = info.x - rect.width / 2 + paddingLeft + "px";
    tooltip.style.top = info.y - rect.height - 10 + "px";
  } else {
    tooltip.style.display = "none";
  }
}
