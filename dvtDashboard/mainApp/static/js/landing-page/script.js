
// visualization variables
var formatInt = d3.format(".0f")

var numDiseases = 3
var diseaseIndexing = { "covid-19": 1, "influenza": 2, "rsv": 3 }
var diseaseColorMap = d3.scaleOrdinal().domain(Object.keys(diseaseIndexing)).unknown("var(--sl-color-gray-600").range(d3.schemeSet1)

var gridItemDataSources = ["health-system-data", "state-training", "state-testing"]

var dataSourceColorMap = {
    "health-system-data": "#648FFF",
    "state-data": "#785EF0",
    "state-training": "#FFB000",
    "state-testing": "#FFB000",
    "state-prediction": "#FE6100",

    // remove when thingy is done
    "health-system": "#648FFF",
    "state-model": "#FFB000",
    "prediction": "#FE6100",
    "state": "#FFB000",
}

var dataSourceLabelPlacement = {
    "health-system": .5,
    "state-data": 0,
    "state-train": .5,
    "state-post-train": .5,
    "prediction": .5,
}

var dataSourceDisplayName = {
    "health-system": "Health System Data",
    "state-data": "State Data",
    "state-train": "Prediction (training)",
    "state-post-train": "Prediction (test)",
    "prediction": "Future Prediction",
}

var dataSourceLineStyle = {
    "health-system": null,
    "state-data": null,
    "state-train": "5,5",
    "state-post-train": null,
    "prediction": null,

    "health-system-data": null,
    "state-training": "5,5",
    "state-testing": "5,5",
}

margins = {
    top: 8,
    right: 8,
    bottom: 8,
    left: 8,
}

var styleSheet = new CSSStyleSheet()
document.adoptedStyleSheets = [styleSheet]

// other info
thisWeekMonday = new Date(2024, 7, 26)
thisWeekMonday = d3.timeMonday.floor(thisWeekMonday)

startDate = new Date(thisWeekMonday);
startDate.setMonth(startDate.getMonth() - 18);
historicalDates = d3.timeMonday.range(startDate, new Date(thisWeekMonday).setDate(thisWeekMonday.getDate()+1), 1)

endDate = new Date(thisWeekMonday);
endDate.setDate(endDate.getDate() + 5*7);
predictionDates = d3.timeMonday.range(thisWeekMonday, new Date(endDate).setDate(endDate.getDate()+1), 1)

// helper functions
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
    <g id="outline-${id}" >
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

async function displayAggregateChart(
    panelName,
    aggregationSVG,
    diseaseAggregated=true,
    populationNormalized=false,
    visibleDiseases=[],
) {
    // creates chart of hospitalizations across all time

    aggregationSVG.node().innerHTML = "" //removes old visualization

    d3.json("/get-hospital-zcta-aggregation", { // hospital zcta data
        "method": "POST",
        "headers": {"Content-Type": "application/json"},
        "body": JSON.stringify({
            "aggregate": diseaseAggregated,
    })}).then((result) => {

        data = result.data
        stats = result.stats
        maxCount = stats.max
        dateMin = stats["date-min"]
        dateMax = stats["date-max"]
        if (!diseaseAggregated) {
            maxCount = d3.max(Object.entries(stats.max), (entry) => {
                return visibleDiseases.includes(entry[0]) ? entry[1] : NaN
            })
            dateMin = d3.min(Object.entries(stats['date-min']), (entry) => {
                return visibleDiseases.includes(entry[0]) ? entry[1] : NaN
            })
            dateMax = d3.max(Object.entries(stats['date-max']), (entry) => {
                return visibleDiseases.includes(entry[0]) ? entry[1] : NaN
            })
        }

        if (populationNormalized) {
            maxCount /= scPopulation
        }

        dateMin = dayjs.tz(dateMin, "YYYY-MM", "America/New_York").toDate()
        dateMax = dayjs.tz(dateMax, "YYYY-MM", "America/New_York").toDate()

        aggregateWidth = aggregationSVG.node().width.baseVal.value
        aggregateHeight = aggregationSVG.node().height.baseVal.value

        // add title
        aggregationSVG.append("foreignObject")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", "100%")
            .attr("height", em)
            .append("xhtml:p")
            .attr("class", "aggregation-graph-title")
            .attr("xmlns", "http://www.w3.org/1999/xhtml")
            .attr("align", "center")
            .html(`${diseaseAggregated ? "Aggregated" : ""} Disease Count Over Time`)

        // add y axis
        yScale = d3.scaleLinear()
                    .domain([0, maxCount]).range([aggregateHeight - 2*em, margins.bottom + em])    
                    .nice()

        aggregationSVG.append("g")
            .attr("transform", `translate(${margins.left + 2*em},0)`)
            .call(d3.axisLeft(yScale).ticks(5).tickSize(0))

        // add x axis
        xScale = d3.scaleUtc()
                    .domain([dateMin, dateMax]).range([margins.left + 2*em, aggregateWidth - margins.right*2])    
                    .nice()
        aggregationSVG.append("g")
            .attr("transform", `translate(0, ${aggregateHeight - 2*em})`)
            .call(d3.axisBottom(xScale)) 

        // add graph
        line = d3.line()
            .x((d) => xScale(dayjs.tz(d.date, "YYYY-MM", "America/New_York").toDate()))
            .y((d) => yScale(populationNormalized ? d.count/scPopulation : d.count))
        
        aggregateChart = aggregationSVG.append("g")

        if (diseaseAggregated) {
            // aggregated so single line
            aggregateChart.append("path")
            .attr("id", panelName+"-aggregate-chart")
            .attr("d", line(data))
            .attr("stroke", "saddlebrown")
            .style("fill", "none")
            .attr("stroke-width", 2)
        } else {
            // separate diseases so multiple lines
            Object.entries(data).forEach((entry) => {
                if(visibleDiseases.includes(entry[0])){
                    aggregateChart.append("path")
                        .attr("id", panelName+"-aggregate-chart-"+entry[0])
                        .attr("d", line(entry[1]))
                        .attr("stroke", diseaseColorMap(entry[0]))
                        .style("fill", "none")
                        .style("stroke-width", 2)
                }
            })
        }
    })
} 

