// keep note of div elements
// group data single line graph (1) 
// brush zoom in,  in detailed graph (2)
// change in rate comparision for different counties (done)

// ratio which is the highest over counties use that as maximum scale
// common script file for all the conties loop over county names and csv for each county
//test for toggle button (done)

countyNames = [
    "abbeville",
    "aiken",
    "allendale",
    "anderson",
    "bamberg",
    "barnwell",
    "beaufort",
    "berkeley",
    "calhoun",
    "charleston",
    "cherokee",
    "chester",
    "chesterfield",
    "clarendon",
    "colleton",
    "darlington",
    "dillon",
    "dorchester",
    "edgefield",
    "fairfield",
    "florence",
    "georgetown",
    "greenville",
    "greenwood",
    "hampton",
    "horry",
    "jasper",
    "kershaw",
    "lancaster",
    "laurens",
    "lee",
    "lexington",
    "marion",
    "marlboro",
    "mccormick",
    "newberry",
    "oconee",
    "orangeburg",
    "pickens",
    "richland",
    "saluda",
    "spartanburg",
    "sumter",
    "union",
    "williamsburg",
    "york",
];

countyPopulation = [
    24527, 170872, 8688, 202558, 14066, 20866, 192122, 227907, 14553, 411406,
    57300, 32244, 45650, 33745, 37677, 66618, 30479, 162809, 27260, 22347, 138293,
    62680, 523542, 70811, 19222, 354081, 30073, 66551, 98012, 67493, 16828,
    298750, 30657, 26118, 9463, 38440, 79546, 86175, 126884, 415759, 20473,
    319785, 106721, 27316, 30368, 280979,
];

countyPOPCsvMapping = [];
for (let i = 0; i < countyNames.length; i++) {
    // create mapping between county name and population
    const mapping = {
        county: countyNames[i],
        countyPop: countyPopulation[i],
    };
    countyPOPCsvMapping.push(mapping);
}

// colors and handy stuff
const colors = ["white", "saddlebrown"] //["#2E1E30", "#331427", "#A20D32", "#FF073A"];
var colorMap = d3.scaleLinear().range(colors)

var margin = { top: em, right: 0, bottom: 0.5*em, left: 0 }


// create svg's for each county
const cont = d3.select("#grid-container")
countyPOPCsvMapping.forEach(({ county }) => {
    let div = cont.append("div").attr("class", "quadrant")
    let svg = div.append("svg")
        .attr("id", county + "-grid")
        .attr("class", "grid-item")
});

createBaseObjects();

function createBaseObjects() {
    countyPOPCsvMapping.forEach(({ county }) => {
        countyName = county.toUpperCase();

        // display data
        const svg = d3.select("#" + county + "-grid")

        // background rep value
        svg
            .append("rect")
            .style("fill", "grey");

        // link to county-vis w/ text
        svg
            .append("text")
            .attr("class", "county-label")
            .attr("x", 0.25*em)
            .attr("y", em)
            .text(countyName)
            .style("fill", "black")
            .style("font-size", "var(--sl-font-size-small)")

        svg
            .append("text")
            .attr("class", "totnumb")
            .attr("x", 0.25*em)
            .attr("y", 2*em) // Adjust the y-coordinate to position it below the existing text
            .style("font-size", "var(--sl-font-size-x-small)")
            .style("fill", "black")

    });

}

function initialVisualisation() {
    
    Object.entries(diseaseIndexing).forEach((entry) => {
        createGridCheck(entry[0], diseaseColorMap(entry[0]))
    })

    updateCountyGraphs();

    // show each county
    countyPOPCsvMapping.forEach(({ county }) => {

        d3.select("#" + county + "-grid")
            .select("path")
            .transition()
            .duration(750)
            .style("opacity", 1);

        d3.select("#" + county + "-grid")
            .select("circle")
            .style("opacity", 1);

        d3.select("#" + county + "-grid")
            .select(".pointlabel")
            .style("opacity", 1);
    });
}

