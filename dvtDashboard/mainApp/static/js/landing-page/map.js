
function displayMap() {
    var width = jsmapSVG.width.baseVal.value
    var height = jsmapSVG.height.baseVal.value
    
    d3.json("../../static/data/tl_2023_sc_county.json").then(function(mapdata) {
        mapData = mapdata
        mapProjection = d3.geoAlbers().fitExtent(
            [[margins.left, margins.top], [width-margins.right,height-margins.bottom]],
            mapdata)
        var pathGenerator = d3.geoPath(mapProjection)

        counties = mapSVG.append("g")
              .attr("id", "counties")
        counties.selectAll("path")
              .data(mapdata.features)
              .enter()
              .append("path")
              .attr("class", "county")
              .attr("id", d => d.properties.NAME.toLowerCase())
              .attr("d", d => pathGenerator(d))
              .style("fill", "var(--sl-color-gray-400)")
                .on("mouseenter", function(e) {
                    toolTipCreator(this, e)
                })

        hospitals = mapSVG.append("g")
              .attr("id", "hospitals")
    }).then(() => {
        d3.json("../../static/data/Hospitals.geojson").then(function(hospdata){
              hospitals.selectAll("svg")
              .data(hospdata.features)
              .enter()
              .append("svg")
              .attr("class", "hospital")
              .attr("id", d => fixHospitalName(d.properties.webdbINFOHEALTHFACILITYLF_NAME))
              .attr("width", Math.max(25, Math.min(width, height) * 0.02))
              .attr("height", Math.max(25, Math.min(width, height) * 0.02))
              .attr("x", (d) => mapProjection(d.geometry.coordinates)[0])
              .attr("y", (d) => mapProjection(d.geometry.coordinates)[1])
              .attr("viewBox", "0 0 16 16")
              .each(function(d) {
                fetch("/hospital/"+fixHospitalName(d.properties.webdbINFOHEALTHFACILITYLF_NAME))
                    .then((response) => {
                        if (!response.ok) {
                            throw new Error("HTTP error " + response.status)
                        }
                        return response.text()
                    }).then((data) => {
                        this.innerHTML = data
                    })
                    .catch((err) => {
                        console.log(err);
                    });
              })
        })
        
        d3.json("/get-real-disease-data", {
            "method": "POST",
            "headers": {"Content-Type": "application/json"},
            "body": JSON.stringify({
                'region-size': 'county',
                'region-name': 'all',
                'disease': 'all',
                'date': 'max',
                'data-type': 'cases 7-day averange',
            })}).then((data) => {
                console.log(data)
            }).catch((err) => {console.log(err)})
        covidData = mapSVG.append("g")
              .attr("id", "covid-data")
        
    })
}

function resizeMap() {
    var width = jsmapSVG.width.baseVal.value
    var height = jsmapSVG.height.baseVal.value
    mapProjection = d3.geoAlbers().fitExtent(
        [[margins.left, margins.top], [width-margins.right,height-margins.bottom]],
        mapData)
    var pathGenerator = d3.geoPath(mapProjection)

    d3.selectAll(".county").each(function(item) {
        d3.select(this)
        .attr("d", (d) => pathGenerator(d))
    })

    d3.selectAll(".hospital").each(function(item) {
        size = Math.max(25, Math.min(width, height) * 0.035)
        d3.select(this)
            .attr("width", size)
            .attr("height", size)
            .attr("x", (d) => mapProjection(d.geometry.coordinates)[0] - size/2)
            .attr("y", (d) => mapProjection(d.geometry.coordinates)[1] - size/2)
    })
}