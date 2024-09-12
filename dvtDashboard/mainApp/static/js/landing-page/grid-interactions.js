gridSort.addEventListener("sl-change", (event) => {
    sortGrid()
})

gridRateSwitch.addEventListener("sl-change", (event) => {
    // when population aggregation switch is changed, update the visualization
    // displayGridAggregateChart()
    updateGridData()
    sortGrid()

})

gridDataSourceSortSelector.addEventListener("sl-change", (event) => {
    // d3.selectAll(".grid-item-value")
    //     .each(function() {
    //         thisNode = d3.select(this)
    //         dataNode = d3.select(this.parentNode.parentNode.parentNode.parentNode)
    //         value = dataNode.datum()

    //         thisNode.select("text")
    //             .attr("y", yScale(value[gridDataSourceSortSelector.value]))
    //             .text(parseInt(value[gridDataSourceSortSelector.value]))

            

    //         return parseInt(value[gridDataSourceSortSelector.value])
    //     })
    //     .text(function() {
            
    //     })

    updateGridData()
    
    sortGrid()

})

// function resizeGridItems() {
    
//     gridHeight = gridContainer.clientHeight
//     gridWidth = gridContainer.clientWidth

//     gridItemWidth = Math.max((gridWidth/8) - .5*em, 0)
//     gridItemHeight = Math.max((gridHeight/6) - 1, 0)

//     d3.selectAll(".grid-background")
//         .attr("width", gridItemWidth)
//         .attr("height", gridItemHeight)

//     d3.selectAll(".grid-item")
//         .attr("width", gridItemWidth)
//         .attr("height", gridItemHeight)
//         .each(function(item) {})

// }

