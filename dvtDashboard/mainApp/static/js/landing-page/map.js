
// Draw the map components
function mapInitialVisualization() {
    d3.json("/data/map/county").then(function(mapdata) {
        // add group for zcta map
        zctas = mapSVG.append("g")
            .attr("id", "map-zctas")

        // draw county map
        mapData = mapdata
        mapProjection = d3.geoAlbers().fitExtent(
            [[margins.left, margins.top], [width-margins.right,height-margins.bottom]],
            mapdata)
        pathGenerator = d3.geoPath(mapProjection)

        counties = mapSVG.append("g")
                .attr("id", "map-counties")
                .style("pointer-events", "none")
        counties.selectAll("g")
              .data(mapdata.features)
              .enter()
              .append("g")
              .append("path")
              .attr("class", "map-county")
              .attr("id", d => "map-" + fixName(d.properties.NAME))
              .attr("d", d => pathGenerator(d))
              .style("fill-opacity", 0)

        icons = mapSVG.append("g")
            .attr("id", "map-icons")
            .style("pointer-events", "none")

        // add group for hospital icons
        hospitals = icons.append("g")
            .attr("id", "map-hospitals")
            .style("display", hospitalIconsToggle.checked ? "initial" : "none")

        // add group for mobile clinic icons
        mobileClinics = icons.append("g")
            .attr("id", "map-mobile-clinics")
            .style("display", mobileClinicIconsToggle.checked ? "initial" : "none")

        // add group for community partner icons
        communityPartners = icons.append("g")
            .attr("id", "map-community-partners")
            .style("display", communityPartnerIconsToggle.checked ? "initial" : "none")

        // add group for map legends
        legendsGroup = mapSVG.append("g")
            .attr("id", "map-legends")
            .style("pointer-events", "none")

        // add tooltip
        ttpDiv = mapSVG.append("foreignObject")
            .attr("id", `map-tooltip-fo`)
                .datum({"geo-coords": [-80.9, 34], "cartesian-coords": [1,1]})
                .attr("x", 1)
                .attr("y", 1)
                .attr("width", 500)
                .attr("height", 300)
                .attr("pointer-events", "none")
            .append("xhtml:div")
            .attr("id", `map-tooltip-div`)

        ttpTitle = ttpDiv.append("p")
            .attr("class", "tooltip-title")
        ttpTitle.append("span")
            .attr("class", "tooltip-title")
        ttpTitle.append("br")
        ttpTitle.append("span")
            .attr("class", "tooltip-subtitle")

        ttpDiv.append("svg")
            .attr("id", `map-tooltip-svg`)
            .attr("class", `tooltip-outer-svg`)
    }).then(() => {

        choroplethColorMap = d3.scaleLinear()
            .domain([0, d3.max(getDataAsArray(mapDiseaseSelector.value, mapDataSourceSelector.value, mapRateSwitch.value == "rate"))])
            .range(["white", dataSourceColorMap[mapDataSourceSelector.value]])
            .unknown("var(--sl-color-gray-600)").nice()

        diseaseData = zctaData[mapDiseaseSelector.value]
        
        // draw zcta map items
        d3.json("/data/map/zcta").then(function(mapdata) {
            zctas.selectAll("g")
                .data(diseaseData)
                .enter()
                .append("g")
                .attr("id", d => `map-${d.zcta}-group`)
                .attr("class", "map-zcta-container")

            mapdata.features.forEach(function(data) {
                group = zctas.select(`#map-${data.properties.ZCTA5CE20}-group`)
                element = group.datum()
                thisData = element[mapDataSourceSelector.value].data

                // find index of current date in data
                thisStartDate = parseDate(element[mapDataSourceSelector.value]["start-date"])
                thisEndDate = new Date(thisStartDate);
                thisEndDate.setDate(thisEndDate.getDate() + thisData.length*7);
                datesReconstructed = d3.timeSaturday.range(thisStartDate, new Date(thisEndDate).setDate(thisEndDate.getDate()+1), 1)

                index = datesReconstructed.findIndex((d) => d.getTime() == thisWeekMonday.getTime())
                
                value = NaN                
                if (index > -1 && (!mapIncludeImputations.checked || !thisData.imputation)) {
                    // update value if current date in data
                    value = thisData.at(index)
                    if (mapRateSwitch.value == "rate") {
                        value /= element.population / 1000
                    }
                }

                // add path and color
                group.append("path")
                    .datum(data)
                    .attr("id", "map-"+element.zcta)
                    .attr("class", "map-zcta")
                    .attr("county", element.county) // add primary county
                    .attr("zcta", element.zcta) // add primary zcta
                    .attr("d", d => pathGenerator(d))
                    .attr('fill', choroplethColorMap(value))
                    .each(function(zctaData) {
                        zcta = d3.select(this)
                        setZctaInteractions(zcta)
                    })
            })
        })

        // draw hospital icons
        hospSize = Math.max(16, Math.min(width, height) * 0.015)
        d3.csv("/data/icon/hospitals").then(function(hospdata){
            hospitals.selectAll("svg")
              .data(hospdata)
              .enter()
              .append("svg")
              .attr("class", "hospital")
              .attr("id", d => "map-"+fixName(d["Name of Facility"]))
              .attr("viewBox", "0 0 16 16")
              .attr("x", d => mapProjection([d.X, d.Y])[0]*zoom + xSkew - hospSize/2)
              .attr("y", d => mapProjection([d.X, d.Y])[1]*zoom + ySkew - hospSize/2)
              .attr("width", hospSize)
              .attr("height", hospSize)
              .each(function(d) {
                this.innerHTML = makeHospital(fixName(d["Name of Facility"]))
              })
        })

        // draw mobile health clinic icons
        mobileClinicSize = Math.max(16, Math.min(width, height) * 0.015)
        d3.csv("/data/icon/mobile_health_clinics").then(function(clinicData){
            mobileClinics.selectAll("svg")
              .data(clinicData)
              .enter()
              .append("svg")
              .attr("class", "mobile-clinic")
              .attr("id", d => "map-"+fixName(d["Site.Name"]))
              .attr("viewBox", "0 0 16 16")
              .attr("x", d => mapProjection([d.longitude, d.latitude])[0]*zoom + xSkew - mobileClinicSize/2)
              .attr("y", d => mapProjection([d.longitude, d.latitude])[1]*zoom + ySkew - mobileClinicSize/2)
              .attr("width", mobileClinicSize)
              .attr("height", mobileClinicSize)
              .each(function(d) {
                this.innerHTML = makeMobileHealthClinic(fixName(d["Site.Name"]))
              })
        })

        // draw community partner icons
        communityPartnerSize = Math.max(16, Math.min(width, height) * 0.015)
        d3.csv("/data/icon/all_community_partners").then(function(clinicData){
            communityPartners.selectAll("svg")
              .data(clinicData)
              .enter()
              .append("svg")
              .attr("class", "community-partner")
              .attr("id", d => "map-"+fixName(d["Site.Name"]))
              .attr("viewBox", "0 0 16 16")
              .attr("x", d => mapProjection([d.longitude, d.latitude])[0]*zoom + xSkew - communityPartnerSize/2)
              .attr("y", d => mapProjection([d.longitude, d.latitude])[1]*zoom + ySkew - communityPartnerSize/2)
              .attr("width", communityPartnerSize)
              .attr("height", communityPartnerSize)
              .each(function(d) {
                this.innerHTML = makeCommunityPartner(fixName(d["Site.Name"]))
              })
        })

        // Add components for choropleth legend
        legendWidth = Math.max(width/3, 300)
        colorLegend = mapSVG.select("#map-legends").append("g")
            .attr("id", "map-color-legend")
            .attr("class", "map-legend")

        // create gradient that goes from white to color... like the choropleth coloring
        colorLegendDefs = colorLegend.append("defs")
        linearGrdient = colorLegendDefs.append("linearGradient")
        linearGrdient.attr("id", "linear-gradient")
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "0%")
        linearGrdient.append("stop")
            .attr("id", "linear-gradient-stop-0")
            .attr("offset", "0%")
            .attr("stop-color", "white")
        linearGrdient.append("stop")
            .attr("id", "linear-gradient-stop-1")
            .attr("offset", "100%")
            .attr("stop-color", dataSourceColorMap[mapDataSourceSelector.value])

        // add background
        colorLegend.append("rect")
            .attr("id", "map-color-legend-background")
            .attr("class", "map-legend-background")

        // display the choropleth range using gradient
        colorLegendContent = colorLegend.append("g").attr("id", "map-color-legend-contents")
        colorLegendContent.append("rect")
            .style("fill", "url(#linear-gradient)");

        // group for x-axis to show the values at each hue
        colorLegendContent.append("g").attr("id", "map-color-legend-axis")
            .call(d3.axisBottom(d3.scaleLinear(choroplethColorMap.domain(), [0, legendWidth])).ticks(9))

        // add a title :)
        colorLegendContent.append("text")
            .attr("id", `map-legend-title`)
            .attr("class", `map-legend title`)
            .text("Current Week's Hospitalizations by ZCTA")
    }).then(() => {
        mapResizer.addEventListener("sl-resize", () => {
            resizeMap()
        })
        resizeMap()
    })
}

