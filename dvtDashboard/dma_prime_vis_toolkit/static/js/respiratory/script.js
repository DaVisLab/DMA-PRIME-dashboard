export {
  zctaData,
  populationColorMap,
  dataSourceColorMap,
  unknownColor,
  getFeatureValue,
  getAllValuesFromFeature,
  getAllFeaturesValue,
  getBoundsOfCoords,
  getCenter,
  drawTooltip,
  drawStateHospitalizations,
  drawLargeStateHospitalizations,
};

// data
const zctaData = await d3.json(
  `/data/respiratory/zcta/covid_19?data_version=${
    metadata.data_version
  }&${parseInt(Math.random() * 9999999999)}`,
);
await Promise.allSettled([
  // wait for following to be defined/load in
  customElements.whenDefined("sl-select"),
  customElements.whenDefined("sl-option"),
]);

// visualization variables
var formatInt = d3.format(".0f");
var formatDate = d3.timeFormat("%b %d, %Y");

var unknownColor = d3.hsl("#CCCCCC");

var dataSourceColorMap = {
  health_system: "#648FFF",
  RFA: "#785EF0",
  // "RFA-projected": "#382EA0", //this doesn't make sense with our current system but I wanted to save the color as it goes with the above
};

var populationColorMap = {
  general_population: { historical: "#FFB000", projected: "#FE6100" },
  health_system: { historical: "#648FFF", projected: "#345FAF" },
};

var ttpHistoryWidthPercentage = 3 / 4;

var styleSheet = new CSSStyleSheet();

d3.selectAll("sl-tooltip")
  .nodes()
  .forEach((n, i) => {
    d3.select(n.shadowRoot)
      .select("div[part='body']")
      .style(
        "background-color",
        `hsla(${getComputedStyle(document.head)
          .getPropertyValue("--sl-color-neutral-1000")
          .replace("hsl(", "")
          .replace(")", "")}, 0.925)`,
      );
  });

window.addEventListener("keydown", (event) => {
  if (event.key == "m") {
    function waitForChange() {
      if (changed != true) {
        window.setTimeout(waitForChange, 10);
      } else {
        styleSheet.deleteRule(0);
        styleSheet.insertRule(
          `
                    .tooltip-div {
                        /* tooltip's containing div */
                        background-color: hsla(${getComputedStyle(document.head)
                          .getPropertyValue("--sl-color-neutral-0")
                          .replace("hsl(", "")
                          .replace(")", "")}, 0.925);
                    }`,
          0,
        );
        changed = false;
      }
    }
    waitForChange();
  }
});

document.adoptedStyleSheets = [styleSheet];

function getAllValuesFromFeature(
  featureProperties,
  population,
  outcomeVariable,
  panelType,
  timeFrame,
) {
  const thisData =
    featureProperties.data[population][outcomeVariable][timeFrame];
  const newData = [];

  for (let i = 0; i < thisData.values.length; i++) {
    let value = NaN;

    try {
      if (panelType === "percentDifference") {
        const thisWeekDatum = parseFloat(thisData.values[i]);
        const lastWeekDatum = parseFloat(thisData.values[i - 1]);

        if (!isNaN(thisWeekDatum) && !isNaN(lastWeekDatum)) {
          value =
            ((thisWeekDatum - lastWeekDatum) / Math.abs(lastWeekDatum)) * 100;
        }
      } else if (panelType === "rate") {
        value = (thisData.values[i] / featureProperties.population) * 1000;
      } else {
        value = thisData.values[i];
      }
    } catch (e) {
      
    }

    newData.push(value);
  }

  if (
    timeFrame === "projected" &&
    panelType === "percentDifference" &&
    newData.length > 0
  ) {
    const lastWeekDatum =
      featureProperties.data[population][outcomeVariable][
        "historical"
      ].values.at(-1);
    const thisWeekDatum = thisData.values[0];

    if (!isNaN(thisWeekDatum) && !isNaN(lastWeekDatum)) {
      newData[0] =
        ((thisWeekDatum - lastWeekDatum) / Math.abs(lastWeekDatum)) * 100;
    }
  }

  return newData;
}

function getUncertaintyValues_percentDiff_ForPanelType(
  featureProperties,
  population,
  outcomeVariable,
  uncertaintyType,
  panelType = "percentDifference",
) {
  const thisData = [
    ...featureProperties.data[population][outcomeVariable]["projected"][
      "uncertainty_range"
    ][uncertaintyType],
  ];

  const projectionValue = [
    ...featureProperties.data[population][outcomeVariable]["projected"].values,
  ];

  thisData.unshift(projectionValue[0]);

  const newData = [];

  if (thisData && thisData.length > 0) {
    for (let i = 0; i < thisData.length; i++) {
      if (i === 0) {
        newData.push(0);
        continue;
      }

      let value = NaN;

      if (panelType === "percentDifference") {
        const thisWeekDatum = parseFloat(thisData[i]);
        const lastWeekDatum = parseFloat(projectionValue[i - 1]);

        if (!isNaN(thisWeekDatum) && !isNaN(lastWeekDatum)) {
          value =
            ((thisWeekDatum - lastWeekDatum) / Math.abs(lastWeekDatum)) * 100;
        }
      } else if (panelType === "rate") {
        value = (thisData[i] / featureProperties.population) * 1000;
      } else {
        value = thisData[i];
      }

      newData.push(value);
    }
  }

  return newData;
}

function getAllFeaturesValue(
  features,
  population,
  outcomeVariable,
  panelType,
  imputations,
) {
  var arr = features.map((feature) => {
    return getFeatureValue(
      feature,
      population,
      outcomeVariable,
      panelType,
      imputations,
    );
  });

  return arr;
}

function getFeatureValue(
  feature,
  population,
  outcomeVariable,
  panelType,
  imputations,
  projectionType = "projected",
) {
  const thisData =
    feature.properties.data[population][outcomeVariable][projectionType];

  if (!imputations && thisData.imputed) {
    if (panelType === "percentDifference") {
      return [NaN, NaN, NaN];
    }
    return NaN;
  }

  const dateIndex = dayjs(currentDate).diff(thisData.start_date, "week");
  let thisWeekDatum = parseFloat(thisData.values.at(dateIndex));

  if (panelType === "rate") {
    thisWeekDatum = (thisWeekDatum / feature.properties.population) * 1000;
  }

  if (panelType === "percentDifference") {
    let lastWeekDatum;

    if (dateIndex === 0) {
      lastWeekDatum = parseFloat(
        feature.properties.data[population][outcomeVariable][
          "historical"
        ].values.at(expectedShortHistoryDataPoints - 1),
      );
    } else {
      lastWeekDatum = parseFloat(thisData.values.at(dateIndex - 1));
    }

    let percentDifference = undefined;
    if (!isNaN(thisWeekDatum) && !isNaN(lastWeekDatum)) {
      percentDifference =
        ((thisWeekDatum - lastWeekDatum) / Math.abs(lastWeekDatum)) * 100;
    }

    return [lastWeekDatum, thisWeekDatum, percentDifference];
  }

  return thisWeekDatum;
}

function getBoundsOfCoords(coordinates) {
  var bounds = new maplibregl.LngLatBounds();
  function addCoordToBounds(bounds, arr) {
    if (Array.isArray(arr[0])) {
      arr.forEach((a) => {
        addCoordToBounds(bounds, a);
      });
    } else {
      bounds.extend(arr);
      return;
    }
  }
  addCoordToBounds(bounds, coordinates);
  return bounds;
}

function getCenter(feature) {
  var coordinates = [feature.properties.INTPTLON, feature.properties.INTPTLAT];

  if (!(coordinates[0] && coordinates[1])) {
    coordinates = getBoundsOfCoords(feature.geometry.coordinates).getCenter();
    coordinates = [coordinates.lng, coordinates.lat];
  } else {
    coordinates[0] = fixCoord(coordinates[0]);
    coordinates[1] = fixCoord(coordinates[1]);
  }
  return coordinates;
}

function fixCoord(coord) {
  while (coord[1] == "0") {
    coord = coord[0] + coord.slice(2);
  }
  return parseFloat(coord);
}

