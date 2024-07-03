
navBar.addEventListener("sl-tab-show", (event) => {
    if (event.detail.name == "main") {
        navBar.show("map")
    }
})


mapZoom = d3.zoom().scaleExtent([1, 10]).on("zoom", function(e) {

    zoom = e.transform.k
    xSkew = e.transform.x
    ySkew = e.transform.y

    mapSVG.select("#counties").attr("transform", e.transform)
    mapSVG.select("#disease-data").attr("transform", e.transform)
    mapSVG.select("#hospital-data").attr("transform", e.transform)
    mapSVG.select("#hospitals").attr("transform", e.transform)
    mapSVG.selectAll(".legend-group").attr("transform", d3.zoomIdentity.scale(zoom))

// trying to get the hospitals to semantically zoom... works on firefox (the bottom function)
    // mapSVG.select("#hospitals").attr("transform", e.transform)
    // mapSVG.selectAll(".hospital")
    //     .attr("transform", function(d) {
    //         console.log(xSkew)
    //         console.log(ySkew)
    //         return d3.zoomIdentity.translate((zoom-1) * (this.x.baseVal.value - this.width.baseVal.value), (zoom-1) * this.y.baseVal.value).scale(1/zoom)
    //     })

    // mapSVG.selectAll(".hospital").attr("transform", function(d){
    //     function blerp(zoom, dimension, location, skew) {
    //         // if you don"t want to scale after translation and only move via translation, use the formula:
    //         // (scale - 1) * ({x or y} position + {width or height}*.5) + {x or y translation}
    //         // return location.baseVal.value * zoom + skew
    //         return ((zoom-1) * (location.baseVal.value + (dimension.baseVal.value * .5))) + skew
    //     }
    //     return d3.zoomIdentity.translate(blerp(zoom, this.width, this.x, xSkew), blerp(zoom, this.height, this.y, ySkew))
    // })
})
mapSVG.call(mapZoom)

mapResizer.addEventListener("sl-resize", () => {
    resizeMap()
    if (document.body.clientWidth * 20 / 100 < 220) {
        mainContent.setAttribute("position", 220 * 100 / document.body.clientWidth)
    } else {
        mainContent.setAttribute("position", 20)
    }
})

resetButton.addEventListener("click", () => {
    mapSVG.call(mapZoom.transform, d3.zoomIdentity.translate(0, 0).scale(1))
})

hospitalToggle.addEventListener("sl-change", () => {
    if(hospitalToggle.checked) {
        mapSVG.selectAll("#hospital-data").raise().style("opacity", 1)
        mapSVG.selectAll(".legend.hospital").style("opacity", 1)
    } else {
        mapSVG.selectAll(".legend.hospital").style("opacity", 0)
        mapSVG.selectAll("#hospital-data").lower().style("opacity", 0)
    }
})

showHospitalIcons.addEventListener("sl-change", () => {
    if(showHospitalIcons.checked) {
        mapSVG.select("#hospitals").raise().style("opacity", 1)
        mapSVG.selectAll("#disease-data").raise()
        mapSVG.selectAll("#hospital-data").raise()
    } else {
        mapSVG.select("#hospitals").lower().style("opacity", 0)
    }
})

function removeTooltip(element) {
    element.on("pointermove", null)
    element.on("pointerleave", null)
    element.on("pointerenter", null)
}

