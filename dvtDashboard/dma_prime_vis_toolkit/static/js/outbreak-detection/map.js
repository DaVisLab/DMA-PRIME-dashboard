const { GeoJsonLayer, TextLayer, MapboxOverlay, Widget } = deck;

export { styleSheet, selectedItems, map, deckOverlay, popup, redraw, drawTooltip, drawAggregation, drawLargeAggregation, drawLegend, updateDiseaseCountDisplay, getData, changeDataColumn, update, updateMapTitle }

var regionData = await d3.json(`/data/outbreak-detection/zcta/pos_tests?${parseInt(Math.random()*9999999999)}`)
var stateFeature = regionData.features.find(d => d.properties.identifier == "state")

var selectedItems = {
    "region": undefined,
    "diseases": [],
    "dataVersion": 0
}

var choroplethColorMap = d3.scaleLinear()
    .domain([-100, -50, -10, 0, 10, 50, 100, 500])
    .range(d3.reverse(d3.schemeRdYlGn[10]).slice(1))
    .unknown(unknownColor).nice()

// Placeholder: actual domain set later via createCountRateChoropleth()
// Placeholder—will be overwritten by createCountRateChoropleth():
let countRateColorMap = d3.scaleLinear()
    .domain([0, 1])
    .range(["white", "maroon"])
    .unknown(unknownColor)
    .nice();


function createCountRateChoropleth(data) {
  // 1) For every polygon (except "state"), grab its latest value (or 0):
  const arr = data.features.map(feature => {
    const thisDt = getData(feature, mapTimeSwitch.value)
    return (thisDt.data.length > 0 && feature.properties.identifier !== "state")
      ? thisDt.data.at(-1)
      : 0
  })

  // 2) If "Rate" is selected, push a small nonzero so domain covers per-1000 scale:
  const minMaxVal = (mapRateSwitch.value === "rate")
    ? 1000.0 / stateFeature.properties.population
    : 1
  arr.push(minMaxVal)

  // 3) Rebuild countRateColorMap → [0 → max(arr)] with YlOrRd interpolator:
  const maxVal = d3.max(arr)
  countRateColorMap = d3.scaleLinear()
    .domain([0, maxVal])
    .range(["white", "maroon"])
    .unknown(unknownColor)
    .nice();
}


const map = new maplibregl.Map({
    container: mapDiv,
    style: "https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json",
    center: [-81, 33.65],
    zoom: 7,
})

await map.once('load')

var popup = new maplibregl.Popup({focusAfterOpen: false, closeOnClick: false})

const deckOverlay = new MapboxOverlay({
    interleaved: true,
})

map.addControl(deckOverlay)
map.addControl(new maplibregl.NavigationControl())

await Promise.allSettled([ // wait for following to be defined/load in
    customElements.whenDefined('sl-checkbox'),
    customElements.whenDefined('sl-button'),
])

var styleSheet = new CSSStyleSheet()
styleSheet.insertRule(`
    .maplibregl-popup-content {
        /* tooltip's containing div */
        background-color: hsla(${getComputedStyle(document.head).getPropertyValue("--sl-color-neutral-0").replace("hsl(", "").replace(")", "")}, 0.925);
    }`
    ,0)   

document.adoptedStyleSheets = [styleSheet]
drawAggregation()
updateDiseaseCountDisplay()
redraw()

