import {
  getBoundsOfCoords,
  drawStateHospitalizations,
  drawLargeStateHospitalizations,
} from "/static/js/respiratory/script.js";

import {
  drawTooltip,
  closePopupAndClearSelection,
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

const MAP_CENTER = [-81, 33.65];
const MAP_ZOOM = 7;

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

function ensurePopupButtons(dataObject) {
  const popupContent = d3.select("div.maplibregl-popup-content");

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
      .on("click", () => {
        window.open(
          `/respiratory-model-exploration?disease=${mapDiseaseSelector.value}&geographic-unit=${mapGeographicUnitSelector.value}&population=${mapPopulationSelector.value}&outcome-variable=${mapOutcomeVariableSelector.value}&location=${dataObject.properties.id}&data_version=${metadata.data_version}`,
        );
      });
  }
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

  popup.setLngLat(coordinates).setHTML(`
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

  dataVersion++;
  redraw();
}

popup.on("close", () => {
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
  } catch (e) {
    console.log(e);
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

  if (selectedItems.feature) {
    updateMapTooltip(selectedItems.feature.properties);
  }

  dataVersion++;
  redraw();
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
});

mapFacilityUnitSelector.addEventListener("change", async () => {
  const facilityUnitSelected = document.querySelector(
    'input[name="facilityOptionGroup"]:checked',
  )?.value;

  if (facilityUnitSelected == "individual-unit") {
    document.getElementById("map-shape-legend").style.display = "";
  } else {
    document.getElementById("map-shape-legend").style.display = "none";
  }

  syncHospitalIconToggle();
  dataVersion++;
  redraw(true, true);
});

mapGeographicUnitSelector.addEventListener("sl-change", async () => {
  await updateMapPopulationOptions();
  mapGeographicUnit = mapGeographicUnitSelector.value;

  closePopupAndClearSelection();
  setFilterPlaceholder();
  syncHospitalIconToggle();

  dataVersion++;
  redraw(true, true);
});

mapPopulationSelector.addEventListener("sl-change", async () => {
  await updateMapOutcomeVariableOptions();
  mapPopulation = mapPopulationSelector.value;

  if (selectedItems.feature) {
    updateMapTooltip(selectedItems.feature.properties);
  }

  dataVersion++;
  redraw(true);
});

mapOutcomeVariableSelector.addEventListener("sl-change", () => {
  mapOutcomeVariable = mapOutcomeVariableSelector.value;

  if (selectedItems.feature) {
    updateMapTooltip(selectedItems.feature.properties);
  }

  dataVersion++;
  redraw(true);
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
