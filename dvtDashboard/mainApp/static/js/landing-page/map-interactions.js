
mapRateSwitch.addEventListener("sl-change", (event) => {
    if (mapRateSwitch.value == "rate"){
        d3.select("#map-legend-title")
            .text("Current Week's Hospitalization Rates by ZCTA")
    } else {
        d3.select("#map-legend-title")
            .text("Current Week's Hospitalizations by ZCTA")
    }
    updateMapData()
})

mapDataSourceSelector.addEventListener("sl-change", (event) => {
    updateMapData()
})

mapDiseaseSelector.addEventListener("sl-change", (event) => {
    updateMapData()
})

hospitalIconsToggle.addEventListener("sl-change", () => {
    // toggle hospital icons
    if (hospitalIconsToggle.checked) {
        mapSVG.select("#map-hospitals")
            .style("display", "initial")
            .raise()
    } else {
        mapSVG.select("#map-hospitals")
            .style("display", "none")
    }
})
mobileClinicIconsToggle.addEventListener("sl-change", () => {
    // toggle mobile clinic icons
    if (mobileClinicIconsToggle.checked) {
        mapSVG.select("#map-mobile-clinics")
            .style("display", "initial")
            .raise()
    } else {
        mapSVG.select("#map-mobile-clinics")
            .style("display", "none")
    }
})
communityPartnerIconsToggle.addEventListener("sl-change", () => {
    // toggle community partner icons
    if (communityPartnerIconsToggle.checked) {
        mapSVG.select("#map-community-partners")
            .style("display", "initial")
            .raise()
    } else {
        mapSVG.select("#map-community-partners")
            .style("display", "none")
    }
})

resetButton.addEventListener("click", () => {
    // reset map's zoom and pan
    focusCounty = null
    mapUnzoom()
    mapClearCountyHighlight()
})

// allow zoom and panning of map
zoomer = d3.zoom().scaleExtent([1, 10])
mapZoom = zoomer.on("zoom", function(e) {
    zoom = e.transform.k
    xSkew = e.transform.x
    ySkew = e.transform.y

    mapSVG.select("#map-counties").attr("transform", e.transform)
    mapSVG.select("#map-zctas").attr("transform", e.transform)
    mapSVG.select("#map-color-legend").attr("transform", d3.zoomIdentity)

    hospSize = Math.max(16, Math.min(width, height) * 0.015)
    mapSVG.select("#map-hospitals").selectAll(".hospital").each(function(d) {
        coords = mapProjection([d.X, d.Y])
        d3.select(this)
            .attr("x", coords[0]*zoom + xSkew - hospSize/2)
            .attr("y", coords[1]*zoom + ySkew - hospSize/2)
    }) 

    mobileClinicSize = Math.max(16, Math.min(width, height) * 0.015)
    mapSVG.select("#map-mobile-clinics").selectAll(".mobile-clinic").each(function(d) {
            coords = mapProjection([d.longitude, d.latitude])
            d3.select(this)
                .attr("x", coords[0]*zoom + xSkew - mobileClinicSize/2)
                .attr("y", coords[1]*zoom + ySkew - mobileClinicSize/2)
    })

    communityPartnerSize = Math.max(16, Math.min(width, height) * 0.015)
    mapSVG.select("#map-community-partners").selectAll(".community-partner").each(function(d) {
            coords = mapProjection([d.longitude, d.latitude])
            d3.select(this)
                .attr("x", coords[0]*zoom + xSkew - communityPartnerSize/2)
                .attr("y", coords[1]*zoom + ySkew - communityPartnerSize/2)
    })

    mapSVG.select("#map-tooltip-fo")
        .attr("x", d => mapProjection(d["geo-coords"])[0]*zoom + xSkew)
        .attr("y", d => mapProjection(d["geo-coords"])[1]*zoom + ySkew)
})
mapSVG.call(mapZoom)

function mapUnzoom() {
    mapSVG.transition().duration(750).call(mapZoom.transform, d3.zoomIdentity.translate(0, 0).scale(1))
}

function mapHighlightCounty(county) {

    // zoom and pan to focus on county
    countyData = county.datum()
    center = mapProjection([countyData.properties.INTPTLON, countyData.properties.INTPTLAT])        
    dims = county.node().getBBox()

    countyWidth = dims.width
    countyHeight = dims.height
    scale = Math.min(4, Math.min(width/countyWidth, height/countyHeight)-1.25)

    t1 = mapSVG.transition().duration(750).call(zoomer.transform, new d3.ZoomTransform(scale, width/2 - center[0]*scale, height/2 - center[1]*scale))

    // highlight  county (grey out other counties and zctas in those counties)
    t2 = mapSVG.selectAll(".map-county").transition().duration(750).style("fill-opacity", .5)
    t3 = county.transition().duration(750).style("fill-opacity", .0)

    return [t1.end(), t2.end(), t3.end()]
}

function mapClearCountyHighlight() {
    mapSVG.selectAll(".map-county").transition().duration(750).style("fill-opacity", 0)
}

function setZctaInteractions(zcta) {
    zcta.on("click", function(event) {
        zctaPathDom = event.target
        zctaPath = d3.select(zctaPathDom)

        countyName = zctaPath.attr("county")
        zctaName = zctaPath.attr("zcta")
        county = d3.select("#map-"+countyName)
        ttpFO = mapSVG.select("#map-tooltip-fo")
        ttpFO.select("div")
            .style("display", "none")

        if (focusZCTA == zctaName) {
            focusZCTA = null
            focusCounty = null
            resetButton.click()
        } else {
            focusZCTA = zctaName
            
            if (focusCounty == countyName) {
                handleZCTAClick()
            } else {
                focusCounty = countyName
                mapClearCountyHighlight()
                Promise.allSettled(mapHighlightCounty(county)).then(() => {
                    handleZCTAClick()
                })
            }
        }

        
    })

    function handleZCTAClick() {
        ttpDiv = ttpFO.select("div")
                        .style("display", "block")
                    // Figure out map tooltip dimensions
                    mapTooltipWidth = Math.max(500, width * .3)
                    mapTooltipHeight = mapTooltipWidth * .65
    
                    // set tooltip title
                    zctaGroup = d3.select(zctaPathDom.parentNode)
                    thisData = zctaGroup.datum()
    
                    p = ttpDiv.select("p").node()
                    p.innerHTML = `County: ${thisData.county[0].toUpperCase()+thisData.county.substring(1)}<br>ZCTA: ${thisData.zcta}`
    
                    // draw tooltip
                    drawTooltip(thisData, ttpDiv, mapTooltipHeight, mapTooltipWidth)
    
                    // place tooltip and set container dimensions
                    zctaPathData = zctaPath.datum().properties
                    coords = mapProjection([zctaPathData.INTPTLON20, zctaPathData.INTPTLAT20])
                    divBorder = parseFloat(ttpDiv.style("border-width").replace("px",""))
                    ttpFO
                        .datum({"geo-coords": [zctaPathData.INTPTLON20, zctaPathData.INTPTLAT20], "cartesian-coords": coords})
                        .attr("x", coords[0]*zoom + xSkew)
                        .attr("y", coords[1]*zoom + ySkew)
                        .attr("width", ttpDiv.node().offsetWidth+divBorder*2)
                        .attr("height", ttpDiv.node().offsetHeight+divBorder*2)
    }

}
