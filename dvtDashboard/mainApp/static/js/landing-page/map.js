
// Draw the map components
function mapInitialVisualization() {
    d3.json("/map-data/county").then(function(mapdata) {
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
        counties.selectAll("path")
              .data(mapdata.features)
              .enter()
              .append("path")
              .attr("class", "map-county")
              .attr("id", d => "map-" + fixName(d.properties.NAME))
              .attr("d", d => pathGenerator(d))
              .style("fill-opacity", 0)

        // add group for hospital icons
        hospitals = mapSVG.append("g")
            .attr("id", "map-hospitals")
            .style("pointer-events", "none")

        // add group for hospital icons
        mobileClinics = mapSVG.append("g")
            .attr("id", "map-mobile-clinics")
            .style("pointer-events", "none")

        communityPartners = mapSVG.append("g")
            .attr("id", "map-community-partners")
            .style("pointer-events", "none")

        // add group for map legends
        legendsGroup = mapSVG.append("g")
            .attr("id", "map-legends")
            .style("pointer-events", "none")
    }).then(() => {
        // draw zcta map items
        d3.json("/map-data/zcta").then(function(mapdata) {
        d3.json("/map-data/zcta_county_crosswalk").then( async function(crosswalk) {
            zcta = mapdata
            zctas.selectAll("path")
                .data(mapdata.features)
                .enter()
                .append("path")
                .attr("class", "map-zcta")
                .attr("id", d => "map-"+fixName(d.properties.ZCTA5CE20))
                .attr("county", (d) => crosswalk[d.properties.ZCTA5CE20]) // add primary county
                .transition()
                .attr("d", d => pathGenerator(d))
                .attr('fill', "var(--sl-color-gray-600)")
                .each(function(zctaData) {
                    zcta = d3.select(this)
                    setZctaInteractions(zcta)
                    // hospitalTooltip(zcta)
                    // zoomToCounty(zcta)
                })
                .call(updateMapData)
        })})

        // draw hospital icons
        hospSize = Math.max(16, Math.min(width, height) * 0.015)
        d3.csv("../../static/data/hospitals-list.csv").then(function(hospdata){
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
        // d3.csv("../../static/data/hospitals-list.csv").then(function(clinicData){
        //     mobileClinics.selectAll("svg")
        //       .data(clinicData)
        //       .enter()
        //       .append("svg")
        //       .attr("class", "mobile-clinic")
        //       .attr("id", d => "map-"+fixName(d["Name of Facility"]))
        //       .attr("viewBox", "0 0 18 18")
        //       .attr("x", d => mapProjection([d.X, d.Y])[0]*zoom + xSkew - healthClinicSize/2)
        //       .attr("y", d => mapProjection([d.X, d.Y])[1]*zoom + ySkew - healthClinicSize/2)
        //       .attr("width", mobileClinicSize)
        //       .attr("height", mobileClinicSize)
        //       .each(function(d) {
        //         this.innerHTML = makeMobileHealthClinic(fixName(d["Name of Facility"]))
        //       })
        // })

        // draw community partner icons
        communityPartnerSize = Math.max(16, Math.min(width, height) * 0.015)
        // d3.csv("../../static/data/hospitals-list.csv").then(function(clinicData){
        //     communityPartners.selectAll("svg")
        //       .data(clinicData)
        //       .enter()
        //       .append("svg")
        //       .attr("class", "community-partner")
        //       .attr("id", d => "map-"+fixName(d["Name of Facility"]))
        //       .attr("viewBox", "0 0 16 16")
        //       .attr("x", d => mapProjection([d.X, d.Y])[0]*zoom + xSkew - communityPartnerSize/2)
        //       .attr("y", d => mapProjection([d.X, d.Y])[1]*zoom + ySkew - communityPartnerSize/2)
        //       .attr("width", communityPartnerSize)
        //       .attr("height", communityPartnerSize)
        //       .each(function(d) {
        //         this.innerHTML = makeCommunityPartner(fixName(d["Name of Facility"]))
        //       })
        // })

        choroplethColorMap = d3.scaleLinear()
            .domain([0, 0])
            .range(["white", dataSourceColorMap[mapDataSourceSelector.value]])
            .unknown("var(--sl-color-gray-600)").nice()

        // Add components for choropleth legend
        legendWidth = Math.max(width/3, 300)
        colorLegend = mapSVG.select("#map-legends").append("g")
            .attr("id", "map-color-legend")

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
            .attr("class", `map-legend title hospital`)
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

    // get data based on options
    d3.json(`/hospitalizations/${mapDiseaseSelector.value}/${mapDataSourceSelector.value}`, { // zcta hospital data
        "method": "POST",
        "headers": {"Content-Type": "application/json"},
        "body": JSON.stringify({
            "region": "all",
            "date": new Date(2024, 7, 26), // 5 is for month 6 - june
            "rate": mapRateSwitch.value == "rate"
    })}).then((result) => {
        // display data
        data = result.data
        stats = result.stats

        choroplethColorMap.domain([0, stats.count.max])
            .range(["white", dataSourceColorMap[mapDataSourceSelector.value]])
            .unknown("var(--sl-color-gray-600)").nice()

        data.forEach(element => {
            d3.select(`#map-${element.zcta}`)
                .attr("fill", choroplethColorMap(element.count))
        });

        d3.select("#linear-gradient-stop-1")
            .attr("stop-color", dataSourceColorMap[mapDataSourceSelector.value])

        // d3.select("#map-color-legend-contents").select("rect")
        //     .style("fill", "url(#linear-gradient)")

        colorLegendAxis = mapSVG.select("#map-color-legend-axis")
        colorLegendAxis.selectAll("*").remove()
        colorLegendAxis
            .attr("transform", `translate(${2*em},${height - 3.5*em})`)
            .call(d3.axisBottom(d3.scaleLinear(choroplethColorMap.domain(), [0, legendWidth])).ticks(9))
    
        // update titles
    
    })
}

