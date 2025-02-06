
function drawCharts() {
    Object.keys(metadata['site_info']).forEach(site => {
        data = d3.select(`#${site}-div`).datum()[gridDiseaseSelector.value]

        domSvg = document.getElementById(`${site}-svg`)
        domSvg.innerHTML = ""
        svg = d3.select(domSvg)
        height = domSvg.scrollHeight
        width = domSvg.scrollWidth
        
        yAxis = svg.append("g")
            .attr("class", "y-axis")
        xAxis = svg.append("g")
            .attr("class", "x-axis")

        minVal = 0
        maxVal = 1

        if (data) {
            maxVal = Math.max(d3.max(Object.values(data)), maxVal)
            data = Object.entries(data).map(d => {return {"date":parseDate(d[0]), "val":d[1]}})
        } else {
            data = []
        }

        temp = svg.append("text").text(d3.format(".2r")(maxVal)).attr("x", 0).attr("y", 0)
        margins = {
            "top": .5*em, 
            "bottom": 1.5*em,
            "left": Math.max(20, temp.node().getBBox().width) + 1.25*em,
            "right": .5*em,
        }

        yScale = d3.scaleLinear()
            .domain([0, maxVal])
            .nice()
            .range([height-margins.bottom, margins.top])

        xScale = d3.scaleUtc()
            .domain([metadata['min_date'], metadata['max_date']])
            .nice()
            .range([margins.left, width - margins.right])

        lineGenerator = d3.line().x(d => xScale(d.date)).y(d => yScale(d.val))

        svg.append("path")
            .attr("d", lineGenerator(data))
            .attr("stroke", collectionColorScheme[site])
            .attr("fill", "none")
            .attr("stroke-width", 3)
        
        svg.append("g")
            .attr("id", `${site}-circles`)
            .selectAll("circle")
            .data(data)
            .enter()
            .append("circle")
            .attr("cx", d => xScale(d.date))
            .attr("cy", d => yScale(d.val))
            .attr("r", 5)
            .attr("fill", collectionColorScheme[site])

        yAxis.append("text")
            .attr("transform", `translate(${1*em},${yScale(d3.mean(yScale.domain()))})rotate(-90)`)
            .attr("text-anchor", "middle")
            .attr("fill", "var(--sl-color-neutral-1000)")
            .attr("font-size", "var(--sl-font-size-small)")
            .text("GC/L WW AVG")
        yAxis.append("g")
            .attr("transform", `translate(${margins.left},0)`)
            .call(d3.axisLeft(yScale).ticks(5).tickSize(4))
            .selectAll("text")
            .attr("class", "tooltip-label")
            .attr("fill", "var(--sl-color-neutral-1000)")
        xAxis.call(d3.axisBottom(xScale).tickArguments([d3.timeMonth.every(1), d3.timeFormat("%b %Y")]))
            .attr("transform", `translate(0, ${height - margins.bottom})`)
        
    })
}

function drawMap(height=0, width=0) {
    mapHeight = gridMapSvg.clientHeight
    mapWidth = gridMapSvg.clientWidth
    mapMargins = {
        "top": .5*em,
        "bottom": .5*em,
        "left": .5*em,
        "right": .5*em,
    }

    d3.json("/data/map/zcta").then(function(mapdata) {
        mapProjection = d3.geoAlbers().fitExtent(
            [[mapMargins.left, mapMargins.top], [mapWidth-mapMargins.right,mapHeight-mapMargins.bottom]],
            mapdata)

        pathGenerator = d3.geoPath(mapProjection)
        d3.select(gridMapSvg).selectAll("path")
            .data(mapdata.features)
            .join(
                enter => enter.append("path")
                            .attr("id", d => `grid-map-${d.properties.ZCTA}`)
                            .attr("class", "grid-map-zcta")
                            .style("fill", "white"),
                update => update,
                exit => exit.remove()
              )
            .attr("d", d => pathGenerator(d))
    }).then(() => {
        Object.entries(metadata.site_info).forEach(([site, info]) => {
            zctaSelector = info.zctas.map(z => `#grid-map-${z}`).join(",")
            d3.selectAll(zctaSelector)
                .style("fill", collectionColorScheme[site])
        })
    })
}