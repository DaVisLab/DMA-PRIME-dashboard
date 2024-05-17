// keep note of div elements
// group data single line graph (1) 
// brush zoom in,  in detailed graph (2)
// change in rate comparision for different counties (done)

// ratio which is the highest over counties use that as maximum scale
// common script file for all the conties loop over county names and csv for each county
//test for toggle button (done)

const toggleButton = document.getElementById("toggleButton");
let isToggled = true;
let svg = null;
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

// csvFile = [
//   "/Counties daily cases/abbeville_case_daily.csv",
//   "/Counties daily cases/aiken_case_daily.csv",
//   "/Counties daily cases/allendale_case_daily.csv",
//   "/Counties daily cases/anderson_case_daily.csv",
//   "/Counties daily cases/bamberg_case_daily.csv",
//   "/Counties daily cases/barnwell_case_daily.csv",
//   "/Counties daily cases/beaufort_case_daily.csv",
//   "/Counties daily cases/berkeley_case_daily.csv",
//   "/Counties daily cases/calhoun_case_daily.csv",
//   "/Counties daily cases/charleston_case_daily.csv",
//   "/Counties daily cases/cherokee_case_daily.csv",
//   "/Counties daily cases/chester_case_daily.csv",
//   "/Counties daily cases/chesterfield_case_daily.csv",
//   "/Counties daily cases/clarendon_case_daily.csv",
//   "/Counties daily cases/colleton_case_daily.csv",
//   "/Counties daily cases/darlington_case_daily.csv",
//   "/Counties daily cases/dillon_case_daily.csv",
//   "/Counties daily cases/dorchester_case_daily.csv",
//   "/Counties daily cases/edgefield_case_daily.csv",
//   "/Counties daily cases/fairfield_case_daily.csv",
//   "/Counties daily cases/florence_case_daily.csv",
//   "/Counties daily cases/georgetown_case_daily.csv",
//   "/Counties daily cases/greenville_case_daily.csv",
//   "/Counties daily cases/greenwood_case_daily.csv",
//   "/Counties daily cases/hampton_case_daily.csv",
//   "/Counties daily cases/horry_case_daily.csv",
//   "/Counties daily cases/jasper_case_daily.csv",
//   "/Counties daily cases/kershaw_case_daily.csv",
//   "/Counties daily cases/lancaster_case_daily.csv",
//   "/Counties daily cases/laurens_case_daily.csv",
//   "/Counties daily cases/lee_case_daily.csv",
//   "/Counties daily cases/lexington_case_daily.csv",
//   "/Counties daily cases/marion_case_daily.csv",
//   "/Counties daily cases/marlboro_case_daily.csv",
//   "/Counties daily cases/mcCormick_case_daily.csv",
//   "/Counties daily cases/newberry_case_daily.csv",
//   "/Counties daily cases/oconee_case_daily.csv",
//   "/Counties daily cases/orangeburg_case_daily.csv",
//   "/Counties daily cases/pickens_case_daily.csv",
//   "/Counties daily cases/richland_case_daily.csv",
//   "/Counties daily cases/saluda_case_daily.csv",
//   "/Counties daily cases/spartanburg_case_daily.csv",
//   "/Counties daily cases/sumter_case_daily.csv",
//   "/Counties daily cases/union_case_daily.csv",
//   "/Counties daily cases/williamsburg_case_daily.csv",
//   "/Counties daily cases/york_case_daily.csv",
// ];



