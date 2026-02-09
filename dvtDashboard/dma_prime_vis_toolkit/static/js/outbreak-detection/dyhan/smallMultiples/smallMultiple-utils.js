export const unitHeight = 50;
export function highlightSmallMultipleUnit(smallMultipleID) {
  let selection = d3.select(smallMultipleID);

  deHighlightSmallMultipleUnit();

  if (!selection.empty()) {
    let container = selection.node().parentNode;
    container.scrollIntoView({ behavior: "instant", block: "start" });

    selection.style("box-shadow", "0 0.2rem 0.2rem #F56600");

    selection
      .select("text")
      .style("font-weight", "bold")
      .style("fill", "#F56600");
  }
}

export function deHighlightSmallMultipleUnit() {
  d3.selectAll(".small-multiple-unit").style("box-shadow", "none");
  d3.selectAll(".small-multiple-unit")
    .select("text")
    .style("font-weight", "normal")
    .style("fill", "black");
}

export const pin_icon_path =
  "M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146zm.122 2.112v-.002.002zm0-.002v.002a.5.5 0 0 1-.122.51L6.293 6.878a.5.5 0 0 1-.511.12H5.78l-.014-.004a4.507 4.507 0 0 0-.288-.076 4.922 4.922 0 0 0-.765-.116c-.422-.028-.836.008-1.175.15l5.51 5.509c.141-.34.177-.753.149-1.175a4.924 4.924 0 0 0-.192-1.054l-.004-.013v-.001a.5.5 0 0 1 .12-.512l3.536-3.535a.5.5 0 0 1 .532-.115l.096.022c.087.017.208.034.344.034.114 0 .23-.011.343-.04L9.927 2.028c-.029.113-.04.23-.04.343a1.779 1.779 0 0 0 .062.46z";

export const expansion_icon_path =
  "M5 5 L9 5 L7.6 6.4 L11 9.8 L9.8 11 L6.4 7.6 L5 9 Z " +
  "M19 5 L15 5 L16.4 6.4 L13 9.8 L14.2 11 L17.6 7.6 L19 9 Z " +
  "M19 19 L19 15 L17.6 16.4 L14.2 13 L13 14.2 L16.4 17.6 L15 19 Z " +
  "M5 19 L5 15 L6.4 16.4 L9.8 13 L11 14.2 L7.6 17.6 L9 19 Z";

export function getCombinedBBox(...nodes) {
  // nodes: array of D3 selections or DOM/SVG nodes
  const bboxes = nodes.map((n) => (n.node ? n.node().getBBox() : n.getBBox()));

  const minX = Math.min(...bboxes.map((b) => b.x));
  const maxX = Math.max(...bboxes.map((b) => b.x + b.width));
  const minY = Math.min(...bboxes.map((b) => b.y));
  const maxY = Math.max(...bboxes.map((b) => b.y + b.height));

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function moveSmallMultipleUnitToROI(smallMultipleROI, featureID) {
  const key = featureID.replaceAll(" ", "-");

  // 1) Original wrapper div (DOM node)
  const originalWrapper = smallMultipleROI.node().parentNode;

  // 2) Clone wrapper + its children (deep clone)
  const clonedWrapper = originalWrapper.cloneNode(true);

  // Mark clone so we can distinguish it from the original
  clonedWrapper.classList.add("roi-clone");

  // 3) Optionally give the cloned SVG a new id
  d3.select(clonedWrapper)
    .select("svg")
    .attr("id", `cloned-small-multiple-${key}`);

  // 4) Append cloned block into ROI container
  const roiContainer = document.getElementById(
    "respiratory-smallMultiples-region-of-interest",
  );
  roiContainer.appendChild(clonedWrapper);

  // 5) Now: access ORIGINAL vs CLONE separately

  // Original: inside the main container, NOT a clone
  const originalSelection = d3.select(`#small-multiple-${key}`);

  // Clone: inside the ROI container, has .roi-clone
  const cloneSelection = d3.select(`#cloned-small-multiple-${key}`);

  originalSelection.select(".pin-feature").attr("stroke", "red");
  cloneSelection
    .on("mouseover", () => {
      originalSelection.node().dispatchEvent(new MouseEvent("mouseover"));
    })
    .on("mouseout", () => {
      originalSelection.node().dispatchEvent(new MouseEvent("mouseout"));
    }); // disable hover effect on clone
  cloneSelection.select(".pin-feature").attr("stroke", "red");

  cloneSelection.select(".pin-button").on("click", function () {
    // resetSmallMultipleUnitPosition(featureID);
    originalSelection
      .select(".pin-button")
      .node()
      .dispatchEvent(new MouseEvent("click"));
  });

  let numberOfChildren = roiContainer.childElementCount;
  document.getElementById("respiratory-smallMultiples-container").style.height =
    `calc(82% - ${numberOfChildren * unitHeight}px)`;
}

export function resetSmallMultipleUnitPosition(featureID) {
  const key = featureID.replaceAll(" ", "-");

  // Remove the cloned element from ROI container
  const roiContainer = document.getElementById(
    "respiratory-smallMultiples-region-of-interest",
  );
  const clonedElement = document.querySelector(`#cloned-small-multiple-${key}`);
  if (clonedElement) {
    roiContainer.removeChild(clonedElement.parentNode);
  }

  // Reset original element
  const originalSelection = d3.select(`#small-multiple-${key}`);
  originalSelection.select(".pin-feature").attr("stroke", "gray");
  originalSelection.attr("isROI", "false");

  let numberOfChildren = roiContainer.childElementCount;
  document.getElementById("respiratory-smallMultiples-container").style.height =
    `calc(82% - ${numberOfChildren * unitHeight}px)`;
}

function getDaysInYear(year) {
  return (new Date(year + 1, 0, 1) - new Date(year, 0, 1)) / 86400000;
}

function parseYMD(v) {
  if (v instanceof Date) return v;

  const s = String(v).trim();

  // If ISO like "2026-02-09T00:00:00.000Z", keep only the date part
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);

  // Last resort: let JS try (works for many formats, but not guaranteed)
  const d = new Date(s);
  return d;
}


export function buildRotatedSeriesForYear({
  year,
  indices,
  dataValues,
  dateInfo,
  startMonth,
}) {
  const yNum = +year;
  const yearStart = new Date(yNum, 0, 1);
  const startDate = new Date(yNum, startMonth, 1);
  const daysInYear = getDaysInYear(yNum);
  const startOffsetDays = d3.timeDay.count(yearStart, startDate);

  // Build points with rotated day index (0..daysInYear-1), and keep a Date for scaleTime
  const pts = indices.map((idx) => {
    const val = dataValues[idx];

    const [yy, mm, dd] = String(dateInfo[idx]).split("-").map(Number);

    // Use the REAL year so leap years are respected for day-of-year
    const realDate = parseYMD(dateInfo[idx]);

    const doy = d3.timeDay.count(yearStart, realDate); // 0..daysInYear-1

    // console.log(doy)
    let rotated = doy - startOffsetDays;
    // console.log(rotated)

    if (rotated < 0) rotated += daysInYear; // shift into [0, daysInYear)

    return {
      xDay: rotated, // numeric day index in rotated year
      x: d3.timeDay.offset(yearStart, rotated), // Date for scaleTime
      // x: realDate, // Date for scaleTime
      y: val,
    };
  });
  
  let ptsBeforeSort = structuredClone(pts);
  // Critical: sort by rotated x so the line draws left->right and avoids a wrap loop
  pts.sort((a, b) => a.xDay - b.xDay);
// console.log(pts)
  return { pts, ptsBeforeSort, yearStart, daysInYear };
}