function drawTooltip(
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

  // console.log(shortHistoryDates);

  var historicalDatesArray = allDates ? allHistoricalDates : shortHistoryDates;
  // console.log(historicalDatesArray);
  var featureData = JSON.parse(JSON.stringify(d));
  var identifier = featureData.id;
  var data = featureData.data[population][outcomeVariable];

  data.historical.start_date = d3.timeDay.offset(
    parseDate(data.projected.start_date),
    -7 * data.historical.values.length,
  );

  data.historical.values = validateFeatureDataLength(
    data.historical.values,
    historicalDatesArray.length,
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

  data.projected.start_date = parseDate(data.projected.start_date);

  // get dimensions
  var ttpHeight = ttpSVG.node().clientHeight;
  var ttpWidth = ttpSVG.node().clientWidth;

  // to use later
  ttpSVG.datum({ extraSources: extraSources });

  // create titles/subtitles
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
  if (data.projected.values.length) {
    let thisProjectedEndDate = d3.timeDay.offset(
      data.projected.start_date,
      7 * (data.projected.values.length - 1),
    );
    var tooltipString = `Projected ${outcomeVariableString} from ${formatDate(
      d3.timeDay.offset(data.projected.start_date, -6),
    )} to ${formatDate(thisProjectedEndDate)}`;
    dataInfo.append("p").html(tooltipString);
  }

  // add buttons and legends
  var ttpLegend = footer.select(".tooltip-legend").html("");
  var ttpOptions = footer.select(".tooltip-options").html("");
  // footer.select(".tooltip-options").select(".tooltip-expand").html("");
  // footer.select(".tooltip-options").select(".tooltip-add-extra").html("");
  // var ttpOptions = footer.select(".tooltip-options")

  var ttpLegendGroup = ttpLegend
    .append("div")
    .attr("class", "tooltip-legend-group");

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
            // console.log(outcomeVariable);
            // console.log(diseaseVariableString);
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
      .attr("size", "small")
      .attr("variant", "default")
      .html("Expand Graph");

    expandPopupButton.on("click", () => {
      var largeTtp = d3.select(tooltipLarge);

      tooltipLarge.show().then(async () => {
        var allExtendedData;
        if (grid) {
          allExtendedData = await d3.json(
            `/data/respiratory/${gridGeographicUnitSelector.value}/${
              gridDiseaseSelector.value
            }/extended?data_version=${metadata.data_version}&${parseInt(
              Math.random() * 9999999999,
            )}`,
          );
        } else {
          allExtendedData = await d3.json(
            `/data/respiratory/${mapGeographicUnitSelector.value}/${
              mapDiseaseSelector.value
            }/extended?data_version=${metadata.data_version}&${parseInt(
              Math.random() * 9999999999,
            )}`,
          );
        }
        var ttpData = {
          id: identifier,
          display_name: data.display_name,
          county: data.county,
          data: allExtendedData[identifier],
          facility_type: data.facility_type,
          system: data.system,
        };

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

  var dataPointTTP = ttpSVG.append("g").attr("class", "data-point-ttp");
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
        isNaN(d) ? NaN : (d / featureData.population) * 1000,
      );
    }
    countMax = d3.max([...data[e_p]["values"], countMax]);
  });

  extraSources.forEach((ds) => {
    if (panelType == "rate") {
      data["extra"][ds] = data["extra"][ds].map((d) =>
        isNaN(d) ? NaN : (d / featureData.population) * 1000,
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

  console.log(countMax);
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

  let clipPath = defs
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

    var percentDifferenceProjectedValues = getAllValuesFromFeature(
      featureData,
      population,
      outcomeVariable,
      panelType,
      "projected",
    );

    var percentile25_percentDiff =
      getUncertaintyValues_percentDiff_ForPanelType(
        featureData,
        population,
        outcomeVariable,
        "percentile25",
        "percentDifference",
      );

    var percentile75_percentDiff =
      getUncertaintyValues_percentDiff_ForPanelType(
        featureData,
        population,
        outcomeVariable,
        "percentile75",
        "percentDifference",
      );

    var percentile2_5_percentDiff =
      getUncertaintyValues_percentDiff_ForPanelType(
        featureData,
        population,
        outcomeVariable,
        "percentile2_5",
        "percentDifference",
      );

    var percentile97_5_percentDiff =
      getUncertaintyValues_percentDiff_ForPanelType(
        featureData,
        population,
        outcomeVariable,
        "percentile97_5",
        "percentDifference",
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
      .range([ttpHeight - ttpMargins.bottom, ttpMargins.top]);

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
        // d3.timeDay.offset(startShortHistory, -7),
        d3.timeDay.offset(historicalDatesArray[0], -7),
        shortHistoryDates[expectedShortHistoryDataPoints - 1],
      ])
      .range([
        ttpMargins.left + 1,
        ttpMargins.left + ttpGraphWidth * ttpHistoryWidthPercentage,
      ]);
  }

  var xScaleForwardProjection = d3
    .scaleTime()
    .domain([d3.timeDay.offset(currentDate, -6), lastDate])
    .range([
      ttpMargins.left + ttpGraphWidth * ttpHistoryWidthPercentage,
      ttpWidth - ttpMargins.right,
    ]);

  var xScale = function (date) {
    if (dayjs(date).isBefore(d3.timeDay.offset(currentDate, -6))) {
      return xScaleHistorical(date);
    } else {
      return xScaleForwardProjection(date);
    }
  };

  // for data point tooltips (gives date and value)
  function createDataPointTooltip(event, groupStartDate) {
    dataPointTTP.html("");

    let tooltipDateFormat = d3.timeFormat("%b %d");

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

    let dateStr = `${tooltipDateFormat(
      d3.timeDay.offset(date, -6),
    )} - ${tooltipDateFormat(date)}`;

    let value = d3.select(thisDataPointShape).datum();
    let valueStr =
      panelType == "rate"
        ? `${value.toFixed(2)} per 1000`
        : value.toFixed(2).toString();

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

    var dx =
      dataShapeBBox.x + dataShapeBBox.width / 2 + thisDataPointShape.getCTM().e;
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
          .y1((d) =>
            panelType == "percentDifference" ? yScale2(d) : yScale(d),
          )
          .defined((d) => d || d == 0)(
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
      .attr("transform", `translate(-${historicalBarWidth}, 0)`)
      .on("mouseover", function (event, d) {
        if (!isNaN(d)) {
          createDataPointTooltip(event, historicalDatesArray[0]);
        }
      })
      .on("mouseout", function () {
        dataPointTTP.html("");
      });
  }

  // draw box to highlight future projections
  graphSVG
    .append("rect")
    .attr("class", "tooltip-prediction-highlighter")
    .attr("x", xScaleForwardProjection.range()[0])
    .attr("y", ttpMargins.top)
    .attr(
      "width",
      xScaleForwardProjection.range()[1] - xScaleForwardProjection.range()[0],
    )
    .attr("height", ttpHeight - ttpMargins.bottom - ttpMargins.top);

  var predictiveGroup = graphSVG.append("g").attr("class", "predictive-group");

  let lastHistoricalValueIndex = data.historical.values.findLastIndex(
    (d) => !isNaN(parseFloat(d)),
  );
  let projectedValues = data.projected.values;

  if (projectedValues.length) {
    if (
      dayjs(historicalDatesArray.at(lastHistoricalValueIndex)).isSame(
        d3.timeDay.offset(data.projected.start_date, -7),
      )
    ) {
      // last historical date is week before projected start date
      projectedValues.splice(
        0,
        0,
        data.historical.values[lastHistoricalValueIndex],
      );
    } else {
      projectedValues.splice(0, 0, projectedValues[0]);
    }

    let areaPathForPrediction = predictiveGroup
      .selectAll("path")
      .data(projectedValues.slice(1))
      .enter()
      .append("path")
      .attr("class", "ttp-data-point")
      .attr("clip-path", `url(#${clipPathId})`)
      .attr("d", (_, i1) =>
        d3
          .area()
          .x((_, i2) =>
            xScale(
              d3.timeDay.offset(data.projected.start_date, 7 * (i1 + i2 - 1)),
            ),
          )
          .y0(panelType == "percentDifference" ? yScale2(0) : yScale(0))
          .y1((d) =>
            panelType == "percentDifference" ? yScale2(d) : yScale(d),
          )
          .defined((d) => d || d == 0)(
          panelType == "percentDifference"
            ? percentDifferenceProjectedValues.slice(i1, i1 + 2)
            : projectedValues.slice(i1, i1 + 2),
        ),
      )
      .attr("fill", populationColorMap[population]["projected"])
      .on("mouseover", function (event, d) {
        if (!isNaN(d)) {
          createDataPointTooltip(event, data.projected.start_date);
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
      console.log(percentDifferenceProjectedValues);
      console.log(percentile25_percentDiff);
      areaPathForPrediction.remove();

      predictiveGroup
        .selectAll("path")
        .data(projectedValues.slice(1)) // one segment per consecutive pair
        .enter()
        .append("path")
        .attr("class", "ttp-data-point")
        .attr("clip-path", `url(#${clipPathId})`)
        .attr("d", (_, i1) =>
          d3
            .line()
            .x((_, i2) =>
              xScale(
                d3.timeDay.offset(data.projected.start_date, 7 * (i1 + i2 - 1)),
              ),
            )
            .y((d) =>
              panelType == "percentDifference" ? yScale2(d) : yScale(d),
            )
            .defined((d) => d || d === 0)(
            panelType == "percentDifference"
              ? percentDifferenceProjectedValues.slice(i1, i1 + 2)
              : projectedValues.slice(i1, i1 + 2),
          ),
        )
        .attr("fill", "none")
        .attr("stroke", populationColorMap[population]["projected"])
        .attr("stroke-width", 2)
        .on("mouseover", function (event, d) {
          if (!isNaN(d)) {
            createDataPointTooltip(event, data.projected.start_date);
          }
        })
        .on("mouseout", function () {
          dataPointTTP.html("");
        });

      const firstProjectedValue = data.projected.values[0];

      // console.log(data.projected.uncertainty_range.percentile25);
      const uncertainty25 = data.projected.uncertainty_range.percentile25;
      const uncertainty75 = data.projected.uncertainty_range.percentile75;
      const uncertainty2_5 = data.projected.uncertainty_range.percentile2_5;
      const uncertainty97_5 = data.projected.uncertainty_range.percentile97_5;

      uncertainty25.unshift(firstProjectedValue);
      uncertainty75.unshift(firstProjectedValue);
      uncertainty2_5.unshift(firstProjectedValue);
      uncertainty97_5.unshift(firstProjectedValue);

      const n = uncertainty2_5.length; // time length

      const band95 = d3
        .area()
        .x((_, i) =>
          xScale(d3.timeDay.offset(data.projected.start_date, 7 * (i - 1))),
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
          xScale(d3.timeDay.offset(data.projected.start_date, 7 * (i - 1))),
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
      .data(
        panelType == "percentDifference"
          ? percentDifferenceProjectedValues
          : data.projected.values,
      )
      .enter()
      .append("circle")
      .attr("class", "ttp-data-point")
      .attr("clip-path", `url(#${clipPathId})`)
      .attr("r", 3)
      .attr("cx", (_, i) =>
        xScale(d3.timeDay.offset(data.projected.start_date, 7 * (i - 1))),
      )
      .attr("cy", (d) =>
        panelType == "percentDifference" ? yScale2(d) : yScale(d),
      )
      .style("opacity", (d) => (isNaN(d) ? 0 : 1))
      .attr("stroke", populationColorMap[population]["projected"])
      .on("mouseover", function (event, d) {
        if (!isNaN(d)) {
          createDataPointTooltip(
            event,
            d3.timeDay.offset(data.projected.start_date, -7),
          );
        }
      })
      .on("mouseout", function () {
        dataPointTTP.html("");
      });
  }

  if (panelType == "percentDifference") {
    graphSVG
      .append("path")
      .attr(
        "d",
        d3
          .line()
          .defined((d) => d || d == 0)
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
          .defined((d) => d || d == 0)
          .x((_, i) => xScale(d3.timeDay.offset(predictionDates[i], -7)))
          .y((d, i) => yScale(d))
          .curve(d3.curveMonotoneX)(data.projected.values),
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
          // if (i > 0) {
          //   if (
          //     historicalDatesArray[i].getMonth() ==
          //     historicalDatesArray[i - 1].getMonth()
          //   ) {
          //     return "";
          //   }
          // }

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
        .tickValues([xScaleForwardProjection.domain()[0], ...predictionDates])
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

  temp.remove();
}

// function drawTooltip(
//   d,
//   ttpSVG,
//   header,
//   footer,
//   population,
//   outcomeVariable,
//   panelType,
//   grid = false,
//   allDates = false,
//   extraSources = [],
//   smallPopupData = {},
// ) {
//   const geographicUnit = grid
//     ? gridGeographicUnitSelector.value
//     : mapGeographicUnitSelector.value;

//   const historicalDatesArray = allDates ? allHistoricalDates : shortHistoryDates;

//   const safeLen = (v) => (Array.isArray(v) ? v.length : 0);
//   const clampNonNegative = (n) => Math.max(0, Number.isFinite(n) ? n : 0);
//   const asDate = (v) => (v instanceof Date ? v : parseDate(v));
//   const finiteValues = (arr) => (arr ?? []).filter((v) => Number.isFinite(v));

//   const safeValidateFeatureDataLength = (values, targetLength, offset = 0) => {
//     return validateFeatureDataLength(
//       Array.isArray(values) ? [...values] : [],
//       targetLength,
//       clampNonNegative(offset),
//     );
//   };

//   const featureData =
//     typeof structuredClone === "function"
//       ? structuredClone(d)
//       : JSON.parse(JSON.stringify(d));

//   const identifier = featureData?.id;
//   const data = featureData?.data?.[population]?.[outcomeVariable];
//   if (!data?.historical || !data?.projected) return;

//   data.extra = data.extra ?? {};
//   data.projected.start_date = asDate(data.projected.start_date);

//   // projected date list used throughout the tooltip
//   const predictionDates = (data.projected.values ?? []).map((_, i) =>
//     d3.timeDay.offset(data.projected.start_date, 7 * i),
//   );

//   data.historical.start_date = d3.timeDay.offset(
//     data.projected.start_date,
//     -7 * (data.historical.values?.length ?? 0),
//   );

//   data.historical.values = safeValidateFeatureDataLength(
//     data.historical.values,
//     historicalDatesArray.length,
//   );

//   if (allDates && data.extra.health_system != null) {
//     const offset =
//       metadata.short_history_dates.length -
//       safeLen(smallPopupData?.extra?.health_system);

//     data.extra.health_system = safeValidateFeatureDataLength(
//       data.extra.health_system,
//       historicalDatesArray.length,
//       offset,
//     );
//   }

//   if (allDates && data.extra.RFA != null) {
//     const offset =
//       metadata.short_history_dates.length - safeLen(smallPopupData?.extra?.RFA);

//     data.extra.RFA = safeValidateFeatureDataLength(
//       data.extra.RFA,
//       historicalDatesArray.length,
//       offset,
//     );
//   }

//   // dimensions
//   const ttpHeight = ttpSVG.node().clientHeight;
//   const ttpWidth = ttpSVG.node().clientWidth;

//   // store extras on svg
//   ttpSVG.datum({ extraSources });

//   // labels
//   const outcomeVariableString =
//     metadata?.outcome_variables?.[outcomeVariable] ?? outcomeVariable;
//   const diseaseVariable = mapDiseaseSelector.value;
//   const diseaseVariableString =
//     metadata?.diseases?.[diseaseVariable] ?? diseaseVariable;

//   // header area
//   const regionInfo = header.select(".tooltip-region-info");
//   regionInfo.html("");

//   if (geographicUnit !== "state") {
//     regionInfo
//       .append("p")
//       .attr("class", "ttp-location-name")
//       .html(`${metadata.region_sizes[geographicUnit]}: ${identifier}`);
//   } else {
//     regionInfo
//       .append("p")
//       .attr("class", "ttp-location-name")
//       .html("South Carolina");
//   }

//   if (geographicUnit === "zcta") {
//     regionInfo
//       .append("p")
//       .html(
//         `County: ${
//           featureData.county?.[0]?.toUpperCase() +
//           featureData.county?.substring(1)
//         }`,
//       );
//   }

//   if (geographicUnit === "facility") {
//     regionInfo.style("flex-direction", "column");
//     regionInfo.style("align-items", "center");
//     regionInfo.select(".ttp-location-name").html(
//       `${featureData.display_name} (${featureData.facility_type})`,
//     );
//     regionInfo.append("p").html(`Health System: ${featureData.system}`);
//   }

//   const dataInfo = header.select(".tooltip-data-info");
//   dataInfo.html("");

//   if (panelType === "rate") {
//     dataInfo
//       .append("p")
//       .html(
//         `Rate of ${outcomeVariableString} (per 1000 people) - ${diseaseVariableString}`,
//       );
//   } else {
//     dataInfo
//       .append("p")
//       .html(`Count of ${outcomeVariableString} - ${diseaseVariableString}`);
//   }

//   if (data.historical.values?.length) {
//     dataInfo
//       .append("p")
//       .html(
//         `${data.historical.reported ? "Reported" : ""} ${outcomeVariableString} from ${formatDate(
//           historicalDatesArray[0],
//         )} to ${formatDate(historicalDatesArray.at(-1))}`,
//       );
//   }

//   if (data.projected.values?.length) {
//     const projectedEndDate = d3.timeDay.offset(
//       data.projected.start_date,
//       7 * (data.projected.values.length - 1),
//     );

//     dataInfo
//       .append("p")
//       .html(
//         `Projected ${outcomeVariableString} from ${formatDate(
//           d3.timeDay.offset(data.projected.start_date, -6),
//         )} to ${formatDate(projectedEndDate)}`,
//       );
//   }

//   // footer area
//   const ttpLegend = footer.select(".tooltip-legend").html("");
//   const ttpOptions = footer.select(".tooltip-options").html("");

//   const appendLegendItem = (group, cls, color, text) => {
//     const item = group.append("div").attr("class", `tooltip-legend-group-item ${cls}`);
//     item.append("sl-icon").attr("name", "square-fill").style("color", color);
//     item
//       .append("p")
//       .attr("class", "tooltip-label")
//       .attr("font-size", "var(--sl-font-size-small)")
//       .attr("color", color)
//       .text(text)
//       .style("transform", "translate(.5rem,0)");
//   };

//   const ttpLegendGroup = ttpLegend.append("div").attr("class", "tooltip-legend-group");

//   ["historical", "projected"].forEach((phase) => {
//     let text = outcomeVariableString;

//     if (phase === "projected") {
//       text =
//         panelType === "percentDifference"
//           ? `Percent Change of ${text}`
//           : `${text} (projected)`;
//     } else {
//       text =
//         outcomeVariable === "all_hospitalizations"
//           ? "All Historical Hospitalizations"
//           : `Historical ${text}`;

//       if (panelType === "percentDifference") {
//         text = `Percent Change of ${text}`;
//       } else if (
//         outcomeVariable === "inpatient_hospitalizations" ||
//         outcomeVariable === "%_influenza-attributable_ed_visits"
//       ) {
//         if (
//           [
//             "COVID-19",
//             "Respiratory Syncytial Virus (RSV)",
//             "Influenza (Flu)",
//             "Respiratory Diseases (COVID-19, Flu, RSV)",
//           ].includes(diseaseVariableString)
//         ) {
//           text += " (reported)";
//         }
//       } else {
//         text += data[phase].reported ? " (reported)" : " (estimated)";
//       }
//     }

//     appendLegendItem(
//       ttpLegendGroup,
//       phase,
//       populationColorMap[population][phase],
//       text,
//     );
//   });

//   if (panelType === "percentDifference") {
//     const percentChangeLegend = ttpLegend.append("div").attr("class", "tooltip-legend-group");

//     appendLegendItem(
//       percentChangeLegend,
//       "percent-change",
//       "#cccccc",
//       `${
//         outcomeVariable === "all_hospitalizations"
//           ? "All Historical Hospitalizations"
//           : `Historical ${outcomeVariableString}`
//       } ${data.historical.reported ? "(reported)" : "(estimated)"}`,
//     );

//     appendLegendItem(
//       percentChangeLegend,
//       "percent-change",
//       "#666666",
//       `${
//         outcomeVariable === "all_hospitalizations"
//           ? "All Historical Hospitalizations"
//           : `Historical ${outcomeVariableString}`
//       } (projected)`,
//     );
//   }

//   // expand button
//   if (!allDates) {
//     const expandPopupButton = ttpOptions
//       .append("sl-button")
//       .attr("size", "small")
//       .attr("variant", "default")
//       .html("Expand Graph");

//     expandPopupButton.on("click", () => {
//       const largeTtp = d3.select(tooltipLarge);

//       tooltipLarge.show().then(async () => {
//         const sourceUnit = grid ? gridGeographicUnitSelector.value : mapGeographicUnitSelector.value;
//         const sourceDisease = grid ? gridDiseaseSelector.value : mapDiseaseSelector.value;

//         const allExtendedData = await d3.json(
//           `/data/respiratory/${sourceUnit}/${sourceDisease}/extended?data_version=${metadata.data_version}&${Date.now()}`,
//         );

//         const ttpData = {
//           id: identifier,
//           display_name: data.display_name,
//           county: data.county,
//           data: allExtendedData[identifier],
//           facility_type: data.facility_type,
//           system: data.system,
//         };

//         drawTooltip(
//           ttpData,
//           largeTtp.select(".tooltip-outer-svg"),
//           largeTtp.select(".tooltip-header"),
//           largeTtp.select(".tooltip-footer"),
//           population,
//           outcomeVariable,
//           panelType,
//           grid,
//           true,
//           [],
//           data,
//         );
//       });
//     });
//   }

//   // add/remove extra sources
//   if (
//     ["all_hospitalizations", "inpatient_hospitalizations", "emergency_department_visits"].includes(
//       outcomeVariable,
//     )
//   ) {
//     const ttpOptionsHandler = (dataSource) => {
//       const next = [...extraSources];
//       const idx = next.indexOf(dataSource);

//       if (idx >= 0) next.splice(idx, 1);
//       else next.push(dataSource);

//       drawTooltip(
//         d,
//         ttpSVG,
//         header,
//         footer,
//         population,
//         outcomeVariable,
//         panelType,
//         grid,
//         allDates,
//         next,
//         smallPopupData,
//       );
//     };

//     Object.entries({
//       health_system: "Health System",
//       RFA: "RFA",
//     }).forEach(([ds, dsS]) => {
//       let buttonText = `${dsS} ${outcomeVariableString}`;

//       if (extraSources.includes(ds)) {
//         const legendGroup = ttpLegend.append("div").attr("class", "tooltip-legend-group");
//         appendLegendItem(legendGroup, "historical", dataSourceColorMap[ds], ` ${buttonText} (reported)`);
//         buttonText = `Remove ${buttonText}`;
//       } else {
//         buttonText = `Add ${buttonText}`;
//       }

//       const button = ttpOptions.append("sl-button").html(buttonText).attr("size", "small");

//       button.node()?.updateComplete?.then(() => {
//         d3.select(button.node().shadowRoot)
//           .select("[part=base]")
//           .style("background-color", "white")
//           .style("border-color", dataSourceColorMap[ds])
//           .style("color", dataSourceColorMap[ds]);
//       });

//       const icon = button.append("sl-icon").attr("slot", "prefix").attr("name", "graph-up");

//       if ((data.extra?.[ds] ?? []).length) {
//         button.on("click", () => ttpOptionsHandler(ds));
//         icon.style("color", dataSourceColorMap[ds]);
//       } else {
//         button.attr("disabled", true);
//         icon.style("color", "var(--sl-color-gray-500)");
//       }
//     });
//   }

//   // reset svg
//   ttpSVG.node().innerHTML = "";

//   const dataPointTTP = ttpSVG.append("g").attr("class", "data-point-ttp");
//   const graphSVG = ttpSVG
//     .append("svg")
//     .attr("class", "tooltip-graph-svg")
//     .attr("height", ttpHeight)
//     .attr("width", ttpWidth);

//   const yAxis = ttpSVG.append("g").attr("class", "y-axis");
//   const xAxisHistorical = ttpSVG.append("g").attr("class", "x-axis-historical");
//   const xAxisPrediction = ttpSVG.append("g").attr("class", "x-axis-prediction");

//   const isPercentDiff = panelType === "percentDifference";

//   let countMax = panelType === "rate" ? 1 / featureData.population : 0.0001;

//   ["historical", "projected"].forEach((phase) => {
//     if (panelType === "rate") {
//       data[phase].values = (data[phase].values ?? []).map((v) =>
//         Number.isFinite(v) ? (v / featureData.population) * 1000 : NaN,
//       );
//     }
//     const localMax = d3.max(finiteValues(data[phase].values));
//     if (Number.isFinite(localMax)) countMax = Math.max(countMax, localMax);
//   });

//   extraSources.forEach((ds) => {
//     if (panelType === "rate") {
//       data.extra[ds] = (data.extra[ds] ?? []).map((v) =>
//         Number.isFinite(v) ? (v / featureData.population) * 1000 : NaN,
//       );
//     }
//     const localMax = d3.max(finiteValues(data.extra[ds]));
//     if (Number.isFinite(localMax)) countMax = Math.max(countMax, localMax);
//   });

//   const temp = ttpSVG.append("text").text(d3.format(".2r")(countMax)).attr("x", 0).attr("y", 0);

//   const ttpMargins = {
//     top: 2 * em,
//     bottom: 2.5 * em,
//     left: Math.max(20, temp.node().getBBox().width) + 2 * em,
//     right: em,
//   };

//   const ttpGraphWidth = ttpWidth - ttpMargins.right - ttpMargins.left;

//   const yScale = d3
//     .scaleLinear()
//     .domain([0, countMax])
//     .nice()
//     .range([ttpHeight - ttpMargins.bottom, ttpMargins.top]);

//   const defs = graphSVG.append("defs");
//   const clipPathId = `ttp-clip-path-def-${allDates ? "all-dates" : "short-history"}`;

//   defs
//     .append("clipPath")
//     .attr("id", clipPathId)
//     .attr("clipPathUnits", "userSpaceOnUse")
//     .append("rect")
//     .attr("x", ttpMargins.left)
//     .attr("y", ttpMargins.top)
//     .attr("width", ttpGraphWidth)
//     .attr("height", ttpHeight - ttpMargins.bottom - ttpMargins.top);

//   let yScale2 = null;
//   let percentDifferenceHistoricalValues = null;
//   let percentDifferenceProjectedValues = null;
//   let percentile25_percentDiff = null;
//   let percentile75_percentDiff = null;
//   let percentile2_5_percentDiff = null;
//   let percentile97_5_percentDiff = null;

//   if (isPercentDiff) {
//     percentDifferenceHistoricalValues = getAllValuesFromFeature(
//       featureData,
//       population,
//       outcomeVariable,
//       panelType,
//       "historical",
//     );

//     percentDifferenceProjectedValues = getAllValuesFromFeature(
//       featureData,
//       population,
//       outcomeVariable,
//       panelType,
//       "projected",
//     );

//     percentile25_percentDiff = getUncertaintyValues_percentDiff_ForPanelType(
//       featureData,
//       population,
//       outcomeVariable,
//       "percentile25",
//       "percentDifference",
//     );

//     percentile75_percentDiff = getUncertaintyValues_percentDiff_ForPanelType(
//       featureData,
//       population,
//       outcomeVariable,
//       "percentile75",
//       "percentDifference",
//     );

//     percentile2_5_percentDiff = getUncertaintyValues_percentDiff_ForPanelType(
//       featureData,
//       population,
//       outcomeVariable,
//       "percentile2_5",
//       "percentDifference",
//     );

//     percentile97_5_percentDiff = getUncertaintyValues_percentDiff_ForPanelType(
//       featureData,
//       population,
//       outcomeVariable,
//       "percentile97_5",
//       "percentDifference",
//     );

//     const pdValues = finiteValues([
//       ...percentDifferenceHistoricalValues,
//       ...percentDifferenceProjectedValues,
//     ]);

//     const pdMax = Math.min(d3.max(pdValues) ?? 1, 500);
//     const pdMin = d3.min(pdValues) ?? -100;

//     temp.text(d3.format(".2r")("-100")).attr("x", 0).attr("y", 0);
//     ttpMargins.right += em + Math.max(20, temp.node().getBBox().width);

//     yScale2 = d3
//       .scaleLinear()
//       .domain([pdMin, pdMax])
//       .nice()
//       .range([ttpHeight - ttpMargins.bottom, ttpMargins.top]);

//     // keep yScale usable for general layout
//     yScale.domain([
//       yScale.domain()[1] * (yScale2.domain()[0] / yScale2.domain()[1]),
//       yScale.domain()[1],
//     ]);
//   }

//   const xScaleHistorical = d3.scaleTime();

//   if (allDates) {
//     xScaleHistorical
//       .domain([
//         d3.timeDay.offset(historicalDatesArray[0], -7),
//         allHistoricalDates[expectedAllHistoricalDataPoints - 1],
//       ])
//       .range([
//         ttpMargins.left,
//         ttpMargins.left + ttpGraphWidth * ttpHistoryWidthPercentage,
//       ]);
//   } else {
//     xScaleHistorical
//       .domain([
//         d3.timeDay.offset(historicalDatesArray[0], -7),
//         shortHistoryDates[expectedShortHistoryDataPoints - 1],
//       ])
//       .range([
//         ttpMargins.left + 1,
//         ttpMargins.left + ttpGraphWidth * ttpHistoryWidthPercentage,
//       ]);
//   }

//   const xScaleForwardProjection = d3
//     .scaleTime()
//     .domain([d3.timeDay.offset(currentDate, -6), lastDate])
//     .range([
//       ttpMargins.left + ttpGraphWidth * ttpHistoryWidthPercentage,
//       ttpWidth - ttpMargins.right,
//     ]);

//   const xScale = (date) => {
//     if (dayjs(date).isBefore(d3.timeDay.offset(currentDate, -6))) {
//       return xScaleHistorical(date);
//     }
//     return xScaleForwardProjection(date);
//   };

//   function createDataPointTooltip(event, groupStartDate) {
//     dataPointTTP.html("");

//     const tooltipDateFormat = d3.timeFormat("%b %d");
//     const thisDataPointShape = event.target;
//     const dataShapeBBox = thisDataPointShape.getBBox();

//     const pointIndex = d3
//       .select(thisDataPointShape.parentNode)
//       .selectAll(".ttp-data-point")
//       .nodes()
//       .indexOf(thisDataPointShape);

//     const date = d3.timeDay.offset(groupStartDate, 7 * pointIndex);
//     const dateStr = `${tooltipDateFormat(d3.timeDay.offset(date, -6))} - ${tooltipDateFormat(
//       date,
//     )}`;

//     const rawValue = d3.select(thisDataPointShape).datum();
//     const value = Number.isFinite(rawValue) ? rawValue : NaN;

//     const valueStr =
//       panelType === "rate"
//         ? `${value.toFixed(2)} per 1000`
//         : value.toFixed(2).toString();

//     let valueTypeStr = "Count";
//     switch (panelType) {
//       case "rate":
//         valueTypeStr = "Rate";
//         break;
//       case "percentDifference":
//         valueTypeStr = "Percent Change";
//         break;
//       default:
//         valueTypeStr = "Count";
//         break;
//     }

//     const dx = dataShapeBBox.x + dataShapeBBox.width / 2 + thisDataPointShape.getCTM().e;
//     const dy = 1 * em;

//     dataPointTTP.append("text").text(dateStr).attr("x", dx).attr("y", dy);
//     dataPointTTP
//       .append("text")
//       .text(`${valueTypeStr}: ${valueStr}`)
//       .attr("x", dx)
//       .attr("y", dy + 0.75 * em);

//     dataPointTTP
//       .append("line")
//       .attr("stroke", "black")
//       .attr("stroke-width", 1)
//       .attr("x1", dx)
//       .attr("y1", dy + 1 * em)
//       .attr("x2", dx)
//       .attr("y2", ttpHeight - ttpMargins.bottom);
//   }

//   // Historical series
//   const historicalGroup = graphSVG.append("g").attr("class", "historical-group");
//   const historicalSeries = isPercentDiff
//     ? percentDifferenceHistoricalValues
//     : data.historical.values;

//   if (allDates) {
//     historicalGroup
//       .append("path")
//       .attr(
//         "d",
//         d3
//           .area()
//           .x((_, i) => xScale(historicalDatesArray[i]))
//           .y0(isPercentDiff ? yScale2(0) : yScale(0))
//           .y1((v) => (isPercentDiff ? yScale2(v) : yScale(v)))
//           .defined((v) => v || v === 0)(historicalSeries),
//       )
//       .attr("fill", populationColorMap[population]["historical"]);
//   } else {
//     const historicalBarWidth = Math.ceil(
//       (ttpGraphWidth * ttpHistoryWidthPercentage) / historicalDatesArray.length,
//     );

//     historicalGroup
//       .append("g")
//       .selectAll("rect")
//       .data(historicalSeries)
//       .enter()
//       .append("rect")
//       .attr("class", "ttp-data-point")
//       .attr("x", (_, i) => xScale(historicalDatesArray[i]))
//       .attr("y", (v) =>
//         isPercentDiff
//           ? v > 0
//             ? Math.max(yScale2(v), yScale2(500))
//             : yScale2(0)
//           : yScale(v),
//       )
//       .attr("height", (v) =>
//         isPercentDiff
//           ? Math.abs(yScale2(0) - Math.max(yScale2(v), yScale2(500)))
//           : yScale(0) - yScale(v),
//       )
//       .attr("width", historicalBarWidth)
//       .attr("fill", populationColorMap[population]["historical"])
//       .attr("transform", `translate(-${historicalBarWidth}, 0)`)
//       .on("mouseover", function (event, v) {
//         if (Number.isFinite(v)) createDataPointTooltip(event, historicalDatesArray[0]);
//       })
//       .on("mouseout", () => dataPointTTP.html(""));
//   }

//   // forecast background
//   graphSVG
//     .append("rect")
//     .attr("class", "tooltip-prediction-highlighter")
//     .attr("x", xScaleForwardProjection.range()[0])
//     .attr("y", ttpMargins.top)
//     .attr("width", xScaleForwardProjection.range()[1] - xScaleForwardProjection.range()[0])
//     .attr("height", ttpHeight - ttpMargins.bottom - ttpMargins.top);

//   const predictiveGroup = graphSVG.append("g").attr("class", "predictive-group");

//   const lastHistoricalValueIndex = data.historical.values.findLastIndex((v) =>
//     Number.isFinite(parseFloat(v)),
//   );

//   const projectedBaseSeries = isPercentDiff
//     ? percentDifferenceProjectedValues
//     : data.projected.values;

//   if (projectedBaseSeries.length) {
//     const anchor =
//       dayjs(historicalDatesArray.at(lastHistoricalValueIndex)).isSame(
//         d3.timeDay.offset(data.projected.start_date, -7),
//       )
//         ? data.historical.values[lastHistoricalValueIndex]
//         : projectedBaseSeries[0];

//     const projectedValues = [anchor, ...projectedBaseSeries];
//     const seriesForSegments = projectedValues.slice(1);

//     predictiveGroup
//       .selectAll("path")
//       .data(seriesForSegments)
//       .enter()
//       .append("path")
//       .attr("class", "ttp-data-point")
//       .attr("clip-path", `url(#${clipPathId})`)
//       .attr("d", (_, i1) =>
//         d3
//           .area()
//           .x((__, i2) =>
//             xScale(d3.timeDay.offset(data.projected.start_date, 7 * (i1 + i2 - 1))),
//           )
//           .y0(isPercentDiff ? yScale2(0) : yScale(0))
//           .y1((v) => (isPercentDiff ? yScale2(v) : yScale(v)))
//           .defined((v) => v || v === 0)(
//             projectedValues.slice(i1, i1 + 2),
//           ),
//       )
//       .attr("fill", populationColorMap[population]["projected"])
//       .on("mouseover", function (event, v) {
//         if (Number.isFinite(v)) {
//           createDataPointTooltip(event, d3.timeDay.offset(data.projected.start_date, -7));
//         }
//       })
//       .on("mouseout", () => dataPointTTP.html(""));

//     if (
//       data.projected.uncertainty_range?.percentile25?.length > 0 &&
//       data.projected.uncertainty_range?.percentile75?.length > 0 &&
//       data.projected.uncertainty_range?.percentile2_5?.length > 0 &&
//       data.projected.uncertainty_range?.percentile97_5?.length > 0
//     ) {
//       const firstProjectedValue = projectedValues[0];

//       const uncertainty25 = isPercentDiff
//         ? [firstProjectedValue, ...percentile25_percentDiff]
//         : [firstProjectedValue, ...data.projected.uncertainty_range.percentile25];

//       const uncertainty75 = isPercentDiff
//         ? [firstProjectedValue, ...percentile75_percentDiff]
//         : [firstProjectedValue, ...data.projected.uncertainty_range.percentile75];

//       const uncertainty2_5 = isPercentDiff
//         ? [firstProjectedValue, ...percentile2_5_percentDiff]
//         : [firstProjectedValue, ...data.projected.uncertainty_range.percentile2_5];

//       const uncertainty97_5 = isPercentDiff
//         ? [firstProjectedValue, ...percentile97_5_percentDiff]
//         : [firstProjectedValue, ...data.projected.uncertainty_range.percentile97_5];

//       const n = uncertainty2_5.length;

//       const band95 = d3
//         .area()
//         .x((_, i) => xScale(d3.timeDay.offset(data.projected.start_date, 7 * (i - 1))))
//         .y0((_, i) => (isPercentDiff ? yScale2(0) : yScale(uncertainty2_5[i])))
//         .y1((_, i) => (isPercentDiff ? yScale2(0) : yScale(uncertainty97_5[i])))
//         .defined((_, i) => uncertainty2_5[i] != null && uncertainty97_5[i] != null);

//       const band50 = d3
//         .area()
//         .x((_, i) => xScale(d3.timeDay.offset(data.projected.start_date, 7 * (i - 1))))
//         .y0((_, i) => (isPercentDiff ? yScale2(0) : yScale(uncertainty25[i])))
//         .y1((_, i) => (isPercentDiff ? yScale2(0) : yScale(uncertainty75[i])))
//         .defined((_, i) => uncertainty25[i] != null && uncertainty75[i] != null);

//       predictiveGroup
//         .append("path")
//         .datum(d3.range(n))
//         .attr("class", "path-uncertainty-50")
//         .attr("clip-path", `url(#${clipPathId})`)
//         .attr("d", band50)
//         .attr("fill", populationColorMap[population]["projected"])
//         .attr("opacity", 0.5);

//       predictiveGroup
//         .append("path")
//         .datum(d3.range(n))
//         .attr("class", "path-uncertainty-95")
//         .attr("clip-path", `url(#${clipPathId})`)
//         .attr("d", band95)
//         .attr("fill", populationColorMap[population]["projected"])
//         .attr("opacity", 0.2);
//     }

//     predictiveGroup
//       .append("g")
//       .selectAll("circle")
//       .data(projectedValues)
//       .enter()
//       .append("circle")
//       .attr("class", "ttp-data-point")
//       .attr("clip-path", `url(#${clipPathId})`)
//       .attr("r", 3)
//       .attr("cx", (_, i) =>
//         xScale(d3.timeDay.offset(data.projected.start_date, 7 * (i - 1))),
//       )
//       .attr("cy", (v) => (isPercentDiff ? yScale2(v) : yScale(v)))
//       .style("opacity", (v) => (Number.isFinite(v) ? 1 : 0))
//       .attr("stroke", populationColorMap[population]["projected"])
//       .on("mouseover", function (event, v) {
//         if (Number.isFinite(v)) {
//           createDataPointTooltip(
//             event,
//             d3.timeDay.offset(data.projected.start_date, -7),
//           );
//         }
//       })
//       .on("mouseout", () => dataPointTTP.html(""));
//   }

//   if (isPercentDiff) {
//     graphSVG
//       .append("path")
//       .attr(
//         "d",
//         d3
//           .line()
//           .defined((v) => v || v === 0)
//           .x((_, i) => xScale(historicalDatesArray[i]))
//           .y((v) => yScale2(v))
//           .curve(d3.curveMonotoneX)(percentDifferenceHistoricalValues),
//       )
//       .attr("class", "historical-path-percent-diff-type")
//       .attr("stroke", "#cccccc")
//       .attr("fill", "none")
//       .attr("stroke-width", 2);

//     graphSVG
//       .append("path")
//       .attr(
//         "d",
//         d3
//           .line()
//           .defined((v) => v || v === 0)
//           .x((_, i) => xScale(d3.timeDay.offset(data.projected.start_date, 7 * i)))
//           .y((v) => yScale2(v))
//           .curve(d3.curveMonotoneX)(percentDifferenceProjectedValues),
//       )
//       .attr("class", "projected-path-percent-diff-type")
//       .attr("stroke", "#666666")
//       .attr("fill", "none")
//       .attr("stroke-width", 2);
//   }

//   // extra sources
//   extraSources.forEach((ds) => {
//     historicalGroup
//       .append("path")
//       .attr(
//         "d",
//         d3
//           .line()
//           .x((_, i) => xScale(historicalDatesArray[i]))
//           .y((v) => yScale(v))
//           .defined((v) => v || v === 0)
//           .curve(d3.curveMonotoneX)(data.extra?.[ds] ?? []),
//       )
//       .attr("stroke", dataSourceColorMap[ds])
//       .attr("fill", "none")
//       .attr("stroke-width", 3);
//   });

//   // axes
//   xAxisHistorical
//     .attr("transform", `translate(0,${ttpHeight - ttpMargins.bottom})`)
//     .call(
//       d3
//         .axisBottom(xScaleHistorical)
//         .tickSize(4)
//         .tickFormat((date) =>
//           xScaleHistorical.range()[1] - xScaleHistorical(date) > 2 * em
//             ? d3.timeFormat("%b %Y")(date)
//             : "",
//         ),
//     )
//     .selectAll("text")
//     .attr("class", "tooltip-label")
//     .style("text-anchor", "end")
//     .attr("fill", "var(--sl-color-neutral-1000)")
//     .attr("transform", "rotate(-40)");

//   xAxisPrediction
//     .attr("transform", `translate(0,${ttpHeight - ttpMargins.bottom})`)
//     .call(
//       d3
//         .axisBottom(xScaleForwardProjection)
//         .tickValues([xScaleForwardProjection.domain()[0], ...predictionDates])
//         .tickSize(4)
//         .tickFormat(d3.timeFormat("%d %b")),
//     )
//     .selectAll("text")
//     .attr("class", "tooltip-label")
//     .style("text-anchor", "end")
//     .attr("fill", "var(--sl-color-neutral-1000)")
//     .attr("transform", "rotate(-40)");

//   xAxisPrediction.selectAll("path, line").attr("stroke", "var(--sl-color-neutral-1000)");

//   const yAxisTitle = yAxis
//     .append("text")
//     .attr(
//       "transform",
//       `translate(${0.6 * em}, ${yScale(d3.mean(yScale.domain()))})rotate(-90)`,
//     )
//     .attr("text-anchor", "middle")
//     .attr("fill", "var(--sl-color-neutral-1000)")
//     .attr("font-size", "var(--sl-font-size-small)");

//   yAxisTitle.append("tspan").attr("x", 0).attr("dy", 0).text(outcomeVariableString);
//   yAxisTitle
//     .append("tspan")
//     .attr("x", 0)
//     .attr("dy", "1.1em")
//     .attr("font-size", "var(--sl-font-size-x-small)")
//     .text(`(${diseaseVariableString})`);

//   yAxis
//     .append("g")
//     .attr("transform", `translate(${ttpMargins.left},0)`)
//     .call(d3.axisLeft(yScale).ticks(5).tickSize(4))
//     .selectAll("text")
//     .attr("class", "tooltip-label")
//     .attr("fill", "var(--sl-color-neutral-1000)");
//   yAxis.selectAll("path, line").attr("stroke", "var(--sl-color-neutral-1000)");

//   if (isPercentDiff && yScale2) {
//     yAxis.html("");

//     const mainYAxis = yAxis.append("g");
//     const lesserYAxis = yAxis.append("g");

//     mainYAxis
//       .append("text")
//       .attr(
//         "transform",
//         `translate(${1.25 * em},${yScale(d3.mean(yScale.domain()))})rotate(-90)`,
//       )
//       .attr("text-anchor", "middle")
//       .style("fill", populationColorMap[population]["historical"])
//       .attr("font-size", "var(--sl-font-size-small)")
//       .text("Percent Change");

//     mainYAxis
//       .append("g")
//       .attr("transform", `translate(${ttpMargins.left},0)`)
//       .call(d3.axisLeft(yScale2).ticks(5).tickSize(4))
//       .selectAll("text")
//       .attr("class", "tooltip-label")
//       .style("fill", populationColorMap[population]["historical"]);

//     mainYAxis
//       .selectAll("path, line")
//       .style("stroke", populationColorMap[population]["historical"]);

//     const lesserYAxisTitle = lesserYAxis
//       .append("text")
//       .attr(
//         "transform",
//         `translate(${ttpWidth - 1 * em}, ${yScale(d3.mean(yScale.domain()))})rotate(-90)`,
//       )
//       .attr("text-anchor", "middle")
//       .attr("fill", "var(--sl-color-neutral-1000)")
//       .attr("font-size", "var(--sl-font-size-small)");

//     lesserYAxisTitle.append("tspan").attr("x", 0).attr("dy", 0).text(outcomeVariableString);
//     lesserYAxisTitle
//       .append("tspan")
//       .attr("x", 0)
//       .attr("dy", "1.1em")
//       .attr("font-size", "var(--sl-font-size-x-small)")
//       .text(`(${diseaseVariableString})`);

//     lesserYAxis
//       .append("g")
//       .attr("transform", `translate(${ttpWidth - ttpMargins.right},0)`)
//       .call(d3.axisRight(yScale).ticks(5).tickSize(4))
//       .selectAll("text")
//       .attr("class", "tooltip-label")
//       .attr("fill", "var(--sl-color-neutral-1000)");

//     lesserYAxis.selectAll("path, line").attr("stroke", "var(--sl-color-neutral-1000)");
//   }

//   temp.remove();
// }

function drawStateHospitalizations(
  disease,
  panelType,
  stateSvg,
  stateSubtitle,
) {
  var stateMargins = {
    top: 1 * em,
    bottom: 3.25 * em,
    left: 1.25 * em,
    right: 1 * em,
    "axis-thickness": 1,
  };

  function yAxisDisplayFunc(
    svg,
    stateYScale,
    stateWidth,
    stateHeight,
    stateMargins,
    diseaseDisplayNames,
  ) {
    svg
      .select(".y-axis")
      .append("text")
      .attr("class", "state-hospitalizations-yaxis-title")
      .attr(
        "transform",
        `translate(${1 * em},${d3.mean(stateYScale.range())})rotate(-90)`,
      )
      .text(diseaseDisplayNames[disease]);

    svg
      .select(".y-axis")
      .append("g")
      .attr(
        "transform",
        `translate(${stateMargins.left - stateMargins["axis-thickness"]},0)`,
      )
      .call(d3.axisLeft(stateYScale).ticks(5).tickSize(4))
      .selectAll("text")
      .attr("class", "tooltip-label");
  }

  function xAxisDisplayFunc(
    svg,
    stateXScale,
    stateWidth,
    stateHeight,
    stateMargins,
    diseaseDisplayNames,
  ) {
    svg
      .select(".x-axis")
      .call(
        d3
          .axisBottom(stateXScale)
          .tickArguments([d3.timeMonth.every(1), d3.timeFormat("%b %Y")]),
      )
      .attr("transform", `translate(0, ${stateHeight - stateMargins.bottom})`)
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("transform", `translate(-12, 6) rotate(-90)`);
  }
  drawStateBarChart(
    disease,
    panelType,
    stateSvg,
    stateSubtitle,
    stateMargins,
    yAxisDisplayFunc,
    xAxisDisplayFunc,
  );
}

function drawLargeStateHospitalizations(
  disease,
  panelType,
  stateSvg,
  stateSubtitle,
) {
  var stateMargins = {
    top: 0.5 * em,
    bottom: 3.5 * em,
    left: 1.75 * em,
    right: 2 * em,
    "axis-thickness": 3,
  };

  function yAxisDisplayFunc(
    svg,
    stateYScale,
    stateWidth,
    stateHeight,
    stateMargins,
    diseaseDisplayNames,
  ) {
    svg
      .select(".y-axis")
      .append("text")
      .attr("id", "map-state-hospitalizations-large-yaxis-title")
      .attr(
        "transform",
        `translate(${1 * em},${d3.mean(stateYScale.range())})rotate(-90)`,
      )
      .attr("text-anchor", "middle")
      .text(diseaseDisplayNames[disease]);

    var svgYAxis = svg
      .select(".y-axis")
      .append("g")
      .attr(
        "transform",
        `translate(${stateMargins.left - stateMargins["axis-thickness"]},0)`,
      )
      .call(d3.axisLeft(stateYScale).ticks(5).tickSize(4));

    svgYAxis.select("path").attr("stroke-width", 3);
    svgYAxis.selectAll("g.tick line").attr("x2", -8).attr("stroke-width", 3);
    svgYAxis
      .selectAll("text")
      .attr("class", "tooltip-label")
      .attr("transform", `translate(-4, 0)`);
  }

  function xAxisDisplayFunc(
    svg,
    stateXScale,
    stateWidth,
    stateHeight,
    stateMargins,
    diseaseDisplayNames,
  ) {
    var allWeeks = [d3.timeDay.offset(startShortHistory, -7)].concat(
      shortHistoryDates,
    );
    var xAxis = svg.select(".x-axis");
    var svgMajorXAxis = xAxis
      .append("g")
      .attr("class", "state-hospitalizations-large-major-xaxis")
      .call(
        d3
          .axisBottom(stateXScale)
          .tickValues(allWeeks.filter((d) => d.getDate() <= 7))
          .tickFormat(d3.timeFormat("")),
      )
      .attr("transform", `translate(0, ${stateHeight - stateMargins.bottom})`);

    svgMajorXAxis.selectAll("path").attr("stroke-width", 3);
    svgMajorXAxis
      .selectAll("g.tick line")
      .attr("y2", (_, i) => 28)
      .attr("stroke-width", 3);
    svgMajorXAxis.selectAll("text").each(function (d, i, a) {
      var thisText = d3.select(this);
      thisText
        .append("tspan")
        .style("text-anchor", "middle")
        .attr(
          "x",
          i < a.length - 1
            ? (stateXScale(a[i + 1].__data__) - stateXScale(d)) / 2
            : (stateXScale.range()[1] - stateXScale(d)) / 2,
        )
        .html(d3.timeFormat("%b")(d));

      thisText
        .append("tspan")
        .style("text-anchor", "middle")
        .attr("dy", 12)
        .attr(
          "x",
          i < a.length - 1
            ? (stateXScale(a[i + 1].__data__) - stateXScale(d)) / 2
            : (stateXScale.range()[1] - stateXScale(d)) / 2,
        )
        .html(d3.timeFormat("%Y")(d));
    });

    xAxis
      .append("g")
      .attr("class", "state-hospitalizations-large-minor-xaxis")
      .call(
        d3
          .axisBottom(stateXScale)
          .tickArguments([d3.timeDay.every(7), d3.timeFormat("")]),
      )
      .attr("transform", `translate(0, ${stateHeight - stateMargins.bottom})`);
  }
  drawStateBarChart(
    disease,
    panelType,
    stateSvg,
    stateSubtitle,
    stateMargins,
    yAxisDisplayFunc,
    xAxisDisplayFunc,
  );
}

async function drawStateBarChart(
  disease,
  panelType,
  svgDOM,
  subtitleDOM,
  stateMargins,
  yAxisDisplayFunc,
  xAxisDisplayFunc,
) {
  var diseaseDisplayNames = {
    covid_19: "COVID-19",
    influenza: "Influenza",
    RSV: "RSV",
    respiratory_diseases: "COVID-19, Flu, RSV",
  };

  svgDOM.innerHTML = "";
  var stateHeight = svgDOM.clientHeight;
  var stateWidth = svgDOM.clientWidth;

  var svg = d3.select(svgDOM);
  var yAxis = svg.append("g").attr("class", "y-axis");
  var xAxis = svg.append("g").attr("class", "x-axis");

  var stateData;
  try {
    stateData = await d3.json(
      `/data/respiratory/state/state-cdc?data_version=${
        metadata.data_version
      }&${parseInt(Math.random() * 9999999999)}`,
    );
    stateData = Object.entries(stateData[disease]).map((d) => {
      temp = { Date: parseDate(d[0]), count: d[1] };
      if (panelType == "rate") {
        temp["count"] /= scPopulation / 1000;
      }
      return temp;
    });
    let stateDates = stateData.map((d) => d.Date);
    subtitleDOM.innerHTML = `Data from ${d3.timeFormat("%b %d, %Y")(
      d3.min(stateDates),
    )} to ${d3.timeFormat("%b %d, %Y")(d3.max(stateDates))}`;
  } catch (error) {
    stateData = [{ Date: parseDate("2020-01-01"), count: 1 }];
    subtitleDOM.innerHTML = "N/A";
  }

  var maxVal = d3.max(stateData.map((d) => d.count)) || 1;

  var temp = svg
    .append("text")
    .text(d3.format(".2r")(maxVal))
    .attr("x", 0)
    .attr("y", 0);

  stateMargins.left +=
    Math.max(20, temp.node().getBBox().width) + stateMargins["axis-thickness"];

  var stateXScale = d3
    .scaleTime()
    .domain([
      d3.timeDay.offset(startShortHistory, -7),
      shortHistoryDates[expectedShortHistoryDataPoints - 1],
    ])
    .range([stateMargins.left, stateWidth - stateMargins.right]);

  var stateYScale = d3
    .scaleLinear()
    .domain([0, maxVal])
    .nice()
    .range([stateHeight - stateMargins.bottom, stateMargins.top]);

  var barWidth =
    (stateWidth - (stateMargins.left + stateMargins.right)) / stateData.length;
  svg
    .append("g")
    .selectAll("rect")
    .data(stateData)
    .enter()
    .append("rect")
    .attr("x", (d) => stateXScale(d["Date"]))
    .attr("y", (d) => stateYScale(d["count"]))
    .attr("height", (d) => {
      return Math.max(stateYScale(0) - stateYScale(d["count"]), 0);
    })
    .attr("width", Math.max(barWidth, 0))
    .attr("stroke", "var(--sl-color-neutral-1000)")
    .attr("stroke-width", 1)
    .attr("fill", "var(--sl-color-neutral-100)")
    .attr("transform", `translate(${barWidth}, 0)`)
    .on("mouseover", function (event, d) {
      let tooltipDateFormat = d3.timeFormat("%b %d");
      let date = d["Date"];
      let dateStr = `${tooltipDateFormat(
        d3.timeDay.offset(date, -6),
      )} - ${tooltipDateFormat(date)}`;
      var countStr =
        panelType == "rate"
          ? `${d["count"].toFixed(2)} per 1000`
          : d["count"].toString();

      // Create tooltip element
      var tooltip = d3
        .select("body")
        .append("div")
        .attr("class", "chart-tooltip")
        .style("position", "absolute")
        .style("background", "rgba(0, 0, 0, 0.8)")
        .style("color", "white")
        .style("padding", "8px 12px")
        .style("border-radius", "4px")
        .style("font-size", "12px")
        .style("pointer-events", "none")
        .style("z-index", "1000");

      tooltip.append("div").text(dateStr);
      tooltip.append("div").text(`Count: ${countStr}`);

      // Position tooltip
      var tooltipWidth = tooltip.node().getBoundingClientRect().width;
      var tooltipHeight = tooltip.node().getBoundingClientRect().height;
      var x = event.pageX + 10;
      var y = event.pageY - tooltipHeight - 10;

      // Adjust if tooltip goes off screen
      if (x + tooltipWidth > window.innerWidth) {
        x = event.pageX - tooltipWidth - 10;
      }
      if (y < 0) {
        y = event.pageY + 10;
      }

      tooltip.style("left", x + "px").style("top", y + "px");
    })
    .on("mouseout", function () {
      d3.selectAll(".chart-tooltip").remove();
    });

  yAxisDisplayFunc(
    svg,
    stateYScale,
    stateWidth,
    stateHeight,
    stateMargins,
    diseaseDisplayNames,
  );
  xAxisDisplayFunc(
    svg,
    stateXScale,
    stateWidth,
    stateHeight,
    stateMargins,
    diseaseDisplayNames,
  );

  temp.remove();
}

function validateFeatureDataLength(featureData, targetLength, offset = 0) {
  if (featureData.length < targetLength) {
    // console.log(targetLength)
    // console.log(featureData.length)
    // console.log(offset)
    let numToAdd = targetLength - offset - featureData.length;
    // console.log(numToAdd)
    featureData = Array(numToAdd).fill(null).concat(featureData);
  }

  return featureData;
}