function redraw() {
    // 1) Recompute the Count/Rate color scale from the actual data:
    createCountRateChoropleth(regionData);
  
    // 2) Now redraw the legend (which will use that updated color scale)
    drawLegend();
  
    // 3) Then set the layers
    var layers = [
      new GeoJsonLayer({
        id: 'disease_choropleth',
        depthTest: false,
        pickable: true,
        data: regionData,
        stroked: true,
        filled: true,
        pointType: 'circle+text',
        pickable: true,
        getFillColor: d => getColor(d),
        lineWidthMinPixels: .75,
        getLineWidth: 20,
        getLineColor: [64, 64, 64],
        updateTriggers: {
          getFillColor: [
            mapRateSwitch.value,
            mapColumnSwitch.value,
            mapTimeSwitch.value,
            selectedItems.diseases,
            selectedItems.dataVersion,
          ],
        },
      }),
      new GeoJsonLayer({
        id: 'region_highlight',
        depthTest: false,
        data: selectedItems.region,
        stroked: true,
        filled: false,
        pointType: 'circle+text',
        pickable: true,
        lineWidthMinPixels: .5,
        getLineWidth: 1000,
        getLineColor: [128, 128, 128],
        getPointRadius: 4,
        getTextSize: 12,
        updateTriggers: {
          data: selectedItems.region
            ? selectedItems.region.properties.identifier
            : selectedItems.region,
        },
      }),
    ]

    if (mapRegionSelector.value != "state" && mapOptionsGeographicLabelsToggle.checked) {
      layers.push(
        new TextLayer({
          id: 'labels',
          data: regionData.features,
          getPosition: d => getCenter(d),
          getText: d => {return d.properties.identifier.toString() != "state" ? d.properties.identifier.toString() : ""},
          getAlignmentBaseline: 'center',
          getTextAnchor: 'middle',
          getColor: [0, 0, 0],
          background: true,
          getBackgroundColor: [255, 255, 255, 32],
          backgroundBorderRadius: 2,
          backgroundPadding: [4, 4],
          getSize: mapRegionSelector.value == "zcta" ? Math.min(Math.max(8, map.getZoom()*1.5), 16) : 16,
          fontFamily:getComputedStyle(document.head).getPropertyValue("--sl-font-sans").replace(/\s/g,'').split(',') ,
          collisionGroup: 'labels',
          collisionTestProps: {sizeScale: 2.5},
          updateTriggers: {
              getSize: [map.getZoom()],
          },
        })
      )
    }
    deckOverlay.setProps({
      layers: layers
    });
  }
  

  function getColor(feature) {
    // —— 1) Percent Difference Mode ——
    if (mapRateSwitch.value === 'percent') {
      // If no diseases selected OR both thisWeek/lastWeek are NaN → grey
      if (
        selectedItems.diseases.length === 0 ||
        (
          isNaN(getLatestDatum(feature, mapTimeSwitch.value).data) &&
          isNaN(getLastWeekDatum(feature, mapTimeSwitch.value).data)
        )
      ) {
        const u = d3.rgb(unknownColor);
        return [u.r, u.g, u.b];
      }
  
      // Otherwise calculate % change as before:
      const thisWeek = getLatestDatum(feature, mapTimeSwitch.value).data;
      const lastWeek = getLastWeekDatum(feature, mapTimeSwitch.value).data;
      let colorObj;
  
      // only compute % change if lastWeek is a valid non-zero number
      if (!isNaN(thisWeek) && !isNaN(lastWeek) && lastWeek !== 0) {
        const pct = (thisWeek - lastWeek) / Math.abs(lastWeek) * 100;
        colorObj = d3.rgb(choroplethColorMap(pct));
      }
      // no encounters (or tests) at all this week → white
      else if (thisWeek === 0) {
        colorObj = d3.rgb('white');
      }
      // new encounters when lastWeek = 0 but thisWeek > 0 → light pink
      else {
        colorObj = d3.rgb('#ffddff');
      }
  
      return [colorObj.r, colorObj.g, colorObj.b];
    }
  
    // —— 2) Count or Rate Mode ——
    // A) If no diseases are selected at all, paint every region grey:
    if (selectedItems.diseases.length === 0) {
      const u = d3.rgb(unknownColor);
      return [u.r, u.g, u.b];
    }
  
    // B) Grab the "latest" value (already population-adjusted if rate)
    const latest = getLatestDatum(feature, mapTimeSwitch.value).data;
  
    // C) If that "latest" is NaN → paint it grey (unknown)
    if (isNaN(latest)) {
      const u = d3.rgb(unknownColor);
      return [u.r, u.g, u.b];
    }
  
    // D) Otherwise (latest is a real number, possibly zero), map 0→white, >0→maroon:
    const colorObj = d3.rgb(countRateColorMap(latest));
    return [colorObj.r, colorObj.g, colorObj.b];
  }
  
  
  
  
  
  

  function drawLegend() {
    choroplethLegendSVG.innerHTML = "";
    const legend = d3.select(choroplethLegendSVG)
        .attr("overflow", "visible")
        .attr("transform", "translate(40, 0)")
        .attr("width", 350)
        .attr("height", 50);

    const legendLength = 350;
    const columnLabel = d3.select(`sl-option[value=${mapColumnSwitch.value}]`).html();

    if (mapRateSwitch.value === "percent") {
        // ======== PERCENT DIFFERENCE LEGEND ========
        const colors = d3.reverse(d3.schemeRdYlGn[10]).slice(1);
        const labels = [-100, -50, -10, 0, 10, 50, 100, 500];

        // 1) Title centered above the swatch bar
        legend.append("text")
            .attr("x", legendLength / 2)
            .attr("y", -em / 2)
            .attr("text-anchor", "middle")
            .style("font-size", 'var(--sl-font-size-x-small)')
            .text(`Percent Change of ${columnLabel} from Last Period`);

        // 2) Draw the colored rectangles (8 bins)
        legend.append("g").selectAll("rect")
            .data(colors)
            .enter()
            .append("rect")
            .attr("x", (d, i) => legendLength * i / colors.length)
            .attr("y", 0)
            .attr("width", legendLength / colors.length)
            .attr("height", 15)
            .attr("fill", d => d);

        // 3) Draw each percentage tick label below the corresponding bin boundary
        legend.append("g").selectAll("text")
            .data(labels)
            .enter()
            .append("text")
            .attr("x", (d, i) => legendLength * (i + 1) / colors.length)
            .attr("y", 15 + em * 0.75)
            .attr("text-anchor", "middle")
            .style("font-size", 'var(--sl-font-size-x-small)')
            .html(d => `${d}%`);

        // 4) "Other colors" group (white, light‐pink, unknown) with explanatory labels
        const otherColors = legend.append("g");
        const others = [
            ["white", `No ${columnLabel}`],
            ["#ffddff", `New ${columnLabel} from Last Period`],
            [unknownColor, "Unknown"]
        ];

        others.forEach((d, i) => {
            const group = otherColors.append("g")
                .attr("transform", `translate(0, ${(i + 1) * -20 - 2 * em})`);
            group.append("rect")
                .attr("x", 0)
                .attr("y", 0)
                .attr("height", 15)
                .attr("width", 15)
                .attr("fill", d[0])
                .attr("stroke", "black")
                .attr("stroke-width", 1);
            group.append("text")
                .attr("class", "legend-other-colors")
                .attr("x", 20)
                .attr("y", 7.5)
                .attr("dominant-baseline", "middle")
                .style("font-size", 'var(--sl-font-size-x-small)')
                .text(d[1]);
        });

    } else {
        // ======== COUNT/RATE CONTINUOUS GRADIENT LEGEND ========
        const gradientId = "countRateGradient";

        // 1) Build <defs> / <linearGradient> (white → maroon)
        const defs = legend.append("defs");
        const linearGradient = defs.append("linearGradient")
            .attr("id", gradientId)
            .attr("x1", "0%")
            .attr("x2", "100%");
        linearGradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", "white");
        linearGradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", "maroon");

        // 2) Title in the middle
        legend.append("text")
            .attr("x", legendLength / 2)
            .attr("y", -em / 2)
            .attr("text-anchor", "middle")
            .style("font-size", 'var(--sl-font-size-x-small)')
            .text(
              `${mapRateSwitch.value === "rate" ? "Rate (per 1000)" : "Count"} of ${columnLabel}`
            );

        // 3) Draw the gradient rectangle
        legend.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", legendLength)
            .attr("height", 15)
            .style("fill", `url(#${gradientId})`);

        // 4) Compute domain endpoints
        const [d0, d1] = countRateColorMap.domain();  // e.g. [0, maxVal]

        // 5) Build a linear scale from [0..d1] → [0..legendLength]
        const linearScale = d3.scaleLinear()
            .domain([d0, d1])
            .range([0, legendLength]);

        // 6) Ask D3 for up to 5 "nice" ticks, then clamp anything > d1
        let rawTicks = linearScale.ticks(5).filter(v => v <= d1);

        // 7) Guarantee that d1 (maxVal) appears exactly as the last tick
        if (!rawTicks.includes(d1)) {
          rawTicks.push(d1);
        }
        rawTicks.sort((a, b) => a - b);

        //
        // ─── FILTER OUT DUPLICATE‐FORMATTED TICKS ───
        // Choose a formatter based on the magnitude of d1
        let formatTick;
        if (d1 >= 100) {
          // large numbers → "1,234"
          formatTick = d3.format(",.0f");
        } else if (d1 >= 1) {
          // moderate numbers → one decimal place, e.g. "12.3"
          formatTick = d3.format(",.1f");
        } else {
          // small numbers → two decimal places, e.g. "0.12"
          formatTick = d3.format(".2f");
        }

        const filteredTicks = [];
        rawTicks.forEach((v, i) => {
          const label = formatTick(v);
          if (i === 0 || label !== formatTick(rawTicks[i - 1])) {
            filteredTicks.push(v);
          }
        });

        // ─── ENSURE AT LEAST TWO TICKS WHEN POSSIBLE ───
        if (filteredTicks.length <= 1) {
          if (d1 === 0) {
            // If everything is zero, show only a single tick at 0
            filteredTicks.splice(0, filteredTicks.length, 0);
            formatTick = d3.format(",.0f"); // force "0"
          } else {
            // Otherwise show both 0 and d1
            filteredTicks.splice(0, filteredTicks.length, d0, d1);
          }
        }

        // 8) Draw a short vertical line ("tick") at each filtered/clamped tick value
        legend.append("g").selectAll("line.tick")
            .data(filteredTicks)
            .enter()
            .append("line")
              .attr("class", "tick")
              .attr("x1", d => Math.min(linearScale(d), legendLength))
              .attr("x2", d => Math.min(linearScale(d), legendLength))
              .attr("y1", 15)                  // bottom edge of gradient
              .attr("y2", 15 + em * 0.25)      // short downward stroke
              .attr("stroke", "black");

        // 9) Draw each tick's label beneath its tick line, centered
        legend.append("g").selectAll("text.tick-label")
            .data(filteredTicks)
            .enter()
            .append("text")
              .attr("class", "tick-label")
              .attr("x", d => Math.min(linearScale(d), legendLength))
              .attr("y", 15 + em)             // same baseline as before
              .attr("text-anchor", "middle")
              .attr("fill", "black")
              .style("font-size", 'var(--sl-font-size-x-small)')
              .text(d => formatTick(d));
    }
}




