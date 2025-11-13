// async function getHospitalizationData() {
async function getHospitalizationData(diseaseOfInterest, valueType) {
  let stateData;
  // console.log(mapDiseaseSelector.value);
  // console.log(mapTypeSwitch.value);

  // // try {
  // const diseaseOfInterest = mapDiseaseSelector.value;
  // const valueType = mapTypeSwitch.value;

  // console.log(diseaseOfInterest);
  stateData = await d3.json(
    `/data/respiratory/state/state-cdc?data_version=${
      metadata.data_version
    }&${parseInt(Math.random() * 9999999999)}`
  );

  stateData = Object.entries(stateData[diseaseOfInterest]).map((d) => {
    let temp = { Date: d[0], count: d[1] };

    if (valueType == "rate") {
      temp["count"] /= scPopulation / 1000;
    }

    return temp;
  });
  console.log(stateData);

  // } catch (error) {
  //   stateData = [{ Date: "2020-01-01", count: 1 }];
  // }

  return stateData;
}

function drawingHospitalizationInfo(data) {
  const svgElement = document.getElementById("state-hospitalizations-svg"); // Select your SVG element by ID
  const bbox = svgElement.getBoundingClientRect();

  const width = bbox.width;
  const height = bbox.height;

  const margin = { top: 15, right: 20, bottom: 50, left: 50 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svg = d3.select(svgElement);
  svg.selectAll("*").remove();

  const parseDate = d3.timeParse("%Y-%m-%d");
  const formatDate = d3.timeFormat("%Y-%m-%d");

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  data.forEach((d) => {
    d.date = parseDate(d.Date);
  });

  data.sort((a, b) => d3.ascending(a.Date, b.Date));

  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  const dateExtent = d3.extent(data, (d) => d.date);

  const barWidth =
    (innerWidth / ((dateExtent[1] - dateExtent[0]) / oneWeekMs + 1)) * 0.8;

  console.log(width);
  console.log(barWidth);
  const x = d3
    .scaleTime()
    .domain(dateExtent)
    .range([barWidth / 2, innerWidth - barWidth / 2]);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.count)])
    .nice()
    .range([innerHeight, 0]);

  g.append("g")
    .attr("transform", `translate(${barWidth / 2}, ${innerHeight})`)
    .call(
      d3
        .axisBottom(x)
        .ticks(d3.timeMonth.every(1))
        .tickFormat(function (d, i) {
          if (i == 0) {
            return formatDate(d);
          }

          const ticks = x.ticks(d3.timeMonth.every(1));

          const prev = ticks[i - 1];
          const yearChanged = d.getFullYear() !== prev.getFullYear();

          if (yearChanged) {
            return formatDate(d);
          } else {
            // return ""
            return d3.timeFormat("%m-%d")(d);
          }
        })
    )
    .selectAll("text")
    .style("color", "black")
    .style("font-size", ".5rem")
    .attr("transform", (d, i) => {
      // console.log(d);
      // console.log(i);
      return "rotate(-45)";
    })

    .style("text-anchor", "end");

  g.append("g")
    .call(d3.axisLeft(y).ticks(5))
    .selectAll("text")
    .style("color", "black")
    .style("font-size", ".5rem");

  g.selectAll(".bar")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", (d) => x(d.date) - barWidth / 2)
    .attr("y", (d) => y(d.count))
    .attr("width", barWidth)
    .attr("height", (d) => innerHeight - y(d.count))
    .attr("fill", "steelblue");
}

document.addEventListener("DOMContentLoaded", async function () {
  // const diseaseOfInterest = mapDiseaseSelector.value;
  // const valueType = mapTypeSwitch.value;
  const mapTypeSwitch = document
    .getElementById("map-type-switch")
    .getAttribute("value");
  const mapDiseaseSelector = document
    .getElementById("map-disease-selector")
    .getAttribute("value");

  const hositalizationData = await getHospitalizationData(
    mapDiseaseSelector,
    mapTypeSwitch
  );

  drawingHospitalizationInfo(hositalizationData);

  // window.addEventListener("resize", () => {
  //   // draw();
  //    drawingHospitalizationInfo(hositalizationData);
  // });

  const ro = new ResizeObserver(() => {
    drawingHospitalizationInfo(hositalizationData);
  });

  ro.observe(d3.select("#state-hospitalizations-svg").node().parentElement);

  //
});