function resizeMap() {
    // figure out map projection
    width = mapDiv.clientWidth
    height = mapDiv.clientHeight
    mapProjection = d3.geoAlbers().fitExtent(
        [[margins.left, margins.top], [width-margins.right,height-margins.bottom]],
        mapData)
    pathGenerator = d3.geoPath(mapProjection)

    // update county paths
    mapSVG.selectAll(".map-county") 
    .attr("d", (d) => pathGenerator(d))

    // update zcta paths
    mapSVG.selectAll(".map-zcta") 
        .attr("d", (d) => pathGenerator(d))

    // resize and move hospitals to correct location
    hospSize = Math.max(16, Math.min(width, height) * 0.015)
    mapSVG.select("#map-hospitals").selectAll(".hospital").each(function(d) {
            coords = mapProjection([d.X, d.Y])
            d3.select(this)
                .attr("x", coords[0]*zoom + xSkew - hospSize/2)
                .attr("y", coords[1]*zoom + ySkew - hospSize/2)
                .attr("width", hospSize)
                .attr("height", hospSize)
    })

    // resize and move hospitals to correct location
    mobileClinicSize = Math.max(16, Math.min(width, height) * 0.015)
    mapSVG.select("#map-mobile-clinics").selectAll(".mobile-clinic").each(function(d) {
            coords = mapProjection([d.longitude, d.latitude])
            d3.select(this)
                .attr("x", coords[0]*zoom + xSkew - mobileClinicSize/2)
                .attr("y", coords[1]*zoom + ySkew - mobileClinicSize/2)
                .attr("width", mobileClinicSize)
                .attr("height", mobileClinicSize)
    })

    // resize and move hospitals to correct location
    communityPartnerSize = Math.max(16, Math.min(width, height) * 0.015)
    mapSVG.select("#map-community-partners").selectAll(".community-partner").each(function(d) {
            coords = mapProjection([d.longitude, d.latitude])
            d3.select(this)
                .attr("x", coords[0]*zoom + xSkew - communityPartnerSize/2)
                .attr("y", coords[1]*zoom + ySkew - communityPartnerSize/2)
                .attr("width", communityPartnerSize)
                .attr("height", communityPartnerSize)
    })

    // update tooltip
    mapSVG.select("#map-tooltip-fo")
        .attr("x", d => mapProjection(d["geo-coords"])[0]*zoom + xSkew)
        .attr("y", d => mapProjection(d["geo-coords"])[1]*zoom + ySkew)

    // update choropleth
    legendWidth = Math.max(width/3, 300)
    colorLegend = mapSVG.select("#map-color-legend")
    colorLegend.select("#map-color-legend-contents>rect")
        .attr("width", legendWidth)
        .attr("height", em)
        .attr("x", 2*em)
        .attr("y", height - 4.5*em)

    colorLegendAxis = colorLegend.select("#map-color-legend-axis")
    colorLegendAxis.selectAll("*").remove()
    colorLegendAxis
        .attr("transform", `translate(${2*em},${height - 3.5*em})`)
        .call(d3.axisBottom(d3.scaleLinear(choroplethColorMap.domain(), [0, legendWidth])).ticks(9))

    colorLegend.select("#map-color-legend-contents>text") 
        .attr("y", height-1*em)
        .attr("x", 2*em + legendWidth/2)

    legendBBox = colorLegend.select("#map-color-legend-contents").node().getBBox()
    colorLegend.select("#map-color-legend-background")
        .attr("x", legendBBox.x - 0.5*em)
        .attr("y", legendBBox.y)
        .attr("height", legendBBox.height + 0.5*em)
        .attr("width", legendBBox.width + em)
}