// detailedGraph = [
//   "/all_detailed/abbevilleDetailed.html",
//   "/all_detailed/aikenDetailed.html",
//   "/all_detailed/allendaleDetailed.html",
//   "/all_detailed/andersonDetailed.html",
//   "/all_detailed/bambergDetailed.html",
//   "/all_detailed/barnwellDetailed.html",
//   "/all_detailed/beaufortDetailed.html",
//   "/all_detailed/berkeleyDetailed.html",
//   "/all_detailed/calhounDetailed.html",
//   "/all_detailed/charlestonDetailed.html",
//   "/all_detailed/cherokeeDetailed.html",
//   "/all_detailed/chesterDetailed.html",
//   "/all_detailed/chesterfieldDetailed.html",
//   "/all_detailed/clarendonDetailed.html",
//   "/all_detailed/colletonDetailed.html",
//   "/all_detailed/darlingtonDetailed.html",
//   "/all_detailed/dillonDetailed.html",
//   "/all_detailed/dorchesterDetailed.html",
//   "/all_detailed/edgefieldDetailed.html",
//   "/all_detailed/fairfieldDetailed.html",
//   "/all_detailed/florenceDetailed.html",
//   "/all_detailed/georgetownDetailed.html",
//   "/all_detailed/greenvilleDetailed.html",
//   "/all_detailed/greenwoodDetailed.html",
//   "/all_detailed/hamptonDetailed.html",
//   "/all_detailed/horryDetailed.html",
//   "/all_detailed/jasperDetailed.html",
//   "/all_detailed/kershawDetailed.html",
//   "/all_detailed/lancasterDetailed.html",
//   "/all_detailed/laurensDetailed.html",
//   "/all_detailed/leeDetailed.html",
//   "/all_detailed/lexingtonDetailed.html",
//   "/all_detailed/marionDetailed.html",
//   "/all_detailed/marlboroDetailed.html",
//   "/all_detailed/mcCormickDetailed.html",
//   "/all_detailed/newberryDetailed.html",
//   "/all_detailed/oconeeDetailed.html",
//   "/all_detailed/orangeburgDetailed.html",
//   "/all_detailed/pickensDetailed.html",
//   "/all_detailed/richlandDetailed.html",
//   "/all_detailed/saludaDetailed.html",
//   "/all_detailed/spartanburgDetailed.html",
//   "/all_detailed/sumterDetailed.html",
//   "/all_detailed/unionDetailed.html",
//   "/all_detailed/williamsburgDetailed.html",
//   "/all_detailed/yorkDetailed.html",
// ];
const countyPOPCsvMapping = [];

for (let i = 0; i < counties.length; i++) {
  const mapping = {
    county: counties[i],
    countyPop: population[i],
  };
  countyPOPCsvMapping.push(mapping);
}


loadData();

