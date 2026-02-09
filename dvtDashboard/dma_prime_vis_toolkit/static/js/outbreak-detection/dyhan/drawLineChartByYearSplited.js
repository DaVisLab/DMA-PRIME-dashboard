import { buildRotatedSeriesForYear } from "./smallMultiples/smallMultiple-utils.js";
import { months } from "./controls.js";
function trendStrict(arr) {
  if (arr.length < 2) return "not enough data";

  let increasing = true;
  let decreasing = true;

  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > arr[i - 1]) decreasing = false;
    if (arr[i] < arr[i - 1]) increasing = false;
  }

  if (increasing) return 1;
  if (decreasing) return -1;
  return 0;
}

export function drawLineChartByYearSplited(
  svg,
  data,
  dateInfo,
  startMonth,
  margin,
  drawAxes = false,
) {
  const width = svg.node().clientWidth;
  const height = svg.node().clientHeight;

  const dataValues = data.properties.final_historical_disease_risk_index;

  if (dataValues.length == 0) {
    svg.style("background-color", "gray");
    return;
  }

  const yearlySplittedDateInfo = {};

  dateInfo.forEach((d, i) => {
    const [yy, mm, dd] = d.split("-").map(Number);
    yearlySplittedDateInfo[yy] = yearlySplittedDateInfo[yy] || [];
    yearlySplittedDateInfo[yy].push(i);
  });

  const yearKeys = Object.keys(yearlySplittedDateInfo);
  const maxYear = Math.max(...yearKeys);

  console.log(yearKeys)
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  let line;

  let x;

  let processed = null;
  let processedBeforeSort = null;
  let yearStart = null;
  let daysInYear = null;

  const maxVal = d3.max(
    dataValues.filter((d) => d !== null && !Number.isNaN(d)),
  );

  let y = d3
    .scaleLinear()
    .domain([0, maxVal])
    .nice()
    .range([margin.top + innerHeight, margin.top]);

  for (const year of yearKeys) {
    // console.log(year);
    const indices = yearlySplittedDateInfo[year];

    ({
      pts: processed,
      ptsBeforeSort: processedBeforeSort,
      yearStart,
      daysInYear,
    } = buildRotatedSeriesForYear({
      year,
      indices,
      dataValues,
      dateInfo,
      startMonth,
    }));

    x = d3
      .scaleTime()
      .domain([yearStart, d3.timeDay.offset(yearStart, daysInYear - 1)])
      .range([margin.left, innerWidth + margin.left]);

    const GAP_DAYS = 8;

    const line = d3
      .line()
      .defined((d, i, arr) => {
        if (d.y === null || Number.isNaN(d.y)) return false;
        if (i === 0) return true;

        return d.xDay - arr[i - 1].xDay < GAP_DAYS;
      })
      .x((d) => x(d.x))
      .y((d) => y(d.y));

    svg
      .append("path")
      .attr("class", `line-year-${year}`)
      .datum(processed)
      .attr("fill", "none")
      .attr("stroke", () => {
        if (year == maxYear) {
          return "#1f77b4";
        } else {
          return "gray";
        }
      })
      .attr("stroke-width", () => {
        if (year == maxYear) {
          return "2";
        } else {
          return "0.5";
        }
      })
      .attr("stroke-opacity", () => {
        if (year == maxYear) {
          return "1";
        } else {
          return "0.5";
        }
      })
      .attr("d", line);
  }

  if (drawAxes) {
    const g = svg.append("g").attr("class", "axes");

    // X axis (bottom)
    g.append("g")
      .attr("transform", `translate(0,${innerHeight + margin.top})`)
      .call(
        d3.axisBottom(x).tickFormat((d) => {
          const month = (d.getMonth() + startMonth) % 12;
          return months[month];
        }),
      );

    // Y axis (left)
    g.append("g")
      .call(d3.axisLeft(y))
      .attr("transform", `translate(${margin.left}, 0)`);
  }

  console.log(processed)
  svg
    .append("line")
    .attr("x1", x(processedBeforeSort[0].x))
    .attr("y1", y(0))
    .attr("x2", x(processedBeforeSort[0].x))
    .attr("y2", y(maxVal))
    .attr("stroke", "black")
    .attr("stroke-width", 1)
    .style("stroke-dasharray", "3, 3");

  const last2 = processedBeforeSort.slice(-2).filter((d) => d.y !== null);
  const trend = trendStrict(last2.map((d) => d.y));

  svg
    .append("path")
    .datum(last2)
    .attr("fill", "none")
    .attr("stroke", trend === 1 ? "red" : trend === -1 ? "green" : "gray")
    .attr("stroke-width", 3)
    .attr("d", line);

  svg
    .append("circle")
    .attr("cx", x(processedBeforeSort.slice(-1)[0].x))
    .attr("cy", y(processedBeforeSort.slice(-1)[0].y))
    .attr("r", 3)
    .attr("stroke", "black")
    .attr("fill", trend === 1 ? "red" : trend === -1 ? "green" : "gray");

  return { yearlySplittedDateInfo, trend };
}