function updateMapData() {
    diseaseData = zctaData[mapDiseaseSelector.value]

    // update colormap
    choroplethColorMap = d3.scaleLinear()
        .domain([0, d3.max(getDataAsArray(mapDiseaseSelector.value, mapDataSourceSelector.value, mapRateSwitch.value == "rate", mapIncludeImputations.checked))])
        .range(["white", dataSourceColorMap[mapDataSourceSelector.value]])
        .unknown("var(--sl-color-gray-600)").nice()

    // update legend
    legendWidth = Math.max(width/3, 300)
    d3.select("#linear-gradient-stop-1")
        .attr("stop-color", dataSourceColorMap[mapDataSourceSelector.value])

    colorLegendAxis = mapSVG.select("#map-color-legend-axis")
    colorLegendAxis.selectAll("*").remove()
    colorLegendAxis
        .attr("transform", `translate(${2*em},${height - 3.5*em})`)
        .call(d3.axisBottom(d3.scaleLinear(choroplethColorMap.domain(), [0, legendWidth])).ticks(9))
    
    d3.selectAll(".map-zcta-container").data(diseaseData).each(function(d) {
        thisData = d[mapDataSourceSelector.value].data

        // find index of current date in the data
        thisStartDate = parseDate(d[mapDataSourceSelector.value]["start-date"])
        thisEndDate = new Date(thisStartDate);
        thisEndDate.setDate(thisEndDate.getDate() + thisData.length*7);
        datesReconstructed = d3.timeSaturday.range(thisStartDate, new Date(thisEndDate).setDate(thisEndDate.getDate()+1), 1)

        index = datesReconstructed.findIndex((d) => d.getTime() == thisWeekMonday.getTime())
        
        value = NaN
        if (index > -1 && // current date in data
            (mapIncludeImputations.checked || !d.imputation) && // imputations included or data is not imputed
            (focusZCTA == null || focusZCTA == d.zcta)) { // no focus zcta or this zcta IS the zcta
            value = thisData.at(index)
            if (mapRateSwitch.value == "rate") {
                value /= d.population / 1000
            }
        }

        d3.select(`path#map-${d.zcta}`)
            .style("fill", choroplethColorMap(value))
    })  

}