function hospitalTooltip(element) {
    var tooltipWidth = 200
    var tooltipHeight = 130

    element.on("pointermove", function(e) {
        if((e.layerY + tooltipHeight + 1.5*em) < mapDiv.clientHeight) {
            tooltip.style.top = (e.layerY + 1.5*em) + "px"
        } else {
            tooltip.style.top = (e.layerY - tooltipHeight - 2.5*em) + "px"
        }
        if ((e.layerX + tooltipWidth) < mapDiv.clientWidth) {
            tooltip.style.left = e.layerX +"px"
        } else {
            tooltip.style.left = mapDiv.clientWidth - tooltipWidth + "px"
        }
    })
    element.on("pointerleave", function(e) {
        d3.select(tooltip)
            .style("opacity", 0)
            .style("z-index", -1)
    })

    element.on("pointerenter", function(e) {
        
        tooltipWidth = Math.max(200, width * .1)
        tooltipHeight = tooltipWidth * .65

        ttp = d3.select(tooltip)
        ttp.style("opacity", 1).style("z-index", 1)
        ttpSVG = ttp.select("#tooltip-svg")
            .attr("height", tooltipHeight)
            .attr("width", tooltipWidth)

        data = element.data()[0]

        ttp.select("p.tooltip").text(data.region.substring(1))
        ttpSVG.node().innerHTML = ""

        d3.json("/get-hospital-zcta-tooltip", { // hospital zcta data
            "method": "POST",
            "headers": {"Content-Type": "application/json"},
            "body": JSON.stringify({
                "region-name": data.region.substring(1),
                "disease": getVisibleHospitalDiseases().join(","),
                "date": data.date,
            })}).then((result) => { 
                
                timeDomain = []
                result.metadata.date.forEach(function(date) {
                    timeDomain.push(dayjs.tz(date, "America/New_York").toDate())
                })
                yScale = d3.scaleLinear()
                            .domain([result.stats.min, result.stats.max])        
                            .nice()

                temp = ttpSVG.append("text").text(yScale.domain()[1]).attr("x", 0).attr("y", 0)
                margins = {
                    "top": Math.max(em, tooltipHeight * .05),
                    "bottom": Math.max(2.5*em, tooltipHeight * .2),
                    "left": temp.node().getBBox().width + em,
                    "right": em,
                }
                temp.remove()

                yScale.range([tooltipHeight - margins.bottom, margins.top])
                xScale = d3.scaleUtc([timeDomain[0], timeDomain[timeDomain.length - 1]], [margins.left, tooltipWidth - margins.right]) 
                line = d3.line()
                    .x((d) => xScale(d.date))
                    .y((d) => yScale(d.count))

                graphSVG = ttpSVG.append("svg")
                    .attr("id", "graph-svg")
                    .attr("height", tooltipHeight)
                    .attr("width", tooltipWidth)

                Object.entries(result.data).forEach(function([disease, values]) {
                    data = []
                    Object.entries(values).forEach(function([date, count]) {
                        date = dayjs.tz(date, "YYYY-MM", "America/New_York").toDate()
                        data.push({"date": date, "count": count})
                    })
                        diseaseGroup = graphSVG.append("g")
                        diseaseGroup.append("path")
                            .attr("d", line(data))
                            .attr("stroke", diseaseColorMap(disease))
                            .attr("fill", "none")
        
                        diseaseGroup.selectAll("circle").data(data)
                        .enter()
                        .append("circle")
                        .attr("r", 3)
                        .attr("cx", (d) => xScale(d.date))
                        .attr("cy", (d) => yScale(d.count))
                        .attr("fill", diseaseColorMap(disease))
                    })

                ttpSVG.append("g")
                .attr("transform", `translate(0,${tooltipHeight - margins.bottom})`)
                .call(d3.axisBottom(xScale).tickValues(timeDomain).tickSize(4).tickFormat(d3.timeFormat("%b %d")))
                .selectAll("text")  
                .style("text-anchor", "end")
                .attr("transform", "rotate(-30)");
    
                ttpSVG.append("g")
                .attr("transform", `translate(${margins.left},0)`)
                .call(d3.axisLeft(yScale).ticks(5).tickSize(4));
            })
    })
}

function generalTooltip(element) {
    var tooltipWidth = 0
    var tooltipHeight = 0
    element.on("pointerenter", function(e) {
        tooltip.innerHTML = ""
        data = element.data()[0]
        ttp = d3.select(tooltip)
        ttp.style("opacity", 1).style("z-index", 1).style("background")
        d3.selectAll(`.${element.attr("bubble-type")}-bubble.${data.region}.${data.date}`)
            .each(function(d) {
                p = ttp.append("p")
                .attr("class", "tooltip text")
                .text(`${d.disease}: ${f(d.count)}`)
            })
        tooltipWidth = ttp.node().scrollWidth
        tooltipHeight = ttp.node().clientHeight
    })
        
    element.on("pointermove", function(e) {
        if((e.layerY + tooltipHeight + 25) < mapDiv.clientHeight) {
            tooltip.style.top = (e.layerY + 25) + "px"
        } else {
            tooltip.style.top = (e.layerY - tooltipHeight - 10) + "px"
        }
        if ((e.layerX + tooltipWidth) < mapDiv.clientWidth) {
            tooltip.style.left = e.layerX +"px"
        } else {
            tooltip.style.left = mapDiv.clientWidth - tooltipWidth + "px"
        }
    })
    element.on("pointerleave", function(e) {
        d3.select(tooltip)
            .style("opacity", 0)
            .style("z-index", -1)
    })
}