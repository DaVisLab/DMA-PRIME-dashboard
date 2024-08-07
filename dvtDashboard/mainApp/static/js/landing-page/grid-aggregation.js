
async function displayGridAggregateChart() {

    jsgridAggregationSvg.innerHTML = ""

    d3.json("/get-hospital-zcta-aggregation", { // hospital zcta data
        "method": "POST",
        "headers": {"Content-Type": "application/json"},
        "body": JSON.stringify({
            "aggregate": gridAggregationSwitch.value ? gridAggregationSwitch.value == "aggregated" : false,
    })}).then((result) => {

        data = result.data
        stats = result.stats
        maxCount = stats.max
        dateMin = stats["date-min"]
        dateMax = stats["date-max"]
        if (gridAggregationSwitch.value != "aggregated") {
            maxCount = d3.max(Object.entries(stats.max), (entry) => {
                return getVisibleGridDiseases().includes(entry[0]) ? entry[1] : NaN
            })
            dateMin = d3.min(Object.entries(stats['date-min']), (entry) => {
                return getVisibleGridDiseases().includes(entry[0]) ? entry[1] : NaN
            })
            dateMax = d3.max(Object.entries(stats['date-max']), (entry) => {
                return getVisibleGridDiseases().includes(entry[0]) ? entry[1] : NaN
            })
        }

        if (gridPopulationSwitch.value != "total") {
            maxCount /= scPopulation
        }

        dateMin = dayjs.tz(dateMin, "YYYY-MM", "America/New_York").toDate()
        dateMax = dayjs.tz(dateMax, "YYYY-MM", "America/New_York").toDate()

        aggregateWidth = jsgridAggregationSvg.width.baseVal.value
        aggregateHeight = jsgridAggregationSvg.height.baseVal.value

        // add title
        gridAggregationSvg.append("foreignObject")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", "100%")
            .attr("height", em)
            .append("xhtml:p")
            .attr("id", "grid-aggregation-graph-title")
            .attr("xmlns", "http://www.w3.org/1999/xhtml")
            .attr("align", "center")
            .html(`${gridAggregationSwitch.value == "aggregated" ? "Aggregated" : ""} Disease Count Over Time`)

        // add y axis
        yScale = d3.scaleLinear()
                    .domain([0, maxCount]).range([aggregateHeight - 2*em, margins.bottom + em])    
                    .nice()

        gridAggregationSvg.append("g")
            .attr("transform", `translate(${margins.left + 2*em},0)`)
            .call(d3.axisLeft(yScale).ticks(5).tickSize(0))

        // add x axis
        xScale = d3.scaleUtc()
                    .domain([dateMin, dateMax]).range([margins.left + 2*em, aggregateWidth - margins.right*2])    
                    .nice()

        gridAggregationSvg.append("g")
            .attr("transform", `translate(0, ${aggregateHeight - 2*em})`)
            .call(d3.axisBottom(xScale)) 

        // add graph
        line = d3.line()
            .x((d) => xScale(dayjs.tz(d.date, "YYYY-MM", "America/New_York").toDate()))
            .y((d) => yScale(gridPopulationSwitch.value=='total' ? d.count : d.count/scPopulation))
        
        aggregateChart = gridAggregationSvg.append("g")

        console.log(getVisibleGridDiseases())

        if (gridAggregationSwitch.value != "aggregated") {
            Object.entries(data).forEach((entry) => {
                if(getVisibleGridDiseases().includes(entry[0])){
                    aggregateChart.append("path")
                        .attr("id", "grid-aggregate-chart-"+entry[0])
                        .attr("d", line(entry[1]))
                        .attr("stroke", diseaseColorMap(entry[0]))
                        .style("fill", "none")
                        .style("stroke-width", 2)
                }
            })
            
        } else {
            aggregateChart.append("path")
            .attr("id", "grid-aggregate-chart")
            .attr("d", line(data))
            .attr("stroke", "saddlebrown")
            .style("fill", "none")
            .attr("stroke-width", 2)
        }
        

    })
}