async function displayDonut(
    panelName,
    jsaggregationDonutSVG,
    aggregationDonutGroup
) {
    // creates chart of current bed capacity
    aggregationDonutGroup.node().innerHTML = ""
    data = {
        // "type of bed": [beds full, beds empty]
        "regular": [8, 2],
        "icu": [undefined, undefined]
    }

    aggregateHeight = jsaggregationDonutSVG.height.baseVal.value

    radius = (aggregateHeight - margins.top) / 2
    radiusInner = radius * .25
    radiusRange = radius * .75

    const pie = d3.pie()
        .sort(null)

    bedTypes = Object.keys(data).length

    bedsColorMap = d3.scaleOrdinal().domain(Object.keys(data)).range(d3.schemeSet2)

    // background in case the bed data is undefined, this makes the lined unknown donut stand out more
    aggregationDonutGroup.append("path")
        .attr("transform", `translate(${radius},${aggregateHeight/2})`)
        .attr("d", d3.arc()({
            innerRadius: radiusInner,
            outerRadius: radius,
            startAngle: 0,
            endAngle: Math.PI * 2
        }))
        .style("fill", "currentColor")

        // adding group to add legend data to
    aggregationDonutLegend = aggregationDonutGroup.append("g")
        .attr("id", panelName+"-aggregation-donut-legend")
        .attr("transform", `translate(${radius*2+em/2}, ${aggregateHeight/2 - (bedTypes*1.5-.5)*em/2})`)

    Object.entries(data).forEach((entry, index) => {
        // display donut for each bed type

        // define arc creator
        const arc = d3.arc()
            .innerRadius(radiusInner + radiusRange * (bedTypes - index - 1)/bedTypes)
            .outerRadius(radiusInner + radiusRange * (bedTypes - index)/bedTypes);

        // if this group exists, set group equal to the d3 selection, otherwise create the group
        group = d3.select(`#${panelName}-${entry[0]}-bed-usage-group`).node() ? 
            d3.select(`#${panelName}-${entry[0]}-bed-usage-group`) : 
            aggregationDonutGroup.append('g').attr("id", `#${panelName}-${entry[0]}-bed-usage-group`)

        // move arc to the left and centered vertically
        group.attr("transform", `translate(${radius}, ${aggregateHeight/2})`)
        
        // add legend color square for this bed type
        aggregationDonutLegend.append("rect")
            .attr("id", `${panelName}-${entry[0]}-bed-usage-legend-color`)
            .attr("x", 0)
            .attr("y", index*1.5*em)
            .attr("height", em/2)
            .attr("width", em/2)
            .style("fill", bedsColorMap(entry[0]))

        // add first line of text to legend (bed type)
        aggregationDonutLegend.append("text")
            .attr("id", `${panelName}-${entry[0]}-bed-usage-legend-text1`)
            .attr("x", em*.75)
            .attr("y", (index*1.5-.0625)*em)
            .style("fill", "currentColor")
            .style("dominant-baseline", "middle")
            .style("font-size", em*.75 + "px")
            .text(`${entry[0]} bed utilization:`)

        // add second line of text to legend (actual utilization)
        aggregationDonutLegend.append("text")
            .attr("id", `${panelName}-${entry[0]}-bed-usage-legend-text2`)
            .attr("x", em*.75)
            .attr("y", (index*1.5+.75)*em)
            .style("fill", "currentColor")
            .style("dominant-baseline", "middle")
            .style("font-size", em*.75 + "px")

        if (entry[1].includes(undefined)) {
            // If the bed utilization is undefined, make the arc a full circle that is striped to indicate unknown value
            group.selectAll("path")
                .data(pie([1, 1]))
                .enter()
                .append("path")
                .attr("mask", "url(#nan-pattern-mask)")
                .attr("fill", bedsColorMap(entry[0]))
                .attr("d", arc)

            aggregationDonutLegend.select(`#${panelName}-${entry[0]}-bed-usage-legend-text2`)
                .text(`unknown`)
        } else {
            // Make the arc proportional to the amount of beds utilized
            group.selectAll("path")
                .data(pie(entry[1]))
                .enter()
                .append("path")
                .attr("fill", (d, i) => i ? "currentColor" : bedsColorMap(entry[0]) )
                .attr("d", arc)

            aggregationDonutLegend.select(`#${panelName}-${entry[0]}-bed-usage-legend-text2`)
                .text(`${d3.format(".0%")(entry[1][0]/(entry[1][0]+entry[1][1]))}`)
                
        }
    })
}