function drawTooltip(dataObject) {
    // 1) If nothing is selected or the popup is closed, remove and bail:
    if (!dataObject || !popup.isOpen()) {
      popup.remove();
      return;
    }

    // 2) Compute "latest" and "previous" values (for percent‐change),
    const latestDatum = getLatestDatum(dataObject, mapTimeSwitch.value).data;
    const prevDatum   = getLastWeekDatum(dataObject, mapTimeSwitch.value).data;

    // 3) Build a percent‐change label
    let percentLabel;
    if (isNaN(latestDatum) || isNaN(prevDatum)) {
      percentLabel = "Change: N/A";
    } else if (prevDatum === 0 && latestDatum === 0) {
      percentLabel = "Change: 0 %";
    } else if (prevDatum === 0 && latestDatum > 0) {
      percentLabel = "Change: New cases";
    } else {
      const rawPct  = ((latestDatum - prevDatum) / Math.abs(prevDatum)) * 100;
      const rounded = Math.round(rawPct * 10) / 10; // one decimal place
      const sign    = rounded >= 0 ? "+" : "";
      percentLabel  = `Change: ${sign}${rounded} %`;
    }
  
    // 4) Grab the entire time series for the bar chart,
    //    forcing weekly data regardless of the selector.
    const thisData = getData(dataObject, "weekly");
  
    // 5) Build the "Encounters ... from X to Y: N" string
    let encounterString = "";
    switch (mapColumnSwitch.value) {
      case "encounters":
        encounterString += "Encounters";
        break;
      case "pos_tests":
        encounterString += "Positive tests";
        break;
      case "encounter_plus_test":
        encounterString += "Encounters and positive tests";
        break;
    }
    encounterString += " from ";
  
    const endDate = thisData.end_date;
    const fmt     = d3.timeFormat("%b %d, %Y");
  
    if (mapTimeSwitch.value === "weekly") {
      // If the user has "Week" selected, show exactly that 7‐day window
      encounterString += `${fmt(endDate)} to ${fmt(d3.timeDay.offset(endDate, 6))}`;
    } else if (mapTimeSwitch.value === "monthly") {
      // If the user has "Month" selected, still show the last four weeks (28 days)
      const startDate = d3.timeDay.offset(endDate, -4 * 7);
      encounterString += `${fmt(startDate)} to ${fmt(d3.timeDay.offset(endDate, 6))}`;
    } else {
      // If the user has "Year" selected, still show the last 52 weeks
      const startDate = d3.timeDay.offset(endDate, -52 * 7);
      encounterString += `${fmt(startDate)} to ${fmt(d3.timeDay.offset(endDate, 6))}`;
    }
    encounterString += ": ";
  
    var lastVal = parseFloat(getData(dataObject, mapTimeSwitch.value).data.at(-1))
    if (mapRateSwitch.value === "rate") {
      encounterString += `${Math.round(lastVal * 1000) / 1000} (per 1000 people)`;
    } else {
      encounterString += lastVal;
    }
  
    // 6) Prepare dimensions and clear existing tooltip
    var width = mapDiv.clientWidth;
    var mapTooltipWidth = Math.max(500, width * .3);
    var mapTooltipHeight = mapTooltipWidth * .65;
  
    const ttpDiv = d3
      .select("#map-tooltip-div")
      .style("display", "initial")
      .style("border-style", "none")
      .html(""); // wipe it clean
  
    //
    // ─── HEADER: "Zip Code: XXX"  (on left)  +  "Change: ±N%"  (on right) ───
    //
    const headerContainer = ttpDiv
      .append("div")
      .attr("class", "tooltip-header")
      .style("display", "flex")
      .style("justify-content", "space-between")
      .style("align-items", "baseline")   // keep left & right on same baseline
      .style("margin-bottom", "8px");
  
    // 7a) LEFT SIDE of header: Zip Code (or whatever region)
    const leftHeaderCol = headerContainer
      .append("div")
      .attr("class", "tooltip-left-col")
      .style("flex", "1")
      .style("font-size", "var(--sl-font-size-small)")
      .style("line-height", "1.4em");
  
    leftHeaderCol
      .append("p")
      .attr("class", "tooltip-title")
      .style("margin", "0px")  // remove default <p> margin
      .html(
        `${d3.select(`sl-option[value=${mapRegionSelector.value}]`).html()}: ${dataObject.properties.identifier}`
      );

    //
    // ─── "County: YYY" on its own line, directly under the header ───
    //
    if (mapRegionSelector.value == "zcta") {
      ttpDiv
        .append("p")
        .attr("class", "tooltip-subtitle")
        .style("margin", "0px")
        .style("font-size", "var(--sl-font-size-small)")
        .style("line-height", "1.4em")
        .html(
          `County: ${dataObject.properties.county[0].toUpperCase() + dataObject.properties.county.slice(1)}`
        );
    }
    

    // 7a-2) If there's no data on map, say no data and return
    if (getData(dataObject, mapTimeSwitch.value).data.length < 1) {
        ttpDiv.append("p").html("No Data")
        return
    }
  
    // 7b) RIGHT SIDE of header: Percent‐change
    const rightHeaderCol = headerContainer
      .append("div")
      .attr("class", "tooltip-right-col")
      .style("text-align", "right")
      .style("font-size", "var(--sl-font-size-small)")
      .style("line-height", "1.4em");
  
    rightHeaderCol
      .append("p")
      .attr("class", "tooltip-percent-change")
      .style("margin", "0px")
      
      .html(percentLabel);
  
  
    //
    // ─── Then the "Encounters ... to ...: N" line ───
    //
    ttpDiv
      .append("p")
      .attr("class", "tooltip-subtitle")
      .style("margin", "4px 0 8px 0") // small spacing above/below
      .style("font-size", "var(--sl-font-size-small)")
      .style("line-height", "1.4em")
      .html(encounterString);
  
    //
    // ─── Finally, insert the bar chart SVG below those three lines ───
    //
    const ttpSVG = ttpDiv
      .append("svg")
      .attr("id", "map-tooltip-svg")
      .attr("class", "tooltip-outer-svg")
      .attr("width", mapTooltipWidth)
      .attr("height", mapTooltipHeight);
  
    createBarGraph(ttpSVG, thisData, regionData.metadata, mapTooltipHeight, mapTooltipWidth);

    // Add expand button to popup (like respiratory)
    var expandPopupButton = d3.select("div.maplibregl-popup-content").append("sl-icon-button")
        .attr("name", "zoom-in")
        .style("font-size", "9px")
        .style("cursor", "pointer")
        .style("position", "absolute")
        .style("right", "18px")
        .style("top", 0);
    expandPopupButton.node().updateComplete.then(() => {
        d3.select(expandPopupButton.node().shadowRoot).select("button").node().style.padding = "4px";
    });
    expandPopupButton.on("click", () => {
      drawLargeTooltip(dataObject);
      document.getElementById("map-tooltip-large").show();
    });
    
}

  
  


