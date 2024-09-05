gridSort.addEventListener("sl-change", (event) => {
    sortGrid()
})

gridRateSwitch.addEventListener("sl-change", (event) => {
    // when population aggregation switch is changed, update the visualization
    // displayGridAggregateChart()
    updateGridData()
    sortGrid()

})

function setGridTooltip(gridTooltip) {
    gridTooltip.on("sl-show", function(event) {
        console.log(event, this)
        d3.json(`/hospitalization-history/${gridDiseaseSelector.value}`, {
            "method": "POST",
            "headers": {"Content-Type": "application/json"},
            "body": JSON.stringify({
                "region": d3.select(this).select("svg").attr("zcta"),
                "date": new Date(2024, 5, 24), // 5 is for month 6 - june
                "rate": gridRateSwitch.value == "rate"
        })}).then((result) => {
            gridTooltipWidth = Math.max(400, width * .1)
            gridTooltipHeight = gridTooltipWidth * .65

            ttp = d3.select(this)
                .style("--max-width", gridTooltipWidth*1.2)
            ttpSVG = ttp.select("svg")
                .attr("height", gridTooltipHeight)
                .attr("width", gridTooltipWidth)

            // reset tooltip contents for new data
            // ttp.select("p.tooltip").node().innerHTML = `${county[0].toUpperCase() + county.slice(1)}<br>ZCTA: ${zctaName}`
            ttpSVG.node().innerHTML = ""

            data = result.data
            stats = result.stats

            stats.date.min = dayjs.tz(stats.date.min, "America/New_York").toDate()
            stats.date.max = dayjs.tz(stats.date.max, "America/New_York").toDate()

            // create y axis scaling (counts of hospitalizations)
            yScale = d3.scaleLinear()
                        .domain([stats.count.min, stats.count.max])        
                        .nice()

            // figure out how much space is needed for the y-axis text
            temp = ttpSVG.append("text").text(yScale.domain()[1]).attr("x", 0).attr("y", 0)
            ttpMargins = {
                "top": em, 
                "bottom": 2.5*em,
                "left": temp.node().getBBox().width + em,
                "right": em,
            }
            temp.remove()

            // finish creating both x and y scales
            xScale = d3.scaleUtc([stats.date.min, stats.date.max], [ttpMargins.left, gridTooltipWidth - ttpMargins.right]) 
            yScale.range([gridTooltipHeight - ttpMargins.bottom, ttpMargins.top])

            // line generator
            line = d3.line()
                .x((d) => xScale(d.date))
                .y((d) => yScale(d.count))
                .curve(d3.curveMonotoneX)

            // line to delineate prediction and historical data
            ttpSVG.append("line").attr("class", "grid-prediction-separator")
            
            // holds lines of linechart
            graphSVG = ttpSVG.append("svg")
                .attr("class", "tooltip-graph-svg")
                .attr("height", gridTooltipHeight)
                .attr("width", gridTooltipWidth)

            color = d3.scaleOrdinal(d3.schemeAccent).domain(Object.keys(data.historical))

            Object.entries(data.historical).forEach(function([dataSource, values]) {
                // for each data source
                historicalData = []
                Object.entries(values).forEach(function([date, count]) {
                    date = dayjs.tz(date, "America/New_York").toDate()
                    historicalData.push({"date": date, "count": count})
                })

                // draw historical line chart
                historicalGroup = graphSVG.append("g")
                historicalGroup.append("path")
                    .attr("d", line(historicalData))
                    .attr("stroke", color(dataSource))
                    .attr("fill", "none")
                    .attr("stroke-width", 2)

                // marks each datapoint on historical line
                historicalGroup.selectAll("circle").data(historicalData)
                    .enter()
                    .append("circle")
                    .attr("r", 3)
                    .attr("cx", (d) => xScale(d.date))
                    .attr("cy", (d) => yScale(d.count))
                    .attr("stroke", color(dataSource))

            })

            Object.entries(data.prediction).forEach(function([dataSource, values]) {
                // for each data source
                predictiveData = []
                Object.entries(values).forEach(function([date, count]) {
                    date = dayjs.tz(date, "America/New_York").toDate()
                    predictiveData.push({"date": date, "count": count})
                })

                // draw historical line chart
                predictiveGroup = graphSVG.append("g")
                predictiveGroup.append("path")
                    .attr("d", line(predictiveData))
                    .attr("stroke", color(dataSource))
                    .attr("fill", "none")
                    .attr("stroke-width", 2)

                // marks each datapoint on prediction line
                predictiveGroup.selectAll("circle").data(predictiveData)
                    .enter()
                    .append("circle")
                    .attr("r", 3)
                    .attr("cx", (d) => xScale(d.date))
                    .attr("cy", (d) => yScale(d.count))
                    .attr("stroke", color(dataSource))

            })

            // // Show confidence interval
            // predictiveGroup.append("path")
            //     .attr("class", "prediction-background")
            //     .datum(predictiveData)
            //     .style("fill", diseaseColorMap(disease))
            //     .style("opacity", 0.25)
            //     .attr("stroke", "none")
            //     .attr("d", d3.area()
            //         .x(function(d) { return xScale(d.date) })
            //         .y0(function(d, i) { return yScale(i == 0 ? d.count : d["min-prediction"]) })
            //         .y1(function(d, i) { return yScale(i == 0 ? d.count : d["max-prediction"]) })
            //         .curve(d3.curveMonotoneX)
            //     )

            if (predictiveData.length){
                // highlights predictive data
                graphSVG.append("rect")
                    .attr("class", "grid-prediction-highlighter")
                    .attr("x", xScale(predictiveData[0].date))
                    .attr("y", ttpMargins.top)
                    .attr("width", xScale(predictiveData[predictiveData.length - 1].date) - xScale(predictiveData[0].date))
                    .attr("height", gridTooltipHeight - ttpMargins.bottom - ttpMargins.top)

                // place line separating historical and prediction data
                ttpSVG.select(".grid-prediction-separator")
                    .attr("x1", xScale(predictiveData[0].date))
                    .attr("y1", ttpMargins.top)
                    .attr("x2", xScale(predictiveData[0].date))
                    .attr("y2", gridTooltipHeight - ttpMargins.bottom)
            }

            // display x-axis on the bottom
            ttpSVG.append("g")
                .attr("transform", `translate(0,${gridTooltipHeight - ttpMargins.bottom})`)
                .call(d3.axisBottom(xScale).tickSize(4).tickFormat(d3.timeFormat("%d %b %Y")))
                .selectAll("text")  
                .style("text-anchor", "end")
                .attr("transform", "rotate(-30)");

            // display y-axis on the left
            ttpSVG.append("g")
                .attr("transform", `translate(${ttpMargins.left},0)`)
                .call(d3.axisLeft(yScale).ticks(5).tickSize(4));
            
        })
    })
}