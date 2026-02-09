// import { drawingSmallMultipleUnit } from "./smallMultiples/smallMultiples-main.js";

import { drawLineChartByYearSplited } from "./drawLineChartByYearSplited.js";
const popup = document.getElementById("popupWindow");
const popupContent = document.getElementById("popupContent");
const popupClose = document.getElementById("popupClose");

const popupTitle = document.getElementById("popupTitle");
const yearComponentDiv = document.getElementById("yearComponent");

export function showPopupLineChart(data, dateInfo) {
  //   popupContent.innerHTML = html;
  const margin = { top: 50, right: 30, bottom: 50, left: 50 };

  popup.style.display = "block";
  popupTitle.textContent = data.name;
  console.log(data);
  const startMonth = +document.getElementById("popupMonthRange").value;

  const svg = d3.select("#popupChartSVG");
  svg.selectAll("*").remove();

  const { yearlySplittedDateInfo, _ } = drawLineChartByYearSplited(
    svg,
    data,
    dateInfo,
    startMonth,
    margin,
    true,
  );

  yearComponent.innerHTML = ""; // Clear previous content

  const years = Object.keys(yearlySplittedDateInfo).sort((a, b) => b - a);
  const maxYear = Math.max(...years);
  const yearColor = d3
    .scaleOrdinal()
    .domain(years) // important: set domain to your years list
    .range(d3.schemeTableau10); // or d3.schemeCategory10

  years.forEach((year) => {
    const yearDiv = document.createElement("div");
    yearDiv.style.display = "flex";
    yearDiv.style.alignItems = "center";
    yearDiv.style.cursor = "pointer";
    yearDiv.setAttribute("show", `true`);

    yearDiv.addEventListener("mouseover", () => {
      svg
        .select(`.line-year-${year}`)
        .attr("stroke-width", year == maxYear ? 4 : 2);

      yearDiv.style.fontWeight = "bold";
    });

    svg
      .select(`.line-year-${year}`)
      .on("mouseover", () => {
        yearDiv.style.fontWeight = "bold";
        d3.select(`.line-year-${year}`).attr(
          "stroke-width",
          year == maxYear ? 4 : 2,
        );
      })
      .on("mouseout", () => {
        yearDiv.style.fontWeight = "normal";
        svg
          .select(`.line-year-${year}`)
          .attr("stroke-width", year == maxYear ? 2 : 0.5);
      });

    yearDiv.addEventListener("mouseout", () => {
      svg
        .select(`.line-year-${year}`)
        .attr("stroke-width", year == maxYear ? 2 : 0.5);

      yearDiv.style.fontWeight = "normal";
    });

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true; // or false
    checkbox.disabled = false;

    // optional styling
    checkbox.style.marginRight = ".5rem";
    checkbox.style.pointerEvents = "none"; // if it's just an indicator

    // svg
    //   .select(`.line-year-${year}`)
    //   .attr("stroke", yearColor(+year))
    //   .attr("stroke-opacity", 1);

    // year label
    const label = document.createElement("span");
    label.textContent = year;

    yearDiv.appendChild(checkbox);
    yearDiv.appendChild(label);

    yearComponentDiv.appendChild(yearDiv);

    yearDiv.addEventListener("click", () => {
      console.log(`Year ${year} clicked`);
      const isShown = yearDiv.getAttribute("show") === "true";

      if (isShown) {
        svg.select(`.line-year-${year}`).attr("stroke-opacity", 0);
        label.style.opacity = 0.5;
        checkbox.checked = false; // or false
        // dot.style.opacity = 0.5;
        yearDiv.setAttribute("show", "false");
      } else {
        svg.select(`.line-year-${year}`).attr("stroke-opacity", 1);
        label.style.opacity = 1;
        checkbox.checked = true; // or false
        // dot.style.opacity = 1;
        yearDiv.setAttribute("show", "true");
      }
      // Optional: Add any click interaction you want here
    });
  });
  console.log(yearlySplittedDateInfo);
}

function hidePopup() {
  popup.style.display = "none";
}

popupClose.addEventListener("click", (e) => {
  e.stopPropagation();
  hidePopup();
});
