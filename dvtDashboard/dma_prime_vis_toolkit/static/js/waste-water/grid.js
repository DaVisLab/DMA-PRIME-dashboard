function drawCharts() {
  // console.log(metadata)

  let [dateMin, dateMax] = [undefined, undefined];
  const diseaseOfInterest = gridDiseaseSelector.value;

  // find date_min and _max
  Object.keys(metadata["site_info"]).forEach((site) => {
    data = d3.select(`#${site}-div`).datum();
    d3.select(`#${site}-div`).style("display", "block");

    const curDates = Object.keys(data[diseaseOfInterest]).map(
      (d) => new Date(d)
    );
    const curDateMin = d3.min(curDates);
    const curDateMax = d3.max(curDates);

    dateMin = dateMin ? d3.min([dateMin, curDateMin]) : curDateMin;
    dateMax = dateMax ? d3.max([dateMax, curDateMax]) : curDateMax;
  });

  metadata.max_date = dateMax;
  metadata.min_date = dateMin;

  Object.keys(metadata["site_info"]).forEach((site, i) => {
    data = d3.select(`#${site}-div`).datum();

    console.log(site);
    // console.log(metadata["site_info"][site])

    domSvg = document.getElementById(`${site}-svg`);
    domSvg.innerHTML = "";
    svg = d3.select(domSvg);
    height = domSvg.scrollHeight;
    width = domSvg.scrollWidth;

    yAxis = svg.append("g").attr("class", "y-axis");
    xAxis = svg.append("g").attr("class", "x-axis");

    maxVal = 1;

    if (data && Object.keys(data[gridDiseaseSelector.value]).length) {
      data = data[gridDiseaseSelector.value];
      maxVal = d3.max(Object.values(data)) | 1;
      data = Object.entries(data).map((d) => {
        return { date: parseDate(d[0]), val: d[1] };
      });
    } else {
      data = [];
      d3.select(`#${site}-div`).style("display", "none");
      return;
    }

    const thresholdVal = d3.mean(data, (d) => d.val);

    d3.select(`#${site}-div`)
      .on("mouseover", (d) => {
        const zctaSelector = metadata["site_info"][site].zctas
          .map((z) => `#grid-map-${z}`)
          .join(",");

        if (zctaSelector.length)
          d3.selectAll(zctaSelector).style("stroke", "red");
      })
      .on("mouseleave", (d) => {
        const zctaSelector = metadata["site_info"][site].zctas
          .map((z) => `#grid-map-${z}`)
          .join(",");
        if (zctaSelector.length)
          d3.selectAll(zctaSelector).style("stroke", "black");
      });

    temp = svg
      .append("text")
      .text(d3.format(".2r")(totalMaxVal))
      .attr("x", 0)
      .attr("y", 0);

    margins = {
      top: 1 * em,
      bottom: 2 * em,
      left: Math.max(20, temp.node().getBBox().width) + 2.5 * em,
      right: 1 * em,
    };

    yScale = d3
      .scaleLinear()
      .domain([0, maxVal])
      .nice()
      .range([height - margins.bottom, margins.top]);

    xScale = d3
      .scaleTime()
      .domain([metadata["min_date"], metadata["max_date"]])
      .nice()
      .range([margins.left, width - margins.right]);

    lineGenerator = d3
      .line()
      .x((d) => xScale(d.date))
      .y((d) => yScale(d.val));

    //   console.log(dat.date)
    // draw threshold line
    svg
      .append("line")
      .attr("x1", xScale(metadata["min_date"]) - margins.right)
      .attr("y1", yScale(thresholdVal))
      .attr("x2", xScale(metadata["max_date"]) + margins.right)
      .attr("y2", yScale(thresholdVal))
      .attr("stroke", "red")
      .attr("stroke-width", 1)
      .style("stroke-dasharray", "5, 5");

    // draw path
    svg
      .append("path")
      .attr("d", lineGenerator(data))
      .attr("stroke", collectionColorScheme[site])
      .attr("fill", "none")
      .attr("stroke-width", 1.5);

    svg
      .append("g")
      .attr("id", `${site}-circles`)
      .selectAll("circle")
      .data(data)
      .enter()
      .append("circle")
      .attr("cx", (d) => xScale(d.date))
      .attr("cy", (d) => yScale(d.val))
      .attr("r", 3)
      .attr("fill", collectionColorScheme[site])
      .on("mouseover", function (event, d) {
        d3.select(`#${site}-svg`)
          .append("text")
          .attr("id", "data-ttp")
          .attr("x", d3.select(this).attr("cx"))
          .attr("y", d3.select(this).attr("cy") - 8)
          .attr("text-anchor", "middle")
          .attr("font-size", "var(--sl-font-size-small)")
          .attr("pointer-events", "none")
          .attr("border", "s")
          .text(Math.round(d.val));
      })
      .on("mouseout", () => d3.select("#data-ttp").remove());

    yAxis
      .append("text")
      .attr(
        "transform",
        `translate(${1 * em},${yScale(d3.mean(yScale.domain()))})rotate(-90)`
      )
      .attr("text-anchor", "middle")
      .attr("fill", "var(--sl-color-neutral-1000)")
      .attr("font-size", "var(--sl-font-size-small)")
      .text("GC/L WW AVG");

    yAxis
      .append("g")
      .attr("transform", `translate(${margins.left},0)`)
      .call(d3.axisLeft(yScale).ticks(5).tickSize(4))
      .selectAll("text")
      .attr("class", "tooltip-label")
      .attr("fill", "var(--sl-color-neutral-1000)");

    var extraTicks = data.map((d) => d.date);
    extraTicks = extraTicks.filter((d) =>
      dayjs(d).isAfter(d3.timeMonth.offset(xScale.domain()[1], -1))
    );

    const tickValues = data.map((d) => d.date);
    const xTicks = d3
      .axisBottom(xScale)
      .tickFormat((d) => d.toLocaleString("default", { month: "short" }));

    const gAxis = xAxis
      .call(xTicks)
      .attr("transform", `translate(0, ${height - margins.bottom})`);

    // replace text with tspans
    gAxis.selectAll(".tick text").each(function (d, i) {
      const text = d3.select(this);
      const month = d.toLocaleString("default", { month: "short" });
      const year = d.getFullYear();

      text.text(null); // clear existing text

      text.append("tspan").attr("x", 0).attr("dy", ".5em").text(month);

      // show year only on January (or year change logic)
      if (d.getMonth() === 0 || i == 0) {
        text.append("tspan").attr("x", 0).attr("dy", "1em").text(year);
      }
    });

    if (data.length) {
      var lastPointLabel = svg.append("g");
      var lastPointX = xScale(data.at(-1).date);
      var lastPointY = yScale(data.at(-1).val);
      var labelY =
        lastPointY - em < yScale.range()[0] ? lastPointY - em : lastPointY + em;

      var lastPointLabelText = lastPointLabel
        .append("text")
        .attr("class", "last-point-label")
        .attr("x", lastPointX)
        .attr("y", labelY)
        .text(d3.timeFormat(" %b %-d ")(data.at(-1).date));

      lastPointLabel
        .append("line")
        .attr("class", "last-point-label-line")
        .attr("x1", lastPointX)
        .attr("x2", lastPointX)
        .attr("y1", lastPointY)
        .attr("y2", labelY);

      if (
        lastPointLabelText.node().getBBox().x +
          lastPointLabel.node().getBBox().width >
        xScale.range()[1]
      ) {
        lastPointLabelText.attr("text-anchor", "end");
      } else if (
        lastPointLabelText.node().getBBox().x +
          lastPointLabel.node().getBBox().width / 2 >
        xScale.range()[1]
      ) {
        lastPointLabelText.attr("text-anchor", "central");
      }
    }
    temp.remove();
  });
}