function drawAggregation() {
    var thisData = getData(stateFeature, "weekly")
    var aggWidth = Math.max(300, document.getElementById("map-sidebar").clientWidth)
    var aggHeight = aggWidth * .5

    aggregatedDiseaseHistoryTitle.innerHTML = `State Wide ${d3.select(`sl-option[value=${mapColumnSwitch.value}]`).html()}`

    var encounterString = ""
    switch (mapColumnSwitch.value) {
        case "encounters":
            encounterString += "Encounters"
            break;
        case "pos_tests":
            encounterString += "Positive tests"
            break;
        case "encounter_plus_test":
            encounterString += "Encounters and positive tests"
            break;
    }
    encounterString += " from "
    var thisWeek = thisData.end_date
    switch (mapTimeSwitch.value) {
        case "weekly":
            var formatDate = d3.timeFormat("%b %d, %Y")
            encounterString += `${formatDate(thisWeek)} to<br/>${formatDate(d3.timeDay.offset(thisWeek, 6))}`
            break;
        case "monthly":
            var startWeek = d3.timeDay.offset(thisWeek, -4*7)
            var formatDate = d3.timeFormat("%b %d, %y")
            encounterString += `${formatDate(startWeek)} to<br/>${formatDate(d3.timeDay.offset(thisWeek, 6))}`
            break;
        case "yearly":
            var startWeek = d3.timeDay.offset(thisWeek, -52*7)
            var formatDate = d3.timeFormat("%b %d, %y")
            encounterString += `${formatDate(startWeek)} to<br/>${formatDate(d3.timeDay.offset(thisWeek, 6))}`
            break;
    }
    encounterString += ": "
    var val = thisData.data.at(-1)
    if (val) {
        if (mapRateSwitch.value == "rate") {
            val = Math.round(val * 1000) / 1000
            encounterString += `${val} (per 1000 people)`
        } else {
            encounterString += val
        }
    } else {
        encounterString += "N/A"
    }
    aggregatedDiseaseHistorySubtitle.innerHTML = encounterString

    var aggSVG = d3.select(aggregatedDiseaseHistory)
    aggSVG.html("")
    
    createBarGraph(aggSVG, thisData, regionData.metadata, aggHeight, aggWidth)
}

