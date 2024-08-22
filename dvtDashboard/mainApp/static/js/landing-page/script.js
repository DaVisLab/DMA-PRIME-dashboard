
// visualization variables
var formatInt = d3.format(".0f")

var numDiseases = 3
var diseaseIndexing = { "covid-19": 1, "influenza": 2, "rsv": 3 }
var diseaseColorMap = d3.scaleOrdinal().domain(Object.keys(diseaseIndexing)).unknown("var(--sl-color-gray-600").range(d3.schemeSet1)

margins = {
    top: 8,
    right: 8,
    bottom: 8,
    left: 8,
}

var styleSheet = new CSSStyleSheet()
document.adoptedStyleSheets = [styleSheet]

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
            .text(`${entry[0]} bed utilizaiton:`)

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