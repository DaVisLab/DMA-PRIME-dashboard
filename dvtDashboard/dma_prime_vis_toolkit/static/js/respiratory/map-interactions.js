
mapRateSwitch.addEventListener("sl-change", (event) => {
    if (mapRateSwitch.value == "rate"){
        d3.select("#map-legend-title")
            .text("Current Week's Hospitalization Rates by ZCTA")
    } else {
        d3.select("#map-legend-title")
            .text("Current Week's Hospitalizations by ZCTA")
    }
    updateMapData()

    if (focusZCTA != null) {
        mapTooltipWidth = Math.max(500, width * .3)
        mapTooltipHeight = mapTooltipWidth * .65    
        drawTooltip(d3.select(`#map-${focusZCTA}-group`).datum(), d3.select("#map-tooltip-div"), mapTooltipHeight, mapTooltipWidth, mapRateSwitch.value == "rate")
    }

})

mapDataSourceSelector.addEventListener("sl-change", (event) => {
    updateMapData()
})

mapDiseaseSelector.addEventListener("sl-change", (event) => {
    updateMapData()

    if (focusZCTA != null) {
        mapTooltipWidth = Math.max(500, width * .3)
        mapTooltipHeight = mapTooltipWidth * .65    
        drawTooltip(d3.select(`#map-${focusZCTA}-group`).datum(), d3.select("#map-tooltip-div"), mapTooltipHeight, mapTooltipWidth, mapRateSwitch.value == "rate")
    }
})

mapIncludeImputations.addEventListener("sl-change", () => {
    if (mapIncludeImputations.checked) {
        mapSVG.selectAll(".map-zcta-container")
            .attr("pointer-events", "initial")
    } else {
        mapSVG.selectAll(".map-zcta-container")
            .filter(function(d) {
                return d.imputation
            })
            .attr("pointer-events", "none")
    }
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
    focusZCTA = null
    mapSVG.select("#map-tooltip-fo").select("div")
        .style("display", "none")
    mapUnzoom()
    mapClearMapItemHighlight()
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

function mapHighlightMapItem(mapItem) {
    // zoom and pan to focus on county
    mapItemData = mapItem.datum()
    center = mapProjection([mapItemData.properties.INTPTLON, mapItemData.properties.INTPTLAT])        
    dims = mapItem.node().getBBox()

    itemWidth = dims.width
    itemHeight = dims.height
    scale = Math.min(4, Math.min(width/itemWidth, height/itemHeight)-1.25)

    t1 = mapSVG.transition().duration(750).call(zoomer.transform, new d3.ZoomTransform(scale, width/2 - center[0]*scale, height/2 - center[1]*scale))

    return [t1.end()] 
}

function mapClearMapItemHighlight() {
    updateMapData()
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
            // unfocus from zip code and hide tooltip
            focusZCTA = null
            focusCounty = null
            resetButton.click()
        } else {
            // focus on zip code and display tooltip
            focusZCTA = zctaName
            focusCounty = countyName
            Promise.allSettled(mapHighlightMapItem(zctaPath)).then(() => {
                handleZCTAClick()
                updateMapData()
            })
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

        // draw tooltip
        drawTooltip(thisData, ttpDiv, mapTooltipHeight, mapTooltipWidth, mapRateSwitch.value == "rate")

        // place tooltip and set container dimensions
        zctaPathData = zctaPath.datum().properties
        coords = mapProjection([zctaPathData.INTPTLON, zctaPathData.INTPTLAT])
        divBorder = parseFloat(ttpDiv.style("border-width").replace("px",""))
        ttpFO
            .datum({"geo-coords": [zctaPathData.INTPTLON, zctaPathData.INTPTLAT], "cartesian-coords": coords})
            .attr("x", coords[0]*zoom + xSkew)
            .attr("y", coords[1]*zoom + ySkew)
            .attr("width", ttpDiv.node().offsetWidth+divBorder*2)
            .attr("height", ttpDiv.node().offsetHeight+divBorder*2)
    }

}