function loadData() {
  // Define colors and ranges
  const colors = ["#2E1E30", "#331427", "#A20D32", "#FF073A"];
  const quartiles = [0, 4000, 40000, 180000];
  var colorMap = d3.scaleLinear().domain(quartiles).range(colors)

  countyPOPCsvMapping.forEach(({ county }) => {
    const cont = d3.select(".container")
    const div = cont.append("div").attr("class", "quadrant")
    const svg = div.append("svg")
                 .attr("id", county)
  });

  countyPOPCsvMapping.forEach(({ county }) => {
    
    d3.csv("/DMA-PRIME-dashboard/dashboardOverview/Counties daily cases/"+county+"_case_daily.csv").then(function (data) {
      const chosenColumn = 0; // Change this to the column you want to display on the y-axis

      var margin = { top: 25, right: 0, bottom: 1, left: 0 },
        width = 205 - margin.left - margin.right,
        height = 120 - margin.top - margin.bottom;

      // Parse the date
      var parseDate = d3.timeParse("%Y-%m-%d");
      data.forEach(function (d) {
        d.date = parseDate(d.date);
        d[chosenColumn] = +d[chosenColumn];
      });

      // // Function to get the color based on the aggregate value
      // function getColor(aggregate) {
      //   for (let i = 0; i < ranges.length; i++) {
      //     if (aggregate <= ranges[i]) {
      //       return colors[i];
      //     }
      //   }
      //   // If the aggregate value is greater than the last range, return the last color
      //   return colors[colors.length - 1];
      // }

      ////// aggregate of all data points
      const aggregate = Math.round(
        data.reduce((total, d) => total + d[chosenColumn], 0)
      );

      console.log(`Aggregate value for ${chosenColumn}th day:`, aggregate);
      // console.log(backgroundColor);

      const maxYValue = d3.max(data, (d) => d[chosenColumn]);
      console.log(Math.round(maxYValue));

      /////data point corresponding to the maximum value
      const maxDataPoint = data.find((d) => d[chosenColumn] === maxYValue);
      console.log("Max Data Point:", maxDataPoint);

      const x = d3
        .scaleTime()
        .domain(d3.extent(data, (d) => d.date))
        .range([0, width]);

      //   const y = d3
      //     .scaleLinear()
      //     .domain([0, d3.max(data, (d) => d[chosenColumn])])
      //     .nice()
      //     .range([height, 0]);

      const fixedMaxYValue = 2500;
      const y = d3
        .scaleLinear()
        .domain([0, fixedMaxYValue])
        .nice()
        .range([height, 0]);

      const line = d3
        .line()
        .defined((d) => !isNaN(d[chosenColumn]))
        .x((d) => x(d.date))
        .y((d) => y(d[chosenColumn]));

      svgElement = "#" + county;
      countyName = county.toUpperCase();

      const svg = d3.select("#"+county)
                     .attr("width", width + margin.left + margin.right)
                    .attr("height", height + margin.top + margin.bottom)
      
      svg
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

      svg
        .append("rect")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .style("fill", colorMap(aggregate));

      // svg.append("g")
      //     .attr("transform", "translate(0," + height + ")")
      //     .call(d3.axisBottom(x));

      // svg.append("g")
      //     .call(d3.axisLeft(y));

      svg
        .append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "white")
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .attr("stroke-width", 2.0)
        .attr("d", line)
        .style("opacity", 0)
        .transition()
        .duration(2000)
        .style("opacity", 1);

      svg
        .append("a")
        .attr("xlink:href", "./county-vis.html?county="+county)
        .append("text")
        .attr("x", width / 2 - 55)
        .attr("y", 18)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "WHITE")
        .style("font-family", "Josefin Sans")
        .text(countyName)
        .style("cursor", "pointer")
        .on("click", () => handleSVGclick(county));

      ///// adding a circle for highest number of cases

      svg
        .append("circle")
        .attr("cx", x(maxDataPoint.date)) // x-coordinate
        .attr("cy", y(maxYValue)) // y-coordinate
        .attr("r", 2)
        .attr("fill", "#777BFF");

      svg
        .append("text")
        .attr("class", "pointlabel")
        .attr("x", x(maxDataPoint.date) + 8)
        .attr("y", y(maxYValue) - 4) // Adjust the position to be above the circle
        .attr("text-anchor", "middle")
        .text(Math.round(maxYValue))
        .style("font-size", "10px")
        .style("fill", "white");

      /////// adding total number of cases for county for that day

      svg
        .append("text")
        .attr("class", "totnumb")
        .attr("x", width / 2 - 60)
        .attr("y", 35) // Adjust the y-coordinate to position it below the existing text
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "white")
        .style("font-family", "Josefin Sans")
        .text(`(${aggregate})`)
        .attr("title", "Total cases");
    });
  });
}

function uploadAbsolute(){

  const colors = ["#2E1E30", "#331427", "#A20D32", "#FF073A"];
  const quartiles = [0, 4000, 40000, 180000];
  var colorMap = d3.scaleLinear().domain(quartiles).range(colors)

  var margin = { top: 25, right: 0, bottom: 1, left: 0 },
  width = 205 - margin.left - margin.right,
  height = 120 - margin.top - margin.bottom;

  console.log("Here")

  countyPOPCsvMapping.forEach(({ county }) => {
    d3.csv("/DMA-PRIME-dashboard/dashboardOverview/Counties daily cases/"+county+"_case_daily.csv").then(function (data) {
    
      const chosenColumn = 0; 
      // Parse the date
      var parseDate = d3.timeParse("%Y-%m-%d");
      data.forEach(function (d) {
        d.date = parseDate(d.date);
        d[chosenColumn] = +d[chosenColumn];
      });

      const aggregate = Math.round(
        data.reduce((total, d) => total + d[chosenColumn], 0)
              );

        d3.select("#"+county)
          .select("rect") 
          .transition()
          .duration(2000) 
          .style("fill", colorMap(aggregate));

        const maxYValue = d3.max(data, (d) => d[chosenColumn]);

        /////data point corresponding to the maximum value
        const maxDataPoint = data.find((d) => d[chosenColumn] === maxYValue);
        // console.log("Max Data Point:", maxDataPoint);

        const x = d3
          .scaleTime()
          .domain(d3.extent(data, (d) => d.date))
          .range([0, width]);

        const fixedMaxYValue = 2500;
        const y = d3
          .scaleLinear()
          .domain([0, fixedMaxYValue])
          .nice()
          .range([height, 0]);

        const line = d3.line()
                    .defined((d) => !isNaN(d[chosenColumn]))
                    .x((d) => x(d.date))
                    .y((d) => y(d[chosenColumn]));

        d3.select("#"+county)
          .select("path")
          .transition()
          .duration(2000)
          .attr("d", line)

        d3.select("#"+county)
          .select("circle")
          .transition()
          .duration(2000)
          .attr("cy", y(maxYValue)) // y-coordinate

        d3.select("#"+county)
          .select(".pointlabel")
          .transition()
          .duration(2000)
          .attr("y", y(maxYValue) - 4) // Adjust the position to be above the circle
          .text(Math.round(maxYValue))


        d3.select("#"+county)
          .select(".totnumb")
          .attr("x", width / 2 - 60)
          .attr("y", 35) // Adjust the y-coordinate to position it below the existing text
          .attr("text-anchor", "middle")
          .style("font-size", "12px")
          .style("fill", "white")
          .style("font-family", "Josefin Sans")
          .text(`(${aggregate})`)
          .attr("title", "Total cases");

      })
  })
}