function updateDiseaseCountDisplay() {
  // 1) grab all disease keys
  const diseases = d3.selectAll(".disease-checkbox").nodes()
    .map(d => d.getAttribute("disease"));

  let allCount = 0, allPrev = 0;

  // 2) compute & render each disease's count/rate plus percent-change
  diseases.forEach(disease => {
    // current & previous raw totals
    let val     = stateFeature.properties.data[disease][mapTimeSwitch.value].at(-1);
    let prevVal = stateFeature.properties.data[disease][mapTimeSwitch.value].at(-2) || 0;

    // apply "per 1000" if in rate mode
    if (mapRateSwitch.value === "rate") {
      val     /= (stateFeature.properties.population / 1000);
      prevVal /= (stateFeature.properties.population / 1000);
    }

    allCount += val;
    allPrev  += prevVal;

    // always compute percent-change
    const rawPct = prevVal !== 0
      ? ((val - prevVal) / Math.abs(prevVal)) * 100
      : 0;
    const pct  = Math.round(rawPct * 10) / 10;     // one decimal
    const sign = pct >= 0 ? "+" : "";              // prefix for positives

    // round display of val
    const dispVal = Math.round(val * 1000) / 1000;

    // show "(value, +pct%)" in every mode
    d3.select(`#map-${disease}-count`)
      .html(`(${dispVal}, ${sign}${pct}%)`);
  });

  // 3) Same for "All Diseases"
  const rawAll = allPrev !== 0
    ? ((allCount - allPrev) / Math.abs(allPrev)) * 100
    : 0;
  const pctAll  = Math.round(rawAll * 10) / 10;
  const signAll = pctAll >= 0 ? "+" : "";
  const dispAll = Math.round(allCount * 1000) / 1000;

  d3.select("#map-all-count")
    .html(`(N=${dispAll}, ${signAll}${pctAll}%)`);
}




function getLatestDatum(feature, timeFrame="weekly") {
  var diseases = selectedItems.diseases;
  var thisData = {
    data: NaN,
    other: NaN,
    population: feature.properties.population,
    start_date: dayjs().toDate(),
    end_date: dayjs().toDate(),
  };

  if (diseases.length > 0) {
    // 1a) Filter to only the selected diseases that actually have data for this timeframe
    var dataDicts = Object.entries(feature.properties.data)
      .filter(([disease, obj]) => 
        diseases.includes(disease) && obj[timeFrame].length > 0
      )
      .map(([_, obj]) => obj);

    var otherDicts = Object.entries(feature.properties.other)
      .filter(([disease, obj]) => 
        diseases.includes(disease) && obj[timeFrame].length > 0
      )
      .map(([_, obj]) => obj);

    // 1b) Grab the metadata dates
    var earliestDate = parseDate(regionData.metadata.start_date);
    var latestDate   = parseDate(regionData.metadata.end_date);
    thisData.start_date = earliestDate;
    thisData.end_date   = latestDate;

    // 1c) Sum up the "latest" values (last entry in each array)
    if (dataDicts.length > 0) {
      thisData.data  = 0;
      thisData.other = 0;
      for (var obj of dataDicts) {
        thisData.data += obj[timeFrame].at(-1);
      }
      for (var obj of otherDicts) {
        thisData.other += obj[timeFrame].at(-1);
      }
    }
    // If dataDicts is empty, thisData.data/other remain NaN.
  }

  // 2) Apply "rate" conversion at the very end—but do NOT do "|| 0"
  if (mapRateSwitch.value === "rate" && !isNaN(thisData.data)) {
    thisData.data = parseFloat(thisData.data) / (thisData.population / 1000.0);
  }
  if (mapRateSwitch.value === "rate" && !isNaN(thisData.other)) {
    thisData.other = parseFloat(thisData.other) / (thisData.population / 1000.0);
  }

  return thisData;
}


function getLastWeekDatum(feature, timeFrame="weekly") {
  var diseases = selectedItems.diseases;
  var thisData = {
    data: NaN,
    other: NaN,
    population: feature.properties.population,
    start_date: dayjs().toDate(),
    end_date: dayjs().toDate(),
  };

  if (diseases.length > 0) {
    var dataDicts = Object.entries(feature.properties.data)
      .filter(([disease, obj]) => 
        diseases.includes(disease) && obj[timeFrame].length > 0
      )
      .map(([_, obj]) => obj);

    var otherDicts = Object.entries(feature.properties.other)
      .filter(([disease, obj]) => 
        diseases.includes(disease) && obj[timeFrame].length > 0
      )
      .map(([_, obj]) => obj);

    var earliestDate = parseDate(regionData.metadata.start_date);
    var latestDate   = parseDate(regionData.metadata.end_date);
    thisData.start_date = earliestDate;
    thisData.end_date   = latestDate;

    if (dataDicts.length > 0) {
      thisData.data  = 0;
      thisData.other = 0;
      for (var obj of dataDicts) {
        // "last week" means the second‐to‐last entry (index -2)
        thisData.data += obj[timeFrame].at(-2);
      }
      for (var obj of otherDicts) {
        thisData.other += obj[timeFrame].at(-2);
      }
    }
    // If dataDicts empty, thisData.data/other remain NaN.
  }

  // Apply rate only if not NaN:
  if (mapRateSwitch.value === "rate" && !isNaN(thisData.data)) {
    thisData.data = parseFloat(thisData.data) / (thisData.population / 1000.0);
  }
  if (mapRateSwitch.value === "rate" && !isNaN(thisData.other)) {
    thisData.other = parseFloat(thisData.other) / (thisData.population / 1000.0);
  }

  return thisData;
}


function getData(feature, timeFrame="weekly") {
    var diseases = selectedItems.diseases
    var thisData = {
        "data": [],
        "other": [],
        "population": feature.properties.population,
        "start_date": dayjs().toDate(),
        "end_date": dayjs().toDate(),
    }

    if (diseases.length > 0) {
        // one/many diseases
        var dataDicts = Object.entries(feature.properties.data).filter(d => diseases.includes(d[0]) && d[1][timeFrame].length > 0)
        dataDicts = dataDicts.map(d => d[1])
        var otherDicts = Object.entries(feature.properties.other).filter(d => diseases.includes(d[0]) && d[1][timeFrame].length > 0)
        otherDicts = otherDicts.map(d => d[1])

        var earliestDate = parseDate(regionData.metadata.start_date)
        var latestDate = parseDate(regionData.metadata.end_date)
        thisData.start_date = earliestDate
        thisData.end_date = latestDate
        var periods
        if (dataDicts.length > 0) {
            switch (timeFrame) {
                case "weekly":
                    periods = (d3.timeDay.count(earliestDate, latestDate)/7) + 1
                    break;
                case "monthly":
                    periods = Math.ceil(d3.timeDay.count(earliestDate, latestDate)/28)
                    break;
                case "yearly":
                    periods = Math.ceil(d3.timeDay.count(earliestDate, latestDate)/(52*7))
                    break;
            }
            thisData.data = new Array(periods).fill(0)
            for (var data of dataDicts) {
                for (var i=0; i < data[timeFrame].length; i++) {
                    thisData.data[i] += data[timeFrame][i]
                }
            }
            thisData.other = new Array(periods).fill(0)
            for (var other of otherDicts) {
                for (var i=0; i < other[timeFrame].length; i++) {
                    thisData.other[i] += other[timeFrame][i]
                }
            }
        }
    }
    
    // rate applied at end
    if (mapRateSwitch.value == "rate") {
        thisData.data = thisData.data.map((val) => 
            (parseFloat(val) / (thisData.population / 1000.0)) || 0)
        thisData.other = thisData.other.map((val) => 
            (parseFloat(val) / (thisData.population / 1000.0)) || 0)
    }

    return thisData
}