async function displayGridDonut() {
    gridAggregationDonut.node().innerHTML = ""
    data = {
        // "type of bed": [beds full, beds empty]
        "regular": [8, 2],
        "icu": [undefined, undefined]
    }

    aggregateHeight = jsgridAggregationDonutSvg.height.baseVal.value

    radius = (aggregateHeight - margins.top) / 2
    radiusInner = radius * .25
    radiusRange = radius * .75

    const pie = d3.pie()
        .sort(null)

    bedTypes = Object.keys(data).length

    bedsColorMap = d3.scaleOrdinal().domain(Object.keys(data)).range(d3.schemeSet2)

    gridAggregationDonut.append("path")
        .attr("transform", `translate(${radius},${aggregateHeight/2})`)
        .attr("d", d3.arc()({
            innerRadius: radiusInner,
            outerRadius: radius,
            startAngle: 0,
            endAngle: Math.PI * 2
        }))
        .style("fill", "currentColor")

    gridAggregationDonutLegend = gridAggregationDonut.append("g")
        .attr("id", "grid-aggregation-donut-legend")
        .attr("transform", `translate(${radius*2+em/2}, ${aggregateHeight/2 - (bedTypes*1.5-.5)*em/2})`)

    Object.entries(data).forEach((entry, index) => {
        const arc = d3.arc()
            .innerRadius(radiusInner + radiusRange * (bedTypes - index - 1)/bedTypes)
            .outerRadius(radiusInner + radiusRange * (bedTypes - index)/bedTypes);

        group = d3.select(`#${entry[0]}-bed-usage-group`).node() ? 
            d3.select(`#${entry[0]}-bed-usage-group`) : 
            gridAggregationDonut.append('g').attr("id", `#${entry[0]}-bed-usage-group`)

        group.attr("transform", `translate(${radius}, ${aggregateHeight/2})`)
        
        gridAggregationDonutLegend.append("rect")
            .attr("id", `${entry[0]}-bed-usage-legend-color`)
            .attr("x", 0)
            .attr("y", index*1.5*em)
            .attr("height", em/2)
            .attr("width", em/2)
            .style("fill", bedsColorMap(entry[0]))

        gridAggregationDonutLegend.append("text")
            .attr("id", `${entry[0]}-bed-usage-legend-text1`)
            .attr("x", em*.75)
            .attr("y", (index*1.5-.0625)*em)
            .style("fill", "currentColor")
            .style("dominant-baseline", "middle")
            .style("font-size", em*.75 + "px")
            .text(`${entry[0]} bed utilizaiton:`)

        gridAggregationDonutLegend.append("text")
            .attr("id", `${entry[0]}-bed-usage-legend-text2`)
            .attr("x", em*.75)
            .attr("y", (index*1.5+.75)*em)
            .style("fill", "currentColor")
            .style("dominant-baseline", "middle")
            .style("font-size", em*.75 + "px")

        if (entry[1].includes(undefined)) {
            group.selectAll("path")
                .data(pie([1, 1]))
                .enter()
                .append("path")
                .attr("mask", "url(#nan-pattern-mask)")
                .attr("fill", bedsColorMap(entry[0]))
                .attr("d", arc)

            gridAggregationDonutLegend.select(`#${entry[0]}-bed-usage-legend-text2`)
                .text(`unknown`)
        } else {
            group.selectAll("path")
                .data(pie(entry[1]))
                .enter()
                .append("path")
                .attr("fill", (d, i) => i ? "currentColor" : bedsColorMap(entry[0]) )
                .attr("d", arc)

            gridAggregationDonutLegend.select(`#${entry[0]}-bed-usage-legend-text2`)
                .text(`${d3.format(".0%")(entry[1][0]/(entry[1][0]+entry[1][1]))}`)
                
        }

    })
}
