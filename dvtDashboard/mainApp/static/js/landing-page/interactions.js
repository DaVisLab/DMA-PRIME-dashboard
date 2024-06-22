
mapZoom = d3.zoom().scaleExtent([1, 10]).on("zoom", function(e) {

    zoom = e.transform.k
    xSkew = e.transform.x
    ySkew = e.transform.y

    d3.select("#counties").attr('transform', e.transform)
    d3.select("#disease-data").attr('transform', e.transform)
    d3.select("#hospital-data").attr('transform', e.transform)
    d3.select("#hospitals").attr('transform', e.transform)
    d3.selectAll(".legend").attr('transform', d3.zoomIdentity.scale(zoom))

// trying to get the hospitals to semantically zoom... works on firefox
    // d3.select("#hospitals").attr('transform', e.transform)
    // d3.selectAll(".hospital")
    //     .attr("transform", function(d) {
    //         console.log(xSkew)
    //         console.log(ySkew)
    //         return d3.zoomIdentity.translate((zoom-1) * (this.x.baseVal.value - this.width.baseVal.value), (zoom-1) * this.y.baseVal.value).scale(1/zoom)
    //     })

    // d3.selectAll(".hospital").attr('transform', function(d){
    //     function blerp(zoom, dimension, location, skew) {
    //         // if you don't want to scale after translation and only move via translation, use the formula:
    //         // (scale - 1) * ({x or y} position + {width or height}*.5) + {x or y translation}
    //         // return location.baseVal.value * zoom + skew
    //         return ((zoom-1) * (location.baseVal.value + (dimension.baseVal.value * .5))) + skew
    //     }
    //     return d3.zoomIdentity.translate(blerp(zoom, this.width, this.x, xSkew), blerp(zoom, this.height, this.y, ySkew))
    // })
})
mapSVG.call(mapZoom)

mapResizer.addEventListener("sl-resize", () => {
    console.log("ss")
    resizeMap()
})

resetButton.addEventListener("click", () => {
    mapSVG.call(mapZoom.transform, d3.zoomIdentity.translate(0, 0).scale(1))
})

diseaseToggle.addEventListener("sl-change", () => {
    if(diseaseToggle.checked) {
        d3.selectAll(".legend.disease").raise().style("opacity", 1)
        d3.select("#disease-data").raise().style("opacity", 1)
        if(hospitalToggle.checked) {
            hospitalToggle.click()
        }
    } else {
        d3.selectAll(".legend.disease").lower().style("opacity", 0)
        d3.select("#disease-data").lower().style("opacity", 0)
    }
})

hospitalToggle.addEventListener("sl-change", () => {
    if(hospitalToggle.checked) {
        d3.selectAll(".legend.hospital").raise().style("opacity", 1)
        d3.selectAll("#hospital-data").raise().style("opacity", 1)
        if(diseaseToggle.checked) {
            diseaseToggle.click()
        }
    } else {
        d3.selectAll(".legend.hospital").lower().style("opacity", 0)
        d3.selectAll("#hospital-data").lower().style("opacity", 0)
    }
})

showHospitalIcons.addEventListener("sl-change", () => {
    if(showHospitalIcons.checked) {
        d3.select("#hospitals").raise().style("opacity", 1)
        d3.selectAll("#disease-data").raise()
        d3.selectAll("#hospital-data").raise()
    } else {
        d3.select("#hospitals").lower().style("opacity", 0)
    }
})