function drawLargeTooltip(dataObject) {
    // 1) If nothing is selected or the popup is closed, remove and bail:
    if (!dataObject) {
      return;
    }

    // 2) Compute "latest" and "previous" values (for percent‐change),
    const latestDatum = getLatestDatum(dataObject, mapTimeSwitch.value).data;
    const prevDatum   = getLastWeekDatum(dataObject, mapTimeSwitch.value).data;

    // 3) Build a percent‐change label
    let percentLabel;
    if (isNaN(latestDatum) || isNaN(prevDatum)) {
      percentLabel = "Change: N/A";
    } else if (prevDatum === 0 && latestDatum === 0) {
      percentLabel = "Change: 0 %";
    } else if (prevDatum === 0 && latestDatum > 0) {
      percentLabel = "Change: New cases";
    } else {
      const rawPct  = ((latestDatum - prevDatum) / Math.abs(prevDatum)) * 100;
      const rounded = Math.round(rawPct * 10) / 10; // one decimal place
      const sign    = rounded >= 0 ? "+" : "";
      percentLabel  = `Change: ${sign}${rounded} %`;
    }
  
    // 4) Grab the entire time series for the bar chart,
    //    forcing weekly data regardless of the selector.
    const thisData = getData(dataObject, "weekly");
  
    // 5) Build the "Encounters ... from X to Y: N" string
    let encounterString = "";
    switch (mapColumnSwitch.value) {
      case "encounters":
        encounterString += "Encounters";
        break;
      case "pos_tests":
        encounterString += "Positive tests";
        break;
      case "encounter_plus_test":
        encounterString += "Encounters and positive tests";
        break;
    }
    encounterString += " from ";
  
    const endDate = thisData.end_date;
    const fmt     = d3.timeFormat("%b %d, %Y");
  
    if (mapTimeSwitch.value === "weekly") {
      // If the user has "Week" selected, show exactly that 7‐day window
      encounterString += `${fmt(endDate)} to ${fmt(d3.timeDay.offset(endDate, 6))}`;
    } else if (mapTimeSwitch.value === "monthly") {
      // If the user has "Month" selected, still show the last four weeks (28 days)
      const startDate = d3.timeDay.offset(endDate, -4 * 7);
      encounterString += `${fmt(startDate)} to ${fmt(d3.timeDay.offset(endDate, 6))}`;
    } else {
      // If the user has "Year" selected, still show the last 52 weeks
      const startDate = d3.timeDay.offset(endDate, -52 * 7);
      encounterString += `${fmt(startDate)} to ${fmt(d3.timeDay.offset(endDate, 6))}`;
    }
    encounterString += ": ";
  
    var lastVal = parseFloat(getData(dataObject, mapTimeSwitch.value).data.at(-1))
    if (mapRateSwitch.value === "rate") {
      encounterString += `${Math.round(lastVal * 1000) / 1000} (per 1000 people)`;
    } else {
      encounterString += lastVal;
    }
  
    // 6) Prepare dimensions and clear existing tooltip
    // Use a fixed, compact size for large tooltip
    const maxWidth = Math.min(600, mapDiv.clientWidth * 0.4);
    const maxHeight = Math.min(350, mapDiv.clientHeight * 0.23);
    const ttpWidth  = maxWidth;
    // Add extra bottom margin for slanted x-axis labels
    const ttpHeight = maxHeight + 40;
  
    const ttpDiv = d3
      .select("#map-tooltip-large-div")
      .style("display", "initial")
      .style("border-style", "none")
      .html(""); // wipe it clean
  
    //
    // ─── HEADER: "Zip Code: XXX"  (on left)  +  "Change: ±N%"  (on right) ───
    //
    const headerContainer = ttpDiv
      .append("div")
      .attr("class", "tooltip-header")
      .style("display", "flex")
      .style("justify-content", "space-between")
      .style("align-items", "baseline")
      .style("margin-bottom", "8px");
    const leftHeaderCol = headerContainer
      .append("div")
      .attr("class", "tooltip-left-col")
      .style("flex", "1")
      .style("font-size", "var(--sl-font-size-x-small)")
      .style("line-height", "1.4em");
    leftHeaderCol
      .append("p")
      .attr("class", "tooltip-title")
      .style("margin", "0px")
      .style("font-size", "var(--sl-font-size-x-small)")
      .html(
        `${d3.select(`sl-option[value=${mapRegionSelector.value}]`).html()}: ${dataObject.properties.identifier}`
      );
    if (mapRegionSelector.value == "zcta") {
      ttpDiv
        .append("p")
        .attr("class", "tooltip-subtitle")
        .style("margin", "0px")
        .style("font-size", "var(--sl-font-size-x-small)")
        .style("line-height", "1.4em")
        .html(
          `County: ${dataObject.properties.county[0].toUpperCase() + dataObject.properties.county.slice(1)}`
        );
    }
    if (getData(dataObject, mapTimeSwitch.value).data.length < 1) {
        ttpDiv.append("p").html("No Data")
        return
    }
    const rightHeaderCol = headerContainer
      .append("div")
      .attr("class", "tooltip-right-col")
      .style("text-align", "right")
      .style("font-size", "var(--sl-font-size-x-small)")
      .style("line-height", "1.4em");
    rightHeaderCol
      .append("p")
      .attr("class", "tooltip-percent-change")
      .style("margin", "0px")
      .style("font-size", "var(--sl-font-size-x-small)")
      .html(percentLabel);
    ttpDiv
      .append("p")
      .attr("class", "tooltip-subtitle")
      .style("margin", "4px 0 8px 0")
      .style("font-size", "var(--sl-font-size-x-small)")
      .style("line-height", "1.4em")
      .html(encounterString);
    // SVG with extra bottom margin
    const ttpSVG = ttpDiv
      .append("svg")
      .attr("id", "map-tooltip-svg")
      .attr("class", "tooltip-outer-svg")
      .attr("width", ttpWidth)
      .attr("height", ttpHeight);
    createBarGraph(ttpSVG, thisData, regionData.metadata, ttpHeight, ttpWidth, { isLargeTooltip: true });
}

