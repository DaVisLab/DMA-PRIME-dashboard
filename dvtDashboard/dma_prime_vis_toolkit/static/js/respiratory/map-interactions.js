import {
  getBoundsOfCoords,
  drawStateHospitalizations,
  drawLargeStateHospitalizations,
} from "/static/js/respiratory/script.js";

import {
  drawTooltip,
} from "/static/js/respiratory/tooltip.js";

import {
  map,
  popup,
  deckOverlay,
  selectedItems,
  redraw,
  updateMapTooltip,
  updateMapOutcomeVariableOptions,
  updateMapPopulationOptions,
  updateMapGeographicUnitOptions,
} from "/static/js/respiratory/map.js";

import {
  setGridDiseaseSelectorValue,
  setGridGeographicUnitSelectorValue,
  setGridPopulationSelectorValue,
  setGridOutcomeVariableSelectorValue,
  setGridFacilityUnitSelectorValue,
  setGridTypeSwitchValue,
} from "/static/js/respiratory/grid-interactions.js";
import { getRespiratoryModelDataSrc } from "/static/js/respiratory/utils/controlState_utils.js";

const MAP_CENTER = [-81, 33.65];
const MAP_ZOOM = 7;
const MODEL_EXPLORATION_PREFETCH_ID = "model-exploration-prefetch";
const POPUP_BOUNDARY_PADDING_PX = 8;
const POPUP_TIP_SIZE_PX = 10;
let prefetchedModelDataUrl = null;
let popupMapMoveListenerAttached = false;
const popupDragState = {
  dragStart: null,
  isDragging: false,
  offset: [0, 0],
  originLngLat: null,
  wasDragPanEnabled: true,
};

function resetMapView() {
  map.flyTo({
    center: MAP_CENTER,
    zoom: MAP_ZOOM,
    essential: true,
  });
}

function syncHospitalIconToggle() {
  const isFacility = mapGeographicUnitSelector.value === "facility";

  if (isFacility) {
    hospitalIconsToggle.checked = false;
    selectedItems.icons = selectedItems.icons.filter(
      (check) => check !== "hospital",
    );
    d3.select(hospitalIconsToggle).attr("disabled", "");
  } else {
    d3.select(hospitalIconsToggle).attr("disabled", null);
  }
}

function setFilterPlaceholder() {
  const filterInput = document.getElementById("filterInput");

  if (mapGeographicUnitSelector.value === "zcta") {
    filterInput.placeholder = "ZCTA";
    return;
  }

  filterInput.placeholder =
    mapGeographicUnitSelector.value.charAt(0).toUpperCase() +
    mapGeographicUnitSelector.value.slice(1);
}

function syncIconSelection(toggle, iconName) {
  selectedItems.icons = selectedItems.icons.filter(
    (check) => check !== iconName,
  );

  if (toggle.checked) {
    selectedItems.icons.push(iconName);
  }
}

function getModelExplorationParams(dataObject) {
  return {
    disease: mapDiseaseSelector.value,
    "geographic-unit": mapGeographicUnitSelector.value,
    population: mapPopulationSelector.value,
    "outcome-variable": mapOutcomeVariableSelector.value,
    location: dataObject.properties.id,
    data_version: metadata.data_version,
  };
}

function getModelExplorationUrl(dataObject) {
  return `/respiratory-model-exploration?${new URLSearchParams(
    getModelExplorationParams(dataObject),
  ).toString()}`;
}

function getModelDataUrl(dataObject) {
  const params = getModelExplorationParams(dataObject);

  return getRespiratoryModelDataSrc({
    metadata,
    disease: params.disease,
    geographicUnit: params["geographic-unit"],
    population: params.population,
    outcomeVariable: params["outcome-variable"],
    location: params.location,
    dataVersion: params.data_version,
  });
}

