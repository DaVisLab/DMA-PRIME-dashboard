
export { zctaData, startDate, currentWeek, historicalDates, predictionDates, dataSourceColorMap, dataSourceLineStyle, gridItemDataSources, parseDate, parseHospDate, getDataAsArray, drawTooltip }


// data
var currentWeek = parseDate(metadata.current_week)

var startDate = parseDate(metadata.start_date)
var historicalDates = d3.timeSaturday.range(startDate, new Date(currentWeek).setDate(currentWeek.getDate()+1), 1)

var endDate = parseDate(metadata.end_date)
var predictionDates = d3.timeSaturday.range(currentWeek, new Date(endDate).setDate(endDate.getDate()+1), 1)


var zctaData = await d3.json(`/data/deckgl-respiratory`)

// visualization variables
var formatInt = d3.format(".0f")

let dataVersion = 0

var gridItemDataSources = ["health-system-data", "state-training", "state-testing"]
var ttpDataSources = ["health-system-data", "state-training", "state-testing", "state-data"]

var dataSourceColorMap = {
    "health-system-data": "#648FFF",
    "state-data": "#785EF0",
    "state-training": "#FFB000",
    "state-testing": "#FFB000",
    "state-prediction": "#FE6100",
}

var dataSourceDisplayName = {
    "health-system-data": "Health System Data",
    "state-data": "State Data",
    "state-training": "Prediction (training)",
    "state-testing": "Prediction (test)",
    "state-prediction": "Future Prediction",
}

var dataSourceLineStyle = {
    "health-system-data": null,
    "state-data": null,
    "state-training": "5,5",
    "state-testing": "5,5",
    
    "health-system-data-tooltip": null,
    "state-data-tooltip": null,
    "state-training-tooltip": "5,5",
    "state-testing-tooltip": null,
}

var ttpHistoryWidthPercentage = 3/4

var styleSheet = new CSSStyleSheet()

styleSheet.insertRule(`
    .tooltip-div {
        /* tooltip's containing div */
        background-color: hsla(${getComputedStyle(document.head).getPropertyValue("--sl-color-neutral-0").replace("hsl(", "").replace(")", "")}, 0.925);
    }`
    ,0)   

d3.selectAll('sl-tooltip').nodes().forEach((n, i) => {
    d3.select(n.shadowRoot).select("div[part='body']")
    .style('background-color', `hsla(${getComputedStyle(document.head).getPropertyValue("--sl-color-neutral-1000").replace("hsl(", "").replace(")", "")}, 0.925)`)
})

window.addEventListener("keydown", (event) => {
    if (event.key == "m") {
        function waitForChange() {
            if(changed != true) {
                window.setTimeout(waitForChange, 10);
            } else {
                styleSheet.deleteRule(0)
                styleSheet.insertRule(`
                    .tooltip-div {
                        /* tooltip's containing div */
                        background-color: hsla(${getComputedStyle(document.head).getPropertyValue("--sl-color-neutral-0").replace("hsl(", "").replace(")", "")}, 0.925);
                    }`
                    ,0)
                changed = false
            }
        }
        waitForChange()
    }
});

document.adoptedStyleSheets = [styleSheet]

// data fetching
function getDataAsArray(disease, dataSource, rate, imputations=true) {
    var arr = zctaData.features.map((d) => {
        var data = d.properties.data[disease]
        if (data[dataSource].data.length > 0 && (imputations || !data.imputation)) {
            if (rate) {
                return data[dataSource].data.at(-1) / d.population * 1000
            } else {
                return data[dataSource].data.at(-1)
            }
        } else {
            return 0
        }
    })

    return arr
}

// helper functions
function parseDate(dateString) {
    return dayjs.tz(dateString, "YYYY-MM-DD", "America/New_York").toDate()
}

function parseHospDate(dateString) {
    return dayjs.tz(dateString, "M/D/YYYY", "America/New_York").toDate()
}

