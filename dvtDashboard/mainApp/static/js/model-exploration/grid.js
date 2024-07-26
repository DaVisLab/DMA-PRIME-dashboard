// keep note of div elements
// group data single line graph (1) 
// brush zoom in,  in detailed graph (2)
// change in rate comparision for different counties (done)

// ratio which is the highest over counties use that as maximum scale
// common script file for all the conties loop over county names and csv for each county
//test for toggle button (done)


// button to toggle between total and average cases?
const toggleButton = document.getElementById("toggleButton");
let isToggled = true;
toggleButton.addEventListener("click", () => {
    isToggled = !isToggled;

    if (isToggled) {
        toggleButton.style.backgroundColor = "rgb(172, 147, 212)";
        toggleButton.textContent = "TOT";

        uploadAbsolute();
    } else {
        toggleButton.style.backgroundColor = "rgb(95, 102, 160)";
        toggleButton.textContent = "AVG";
        uploadAveraged();
    }
});

const chosenColumn = 0; // Change this to the column you want to display on the y-axis

counties = [
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
    "mcCormick",
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

population = [
    24527, 170872, 8688, 202558, 14066, 20866, 192122, 227907, 14553, 411406,
    57300, 32244, 45650, 33745, 37677, 66618, 30479, 162809, 27260, 22347, 138293,
    62680, 523542, 70811, 19222, 354081, 30073, 66551, 98012, 67493, 16828,
    298750, 30657, 26118, 9463, 38440, 79546, 86175, 126884, 415759, 20473,
    319785, 106721, 27316, 30368, 280979,
];

const countyPOPCsvMapping = [];

for (let i = 0; i < counties.length; i++) {
    const mapping = {
        county: counties[i],
        countyPop: population[i],
    };
    countyPOPCsvMapping.push(mapping);
}

// colors and handy stuff
const colors = ["#2E1E30", "#331427", "#A20D32", "#FF073A"];
const quartiles = [0, 4000, 40000, 180000];
var colorMap = d3.scaleLinear().domain(quartiles).range(colors)

var margin = { top: em, right: 0, bottom: 0.5*em, left: 0 },
    gridItemWidth = 205 - margin.left - margin.right,
    gridItemHeight = 120 - margin.top - margin.bottom;


// create svg's for each county
const cont = d3.select(".container")

countyPOPCsvMapping.forEach(({ county }) => {
    let div = cont.append("div").attr("class", "quadrant")
    let svg = div.append("svg")
        .attr("id", county + "-grid")
});



createBaseObjects();
initialVisualisation();

function createBaseObjects() {
    countyPOPCsvMapping.forEach(({ county }) => {
        countyName = county.toUpperCase();

        // display data
        const svg = d3.select("#" + county + "-grid")
            .attr("width", gridItemWidth + margin.left + margin.right)
            .attr("height", gridItemHeight + margin.top + margin.bottom)

        svg
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        // background rep value
        svg
            .append("rect")
            .attr("width", gridItemWidth + margin.left + margin.right)
            .attr("height", gridItemHeight + margin.top + margin.bottom)
            .style("fill", colorMap(0));

        // line of linechart
        svg
            .append("path")
            .attr("fill", "none")
            .attr("stroke", "white")
            .attr("stroke-linejoin", "round")
            .attr("stroke-linecap", "round")
            .attr("stroke-width", 2.0);

        // link to county-vis w/ text
        svg
            .append("text")
            .attr("class", "county-label")
            .attr("x", 0.5*em)
            .attr("y", em)
            // .attr("text-anchor", "middle")
            .text(countyName)
            .style("fill", "white")
            .style("font-size", "var(--sl-font-size-small)")


        // max value blue circle signifier
        svg
            .append("circle")
            .attr("r", 2)
            .attr("fill", "#777BFF")
            .style("opacity", 0);

        // label for max value
        svg
            .append("text")
            .attr("class", "pointlabel")
            .attr("text-anchor", "middle")
            .style("fill", "white")
            .style("font-size", "var(--sl-font-size-2x-small)")
            .style("opacity", 0);

        // adding total number of cases for county for that day
        svg
            .append("text")
            .attr("class", "totnumb")
            .attr("x", function(d) {
                bbox = svg.select(".county-label").node().getBBox()
                return bbox.x + bbox.width/2
            })
            .attr("y", 2*em) // Adjust the y-coordinate to position it below the existing text
            .attr("text-anchor", "middle")
            .style("font-size", "var(--sl-font-size-x-small)")
            .style("fill", "white")
    });

}

function initialVisualisation() {
    uploadAbsolute();
    countyPOPCsvMapping.forEach(({ county }) => {

        d3.select("#" + county + "-grid")
            .select("path")
            .transition()
            .duration(2000)
            .style("opacity", 1);

        d3.select("#" + county + "-grid")
            .select("circle")
            .style("opacity", 1);

        d3.select("#" + county + "-grid")
            .select(".pointlabel")
            .style("opacity", 1);
    });
}

function uploadAbsolute() {
    updateCountyGraphs("total");
}

function uploadAveraged() {
    updateCountyGraphs("popAdjusted");
}

function updateCountyGraphs(type) {
    countyPOPCsvMapping.forEach(({ county, countyPop }) => {
        d3.csv("static/data/county/Counties daily cases/" + county + "_case_daily.csv").then(function (data) {

            // Parse the date
            var parseDate = d3.timeParse("%Y-%m-%d");
            data.forEach(function (d) {
                d.date = parseDate(d.date);
                d[chosenColumn] = +d[chosenColumn];
            });

            const aggregate = Math.round(
                data.reduce((total, d) => total + d[chosenColumn], 0)
            );

            // information to display total values
            // may be redefined in the switch if we are not displaying total
            let fixedMaxYValue = 2500;
            let maxYValue = d3.max(data, (d) => d[chosenColumn]);
            const maxDataPoint = data.find((d) => d[chosenColumn] === maxYValue);
            let pointLabel = Math.round(maxYValue);
            let countyValue = aggregate;
            let lineFunc = function (val) { return val; };
            let countyTitle = "Total Cases";
            let quartiles = [0, 4000, 40000, 180000];

            switch (type) {
                case "popAdjusted":
                    quartiles = [0.0, 0.03, 0.2, 0.5];
                    fixedMaxYValue = 0.006;
                    maxYValue = d3.max(data, (d) => d[chosenColumn] / countyPop);
                    pointLabel = maxYValue.toFixed(3);
                    countyValue = (aggregate / countyPop).toFixed(3);
                    lineFunc = function (val) { return val / countyPop; };
                    countyTitle = "Pop Adjusted Cases";
                    break;
                // in the event we have many different things, I'm using a switch statement the default is total, see above
            }

            var colorMap = d3.scaleLinear().domain(quartiles).range(colors);

            d3.select("#" + county + "-grid")
                .select("rect")
                .transition()
                .duration(2000)
                .style("fill", colorMap(countyValue));

            const x = d3
                .scaleTime()
                .domain(d3.extent(data, (d) => d.date))
                .range([0, gridItemWidth]);

            const y = d3
                .scaleLinear()
                .domain([0, fixedMaxYValue])
                .nice()
                .range([gridItemHeight + margin.top - margin.bottom, margin.top]);

            const line = d3.line()
                .defined((d) => !isNaN(d[chosenColumn]))
                .x((d) => x(d.date))
                .y((d) => y(lineFunc(d[chosenColumn])));

            d3.select("#" + county + "-grid")
                .select("path")
                .datum(data)
                .transition()
                .duration(2000)
                .attr("d", line);

            d3.select("#" + county + "-grid")
                .select("circle")
                .transition()
                .duration(2000)
                .attr("cx", x(maxDataPoint.date)) // x-coordinate
                .attr("cy", y(maxYValue)); // y-coordinate

            d3.select("#" + county + "-grid")
                .select(".pointlabel")
                .transition()
                .duration(2000)
                .attr("x", x(maxDataPoint.date) + 8) // x-coordinate
                .attr("y", y(maxYValue) - 4) // Adjust the position to be above the circle
                .text(pointLabel);


            d3.select("#" + county + "-grid")
                .select(".totnumb").text(`(${countyValue})`)
                .attr("title", countyTitle);

        })
    })
}