function prefetchModelExploration(dataObject) {
  const explorationUrl = getModelExplorationUrl(dataObject);
  const dataUrl = getModelDataUrl(dataObject);

  let prefetchLink = document.getElementById(MODEL_EXPLORATION_PREFETCH_ID);
  if (!prefetchLink) {
    prefetchLink = document.createElement("link");
    prefetchLink.id = MODEL_EXPLORATION_PREFETCH_ID;
    prefetchLink.rel = "prefetch";
    prefetchLink.as = "document";
    document.head.appendChild(prefetchLink);
  }
  prefetchLink.href = explorationUrl;

  if (!dataUrl) return;
  if (prefetchedModelDataUrl === dataUrl) return;
  prefetchedModelDataUrl = dataUrl;

  const runPrefetch = () => {
    fetch(dataUrl, { credentials: "same-origin", cache: "force-cache" }).catch(
      () => {},
    );
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(runPrefetch, { timeout: 1500 });
  } else {
    window.setTimeout(runPrefetch, 0);
  }
}

function openModelExploration(dataObject) {
  window.open(
    getModelExplorationUrl(dataObject),
    "_blank",
    "noopener,noreferrer",
  );
}

function ensurePopupButtons(dataObject) {
  const popupContent = d3.select("div.maplibregl-popup-content");
  prefetchModelExploration(dataObject);

  if (popupContent.select(".expand-icon-button").empty()) {
    popupContent
      .append("sl-icon-button")
      .attr("class", "expand-icon-button")
      .attr("name", "zoom-in")
      .style("position", "absolute")
      .style("font-size", "1rem")
      .style("right", "18px")
      .style("top", "0px")
      .style("color", "black")
      .style("cursor", "pointer")
      .on("click", () => {
        // d3.select("#expand-tooltip-btn")
        const el = document.getElementById("expand-tooltip-btn");

        if (el) {
          el.click();
        }
      });
  }

  if (popupContent.select(".model-exploration-icon-button").empty()) {
    popupContent
      .append("sl-icon-button")
      .attr("class", "model-exploration-icon-button")
      .attr("name", "info-circle")
      .style("position", "absolute")
      .style("font-size", "1rem")
      .style("right", "40px")
      .style("top", "0px")
      .style("color", "black")
      .style("cursor", "pointer")
      .on("pointerenter focus", () => {
        prefetchModelExploration(dataObject);
      })
      .on("click", () => {
        openModelExploration(dataObject);
      });
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getPopupContentElement() {
  return popup.getElement()?.querySelector(".maplibregl-popup-content") || null;
}

function getPopupTipElement() {
  return popup.getElement()?.querySelector(".maplibregl-popup-tip") || null;
}

function getSourceClientPoint() {
  if (!popupDragState.originLngLat) return null;

  const mapRect = mapDiv.getBoundingClientRect();
  const projectedPoint = map.project(popupDragState.originLngLat);

  return {
    x: mapRect.left + projectedPoint.x,
    y: mapRect.top + projectedPoint.y,
  };
}

function getPopupTipSide(sourcePoint, contentRect) {
  const outsideLeft = sourcePoint.x < contentRect.left;
  const outsideRight = sourcePoint.x > contentRect.right;
  const outsideTop = sourcePoint.y < contentRect.top;
  const outsideBottom = sourcePoint.y > contentRect.bottom;
  const horizontalDistance = outsideLeft
    ? contentRect.left - sourcePoint.x
    : outsideRight
      ? sourcePoint.x - contentRect.right
      : 0;
  const verticalDistance = outsideTop
    ? contentRect.top - sourcePoint.y
    : outsideBottom
      ? sourcePoint.y - contentRect.bottom
      : 0;

  if (verticalDistance || horizontalDistance) {
    if (verticalDistance >= horizontalDistance) {
      return outsideTop ? "top" : "bottom";
    }

    return outsideLeft ? "left" : "right";
  }

  const distances = [
    { side: "top", value: Math.abs(sourcePoint.y - contentRect.top) },
    { side: "bottom", value: Math.abs(contentRect.bottom - sourcePoint.y) },
    { side: "left", value: Math.abs(sourcePoint.x - contentRect.left) },
    { side: "right", value: Math.abs(contentRect.right - sourcePoint.x) },
  ];

  return distances.sort((a, b) => a.value - b.value)[0].side;
}

function resetPopupTipStyle(tip) {
  Object.assign(tip.style, {
    position: "absolute",
    width: "0",
    height: "0",
    margin: "0",
    border: "0",
    pointerEvents: "none",
  });
}

function updatePopupTipPosition() {
  const popupElement = popup.getElement();
  const content = getPopupContentElement();
  const tip = getPopupTipElement();
  const sourcePoint = getSourceClientPoint();

  if (!popupElement || !content || !tip || !sourcePoint) return;

  const popupRect = popupElement.getBoundingClientRect();
  const contentRect = content.getBoundingClientRect();
  const tipSize = POPUP_TIP_SIZE_PX;
  const side = getPopupTipSide(sourcePoint, contentRect);
  const minX = contentRect.left - popupRect.left + tipSize;
  const maxX = contentRect.right - popupRect.left - tipSize;
  const minY = contentRect.top - popupRect.top + tipSize;
  const maxY = contentRect.bottom - popupRect.top - tipSize;

  resetPopupTipStyle(tip);

  if (side === "top" || side === "bottom") {
    tip.style.left = `${clamp(sourcePoint.x - popupRect.left, minX, maxX)}px`;
    tip.style.top =
      side === "top"
        ? `${contentRect.top - popupRect.top}px`
        : `${contentRect.bottom - popupRect.top}px`;
    tip.style.transform =
      side === "top" ? "translate(-50%, -100%)" : "translate(-50%, 0)";
    tip.style.borderLeft = `${tipSize}px solid transparent`;
    tip.style.borderRight = `${tipSize}px solid transparent`;
    tip.style[side === "top" ? "borderBottom" : "borderTop"] =
      `${tipSize}px solid white`;
    return;
  }

  tip.style.left =
    side === "left"
      ? `${contentRect.left - popupRect.left}px`
      : `${contentRect.right - popupRect.left}px`;
  tip.style.top = `${clamp(sourcePoint.y - popupRect.top, minY, maxY)}px`;
  tip.style.transform =
    side === "left" ? "translate(-100%, -50%)" : "translate(0, -50%)";
  tip.style.borderTop = `${tipSize}px solid transparent`;
  tip.style.borderBottom = `${tipSize}px solid transparent`;
  tip.style[side === "left" ? "borderRight" : "borderLeft"] =
    `${tipSize}px solid white`;
}

function schedulePopupTipUpdate() {
  requestAnimationFrame(updatePopupTipPosition);
}

function constrainPopupOffset(nextOffset) {
  const content = getPopupContentElement();

  if (!content) return nextOffset;

  const mapRect = mapDiv.getBoundingClientRect();
  const contentRect = content.getBoundingClientRect();
  let deltaX = nextOffset[0] - popupDragState.offset[0];
  let deltaY = nextOffset[1] - popupDragState.offset[1];
  const minLeft = mapRect.left + POPUP_BOUNDARY_PADDING_PX;
  const maxRight = mapRect.right - POPUP_BOUNDARY_PADDING_PX;
  const minTop = mapRect.top + POPUP_BOUNDARY_PADDING_PX;
  const maxBottom = mapRect.bottom - POPUP_BOUNDARY_PADDING_PX;

  if (contentRect.left + deltaX < minLeft) {
    deltaX += minLeft - (contentRect.left + deltaX);
  }

  if (contentRect.right + deltaX > maxRight) {
    deltaX -= contentRect.right + deltaX - maxRight;
  }

  if (contentRect.top + deltaY < minTop) {
    deltaY += minTop - (contentRect.top + deltaY);
  }

  if (contentRect.bottom + deltaY > maxBottom) {
    deltaY -= contentRect.bottom + deltaY - maxBottom;
  }

  return [popupDragState.offset[0] + deltaX, popupDragState.offset[1] + deltaY];
}

function setPopupDragOffset(nextOffset) {
  popupDragState.offset = constrainPopupOffset(nextOffset);
  popup.setOffset(popupDragState.offset);
  schedulePopupTipUpdate();
}

function stopPopupDrag() {
  const header = popup.getElement()?.querySelector(".tooltip-header");
  const wasDragging = popupDragState.isDragging;

  popupDragState.isDragging = false;
  popupDragState.dragStart = null;
  header?.classList.remove("map-tooltip-dragging");

  if (wasDragging && popupDragState.wasDragPanEnabled) {
    map.dragPan.enable();
  }

  document.removeEventListener("pointermove", handlePopupDragMove);
  document.removeEventListener("pointerup", stopPopupDrag);
  document.removeEventListener("pointercancel", stopPopupDrag);
}

function handlePopupDragMove(event) {
  if (!popupDragState.isDragging || !popupDragState.dragStart) return;

  event.preventDefault();
  event.stopPropagation();

  const dragStart = popupDragState.dragStart;
  const nextOffset = [
    dragStart.offset[0] + event.clientX - dragStart.x,
    dragStart.offset[1] + event.clientY - dragStart.y,
  ];

  setPopupDragOffset(nextOffset);
}

function startPopupDrag(event) {
  if (event.button !== 0 && event.pointerType !== "touch") return;
  if (
    event.target.closest("button, sl-icon-button, a, input, select, textarea")
  ) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  popupDragState.isDragging = true;
  popupDragState.wasDragPanEnabled = map.dragPan.isEnabled?.() ?? true;
  popupDragState.dragStart = {
    x: event.clientX,
    y: event.clientY,
    offset: [...popupDragState.offset],
  };

  map.dragPan.disable();
  event.currentTarget.classList.add("map-tooltip-dragging");

  document.addEventListener("pointermove", handlePopupDragMove, {
    passive: false,
  });
  document.addEventListener("pointerup", stopPopupDrag);
  document.addEventListener("pointercancel", stopPopupDrag);
}

function attachPopupDragBehavior(originLngLat) {
  popupDragState.originLngLat = originLngLat;
  popupDragState.offset = [0, 0];
  popup.setOffset(popupDragState.offset);

  const popupElement = popup.getElement();
  const header = popupElement?.querySelector(".tooltip-header");

  popupElement?.classList.add("map-tooltip-draggable");
  header?.classList.add("map-tooltip-drag-handle");

  if (header && !header.dataset.dragHandleReady) {
    header.dataset.dragHandleReady = "true";
    header.addEventListener("pointerdown", startPopupDrag);
  }

  if (!popupMapMoveListenerAttached) {
    map.on("move", schedulePopupTipUpdate);
    map.on("resize", schedulePopupTipUpdate);
    popupMapMoveListenerAttached = true;
  }

  schedulePopupTipUpdate();
}

function closePopupAndClearSelection() {
  selectedItems.feature = undefined;
  if (popup.isOpen()) popup.remove();
}

export function showMapTooltip(dataObject) {
  const width = mapDiv.clientWidth;
  const mapTooltipWidth = Math.max(500, width * 0.3);
  const mapTooltipHeight = mapTooltipWidth * 0.65;

  if (dataObject == null) {
    closePopupAndClearSelection();
    return;
  }

  if (
    selectedItems.feature &&
    selectedItems.feature.properties.id === dataObject.properties.id
  ) {
    closePopupAndClearSelection();
    resetMapView();
    return;
  }

  selectedItems.feature = dataObject;

  console.log(dataObject)

  const bounds = getBoundsOfCoords(dataObject.geometry.coordinates);

  map.fitBounds(bounds, {
    padding: Math.min(mapDiv.clientWidth / 3, mapDiv.clientHeight / 3),
    maxZoom: 12,
    screenSpeed: 0.7,
    offset: [0, -mapTooltipHeight / 3],
  });

  let coordinates = [
    dataObject.properties.INTPTLON,
    dataObject.properties.INTPTLAT,
  ];

  if (!(coordinates[0] && coordinates[1])) {
    coordinates = bounds.getCenter();
  }

  popup.setLngLat(coordinates).setOffset([0, 0]).setHTML(`
      <div id="map-tooltip-div" class="tooltip-div">
        <div class="tooltip-header">
          <div class="tooltip-region-info"></div>
          <div class="tooltip-data-info"></div>
        </div>
        <svg id="map-tooltip-svg" class="tooltip-outer-svg"></svg>
        <div class="tooltip-footer">
          <div class="tooltip-legend"></div>
          <div class="tooltip-options"></div>
        </div>
      </div>
    `);

  if (!popup.isOpen()) {
    popup.addTo(map);
  }

  popup.setMaxWidth(`${mapDiv.clientWidth}px`);

  const ttpDiv = d3
    .select("#map-tooltip-div")
    .style("display", "initial")
    .style("border-style", "none");

  const ttpSVG = ttpDiv
    .select(".tooltip-outer-svg")
    .attr("width", mapTooltipWidth)
    .attr("height", mapTooltipHeight);

  drawTooltip(
    dataObject.properties,
    ttpSVG,
    ttpDiv.select(".tooltip-header"),
    ttpDiv.select(".tooltip-footer"),
    mapPopulationSelector.value,
    mapOutcomeVariableSelector.value,
    mapTypeSwitch.value,
    false,
    false,
    [],
  );

  requestAnimationFrame(() => {
    const optionsWidth = d3.select(".tooltip-options").node().clientWidth;
    const svgWidth = ttpSVG.node().getBoundingClientRect().width;

    ttpSVG.style(
      "transform",
      `translate(${(optionsWidth - svgWidth) / 2}px, 0px)`,
    );
  });

  ensurePopupButtons(dataObject);
  attachPopupDragBehavior(coordinates);

  dataVersion++;
  redraw();
}

popup.on("close", () => {
  stopPopupDrag();
  popupDragState.originLngLat = null;
  popupDragState.offset = [0, 0];
  selectedItems.feature = undefined;
  dataVersion++;
  redraw(false, false, true);
});


map.on("zoom", () => {
  if (mapGeographicUnitSelector.value === "zcta") {
    redraw();
  }
});

map.on("click", (e) => {
  try {
    const temp = { x: e.point.x, y: e.point.y };
    const dataObject = deckOverlay.pickObject(temp).object;

    showMapTooltip(dataObject);
  } catch (error) {
    closePopupAndClearSelection();
    dataVersion++;
    redraw(false, false, true);
  }
});

mapResetButton.addEventListener("click", () => {
  resetMapView();
  closePopupAndClearSelection();
  dataVersion++;
  redraw();
});

mapTypeSwitch.addEventListener("sl-change", () => {
  drawStateHospitalizations(
    mapDiseaseSelector.value,
    mapTypeSwitch.value,
    mapStateHospitalizationsSvg,
    mapStateHospitalizationsSubtitle,
  );

  closePopupAndClearSelection();

  dataVersion++;
  redraw();

  setGridTypeSwitchValue(mapTypeSwitch.value);
});

mapDiseaseSelector.addEventListener("sl-change", async () => {
  await updateMapGeographicUnitOptions();

  drawStateHospitalizations(
    mapDiseaseSelector.value,
    mapTypeSwitch.value,
    mapStateHospitalizationsSvg,
    mapStateHospitalizationsSubtitle,
  );

  closePopupAndClearSelection();
  dataVersion++;
  redraw(true, true);

  // update grid view
  setGridDiseaseSelectorValue(mapDiseaseSelector.value);
});

mapFacilityUnitSelector.addEventListener("change", async () => {
  const facilityUnitSelected = document.querySelector(
    'input[name="map-facilityOptionGroup"]:checked',
  )?.value;

  if (facilityUnitSelected == "individual-unit") {
    document.getElementById("map-shape-legend").style.display = "";
  } else {
    document.getElementById("map-shape-legend").style.display = "none";
  }

  syncHospitalIconToggle();
  dataVersion++;
  redraw(true, true);

  // update grid view
  setGridFacilityUnitSelectorValue(facilityUnitSelected);
});

mapGeographicUnitSelector.addEventListener("sl-change", async () => {
  await updateMapPopulationOptions();
  mapGeographicUnit = mapGeographicUnitSelector.value;

  closePopupAndClearSelection();
  setFilterPlaceholder();
  syncHospitalIconToggle();

  dataVersion++;
  redraw(true, true);

  // update grid view
  setGridGeographicUnitSelectorValue(mapGeographicUnit);
});

mapPopulationSelector.addEventListener("sl-change", async () => {
  await updateMapOutcomeVariableOptions();
  mapPopulation = mapPopulationSelector.value;

  if (selectedItems.feature) {
    updateMapTooltip(selectedItems.feature.properties);
  }

  dataVersion++;
  redraw(true);

  // update grid view
  setGridPopulationSelectorValue(mapPopulation);
});

mapOutcomeVariableSelector.addEventListener("sl-change", () => {
  mapOutcomeVariable = mapOutcomeVariableSelector.value;

  if (selectedItems.feature) {
    updateMapTooltip(selectedItems.feature.properties);
  }

  dataVersion++;
  redraw(true);

  // update grid view
  setGridOutcomeVariableSelectorValue(mapOutcomeVariable);
});

mapIncludeImputations.addEventListener("sl-change", () => {
  dataVersion++;
  redraw();
});

mapOptionsGeographicLabelsToggle.addEventListener("sl-change", () => {
  dataVersion++;
  redraw();
});

hospitalIconsToggle.addEventListener("sl-change", () => {
  syncIconSelection(hospitalIconsToggle, "hospital");
  dataVersion++;
  redraw();
});

mobileClinicIconsToggle.addEventListener("sl-change", () => {
  syncIconSelection(mobileClinicIconsToggle, "mobile_health_clinic");
  dataVersion++;
  redraw();
});

communityPartnerIconsToggle.addEventListener("sl-change", () => {
  syncIconSelection(communityPartnerIconsToggle, "community_partner");
  dataVersion++;
  redraw();
});

mapStateHospitalizationsResizer.addEventListener("sl-resize", () => {
  drawStateHospitalizations(
    mapDiseaseSelector.value,
    mapTypeSwitch.value,
    mapStateHospitalizationsSvg,
    mapStateHospitalizationsSubtitle,
  );
});

mapStateHospitalizationsSvg.addEventListener("click", () => {
  mapStateHospitalizationsLarge.show();
});

mapStateHospitalizationsLargeResizer.addEventListener("sl-resize", () => {
  drawLargeStateHospitalizations(
    mapDiseaseSelector.value,
    mapTypeSwitch.value,
    mapStateHospitalizationsLargeSvg,
    mapStateHospitalizationsLargeSubtitle,
  );
});

export function setMapDiseaseSelectorValue(value) {
  if (value == mapDiseaseSelector.value) return;

  mapDiseaseSelector.value = value;
  mapDiseaseSelector.dispatchEvent(
    new CustomEvent("sl-change", {
      bubbles: true,
    }),
  );
}

export function setMapGeographicUnitSelectorValue(value) {
  if (value == mapGeographicUnitSelector.value) return;

  mapGeographicUnitSelector.value = value;
  mapGeographicUnitSelector.dispatchEvent(
    new CustomEvent("sl-change", {
      bubbles: true,
    }),
  );
}

export function setMapPopulationSelectorValue(value) {
  if (value == mapPopulationSelector.value) return;

  mapPopulationSelector.value = value;
  mapPopulationSelector.dispatchEvent(
    new CustomEvent("sl-change", {
      bubbles: true,
    }),
  );
}

export function setMapOutcomeVariableSelectorValue(value) {
  if (value == mapOutcomeVariableSelector.value) return;

  mapOutcomeVariableSelector.value = value;
  mapOutcomeVariableSelector.dispatchEvent(
    new CustomEvent("sl-change", {
      bubbles: true,
    }),
  );
}

export function setMapFacilityUnitSelectorValue(value) {
  const facilityUnitSelected = document.querySelector(
    'input[name="map-facilityOptionGroup"]:checked',
  )?.value;

  if (value == facilityUnitSelected) return;

  const facilityOption = document.getElementById(`map-facility-option-${value}`);
  if (!facilityOption) return;

  facilityOption.checked = true;

  mapFacilityUnitSelector.dispatchEvent(
    new CustomEvent("change", {
      bubbles: true,
    }),
  );
}

export function setMapTypeSwitchValue(value) {
  if (value == mapTypeSwitch.value) return;

  mapTypeSwitch.value = value;
  mapTypeSwitch.dispatchEvent(
    new CustomEvent("sl-change", {
      bubbles: true,
    }),
  );
}