function drawMap(height = 0, width = 0) {
  mapHeight = gridMapSvg.clientHeight;
  mapWidth = gridMapSvg.clientWidth;
  mapMargins = {
    top: 0.5 * em,
    bottom: 0.5 * em,
    left: 0.5 * em,
    right: 0.5 * em,
  };

  d3.json("/data/map/zcta")
    .then(function (mapdata) {
      mapProjection = d3.geoAlbers().fitExtent(
        [
          [mapMargins.left, mapMargins.top],
          [mapWidth - mapMargins.right, mapHeight - mapMargins.bottom],
        ],
        mapdata
      );

      //   console.log(mapdata);
      pathGenerator = d3.geoPath(mapProjection);

      d3.select(gridMapSvg)
        .selectAll("path")
        .data(mapdata.features)
        .join(
          (enter) =>
            enter
              .append("path")
              .attr("id", (d) => `grid-map-${d.properties.ZCTA}`)
              .attr("class", "grid-map-zcta")
              .style("fill", "white"),
          (update) => update,
          (exit) => exit.remove()
        )
        .attr("d", (d) => pathGenerator(d));
    })
    .then(() => {
      //   console.log(metadata);
      Object.entries(metadata.site_info).forEach(([site, info]) => {
        // console.log(site);
        // console.log(collectionColorScheme[site]);
        // console.log(info.zctas);
        zctaSelector = info.zctas.map((z) => `#grid-map-${z}`).join(",");

        if (zctaSelector.length)
          d3.selectAll(zctaSelector)
            .style("fill", collectionColorScheme[site])
            .on("mouseover", (d) => {
              // `#${site}-div`
              const zctaSelector = info.zctas
                .map((z) => `#grid-map-${z}`)
                .join(",");

              d3.selectAll(zctaSelector).style("stroke", "red");
              let selection = d3.select(`#${site}-div`);

              selection.select(".site-title").style("color", "red");
              selection
                .node()
                .scrollIntoView({ behavior: "instant", block: "start" });
            })
            .on("mouseout", (d) => {
              const zctaSelector = info.zctas
                .map((z) => `#grid-map-${z}`)
                .join(",");
              d3.selectAll(zctaSelector).style("stroke", "black");
              let selection = d3.select(`#${site}-div`);

              selection.select(".site-title").style("color", "black");
            });
      });
    });
}