function updateCountyGraphs() {
    d3.json("/get-hospital-zcta-data-by-county", { // zcta hospital data
        "method": "POST",
        "headers": {"Content-Type": "application/json"},
        "body": JSON.stringify({
            "disease": getVisibleDiseases("grid"),
            "date": "all",
            "pop-norm": gridPopulationSwitch.value == "pop-norm"
    })}).then(function(result) {

        diseaseType = gridAggregationSwitch.value

        gridHeight = gridContainer.clientHeight
        gridWidth = gridContainer.clientWidth

        gridItemWidth = Math.max((gridWidth/8) - 1, 0)
        gridItemHeight = Math.max((gridHeight/6) - 1, 0)
        
        data = result.data
        
        var parseDate = function(date) {return dayjs.tz(date, "YYYY-MM", "America/New_York").toDate()}
        colorMap.domain([0, result.stats['max-cum']])

        // x axis
        const x = d3
            .scaleTime()
            .domain([parseDate(result.stats['min-date']), parseDate(result.stats['max-date'])])
            .range([0, gridItemWidth]);

        gridStartDate.html(d3.utcFormat("%B %Y")(parseDate(result.stats['min-date'])))
        gridEndDate.html(d3.utcFormat("%B %Y")(parseDate(result.stats['max-date'])))

        countyPOPCsvMapping.forEach(({ county, countyPop }) => {
            // update each county grid visualization

            countyData = result.data[county]
            maxYValue = result.stats['county'][county]['max']

            countySVG = d3.select("#" + county + "-grid")
            
            countySVG
                .attr("width", gridItemWidth)
                .attr("height", gridItemHeight)
                
            if (diseaseType == "aggregated") {
                countyValue = countyData["cum-sum"]
            }
            else {
                countyValue = ""
            }

            countyTitle = diseaseType == "aggregated" ? "Total Cases" : "Population Adjusted Cases"

            // y axis
            const y = d3
                .scaleLinear()
                .domain([0, maxYValue * 1.2])
                .nice()
                .range([gridItemHeight - margin.bottom, margin.top]);

            // line generator
            const line = d3.line()
                .defined((d) => !isNaN(d.count))
                .x((d) => x(parseDate(d.date)))
                .y((d) => y(d.count));

            getMaxPoint = function(county, diseaseType, data) {
                dataPoint = result.stats['county'][county][diseaseType][data.disease]
                return {
                        'date': parseDate(dataPoint.date),
                        'count': dataPoint.count,
                    }  
            }

            // assign new data to existing paths
            diseasePaths = countySVG
                .selectAll(".path-container")
                .data(countyData[diseaseType])

            // remove any extra paths
            diseasePaths.exit().remove()

            // create path containers for new paths
            newPaths = diseasePaths.enter().append("g").attr("class", "path-container")

            // create a path, point for max value, and text for max value label for each path (disease)
            newPaths.datum(d => d)
                .append("path")
                .attr("fill", "none")
                .attr("stroke-linejoin", "round")
                .attr("stroke-linecap", "round")
                .attr("stroke-width", 2.0)
            newPaths.datum(d => d)
                .append("circle")
            newPaths.datum(d => d)
                .append("text")
                
            // merge old and new paths together so they can be altered together
            allPaths = newPaths
                .merge(diseasePaths)

            allPaths // actually draw path according to data passed to it
                .select("path").transition().duration(750)
                .attr("stroke", d => diseaseType == "aggregated" ? "black" : diseaseColorMap(d.disease))
                .attr("d", d => line(d.data));
            allPaths.datum(d => d) // position and fill max value circle
                .select("circle").transition().duration(750)
                .attr("cx", d => x(getMaxPoint(county, diseaseType, d).date)) // x-coordinate
                .attr("cy", d => y(getMaxPoint(county, diseaseType, d).count)) // y-coordinate
                .attr("r", 2.5)
                .attr("fill", d => diseaseType == "aggregated" ? d3.color("saddlebrown").brighter() : diseaseColorMap(d.disease))
            allPaths.datum(d => d) // position and write text for max value label
                .select("text").transition().duration(750)
                .attr("x", d => x(getMaxPoint(county, diseaseType, d).date)) // x-coordinate
                .attr("y", d => y(getMaxPoint(county, diseaseType, d).count) - 4) // Adjust the position to be above the circle
                .style("font-size", "var(--sl-font-size-x-small)")
                .style("text-anchor", "middle")
                .text(d => d3.format("2.2r")(getMaxPoint(county, diseaseType, d).count))
                .on("end", function(d) {
                    text = d3.select(this)
                    tempWidth = parseFloat(d3.select(this.ownerSVGElement).attr("width"))
                    tempLength = this.getBBox().width
                    xPos = parseFloat(text.attr("x"))
                    if (xPos < tempWidth/2) {
                        if (xPos - (1/2 * tempLength) < 0) {
                            text.style("text-anchor", "start")
                        }
                    } else {
                        if (tempWidth < xPos + (1/2 * tempLength)) {
                            text.style("text-anchor", "end")
                        }
                    }
                })

            // Add title for type of data (see when countyTitle is set above)
            countySVG
                .select(".totnumb").text(countyValue == "" ? countyValue : `(${d3.format("2.2r")(countyValue)})`)
                .attr("title", countyTitle);

            // color rectangle of county grid item
            countySVG
                .select("rect")
                .transition().duration(750)
                .attr("width", gridItemWidth)
                .attr("height", gridItemHeight)
                .style("fill", diseaseType == 'aggregated' ? colorMap(countyValue) : "grey");
        })
    })
}