function drawLargeAggregation() {
    var thisData = getData(stateFeature, "weekly")

    aggregatedDiseaseHistoryLargeTitle.innerHTML = `State Wide ${d3.select(`sl-option[value=${mapColumnSwitch.value}]`).html()}`

    var encounterString = ""
    switch (mapColumnSwitch.value) {
        case "encounters":
            encounterString += "Encounters"
            break;
        case "pos_tests":
            encounterString += "Positive tests"
            break;
        case "encounter_plus_test":
            encounterString += "Encounters and positive tests"
            break;
    }
    encounterString += " from "
    var thisWeek = thisData.end_date
    switch (mapTimeSwitch.value) {
        case "weekly":
            var formatDate = d3.timeFormat("%b %d, %Y")
            encounterString += `${formatDate(thisWeek)} to ${formatDate(d3.timeDay.offset(thisWeek, 6))}`
            break;
        case "monthly":
            var startWeek = d3.timeDay.offset(thisWeek, -4*7)
            var formatDate = d3.timeFormat("%b %d, %y")
            encounterString += `${formatDate(startWeek)} to ${formatDate(d3.timeDay.offset(thisWeek, 6))}`
            break;
        case "yearly":
            var startWeek = d3.timeDay.offset(thisWeek, -52*7)
            var formatDate = d3.timeFormat("%b %d, %y")
            encounterString += `${formatDate(startWeek)} to ${formatDate(d3.timeDay.offset(thisWeek, 6))}`
            break;
    }
    encounterString += ": "
    var val = thisData.data.at(-1)
    if (val) {
        if (mapRateSwitch.value == "rate") {
            val = Math.round(val * 1000) / 1000
            encounterString += `${val} (per 1000 people)`
        } else {
            encounterString += val
        }
    } else {
        encounterString += "N/A"
    }
    aggregatedDiseaseHistoryLargeSubtitle.innerHTML = encounterString

    var svg = d3.select(aggregatedDiseaseHistoryLargeSvg)
    svg.html("")
    var data = thisData
    var metadata = regionData.metadata
    var width = aggregatedDiseaseHistoryLargeSvg.clientWidth
    var height = aggregatedDiseaseHistoryLargeSvg.clientHeight

    var graphSVG = svg.append("svg")
        .attr("class", "tooltip-graph-svg")
        .attr("height", height)
        .attr("width", width)

    var yAxis = svg.append("g")
        .attr("class", "y-axis")
    var xAxis = svg.append("g")
        .attr("class", "x-axis")
    
    var minMaxVal = mapRateSwitch.value == "rate" ? 1000.0/data.population : 1
    var maxVal = d3.max(data.data) ? d3.max(data.data) : minMaxVal
    maxVal = d3.max(data.other) ? Math.max(maxVal, d3.max(data.other)) : maxVal
    
    // figure out how much space is needed for the y-axis text
    var temp = svg.append("text").text(d3.format(".2r")(maxVal)).attr("x", 0).attr("y", 0)
    var margins = {
        "top": .5*em, 
        "bottom": 1.5*em,
        "left": 1.25*em,
        "right": .5*em,
    }
    margins.left += Math.max(20, temp.node().getBBox().width)

    if (mapColumnSwitch.value == "pos_tests") {
        var percentages = data.data.map((pos_test, i) => pos_test / Math.max(data.other[i], 1))
        temp.text(d3.format(".0%")(1))
        margins.right += Math.max(10, temp.node().getBBox().width) + .75*em
    }

    var yScale = d3.scaleLinear()
        .domain([0, maxVal])
        .nice()
        .range([height-margins.bottom, margins.top])

    var start_date = parseDate(metadata.start_date)
    var xScale = d3.scaleTime()
        .domain([start_date, parseDate(metadata.end_date)])
        .nice()
        .range([margins.left, width - margins.right])

    // graphSVG.append("g").selectAll("rect")
    //     .data(data.other)
    //     .enter()
    //     .append("rect")
    //     .attr("x", (d, i) => xScale(d3.timeDay.offset(start_date, (7 * i))))
    //     .attr("y", d => yScale(d))
    //     .attr("height", d => yScale(0) - yScale(d))
    //     .attr("width", (width - (margins.left + margins.right)) / data.data.length)
    //     .attr("fill", "var(--sl-color-neutral-400)")

    graphSVG.append("g").selectAll("rect")
        .data(data.data)
        .enter()
        .append("rect")
        .attr("x", (d, i) => xScale(d3.timeDay.offset(start_date, (7 * i))))
        .attr("y", d => yScale(d))
        .attr("height", d => yScale(0) - yScale(d))
        .attr("width", (width - (margins.left + margins.right)) / data.data.length)
        .attr("fill", "var(--sl-color-neutral-1000)")

    yAxis.append("text")
        .attr("transform", `translate(${1*em},${yScale(d3.mean(yScale.domain()))})rotate(-90)`)
        .attr("text-anchor", "middle")
        .attr("fill", "var(--sl-color-neutral-1000)")
        .attr("font-size", "var(--sl-font-size-small)")
        // .text(mapColumnSwitch.value == "pos_tests" ? "Tests" : d3.select(`sl-option[value=${mapColumnSwitch.value}]`).html())
        .text(d3.select(`sl-option[value=${mapColumnSwitch.value}]`).html())
        
    yAxis.append("g")
        .attr("transform", `translate(${margins.left},0)`)
        .call(d3.axisLeft(yScale).ticks(5).tickSize(4))
        .selectAll("text")
        .attr("class", "tooltip-label")
        .attr("fill", "var(--sl-color-neutral-1000)")

    xAxis.call(d3.axisBottom(xScale).tickArguments([d3.timeYear.every(1), d3.timeFormat("%Y")]))
        .attr("transform", `translate(0, ${height - margins.bottom})`)

    if (mapColumnSwitch.value == "pos_tests") {
        var yScale2 = d3.scaleLinear()
            .domain([0, 1])
            .nice()
            .range([height-margins.bottom, margins.top])

        var yAxis2 = svg.append("g")
            .attr("class", "y-axis")
        
        var percentageGroup = graphSVG.append("g")

          const line = d3.line()
            .x((_, i) => xScale(d3.timeDay.offset(start_date, (7 * i))))
            .y((d) => yScale2(d))

        percentageGroup.append("path")
            .attr("d", line(percentages))
            .style("stroke", "blue")
            .attr("fill", "none")
            .attr("stroke-width", 1)

        yAxis2.append("text")
            .attr("transform", `translate(${width-em},${yScale(d3.mean(yScale.domain()))})rotate(90)`)
            .attr("text-anchor", "middle")
            .attr("fill", "blue")
            .attr("font-size", "var(--sl-font-size-small)")
            .text("Percent Positive Tests")
            
        var yAxis2Axis = yAxis2.append("g")
            .attr("transform", `translate(${xScale.range()[1]},0)`)
            .call(d3.axisRight(yScale2).ticks(5, ".0%").tickSize(4))
        yAxis2Axis.selectAll("text")
            .attr("class", "tooltip-label")
            .attr("fill", "blue")
        yAxis2Axis.selectAll("line,path")
            .style("stroke", "blue")
        
        var legend = svg.append("g")
        legend.attr("transform", `translate(${xScale.range()[0] + .5*em}, 0)`)
        var posTest = legend.append("g")
        posTest.append("rect")
            .attr("height", .5*em)
            .attr("width", .5*em)
            .attr("x", 0)
            .attr("y", .5*em/4)
            .attr("fill", "var(--sl-color-neutral-1000)")
        posTest.append("text")
            .attr("x", .5*1.5*em)
            .attr("y", em/2)
            .attr("dominant-baseline", "middle")
            .attr("fill", "var(--sl-color-neutral-1000)")
            .style("font-size", "var(--sl-font-size-small)")
            .text("Positive Tests")
        // var test = legend.append("g")
        // test.attr("transform", `translate(0, ${em})`)
        // test.append("rect")
        //     .attr("height", .5*em)
        //     .attr("width", .5*em)
        //     .attr("x", 0)
        //     .attr("y", .5*em/4)
        //     .attr("fill", "var(--sl-color-neutral-400)")
        // test.append("text")
        //     .attr("x", .5*1.5*em)
        //     .attr("y", em/2)
        //     .attr("dominant-baseline", "middle")
        //     .attr("fill", "var(--sl-color-neutral-1000)")
        //     .style("font-size", "var(--sl-font-size-small)")
        //     .text("Tests")
        var percentPosTest = legend.append("g")
        percentPosTest.attr("transform", `translate(0, ${em})`)
        // percentPosTest.attr("transform", `translate(0, ${2*em})`)
        percentPosTest.append("line")
            .attr("x1", 0)
            .attr("x2", .5*em)
            .attr("y1", .5*em)
            .attr("y2", .5*em)
            .attr("stroke", "blue")
        percentPosTest.append("text")
            .attr("x", .5*1.5*em)
            .attr("y", em/2)
            .attr("dominant-baseline", "middle")
            .attr("fill", "blue")
            .style("font-size", "var(--sl-font-size-small)")
            .text("Percent Positive Tests")
    }
    
    temp.remove()
    
}