function setGridTooltip(gridTooltip) {
    gridTooltip.on("sl-show", function(event) {
        d3.json(`/hospitalization-history/${gridDiseaseSelector.value}`, {
            "method": "POST",
            "headers": {"Content-Type": "application/json"},
            "body": JSON.stringify({
                "region": d3.select(this).select("svg").attr("zcta"),
                "date": new Date(2024, 7, 26), // 5 is for month 6 - june
                "rate": gridRateSwitch.value == "rate"
        })}).then((result) => {
            gridTooltipWidth = Math.max(500, width * .3)
            gridTooltipHeight = gridTooltipWidth * .65
            gridTooltipLegendTop = gridTooltipHeight - 2.5*em

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

            stats.date.historical.min = dayjs.tz(stats.date.historical.min.split("GMT")[0], "America/New_York").toDate()
            stats.date.historical.max = dayjs.tz(stats.date.historical.max.split("GMT")[0], "America/New_York").toDate()
            stats.date.prediction.min = dayjs.tz(stats.date.prediction.min.split("GMT")[0], "America/New_York").toDate()
            stats.date.prediction.max = dayjs.tz(stats.date.prediction.max.split("GMT")[0], "America/New_York").toDate()

            // create y axis scaling (counts of hospitalizations)
            yScale = d3.scaleLinear()
                        .domain([stats.count.min, stats.count.max])        
                        .nice()

            // figure out how much space is needed for the y-axis text
            temp = ttpSVG.append("text").text(yScale.domain()[1]).attr("x", 0).attr("y", 0)
            ttpMargins = {
                "top": 1*em, 
                "bottom": 2.5*em + 3*em,
                "left": temp.node().getBBox().width + 2*em,
                "right": em,
            }
            temp.remove()

            // finish creating both x and y scales
            yScale.range([gridTooltipHeight - ttpMargins.bottom, ttpMargins.top])
            xScaleHistorical = d3.scaleUtc()
                .domain([stats.date.historical.min, stats.date.historical.max])
                .range([ttpMargins.left, ttpMargins.left + (gridTooltipWidth - ttpMargins.right - ttpMargins.left)*3/4]) 
            xScalePrediction = d3.scaleUtc()
                .domain([stats.date.prediction.min, stats.date.prediction.max])
                .range([ttpMargins.left + (gridTooltipWidth - ttpMargins.right - ttpMargins.left)*3/4, gridTooltipWidth - ttpMargins.right]) 

            // line generator
            historicalLine = d3.line()
                .x((d) => xScaleHistorical(d.date))
                .y((d) => yScale(d.count))
                .curve(d3.curveMonotoneX)

            predictionLine = d3.line()
                .x((d) => xScalePrediction(d.date))
                .y((d) => yScale(d.count))
                .curve(d3.curveMonotoneX)

            // line to delineate prediction and historical data
            ttpSVG.append("line").attr("class", "grid-prediction-separator")
            
            // eww legend
            ttpLegend = ttpSVG.append("g").attr("class", "grid-tooltip-legend")
            ttpLegend.append("rect")
                .attr("x", .5*em)
                .attr("y", gridTooltipLegendTop)
                .attr("height", 2.5*em)
                .attr("width", gridTooltipWidth-em)
                .attr("fill", "var(--sl-color-gray-300)")
                .attr("opacity", .5)
            // holds lines of linechart
            graphSVG = ttpSVG.append("svg")
                .attr("id", "graph-svg")
                .attr("height", gridTooltipHeight)
                .attr("width", gridTooltipWidth)

            // holds lines of linechart
            graphSVG = ttpSVG.append("svg")
                .attr("class", "tooltip-graph-svg")
                .attr("height", gridTooltipHeight)
                .attr("width", gridTooltipWidth)

            Object.entries(data.historical).forEach(function([dataSource, values], i) {
                // for each data source
                historicalData = []
                Object.entries(values).forEach(function([date, count]) {
                    jsDate = dayjs.tz(date, "America/New_York").toDate()
                    historicalData.push({"date": jsDate, "count": count})
                })

                // draw historical line chart
                historicalGroup = graphSVG.append("g")
                historicalGroup.append("path")
                    .attr("d", historicalLine(historicalData))
                    .attr("stroke", dataSourceColorMap[dataSource])
                    .attr("fill", "none")
                    .attr("stroke-width", 2)
                    .style("stroke-dasharray", dataSourceLineStyle[dataSource])

                // marks each datapoint on historical line
                historicalGroup.selectAll("circle")
                    .data(historicalData.filter(function(d) {
                        refDate = getMonday(new Date(2024, 7, 26))
                        refDate.setDate(refDate.getDate() - 7)
                        return d.date >= refDate}))
                    .enter()
                    .append("circle")
                    .attr("r", 3)
                    .attr("cx", (d) => xScaleHistorical(d.date))
                    .attr("cy", (d) => yScale(d.count))
                    .attr("stroke", dataSourceColorMap[dataSource])

                    // labelBasis =  historicalData[parseInt((historicalData.length-1)*dataSourceLabelPlacement[dataSource])]

                    labelGroup = ttpLegend.append("g")
                        .attr("class", "tooltip-label-group")
                    // labelGroupBackground = labelGroup.append("rect") 
                    labelGroup.append("line")
                        .attr("x1", 1*em + ((gridTooltipWidth-2*em)/3 * (i%2)))
                        .attr("y1", gridTooltipLegendTop + .75*em + em * parseInt(i/2))
                        .attr("x2", 2.25*em + ((gridTooltipWidth-2*em)/3 * (i%2)))
                        .attr("y2", gridTooltipLegendTop + .75*em + em * parseInt(i/2))
                        .style("stroke-dasharray", dataSourceLineStyle[dataSource])
                        .attr("stroke", dataSourceColorMap[dataSource])
                    labelText = labelGroup.append("text")
                        .attr("class", "tooltip-label")
                        .attr("x", 2.5*em + ((gridTooltipWidth-2*em)/3 * (i%2)))
                        .attr("y", gridTooltipLegendTop + em + em * parseInt(i/2))
                        .attr("fill", dataSourceColorMap[dataSource])
                        .attr("font-size", "var(--sl-font-size-small)")
                        .text(dataSourceDisplayName[dataSource])

                    // labelGroup = historicalGroup.append("g")
                    //     .attr("class", "tooltip-label-group")
                    // labelGroupBackground = labelGroup.append("rect") 
                    // labelText = labelGroup.append("text")
                    //     .attr("class", "tooltip-label")
                    //     .attr("x", xScaleHistorical(labelBasis.date))
                    //     .attr("y", Math.max(yScale(yScale.domain()[1])+em, yScale(labelBasis.count) - (i%2+1)*em))
                    //     .attr("fill", dataSourceColorMap[dataSource])
                    //     .attr("font-size", "var(--sl-font-size-small)")
                    //     .text(dataSource)
                    // labelBBox = labelText.node().getBBox()

                    // labelGroupBackground
                    //     .attr("height", labelBBox.height)
                    //     .attr("width", labelBBox.width)
                    //     .attr("x", labelBBox.x)
                    //     .attr("y", labelBBox.y)
                    //     .attr("fill", "var(--sl-color-gray-600)")
                    //     .attr("opacity", .75)
            })

            graphSVG.append("rect")
                    .attr("id", "grid-prediction-highlighter")

            predictiveTicks = []

            Object.entries(data.prediction).forEach(function([dataSource, values]) {
                // for each data source
                predictiveData = []
                Object.entries(values).forEach(function([date, count]) {
                    jsDate = dayjs.tz(date, "YYYY-MM-DD", "America/New_York").toDate()
                    predictiveData.push({"date": jsDate, "count": count})
                    predictiveTicks.push(jsDate)
                })

                // draw predictive line chart
                predictiveGroup = graphSVG.append("g")
                predictiveGroup.append("path")
                .attr("d", predictionLine(predictiveData))
                .attr("stroke", dataSourceColorMap["prediction"])
                    .attr("fill", "none")
                    .attr("stroke-width", 2)

                // marks each datapoint on prediction line
                predictiveGroup.selectAll("circle").data(predictiveData)
                    .enter()
                    .append("circle")
                    .attr("r", 3)
                    .attr("cx", (d) =>  xScalePrediction(d.date))
                    .attr("cy", (d) => yScale(d.count))
                    .attr("stroke", dataSourceColorMap["prediction"])

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
                graphSVG.select(".grid-prediction-highlighter")
                    .attr("x", xScalePrediction(predictiveData[0].date))
                    .attr("y", ttpMargins.top)
                    .attr("width", xScalePrediction(predictiveData[predictiveData.length - 1].date) - xScalePrediction(predictiveData[0].date))
                    .attr("height", gridTooltipHeight - ttpMargins.bottom - ttpMargins.top)

                // place line separating historical and prediction data
                ttpSVG.select(".grid-prediction-separator")
                    .attr("x1", xScalePrediction(predictiveData[0].date))
                    .attr("y1", ttpMargins.top)
                    .attr("x2", xScalePrediction(predictiveData[0].date))
                    .attr("y2", gridTooltipHeight - ttpMargins.bottom)

                labelGroup = ttpLegend.append("g")
                    .attr("class", "tooltip-label-group")
                // labelGroupBackground = labelGroup.append("rect")
                labelGroup.append("line")
                    .attr("x1", 2.5*em + ((gridTooltipWidth-2*em)/3 * 2))
                    .attr("y1", gridTooltipLegendTop + .75*em + em*.5)
                    .attr("x2", 3.75*em + ((gridTooltipWidth-2*em)/3 * 2))
                    .attr("y2", gridTooltipLegendTop + .75*em + em*.5)
                    .attr("stroke", dataSourceColorMap["prediction"])
                labelText = labelGroup.append("text")
                    .attr("class", "tooltip-label")
                    .attr("x", 4*em + ((gridTooltipWidth-2*em)/3 * 2))
                    .attr("y", gridTooltipLegendTop + em + em *.5)
                    .attr("fill", dataSourceColorMap["prediction"])
                    .attr("font-size", "var(--sl-font-size-small)")
                    .text(dataSourceDisplayName["prediction"])

                // labelBasis = predictiveData[parseInt((predictiveData.length-1))]
                // fiveWeekLabelGroup = predictiveGroup.append("g")
                //     .attr("class", "tooltip-label-group")
                // fiveWeekTextPosition = yScale(labelBasis.count) - em
                // if (yScale(yScale.domain()[1]) > fiveWeekTextPosition - em) {
                //     fiveWeekTextPosition = yScale(yScale.domain()[1]) + 1*em
                // }
                // fiveWeekLabel = fiveWeekLabelGroup.append("text")
                //     .attr("class", "tooltip-label")
                //     .attr("x", xScalePrediction(labelBasis.date))
                //     .attr("y", fiveWeekTextPosition)
                //     .attr("text-anchor", "end")
                //     .attr("font-size", "var(--sl-font-size-small)")
                //     .attr("text-decoration", "underline")
                //     .text("5 Week Prediction")

                // fiveWeekLabelBBox = fiveWeekLabel.node().getBBox()
                // fiveWeekLabelGroup.append("line")
                //     .attr("x1", fiveWeekLabelBBox.width/2 + fiveWeekLabelBBox.x)
                //     .attr("y1", fiveWeekLabelBBox.height + fiveWeekLabelBBox.y)
                //     .attr("x2", xScalePrediction(labelBasis.date))
                //     .attr("y2", yScale(labelBasis.count))
                //     .attr("stroke", "black")

                // labelGroup = predictiveGroup.append("g")
                //     .attr("class", "tooltip-label-group")
                // labelGroupBackground = labelGroup.append("rect") 
                // predictionTextPosition = yScale(yScale.domain()[1]) + em
                // if (yScale(labelBasis.count) <= predictionTextPosition + em) {
                //     predictionTextPosition = yScale(0) - .5*em
                // }
                // labelText = labelGroup.append("text")
                //     .attr("class", "tooltip-label")
                //     .attr("x", xScalePrediction(d3.mean(xScalePrediction.domain())))
                //     .attr("y", predictionTextPosition)
                //     .attr("fill", dataSourceColorMap["prediction"])
                //     .attr("font-size", "var(--sl-font-size-small)")
                //     .attr("text-anchor", "middle")
                //     .text("prediction")

                // labelBBox = labelText.node().getBBox()
                // labelGroupBackground
                //     .attr("height", labelBBox.height)
                //     .attr("width", labelBBox.width)
                //     .attr("x", labelBBox.x)
                //     .attr("y", labelBBox.y)
                //     .attr("fill", "var(--sl-color-gray-600)")
                //     .attr("opacity", .5)
            }

           // display x-axis on the bottom
           ttpSVG.append("g") // historical
                .attr("transform", `translate(0,${gridTooltipHeight - ttpMargins.bottom})`)
                .call(d3.axisBottom(xScaleHistorical).tickSize(4).tickFormat(d3.timeFormat("%b %Y")))
                .selectAll("text")  
                .attr("class", "tooltip-label")
                .style("text-anchor", "end")
                .attr("transform", "rotate(-40)");

            ttpSVG.append("g") //prediction
                .attr("transform", `translate(0,${gridTooltipHeight - ttpMargins.bottom})`)
                .call(d3.axisBottom(xScalePrediction).tickValues(predictiveTicks).tickSize(4).tickFormat(d3.timeFormat("%d %b")))
                .selectAll("text")  
                .attr("class", "tooltip-label")
                .style("text-anchor", "end")
                .attr("transform", "rotate(-40)");

            // display y-axis on the left
            yAxis = ttpSVG.append("g")
            yAxis.append("text")
                    .attr("transform", `translate(${1.5*em},${yScale(d3.mean(yScale.domain()))})rotate(-90)`)
                    .attr("text-anchor", "middle")
                    .attr("fill", "currentColor")
                    .attr("font-size", "var(--sl-font-size-small)")
                    .text("Hospitalizations")
            
            yAxis.append("g")
                .attr("transform", `translate(${ttpMargins.left},0)`)
                .call(d3.axisLeft(yScale).ticks(5).tickSize(4))
                .selectAll("text")
                .attr("class", "tooltip-label")
            
        })
    })
}