function uploadAveraged(){
      const colors = ["#2E1E30", "#331427", "#A20D32", "#FF073A"];
      const quartiles = [0.0, 0.03, 0.2, 0.5];
      var colorMap = d3.scaleLinear().domain(quartiles).range(colors);

      var margin = { top: 25, right: 0, bottom: 1, left: 0 },
      width = 205 - margin.left - margin.right,
      height = 120 - margin.top - margin.bottom;

      // console.log("Here")

      countyPOPCsvMapping.forEach(({ county, countyPop }) => {
        d3.csv("/DMA-PRIME-dashboard/dashboardOverview/Counties daily cases/"+county+"_case_daily.csv").then(function (data) {
          
          const chosenColumn = 0; // Change this to the column you want to display on the y-axis

          // Parse the date
          var parseDate = d3.timeParse("%Y-%m-%d");
          data.forEach(function (d) {
            d.date = parseDate(d.date);
            d[chosenColumn] = +d[chosenColumn];
          });
          
          const aggregate = Math.round(
          data.reduce((total, d) => total + d[chosenColumn], 0));
      
          const ratio = aggregate / countyPop;
 
          d3.select("#"+county)
            .select("rect")
            .transition()
            .duration(2000)   
            .style("fill", colorMap(ratio));

          const maxYValue = d3.max(data, (d) => d[chosenColumn]/ countyPop);
          console.log(maxYValue, countyPop);

          /////data point corresponding to the maximum value
          const maxDataPoint = data.find((d) => d[chosenColumn] === maxYValue);
          // console.log("Max Data Point:", maxDataPoint);

          const x = d3
            .scaleTime()
            .domain(d3.extent(data, (d) => d.date))
            .range([0, width]);

          const fixedMaxYValue = 0.006;
          const y = d3
            .scaleLinear()
            .domain([0, fixedMaxYValue])
            .nice()
            .range([height, 0]);

          const line = d3.line()
                      .defined((d) => !isNaN(d[chosenColumn]))
                      .x((d) => x(d.date))
                      .y((d) => y(d[chosenColumn] / countyPop));

          d3.select("#"+county)
            .select("path")
            .transition()
            .duration(2000)
            .attr("d", line)

          d3.select("#"+county)
            .select("circle")
            .transition()
            .duration(2000)
            .attr("cy", y(maxYValue)) // y-coordinate

          d3.select("#"+county)
            .select(".pointlabel")
            .transition()
            .duration(2000)
            .attr("y", y(maxYValue) - 4) // Adjust the position to be above the circle
            .text(maxYValue.toFixed(3))


          d3.select("#"+county)
            .select(".totnumb")
            .attr("x", width / 2 - 60)
            .attr("y", 35) // Adjust the y-coordinate to position it below the existing text
            .attr("text-anchor", "middle")
            .style("font-size", "12px")
            .style("fill", "white")
            .style("font-family", "Josefin Sans")
            .text(`(${ratio.toFixed(3)})`)
            .attr("title", "Total cases");

        })
        

      })

}
