
function newMinorVis(tab, signifier, type){
    switch(type) {
        case "line":
            console.log(tab)
            console.log(signifier)
            lineVis(tab, signifier)
            break;
        default:
            broken(tab)
            break;
    }
}

function lineVis(tab, signifier) {
    console.log("creating")
    newVis = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    newVis.setAttribute("id", "minor_" + signifier)
    newVis.setAttribute("width", 300)
    newVis.setAttribute("height", 300)
    tab.append(newVis)

    console.log(tab)
    console.log(signifier)
    console.log(newVis)
    
    svg = d3.select("#minor_" + signifier)
    d3.csv("static/data/county/Counties daily cases/" + signifier + "_case_daily.csv").then( (data) => {
        d3.csv("static/data/county/RealDataCounties/" + signifier + "covid19.csv").then((real_data) => {
            var parseDate = d3.timeParse("%Y-%m-%d");
            data.forEach(function (d) {
                d.date = parseDate(d.date);
            });

            // dimensions for the chart
            var margin = { top: 30, right: 5, bottom: 20, left: 25 },
                width = 300 - margin.left - margin.right,
                height = 300 - margin.top - margin.bottom;

            var columnsToKeep = [0, 1, 2, 3, 4, 5, 6];
            var maxAcrossColumns = d3.max(data, function (d) {
                var maxInRow = d3.max(columnsToKeep, function (column) {
                    return +d[column];
                });

                return maxInRow;
            });
            // console.log("Max across columns:", maxAcrossColumns);
            // console.log("Parsed data:", data);

            const chosenColumn = "cases 7-day averange"; // Change this to the column you want to display on the y-axis

            // Parse the date
            var parseDate = d3.timeParse("%Y-%m-%d");
            real_data.forEach(function (d) {
                d.date = parseDate(d.date);
                d[chosenColumn] = +d[chosenColumn];
            });

            ////// aggregate of all data points
            const aggregate = Math.round(
                real_data.reduce((total, d) => total + d[chosenColumn], 0)
            );
            // console.log(
            //     `Aggregate value for ${chosenColumn}th day:`,
            //     aggregate
            // );

            const maxYValue = d3.max(real_data, (d) => d[chosenColumn]);
            // console.log(Math.round(maxYValue));


            const x = d3
                .scaleTime()
                .domain(d3.extent(data, (d) => new Date(d.date)))
                .range([0, width]);

            const y = d3
                .scaleLinear()
                .domain([0, maxYValue])
                .nice()
                .range([height - margin.bottom, margin.top]);

            const colors = [
                "#FF073B",
                "#27A844",
                "#0000FF",
                "#FFFF00",
                "#FF00FF",
                "#00FFFF",
                "#FFA500",
            ];

            const lines = [];
            for (let i = 0; i < 7; i++) {
                lines.push(
                    d3
                        .line()
                        .x((d) => x(new Date(d.date)))
                        .y((d) => y(d[`${i}`]))
                        .curve(d3.curveBasis)
                        .context(null)
                );
            }



            svg
                .append("g")
                .attr(
                    "transform",
                    "translate(0," + (height - margin.bottom) + ")"
                )
                .call(d3.axisBottom(x))
                .selectAll("path")
                .style("stroke", "white"); // Change x-axis line color

            svg.selectAll(".tick line").style("stroke", "white"); // Change x-axis tick lines color

            svg.selectAll(".tick text").style("fill", "white"); // Change x-axis tick label color

            svg
                .append("g")
                .attr("transform", "translate(0,0)")
                .call(d3.axisLeft(y).ticks(height / 40))
                .call((g) => g.select(".domain").remove())
                .call((g) =>
                    g
                        .selectAll(".tick line")
                        .clone()
                        .attr("x2", width)
                        .attr("stroke", "white") // Change guide line color
                        .attr("stroke-opacity", 0.1)
                )
                .call((g) =>
                    g
                        .append("text")
                        .attr("x", -margin.left)
                        .attr("y", 10)
                        .attr("fill", "white")
                );

            svg.selectAll(".tick line").style("stroke", "white");

            svg.selectAll(".tick text").style("fill", "white");
            svg
                .append("text")
                .attr("x", -25)
                .attr("y", 10)
                .text("Weekly Cases: " + signifier.toUpperCase())
                .style("font-size", "16px")
                .style("fill", "white");

            const legend = svg
                .selectAll(".legend")
                .data(data.columns.slice(1))
                .enter()
                .append("g")
                .attr("transform", function (d, i) {
                    return "translate(0," + i * 20 + ")";
                })
                .on("click", function (d, i) {
                    // Toggle the opacity of lines based on the "active" class
                    const isActive = d3.select(this).classed("active");
                    d3.select(this).classed("active", !isActive)

                    d3.select("#path_" + i)
                        .transition()
                        .duration(1200)
                        .style("opacity", !isActive ? 1 : 0); // Adjust opacity based on active status
                    // console.log(`button ${i}`);
                    // console.log(isActive);
                });



            legend
                .append("rect")
                .attr("x", width - 10)
                .attr("width", 18)
                .attr("height", 18)
                .style("fill", function (d, i) {
                    if (i == 0)
                        return colors[i];
                    return "gray";
                })
                .attr("opacity", function (d, i) {
                    if (i == 0)
                        return 1;
                    return 0.2;
                })
                .style("cursor", "pointer")
                .on("click", function (d, i) {
                    // Toggle the stroke of lines based on the "active" class
                    const isActive = d3.select(this).classed("active");
                    d3.select(this).classed("active", !isActive)

                    d3.select(this)
                        .transition()
                        .duration(1000)
                        .style("fill", !isActive ? colors[i] : "gray")
                        .style("opacity", !isActive ? 1 : 0.2)

                    d3.select("#path_" + i)
                        .transition()
                        .duration(1000)
                        .style("opacity", !isActive ? 1 : 0);

                    console.log(`button ${i}`);
                    console.log(isActive);

                });

            legend
                .append("text")
                .attr("x", width - 11)
                .attr("y", 9)
                .attr("dy", "0.35em")
                .text((d, i) => `Day ${i + 1}`, "white")
                .style("text-anchor", "end")
                .style("fill", "white")
                .style("font-family", "Josefin Sans")
                .style("font-size", "12px");




            /////data point corresponding to the maximum value
            const maxDataPoint = real_data.find(
                (d) => d[chosenColumn] === maxYValue
            );

            line = d3
                .line()
                .defined((d) => !isNaN(d[chosenColumn]))
                .x((d) => x(d.date))
                .y((d) => y(d[chosenColumn]));

            svg
                .append("path")
                .datum(real_data)
                .attr("fill", "none")
                .attr("stroke", "white")
                .attr("stroke-linejoin", "round")
                .attr("stroke-linecap", "round")
                .attr("stroke-width", 1.5)
                .attr("d", line);

            for (let i = 0; i < 7; i++) {
                svg
                    .append("path")
                    .attr("id", "path_" + i)
                    .datum(data)
                    .attr("fill", "none")
                    .attr("stroke", colors[i])
                    .attr("stroke-width", 2)
                    .attr(
                        "d",
                        d3
                            .line()
                            .x((d) => x(new Date(d.date)))
                            .y((d) => y(d[`${i}`]))
                            .curve(d3.curveBasis)
                            .context(null)
                    )
                    .style("opacity", 0)
                    .on("click", function (d, i) {
                        const isActive = d3.select(this).classed("active");
                        const obj = d3.select(this)

                        console.log(obj, isActive)

                        obj.classed("active", !isActive)
                            .style("opacity", isActive ? 1 : 0);
                    })
            }
            svg.select("#path_0")
                .classed("class", "active")
                .style("opacity", 1)
        })
    })
}

function broken(tab) {
    icon = document.createElement("sl-icon")
    icon.setAttribute("name", "emoji-frown")
    tab.append(icon)
}