async function changeRegionSize() {
    regionData = await d3.json(`/data/outbreak-detection/${mapRegionSelector.value}/${mapColumnSwitch.value}?${parseInt(Math.random()*9999999999)}`)
    stateFeature = regionData.features.find(d => d.properties.identifier == "state")

    selectedItems.region = undefined

    update()
}

async function changeDataColumn() {
    regionData = await d3.json(`/data/outbreak-detection/${mapRegionSelector.value}/${mapColumnSwitch.value}?${parseInt(Math.random()*9999999999)}`)
    stateFeature = regionData.features.find(d => d.properties.identifier == "state")

    if (selectedItems.region) {
        selectedItems.region = regionData.features.find(d => d.properties.identifier == selectedItems.region.properties.identifier)
    }

    update()
}

function update() {
    selectedItems.dataVersion++
    drawTooltip(selectedItems.region)
    updateDiseaseCountDisplay()
    drawAggregation()
    drawLargeAggregation()
    drawLegend()
    updateMapTitle()
    redraw()
}

function updateMapTitle() {
    var titleStart = `${d3.select(mapRateSwitch).select(`*[value=${mapRateSwitch.value}]`).html()} `
    titleStart += `of ${d3.select(mapTimeSwitch).select(`*[value=${mapTimeSwitch.value}]`).html()}ly `
    titleStart += `${d3.select(mapColumnSwitch).select(`*[value=${mapColumnSwitch.value}]`).html()} `

    var titleEnd = "in South Carolina "
    if (mapRegionSelector.value != "state") {
        titleEnd += "by "
        titleEnd += d3.select(mapRegionSelector).select(`*[value=${mapRegionSelector.value}]`).html() 
    } 

    switch (mapRateSwitch.value) {
        case "count": 
            mapTitle.innerHTML = titleStart + titleEnd
        break;
        case "rate": 
            mapTitle.innerHTML = titleStart + "(per 1000 people) " + titleEnd
        break;
        case "percent": 
            mapTitle.innerHTML = titleStart + "from Last "+ d3.select(mapTimeSwitch).select(`*[value=${mapTimeSwitch.value}]`).html() + " " + titleEnd
        break;
        default: 
            mapTitle.innerHTML = titleStart + titleEnd
        break;
    }
}