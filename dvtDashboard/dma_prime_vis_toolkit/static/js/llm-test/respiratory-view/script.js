export {
  // zctaData,
  getBoundsOfCoords,
  getCenter,
  drawStateHospitalizations,
  drawLargeStateHospitalizations,
};

// // data
// const zctaData = await d3.json(
//   `/data/respiratory/zcta/covid_19?data_version=${
//     metadata.data_version
//   }&${parseInt(Math.random() * 9999999999)}`,
// );

// console.log(zctaData)

await Promise.allSettled([
  // wait for following to be defined/load in
  customElements.whenDefined("sl-select"),
  customElements.whenDefined("sl-option"),
]);

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

document.adoptedStyleSheets = [styleSheet];

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
  coord = coord.toString();

  while (coord[1] == "0") {
    coord = coord[0] + coord.slice(2);
  }
  return parseFloat(coord);
}

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
      `/recommendation/respiratory/state/state-cdc?data_version=${
        metadata.data_version
      }&${parseInt(Math.random() * 9999999999)}`,
    );

    console.log(stateData)
    
    stateData = Object.entries(stateData[disease]).map((d) => {
      const temp = { Date: parseDate(d[0]), count: d[1] };
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