function fixName(name) {
    // replace spaces with dashes
    // remove apostrophe's 
    newName = name.toLowerCase().split(" ").join("-")
    newName = newName.replace(/[\/']/g, "")
    return newName
}

function fixCoord(coord) {
    while (coord[1] == "0") {
        coord = coord[0] + coord.slice(2)
    }
    return parseFloat(coord)
}

function formatTuple(string) {
    // Remove (, ), ', and space and split the resulting string one , to turn "(item, item, item)" into [item, item, item]
    return string.replace(/[(' )]/g, "").split(",")
}

function opacify(color, opacity) {
    // take a color and make it more opaque, returning the resulting color as a string
    d3color = d3.color(color)
    d3color.opacity = opacity
    return d3color.rgb().toString()
}

function fakeSin(angle) {
    // function that approximates sine(angle) in degrees
    angle = angle % 360
    neg = angle < 0
    angle *= neg ? -1 : 1
    val = 0
    if (angle < 180) {
        val = 1 - (0.5 * ((angle-90)*Math.PI/200)^2)
    } else {
        val = -1 + (0.5 * ((angle-270)*Math.PI/200)^2)
    }
    val *= neg ? -1 : 1
    return val
}

function fakeCos(angle) {
    // function that approximates cosine(angle) in degrees
    angle = angle % 360
    neg = angle < 0
    angle *= neg ? -1 : 1
    val = 0
    if (angle < 90) {
        val = 1 - (0.5 * ((angle)*Math.PI/200)^2)
    } else if(angle < 270){
        val = -1 + (0.5 * ((angle-180)*Math.PI/200)^2)
    } else {
        val = 1 - (0.5 * ((angle-360)*Math.PI/200)^2)
    }
    return val
}

function skew(orig, radius, idx, total) {
    // Returns a skewed coordinate based on:
    //      the original coordinate, 
    //      desired radius from original position, 
    //      index of point, 
    //      and total number of poitns to be placed around the original point
    if(total == 1)
        return orig
    
    angle = (idx/total) * 360
    orig[0] += radius * fakeSin(angle)
    orig[1] += radius * fakeCos(angle)
    return orig
}

function getMonday(date) {
    return new Date((date - date.getDay()) + 1) 
}

 // determines what disease hospitalization are checked (to show) for specified type of check
 function getVisibleDiseases(prefix) {
    diseases = []
    d3.selectAll(`.${prefix}-check`).each(function(d){
        if (this.checked) {
            diseases.push(this.getAttribute("disease"))
        }
    })
    return diseases
  }

// creation functions
function makeHospital(id) {
    // Makes hospital icon
    // altered from shoelace's hospital icon
    stringy =  `<clipPath id="clipper-${id}"> \n
        <path id="bgd-${id}" fill="darkgrey" d="M6 0a1 1 0 0 0-1 1v1a1 1 0 0 0-1 1v4H1a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-3V3a1 1 0 0 0-1-1V1a1 1 0 0 0-1-1z"/>
    </clipPath>
    <use href="#bgd-${id}"></use>
    <rect id="fill-${id}" y="0%" width="100%" height="100%" clip-path="url(#clipper-${id})" fill="#FFF"/>
    <g id="outline-${id}" >
        <path d="M8.5 5.034v1.1l.953-.55.5.867L9 7l.953.55-.5.866-.953-.55v1.1h-1v-1.1l-.953.55-.5-.866L7 7l-.953-.55.5-.866.953.55v-1.1zM13.25 9a.25.25 0 0 0-.25.25v.5c0 .138.112.25.25.25h.5a.25.25 0 0 0 .25-.25v-.5a.25.25 0 0 0-.25-.25zM13 11.25a.25.25 0 0 1 .25-.25h.5a.25.25 0 0 1 .25.25v.5a.25.25 0 0 1-.25.25h-.5a.25.25 0 0 1-.25-.25zm.25 1.75a.25.25 0 0 0-.25.25v.5c0 .138.112.25.25.25h.5a.25.25 0 0 0 .25-.25v-.5a.25.25 0 0 0-.25-.25zm-11-4a.25.25 0 0 0-.25.25v.5c0 .138.112.25.25.25h.5A.25.25 0 0 0 3 9.75v-.5A.25.25 0 0 0 2.75 9zm0 2a.25.25 0 0 0-.25.25v.5c0 .138.112.25.25.25h.5a.25.25 0 0 0 .25-.25v-.5a.25.25 0 0 0-.25-.25zM2 13.25a.25.25 0 0 1 .25-.25h.5a.25.25 0 0 1 .25.25v.5a.25.25 0 0 1-.25.25h-.5a.25.25 0 0 1-.25-.25z"/>
        <path d="M5 1a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1a1 1 0 0 1 1 1v4h3a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h3V3a1 1 0 0 1 1-1zm2 14h2v-3H7zm3 0h1V3H5v12h1v-3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1zm0-14H6v1h4zm2 7v7h3V8zm-8 7V8H1v7z"/>
    </g>`
    return stringy
}

function makeMobileHealthClinic(id) {
    // makes mobile health clinic icon
    // altered from shoelace's truck icon
    stringy = `
    <g id="outline-${id}" transform="scale(${16/18},${16/18})">
        <path style="fill:white" d="M0 3.5A1.5 1.5 0 0 1 1.5 2h11a1.5 1.5 0 0 1 1.5 1.5V5h1.02a1.5 1.5 0 0 1 1.17.563l1.481 1.85a1.5 1.5 0 0 1 .329.938V10.5a1.5 1.5 0 0 1-1.5 1.5H16a2 2 0 1 1-4 0H5a2 2 0 1 1-3.998-.085A1.5 1.5 0 0 1 0 10.5v-7z"></path>
        <path style="fill:black" d="M0 3.5A1.5 1.5 0 0 1 1.5 2h11a1.5 1.5 0 0 1 1.5 1.5V5h1.02a1.5 1.5 0 0 1 1.17.563l1.481 1.85a1.5 1.5 0 0 1 .329.938V10.5a1.5 1.5 0 0 1 -1.5 1.5H16a2 2 0 1 1-4 0H5a2 2 0 1 1-3.998-.085A1.5 1.5 0 0 1 0 10.5v-7z
            m1.294 7.456A1.999 1.999 0 0 1 4.732 11h7.536a2.01 2.01 0 0 1 .732-.732V3.5a.5.5 0 0 0-.5-.5h-11a.5.5 0 0 0-.5.5v7a.5.5 0 0 0 .294.456z
            M14 10a2 2 0 0 1 1.732 1h.768a.5.5 0 0 0 .5-.5V8.35a.5.5 0 0 0-.11-.312l-1.48-1.85A.5.5 0 0 0 15.02 6H14v4z
            m-11 1a1 1 0 1 0 0 2 1 1 0 0 0 0-2z
            m11 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"></path>
        <path style="stroke-width: 1.25; stroke: black; stroke-endcap: round" d="M5 6.75h5zM7.5 4.25v5"></path>
    </g>`
    return stringy
}

function makeCommunityPartner(id) {
    // TODO WE NEED TO CREDIT Ravi Poovaiah for this design
    stringy = `
        <g transform="translate(0,16)scale(${16/3976},-${16/3976})">
            <path fill="#ffffff" d="M511.602,1777.44 C54.2236,2234.82,-9.58984,3040.18,447.774,3497.54 C905.152,3954.93,1646.7,3954.92,2104.08,3497.54L2160,3436.9 C2626.74,3823.4,3365.48,3854.62,3795.96,3424.15 C4253.34,2966.77,4253.34,2225.22,3795.96,1767.85L3774.92,1756 C3787.19,1674.8,3760.98,1588.47,3698.31,1525.83 C3595.33,1422.82,3428.33,1422.85,3325.34,1525.84L3326.3,1522.28 C3429.3,1419.26,3424.8,1252.29,3321.8,1149.3 C3218.8,1046.29,3051.81,1046.31,2948.83,1149.31L2949.78,1145.75 C3052.79,1042.75,3048.28,875.748,2945.29,772.779 C2842.29,669.781,2675.29,669.801,2572.3,772.779L2499.84,844.693 C2602.85,741.695,2602.83,574.723,2499.84,471.734L2238.16,210.035 C2135.16,107.037,1968.16,111.539,1865.17,214.537 C1762.17,317.535,1762.21,484.508,1865.18,587.506L1861.63,586.559 C1758.62,483.561,1591.64,488.053,1488.66,591.051 C1385.64,694.049,1385.67,861.041,1488.66,964.029L1485.12,963.072 C1382.11,860.074,1215.12,864.586,1112.12,967.574 C1009.13,1070.58,1009.16,1237.55,1112.13,1340.54L1108.58,1339.6 C1005.58,1236.61,838.594,1241.09,735.606,1344.09 C657.769,1421.93,638.765,1536.31,678.574,1632Z"/>
            <path stroke-width="180" stroke-linecap="round" stroke="#000000" fill="none" d="M2238.16,210.035 C2135.16,107.037,1968.16,111.539,1865.17,214.537 C1762.17,317.535,1762.21,484.508,1865.18,587.506L2126.87,849.195 C2229.87,952.193,2396.87,947.691,2499.84,844.693 C2602.85,741.695,2602.83,574.723,2499.84,471.734Z M1861.63,586.559 C1758.62,483.561,1591.64,488.053,1488.66,591.051 C1385.64,694.049,1385.67,861.041,1488.66,964.029L1750.34,1225.71 C1853.36,1328.71,2020.36,1324.21,2123.33,1221.23 C2226.33,1118.23,2226.31,951.236,2123.33,848.238Z M1485.12,963.072 C1382.11,860.074,1215.12,864.586,1112.12,967.574 C1009.13,1070.58,1009.16,1237.55,1112.13,1340.54L1373.83,1602.23 C1476.83,1705.25,1643.83,1700.74,1746.8,1597.74 C1849.82,1494.74,1849.79,1327.75,1746.8,1224.76Z M1108.58,1339.6 C1005.58,1236.61,838.594,1241.09,735.606,1344.09 C632.608,1447.09,632.627,1614.08,735.615,1717.07L997.3,1978.77 C1100.32,2081.76,1267.29,2077.26,1370.29,1974.26 C1473.29,1871.27,1473.26,1704.27,1370.28,1601.29Z M2539.38,3059.39L2088.25,2607.87 C1868.95,2385.03,1524.95,2385.03,1312.75,2597.22L2077.95,3362.43 M2075.84,3360.32 C2533.22,3817.7,3338.58,3881.52,3795.96,3424.15 C4253.34,2966.77,4253.34,2225.22,3795.96,1767.85 M2546.84,3054.77L3702.81,1898.79 C3805.83,1795.8,3801.33,1628.81,3698.31,1525.83 C3595.33,1422.82,3428.33,1422.85,3325.34,1525.84 M2547.71,2300.88L3326.3,1522.28 C3429.3,1419.26,3424.8,1252.29,3321.8,1149.3 C3218.8,1046.29,3051.81,1046.31,2948.83,1149.31L2170.24,1927.92 M2949.78,1145.75 C3052.79,1042.75,3048.28,875.748,2945.29,772.779 C2842.29,669.781,2675.29,669.801,2572.3,772.779 M617.393,1671.65L511.602,1777.44 C54.2236,2234.82,-9.58984,3040.18,447.774,3497.54 C905.152,3954.93,1646.7,3954.92,2104.08,3497.54L2136.21,3465.23"/>
        </g>
    `
    return stringy
}

function drawTooltip(d, div, ttpHeight, ttpWidth, rate=false) {
    var data = JSON.parse(JSON.stringify(d))

    var p = div.select("p")
    p.select(".tooltip-title").html(`ZCTA: ${data.zcta}`)
    p.select(".tooltip-subtitle").html(`County: ${data.county[0].toUpperCase()+data.county.substring(1)}`)

    var ttpLegendTop = ttpHeight - 2.5*em

    var ttpSVG = div.select(".tooltip-outer-svg")
        .attr("height", ttpHeight)
        .attr("width", ttpWidth)

    // reset tooltip contents for new data
    ttpSVG.node().innerHTML = ""

    var graphSVG = ttpSVG.append("svg")
        .attr("class", "tooltip-graph-svg")
        .attr("height", ttpHeight)
        .attr("width", ttpWidth)
    graphSVG.append("line")
        .attr("class", "tooltip-prediction-separator")

    var yAxis = ttpSVG.append("g")
        .attr("class", "y-axis")
    var xAxisHistorical = ttpSVG.append("g")
        .attr("class", "x-axis-historical")
    var xAxisPrediction = ttpSVG.append("g")
        .attr("class", "x-axis-prediction")

    var ttpLegend = ttpSVG.append("g").attr("class", "tooltip-legend")

    var countMax = 0

    ttpDataSources.forEach(function(dataSource) {
        if (rate) {
            data[dataSource].data = d[dataSource].data.map(function(item) { return item/d.population * 1000} )
        }
        if (data[dataSource].data.length) {
            countMax = Math.max(d3.max(data[dataSource].data), countMax)
        }
    })
    
    var predictionData = JSON.parse(JSON.stringify(data["state-prediction"]))
    if (predictionData.data.length > 0 && mapDiseaseSelector.value.includes("influenza")) {
        predictionData.data = predictionData.data.splice(start=0, end=3)
    }
    if (rate) {
        predictionData.data = d["state-prediction"].data.map(function(item) { return item/d.population * 1000} )
    }
    if (predictionData.data.length) {
        countMax = Math.max(d3.max(predictionData.data), countMax)
    }

    // figure out how much space is needed for the y-axis text
    var temp = ttpSVG.append("text").text(d3.format(".2r")(countMax)).attr("x", 0).attr("y", 0)
    var ttpMargins = {
        "top": 1*em, 
        "bottom": 2.5*em + 3*em,
        "left": Math.max(20, temp.node().getBBox().width) + 2*em,
        "right": em,
    }

    var yScale = d3.scaleLinear()
        .domain([0, countMax])        
        .nice()
        .range([ttpHeight-ttpMargins.bottom, ttpMargins.top])

    var xScaleHistorical = d3.scaleUtc()
        .domain(d3.extent(historicalDates))
        .range([ttpMargins.left, ttpMargins.left + (ttpWidth - ttpMargins.right - ttpMargins.left)*ttpHistoryWidthPercentage]) 
    var xScalePrediction = d3.scaleUtc()
        .domain(d3.extent(predictionDates))
        .range([ttpMargins.left + (ttpWidth - ttpMargins.right - ttpMargins.left)*ttpHistoryWidthPercentage, ttpWidth - ttpMargins.right]) 

    // line generators
    var historicalLine = function(data) {
        var thisStartDate = d3.timeSaturday.round(new Date(data["start-date"]))
        var startIndex = historicalDates.findIndex((d) => d.getTime() == thisStartDate.getTime())

        return d3.line()
            .x((_, i) => xScaleHistorical(historicalDates[i+startIndex]))
            .y((d, i) => yScale(d))
            .curve(d3.curveMonotoneX)(data.data)
    }

    var predictionLine = function(data) {
        var thisStartDate = d3.timeSaturday.round(new Date(data["start-date"]))
        var startIndex = predictionDates.findIndex((d) => d.getTime() == thisStartDate.getTime())

        return d3.line()
            .x((_, i) => xScalePrediction(predictionDates[i+startIndex]))
            .y((d, i) => yScale(d))
            .curve(d3.curveMonotoneX)(data.data)
    }

    ttpDataSources.forEach(function(dataSource, i) {
        var thisData = data[dataSource]
        // draw historical line chart
        var historicalGroup = graphSVG.append("g")
        historicalGroup.append("path")
            .attr("d", historicalLine(thisData))
            .attr("stroke", dataSourceColorMap[dataSource])
            .attr("fill", "none")
            .attr("stroke-width", 2)
            .style("stroke-dasharray", dataSourceLineStyle[`${dataSource}-tooltip`])
        
        var labelGroup = ttpLegend.append("g")
            .attr("class", "tooltip-label-group")
        labelGroup.append("line")
            .attr("x1", 1*em + ((ttpWidth-2*em)/3 * (i%2)))
            .attr("y1", ttpLegendTop + .75*em + em * parseInt(i/2))
            .attr("x2", 2.25*em + ((ttpWidth-2*em)/3 * (i%2)))
            .attr("y2", ttpLegendTop + .75*em + em * parseInt(i/2))
            .style("stroke-dasharray", dataSourceLineStyle[`${dataSource}-tooltip`])
            .attr("stroke", dataSourceColorMap[dataSource])
        var labelText = labelGroup.append("text")
            .attr("class", "tooltip-label")
            .attr("x", 2.5*em + ((ttpWidth-2*em)/3 * (i%2)))
            .attr("y", ttpLegendTop + em + em * parseInt(i/2))
            .attr("fill", dataSourceColorMap[dataSource])
            .attr("font-size", "var(--sl-font-size-small)")
            .text(dataSourceDisplayName[dataSource])
    })

    var stateCurrentLabelPositionAbove = null
    if (predictionData.data.length) {
        graphSVG.append("rect")
            .attr("class", "tooltip-prediction-highlighter")

        // draw predictive line chart
        var predictiveGroup = graphSVG.append("g")
        predictiveGroup.append("path")
            .attr("d", predictionLine(predictionData))
            .attr("stroke", dataSourceColorMap["state-prediction"])
            .attr("fill", "none")
            .attr("stroke-width", 2)

        // marks each datapoint on prediction line
        predictiveGroup.selectAll("circle").data(predictionData.data)
            .enter()
            .append("circle")
            .attr("r", 3)
            .attr("cx", (_, i) =>  xScalePrediction(predictionDates[i]))
            .attr("cy", (d) => yScale(d))
            .attr("stroke", dataSourceColorMap["state-prediction"])

            // highlights predictive data
        graphSVG.select(".tooltip-prediction-highlighter")
            .attr("x", xScalePrediction.range()[0])
            .attr("y", ttpMargins.top)
            .attr("width", xScalePrediction.range()[1] - xScalePrediction.range()[0])
            .attr("height", ttpHeight - ttpMargins.bottom - ttpMargins.top)

        // place line separating historical and prediction data
        ttpSVG.select(".tooltip-prediction-separator")
            .attr("x1", xScalePrediction.range()[0])
            .attr("y1", ttpMargins.top)
            .attr("x2", xScalePrediction.range()[0])
            .attr("y2", ttpHeight - ttpMargins.bottom)

        var labelGroup = ttpLegend.append("g")
            .attr("class", "tooltip-label-group")
        labelGroup.append("line")
            .attr("x1", 2.5*em + ((ttpWidth-2*em)/3 * 2))
            .attr("y1", ttpLegendTop + .75*em + em*.5)
            .attr("x2", 3.75*em + ((ttpWidth-2*em)/3 * 2))
            .attr("y2", ttpLegendTop + .75*em + em*.5)
            .attr("stroke", dataSourceColorMap["state-prediction"])
        var labelText = labelGroup.append("text")
            .attr("class", "tooltip-label")
            .attr("x", 4*em + ((ttpWidth-2*em)/3 * 2))
            .attr("y", ttpLegendTop + em + em *.5)
            .attr("fill", dataSourceColorMap["state-prediction"])
            .attr("font-size", "var(--sl-font-size-small)")
            .text(dataSourceDisplayName["state-prediction"])

        stateCurrentLabelPositionAbove = predictionData.data[0] > predictionData.data[1]
    }

    
    ["state-testing", "health-system-data"].forEach(function(dataSource) {
        var thisData = data[dataSource]
        var historicalLabels = graphSVG.append("g")

        var thisStartDate = parseDate(thisData["start-date"])
        var thisEndDate = new Date(thisStartDate);
        thisEndDate.setDate(thisEndDate.getDate() + thisData.data.length*7);
        var datesReconstructed = d3.timeSaturday.range(thisStartDate, new Date(thisEndDate).setDate(thisEndDate.getDate()+1), 1)

        var refDate = new Date(currentWeek)
        refDate.setDate(refDate.getDate() - 7)

        var index = datesReconstructed.findIndex((d) => d.getTime() == refDate.getTime())

        if (index > -1) {
            var circleData = thisData.data.slice(index).map(function(d, i) {
                return {"count": d, "date": datesReconstructed.slice(index)[i]};
              })

            historicalLabels.selectAll("circle")
              .data(circleData)
              .enter()
              .append("circle")
              .attr("r", 3)
              .attr("cx", (d) => xScaleHistorical(d.date))
              .attr("cy", (d) => yScale(d.count))
              .attr("stroke", dataSourceColorMap[dataSource])

            if (circleData.length > 1) {
                var yPosition = yScale(circleData[1].count)
                if (dataSource == "state-testing") {
                    if (stateCurrentLabelPositionAbove !== null) {
                        yPosition += stateCurrentLabelPositionAbove ? -6 : 12
                    }
                } else {
                    yPosition += 6
                }

                yPosition = Math.min(Math.max(yPosition, yScale.range()[1] + 12), yScale.range()[0] - 3)

                historicalLabels.append("text")
                    .attr("x", xScaleHistorical(circleData[1].date) + 6)
                    .attr("y", yPosition)
                    .attr("fill", dataSourceColorMap[dataSource])
                    .attr("font-size", "var(--sl-font-size-x-small)")
                    .text(parseFloat(circleData[1].count.toFixed(1)))
            }
            
        }

        
    })

    // display x-axis on the bottom
    xAxisHistorical // historical
        .attr("transform", `translate(0,${ttpHeight - ttpMargins.bottom})`)
        .call(d3.axisBottom(xScaleHistorical).tickSize(4).tickFormat(d3.timeFormat("%b %Y")))
        .selectAll("text") 
        .attr("class", "tooltip-label")
        .style("text-anchor", "end")
        .attr("fill", "var(--sl-color-neutral-1000)")
        .attr("transform", "rotate(-40)");
    xAxisHistorical.selectAll("path, line")
        .attr("stroke", "var(--sl-color-neutral-1000)")

    xAxisPrediction //prediction
        .attr("transform", `translate(0,${ttpHeight - ttpMargins.bottom})`)
        .call(d3.axisBottom(xScalePrediction).tickValues(predictionDates).tickSize(4).tickFormat(d3.timeFormat("%d %b")))
        .selectAll("text")  
        .attr("class", "tooltip-label")
        .style("text-anchor", "end")
        .attr("fill", "var(--sl-color-neutral-1000)")
        .attr("transform", "rotate(-40)");
    xAxisPrediction.selectAll("path, line")
        .attr("stroke", "var(--sl-color-neutral-1000)")

    // display y-axis on the left
    yAxis.append("text")
        .attr("transform", `translate(${1.5*em},${yScale(d3.mean(yScale.domain()))})rotate(-90)`)
        .attr("text-anchor", "middle")
        .attr("fill", "var(--sl-color-neutral-1000)")
        .attr("font-size", "var(--sl-font-size-small)")
        .text("Hospitalizations")

    yAxis.append("g")
        .attr("transform", `translate(${ttpMargins.left},0)`)
        .call(d3.axisLeft(yScale).ticks(5).tickSize(4))
        .selectAll("text")
        .attr("class", "tooltip-label")
        .attr("fill", "var(--sl-color-neutral-1000)")
    yAxis.selectAll("path, line")
        .attr("stroke", "var(--sl-color-neutral-1000)")

    temp.remove()

}



// trying to make a widget but I need to use deck instead of deckgl and npm imports
class D3Anchor {
    static #count = 0;
    constructor(props={}) { //should have options.size
        var defaultProps = {
            // interface
            "id":"d3anchor",
            "viewId": null,
            "placement": "top-left",
            // extra
            "onHover": () => null,
            "onClick": () => null,
            "onDragStart": () => null,
            "onDrag": () => null,
            "onDragEnd": () => null,
            "divId": "div",
        }

        this.props = Object.assign(defaultProps, props)

        if (this.props.id == "d3anchor") {
            this.id = `${this.props.id}${D3Anchor.#count}`
            this.props.id = `${this.props.id}${D3Anchor.#count}`
            D3Anchor.#count++
        }

        if (this.props.divId == "div") {
            this.divId = `${this.props.divId}${D3Anchor.#count}`
            this.props.divId = `${this.props.divId}${D3Anchor.#count}`
            D3Anchor.#count++
        }

        this.props = props
    }

    onAdd(context) {
        const el = document.createElement('div');
        el.id = this.divId
        el.className = 'd3anchor';
        // el.style.width = `${this.size}px`;
        // TODO - create animation for .spinner in the CSS stylesheet
        this.element = el;
        return el;
    }

    onRemove() {
        this.element = undefined;
    }

    // update props
    // may add actions to this afterwards idk
    setProps(props) {
        this.props = Object.assign(this.props, props)
    }

    onViewportChange(viewport){

    }
    onRedraw(params) {
        // const isVisible = params.layers.some(layer => !layer.isLoaded);
        // this.element.style.display = isVisible ? 'block' : 'none';
    }
    onHover(info, event) {
        this.props.onHover(info, event)
    }
    onClick(info, event) {
        this.props.onClick(info, event)
    }
    onDragStart(info, event) {
        this.props.onDragStart(info, event)
    }
    onDrag(info, event) {
        this.props.onDrag(info, event)
    }
    onDragEnd(info, event) {
        this.props.onDragEnd(info, event)
    }
}