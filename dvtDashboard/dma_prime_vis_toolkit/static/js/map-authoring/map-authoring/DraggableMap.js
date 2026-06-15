import {
  getAbbreviationFromFullName,
  makeViewportCenterGetter,
  getColorTheme,
  drawColorLegend,
} from "./helper.js";

import { graphRelationship } from "./LineConnector.js";
import { getNameByMapResolution, preprocessingGeoJSON } from "./helper.js";
import {
  hideMapFeatureTooltip,
  getFeatureDisplayName,
  moveMapFeatureTooltip,
  showMapFeatureTooltip,
} from "./FeatureTooltip.js";
import {
  applyDatasetToGeojson,
  DATA_LEVELS,
  DATA_VARIABLES,
  DEFAULT_DATA_VARIABLE_ID,
  getDataVariableById,
  getDatasetLevelForGeoResolution,
  loadGeojsonWithDataset,
} from "./DataRepository.js";
import { HIERARCHY_MODE_IDS } from "./HierarchyConfig.js";

const d3 = window.d3;

const DEFAULT_VARIABLE = DEFAULT_DATA_VARIABLE_ID;
const DRAG_SPAWN_THRESHOLD = 8;
const MIN_NODE_RADIUS = 72;
const RESIZE_MAX_CANVAS_RATIO = 0.72;
const NODE_HEADER_HEIGHT = 54;
const NODE_HEADER_PAD_X = 12;
const NODE_HEADER_PAD_Y = 7;
const NODE_HEADER_MIN_WIDTH = 72;
const NODE_HEADER_MAX_WIDTH = 290;
const NODE_HEADER_CONTROL_HEIGHT = 34;
const NODE_HEADER_LEVEL_SELECT_WIDTH = 96;
const NODE_VARIABLE_SELECT_WIDTH = 150;
const NODE_VARIABLE_SELECT_HEIGHT = 32;
const CHILD_NODE_RADIUS_SCALE = 0.75;
const CHILD_NODE_AUTO_GAP = 40;
const CHILD_NODE_MIN_VISIBLE_GAP_PX = 16;
const MAP_FEATURE_STROKE = "#ffffff";
const MAP_FEATURE_STROKE_WIDTH = 1;
const NO_DATA_FEATURE_FILL = "#c8c8c8";
const MIN_LOG_COLOR_VALUE = 1e-9;
const ZCTA_PARENT_BACKGROUND_FILL = "#d8dde3";
const ZCTA_PARENT_BACKGROUND_STROKE = "#ffffff";
const ZCTA_PARENT_BACKGROUND_STROKE_WIDTH = 1.5;
const PIN_EDITOR_WIDTH = 220;
const PIN_EDITOR_HEIGHT = 150;
const ANNOTATION_PIN_PATH = [
  "M 0,0",
  "C -3,-4 -7,-9 -7,-14",
  "C -7,-19 -4,-22 0,-22",
  "C 4,-22 7,-19 7,-14",
  "C 7,-9 3,-4 0,0 Z",
].join(" ");
const ANNOTATION_PIN_DOT_CY = -14;
const ANNOTATION_PIN_DOT_RADIUS = 4.8;
const SC_SCOPE_LEVELS = Object.freeze({
  STATE: "state",
  REGION: "region",
  COUNTY: "county",
});
const DISPLAY_LEVEL_LABELS = Object.freeze({
  [DATA_LEVELS.REGION]: "regions",
  [DATA_LEVELS.COUNTY]: "counties",
  [DATA_LEVELS.ZCTA]: "ZCTAs",
});
const DISPLAY_LEVEL_TO_GEO_RESOLUTION = Object.freeze({
  [DATA_LEVELS.REGION]: "REGION",
  [DATA_LEVELS.COUNTY]: "STATE",
  [DATA_LEVELS.ZCTA]: "COUNTY",
});
const DISPLAY_LEVEL_TO_PREPROCESS_RESOLUTION = Object.freeze({
  [DATA_LEVELS.REGION]: "REGION",
  [DATA_LEVELS.COUNTY]: "STATE",
  [DATA_LEVELS.ZCTA]: "COUNTY",
});
const DISPLAY_LEVEL_OPTIONS_BY_SCOPE = Object.freeze({
  [SC_SCOPE_LEVELS.STATE]: [
    DATA_LEVELS.REGION,
    DATA_LEVELS.COUNTY,
    DATA_LEVELS.ZCTA,
  ],
  [SC_SCOPE_LEVELS.REGION]: [DATA_LEVELS.COUNTY, DATA_LEVELS.ZCTA],
  [SC_SCOPE_LEVELS.COUNTY]: [DATA_LEVELS.ZCTA],
});

function cloneGeojsonFeature(feature) {
  return {
    ...feature,
    properties: { ...(feature?.properties ?? {}) },
  };
}

function normalizeComparableId(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hasMatchingComparableId(candidateValues, selectedValues) {
  const selectedSet = new Set(
    selectedValues.map(normalizeComparableId).filter(Boolean),
  );

  return candidateValues.some((value) =>
    selectedSet.has(normalizeComparableId(value)),
  );
}

function getDisplayLevelForGeoResolution(geoResolution) {
  if (geoResolution === "REGION") return DATA_LEVELS.REGION;
  if (geoResolution === "STATE") return DATA_LEVELS.COUNTY;
  if (geoResolution === "COUNTY") return DATA_LEVELS.ZCTA;

  return DATA_LEVELS.REGION;
}

function getGeoResolutionForDisplayLevel(displayLevel) {
  return DISPLAY_LEVEL_TO_GEO_RESOLUTION[displayLevel] ?? "REGION";
}

function getPreprocessResolutionForDisplayLevel(displayLevel) {
  return DISPLAY_LEVEL_TO_PREPROCESS_RESOLUTION[displayLevel] ?? "REGION";
}

function inferSouthCarolinaScopeLevel(geoResolution, geoID) {
  if (geoResolution === "REGION" && geoID === "SC_REGIONS") {
    return SC_SCOPE_LEVELS.STATE;
  }

  if (geoResolution === "STATE") return SC_SCOPE_LEVELS.REGION;
  if (geoResolution === "COUNTY") return SC_SCOPE_LEVELS.COUNTY;

  return null;
}

function inferSouthCarolinaScopeId({
  displayLevel,
  geoID,
  geoLabel,
  scopeLevel,
}) {
  if (scopeLevel === SC_SCOPE_LEVELS.STATE) return "sc";
  if (scopeLevel === SC_SCOPE_LEVELS.REGION) {
    return normalizeComparableId(geoID ?? geoLabel);
  }
  if (scopeLevel === SC_SCOPE_LEVELS.COUNTY) {
    return normalizeComparableId(geoID ?? geoLabel);
  }

  return normalizeComparableId(geoID ?? geoLabel ?? displayLevel);
}

function inferSouthCarolinaScopeLabel({ geoID, geoLabel, scopeLevel }) {
  if (scopeLevel === SC_SCOPE_LEVELS.STATE) return "South Carolina";
  return geoLabel ?? geoID;
}

function createEmptyFeatureCollection() {
  return {
    type: "FeatureCollection",
    features: [],
  };
}

function waitForNextFrame() {
  return new Promise((resolve) => {
    const requestFrame =
      typeof window !== "undefined" &&
      typeof window.requestAnimationFrame === "function"
        ? window.requestAnimationFrame.bind(window)
        : (callback) => setTimeout(callback, 16);

    requestFrame(resolve);
  });
}

// Imperative D3 renderer for one draggable circular map instance.
export class DraggableMap {
  /**
   * Each instance renders into its own <g>.
   * @param {{
   *  manager: MapManager,
   *  geojson: any,
   *  x: number,
   *  y: number,
   *  radius: number
   *  geoResolution: string
   *  geoID: string
   *  geoLabel?: string
   *  displayLevel?: string
   *  scopeId?: string
   *  scopeLabel?: string
   *  scopeLevel?: string
   *  isLoading?: boolean
   *  backgroundGeojson?: any
   * }} args
   */
  constructor({
    manager,
    geojson,
    backgroundGeojson = null,
    x,
    y,
    radius,
    displayLevel,
    geoResolution,
    geoID,
    geoLabel,
    scopeId,
    scopeLabel,
    scopeLevel,
    isLoading = false,
    variableOfInterest,
  }) {
    this.manager = manager;
    this.geojson = geojson;
    this.backgroundGeojson = backgroundGeojson;
    this.geoResolution = geoResolution;
    this.geoID = geoID;
    this.geoLabel = geoLabel ?? geoID;
    this.displayLevel =
      displayLevel ?? getDisplayLevelForGeoResolution(geoResolution);
    this.scopeLevel =
      scopeLevel ?? inferSouthCarolinaScopeLevel(geoResolution, geoID);
    this.scopeId = scopeId ?? inferSouthCarolinaScopeId({
      displayLevel: this.displayLevel,
      geoID,
      geoLabel: this.geoLabel,
      scopeLevel: this.scopeLevel,
    });
    this.scopeLabel = scopeLabel ?? inferSouthCarolinaScopeLabel({
      geoID,
      geoLabel: this.geoLabel,
      scopeLevel: this.scopeLevel,
    });

    const uniqueIdx = this.manager.instances.filter((d) =>
      d.instanceId.includes(`map-${geoResolution}-${geoID}`),
    ).length;

    this.instanceId =
      `${manager.instanceIdPrefix ?? ""}map-${geoResolution}-${geoID}-${uniqueIdx}`;
    this.clipId = `${this.instanceId}-clip`;

    this.x = x;
    this.y = y;
    this.r = radius;
    this.minRadius = Math.min(MIN_NODE_RADIUS, radius);
    this.maxRadius = Math.max(
      260,
      Math.min(manager.width, manager.height) * RESIZE_MAX_CANVAS_RATIO,
    );
    this.prevHitObjectRecords = [];
    this.__collisionFrame = null;
    this.__positionRenderFrame = null;
    this.isLoading = false;
    // Shift-clicked source features waiting to be spawned as child maps.
    this.selectedChildFeatures = new Map();
    this.annotationPins = [];
    this.annotationPinSeq = 0;
    this.activeAnnotationPinId = null;
    this.previewedAnnotationPinId = null;
    this.annotationEditorDismissEvent = `mousedown.annotationEditor${this.instanceId.replace(
      /[^a-zA-Z0-9_]/g,
      "",
    )}`;

    this.curVar = variableOfInterest ? variableOfInterest : DEFAULT_VARIABLE;
    this.isUnivariateMap = true;
    this.varOptions = DATA_VARIABLES.map((variable) => ({
      value: variable.id,
      label: variable.label,
      shortLabel: variable.shortLabel,
    }));

    this.root = manager.viewport
      .append("g")
      .attr("class", "map-instance")
      .attr("transform", `translate(${x},${y})`)
      .on("mouseover.parent-area", (event) => {
        if (this._isInternalPointerTransition(event)) return;
        this.highlightParentNodeArea();
      })
      .on("mouseout.parent-area", (event) => {
        if (this._isInternalPointerTransition(event)) return;
        this.dehighlightParentNodeArea();
      })
      .on("click.select", (event) => {
        event.stopPropagation();
        this.manager.selectInstance(this.instanceId, {
          additive: event.shiftKey,
        });
      });

    this.gOverlay = this.root.append("g").attr("class", "layer-overlay");

    this.gBase = this.root.append("g").attr("class", "layer-base");

    this.gOptions = this.root
      .append("g")
      .attr("class", "layer-option")
      .attr("transform", `translate(${-radius / 2}, ${-radius})`);

    this.gLegend = this.root
      .append("g")
      .attr("class", "layer-legend")
      .attr("transform", `translate(${-radius / 2}, ${-radius})`);

    this.gChrome = this.root.append("g").attr("class", "layer-chrome");
    this.gPins = this.root.append("g").attr("class", "layer-pins");
    this._drawLoadingOverlay();

    this.setVariableOptions();

    this.circle = this.gOverlay
      .append("circle")
      .attr("class", "outer-circle")
      .attr("id", this.instanceId)
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("r", radius)
      .style("fill", "transparent")
      .style("pointer-events", "all");

    this._drawNodeHeader();
    this._drawDrillDownAffordance();
    this._drawResizeHandle();

    this.manager.graph.addNode(
      this.instanceId,
      makeViewportCenterGetter(this.manager.svg.node(), this.circle.node()),
    );

    this.manager.graph.updateLinks();

    this._applyCircleClip(radius);
    this._updateProjection();

    this.colorTheme = getColorTheme(
      geojson.features.map((feature) => feature.properties[this.curVar]),
      "sequential",
      "discrete",
    );

    drawColorLegend(this.gLegend, this.colorTheme);

    this._drawBackgroundFeatures();
    this._drawFeatures();
    this._registerFeatureGraphNodes();

    const instanceDrag = this._instanceDrag();
    this.circle.call(instanceDrag);
    this.nodeHeader.call(instanceDrag);

    this._attachFeatureCloneDrag();
    this.setLoading(isLoading);
  }

  destroy() {
    this.manager.instances = this.manager.instances.filter(
      (d) => d.instanceId !== this.instanceId,
    );
    this.manager.graph.removeNode(this.instanceId);
    this.manager.instances.forEach((instance) => {
      instance._updateNodeHeader?.();
    });
    hideMapFeatureTooltip();
    this._clearCollisionFeedback();
    this._flushPositionRender();
    this._clearAnnotationEditorDismiss();
    this.root.remove();
  }

  _applyCircleClip(radius) {
    const defs = this.manager.svg.select("defs").empty()
      ? this.manager.svg.append("defs")
      : this.manager.svg.select("defs");

    defs.select(`#${this.clipId}`).remove();

    defs
      .append("clipPath")
      .attr("id", this.clipId)
      .append("circle")
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("r", radius);

    this.gBase.attr("clip-path", `url(#${this.clipId})`);
  }

  _drawBackgroundFeatures() {
    const features = this.backgroundGeojson?.features ?? [];

    this.gBase
      .selectAll(`.background-path-${this.instanceId}`)
      .data(features)
      .join(
        (enter) => enter.append("path"),
        (update) => update,
        (exit) => exit.remove(),
      )
      .attr("class", `background-path-${this.instanceId} zcta-parent-background`)
      .attr("d", this.path)
      .attr("fill", ZCTA_PARENT_BACKGROUND_FILL)
      .attr("stroke", ZCTA_PARENT_BACKGROUND_STROKE)
      .attr("stroke-width", ZCTA_PARENT_BACKGROUND_STROKE_WIDTH)
      .attr("vector-effect", "non-scaling-stroke")
      .style("pointer-events", "none")
      .lower();
  }

  _drawFeatures() {
    const features = this.geojson.features;
    const self = this;

    this.gBase
      .selectAll(`.path-${this.instanceId}`)
      .data(features)
      .join("path")
      .attr("class", `path-${this.instanceId}`)
      .attr("d", this.path)
      .attr("id", (d) => `${self.instanceId}-innerarea-${d.properties.ID}`)
      .attr("geo-properties", (d) => JSON.stringify(d.properties))
      .attr("fill", (d) => this._getFeatureFill(d))
      .attr("stroke", (d) => this._getFeatureStroke(d))
      .attr("stroke-width", (d) => this._getFeatureStrokeWidth(d))
      .attr("vector-effect", "non-scaling-stroke")
      .style("pointer-events", "all")
      .on("click.childSelect", function (event, d) {
        event.preventDefault();
        event.stopPropagation();

        if (event.shiftKey) {
          self.toggleChildFeatureSelection(this, d);
          return;
        }

        self.clearChildFeatureSelection();
      })
      .on("dblclick", function (event, d) {
        event.preventDefault();
        event.stopPropagation();

        if (event.shiftKey) return;

        const [childX, childY] = self._getAutoChildPosition();
        self._spawnChildMapFromFeature(d, this, childX, childY);
      })
      .on("contextmenu", function (event, d) {
        self._showAnnotationContextMenu(event, d);
      })
      .on("mouseover", function (event, d) {
        self._handleFeatureHover(event, d);
      })
      .on("mousemove", function (event) {
        self._moveDrillDownAffordance(event);
        moveMapFeatureTooltip(event);
      })
      .on("mouseleave", function (event, d) {
        self._handleFeatureLeave(d);
      });
  }

  _registerFeatureGraphNodes() {
    const prefix = `${this.instanceId}-innerarea-`;

    Array.from(this.manager.graph.nodes.keys()).forEach((nodeId) => {
      if (String(nodeId).startsWith(prefix)) {
        this.manager.graph.nodes.delete(nodeId);
      }
    });

    this.gBase
      .selectAll(`.path-${this.instanceId}`)
      .nodes()
      .forEach((el) => {
        const geoID = d3.select(el).attr("id");
        if (!geoID) return;

        const center = makeViewportCenterGetter(this.manager.svg.node(), el);
        this.manager.graph.addNode(geoID, center);
      });
  }

  _showAnnotationContextMenu(event, feature) {
    event.preventDefault();
    event.stopPropagation();

    const [localX, localY] = d3.pointer(event, this.root.node());

    this.manager.selectInstance(this.instanceId);
    hideMapFeatureTooltip();
    this.manager.showMenu(event, null, {
      forcedTargetInstances: [this],
      annotationTarget: {
        feature,
        instance: this,
        localX,
        localY,
      },
    });
  }

  createAnnotationPin(localX, localY, feature) {
    const featureProperties = feature.properties ?? {};
    const [pinX, pinY] = this._getFeatureAnnotationAnchor(
      feature,
      localX,
      localY,
    );
    const pin = {
      id: `${this.instanceId}-pin-${this.annotationPinSeq++}`,
      featureId: featureProperties.ID,
      featureLabel: getFeatureDisplayName(featureProperties),
      note: "",
      isSaved: false,
      rx: pinX / this.r,
      ry: pinY / this.r,
    };

    this.annotationPins.push(pin);
    this.activeAnnotationPinId = pin.id;
    this._renderAnnotationPins();
  }

  _getFeatureAnnotationAnchor(feature, fallbackX, fallbackY) {
    const bounds = this.path?.bounds?.(feature);

    if (bounds?.flat().every(Number.isFinite)) {
      return [
        (bounds[0][0] + bounds[1][0]) / 2,
        (bounds[0][1] + bounds[1][1]) / 2,
      ];
    }

    const centroid = this.path?.centroid?.(feature);
    if (centroid?.every(Number.isFinite)) return centroid;

    return [fallbackX, fallbackY];
  }

  getAnnotationPin(pinId) {
    return this.annotationPins.find((pin) => pin.id === pinId);
  }

  getSavedAnnotations() {
    return this.annotationPins
      .filter((pin) => pin.isSaved)
      .map((pin) => ({
        id: pin.id,
        source: "map-authoring",
        nodeId: this.instanceId,
        nodeTitle: this.getNodeTitle(),
        scaleLabel: this.getScaleLabel(),
        level: this.getAnnotationLevel(),
        parentLabel: this.manager.getParentAreaLabel(this.instanceId),
        areaId: pin.featureId,
        areaLabel: pin.featureLabel,
        note: pin.note,
      }));
  }

  getAuthoringState(parentLabel = "workspace root") {
    return {
      id: this.instanceId,
      title: this.getNodeTitle(),
      parentLabel,
      geometry: {
        x: this.x,
        y: this.y,
        radius: this.r,
      },
      data: {
        displayLevel: this.displayLevel,
        geoResolution: this.geoResolution,
        geoID: this.geoID,
        geoLabel: this.geoLabel,
        scopeId: this.scopeId,
        scopeLabel: this.scopeLabel,
        scopeLevel: this.scopeLevel,
      },
      variable: {
        id: this.curVar,
        label: this.getVariableLabel(this.curVar),
      },
      annotations: this.getAnnotationPinState(),
      annotationSeq: this.annotationPinSeq,
      featureCount: this.geojson?.features?.length ?? 0,
    };
  }

  getAnnotationPinState() {
    return this.annotationPins.map((pin) => ({
      id: pin.id,
      featureId: pin.featureId,
      featureLabel: pin.featureLabel,
      note: pin.note,
      isSaved: pin.isSaved,
      rx: pin.rx,
      ry: pin.ry,
    }));
  }

  restoreAnnotationPinState(pins = [], { annotationSeq = null } = {}) {
    this.annotationPins = pins.map((pin, index) => ({
      id: `${this.instanceId}-pin-${index}`,
      featureId: pin.featureId,
      featureLabel: pin.featureLabel,
      note: pin.note ?? "",
      isSaved: Boolean(pin.isSaved ?? pin.note),
      rx: Number.isFinite(Number(pin.rx)) ? Number(pin.rx) : 0,
      ry: Number.isFinite(Number(pin.ry)) ? Number(pin.ry) : 0,
    }));
    this.annotationPinSeq = Number.isFinite(Number(annotationSeq))
      ? Math.max(Number(annotationSeq), this.annotationPins.length)
      : this.annotationPins.length;
    this.activeAnnotationPinId = null;
    this.previewedAnnotationPinId = null;
    this._renderAnnotationPins();
  }

  updateAnnotationPinNote(pinId, note, { emit = false } = {}) {
    const pin = this.getAnnotationPin(pinId);
    const nextNote = note.trim();
    if (!pin || !nextNote) return;

    pin.note = nextNote;
    pin.isSaved = true;
    this._renderAnnotationPins();

    if (emit) this.manager.emitAnnotationsChange();
  }

  setAnnotationPreview(pinId, isPreviewed) {
    this.previewedAnnotationPinId = isPreviewed ? pinId : null;
    this._renderAnnotationPins();
  }

  saveAnnotationPin(pin) {
    pin.note = pin.note.trim();
    if (!pin.note) {
      this._deleteAnnotationPin(pin.id, { emit: true });
      return;
    }

    pin.isSaved = Boolean(pin.note);
    this.manager.emitAnnotationsChange();
    this._closeAnnotationEditor();
  }

  deleteAnnotationPin(pinId, { emit = false } = {}) {
    this._deleteAnnotationPin(pinId, { emit });
  }

  _getPinPosition(pin) {
    return [pin.rx * this.r, pin.ry * this.r];
  }

  getAnnotationLevel() {
    if (this.geoResolution === "REGION") return "region";
    if (this.geoResolution === "DIVISION") return "division";
    if (this.geoResolution === "COUNTRY") return "state";
    if (this.geoResolution === "STATE") return "county";
    if (this.geoResolution === "COUNTY") return "zcta";
    return this.geoResolution.toLowerCase();
  }

  _getAnnotationPinGroups() {
    const groupsByFeature = new Map();

    this.annotationPins.forEach((pin) => {
      const key = pin.featureId ?? pin.id;
      const group = groupsByFeature.get(key) ?? {
        key,
        featureId: pin.featureId,
        featureLabel: pin.featureLabel,
        pins: [],
        rx: pin.rx,
        ry: pin.ry,
      };

      group.pins.push(pin);
      groupsByFeature.set(key, group);
    });

    return Array.from(groupsByFeature.values()).map((group) => {
      const savedPins = group.pins.filter((pin) => pin.isSaved);
      const activePin = group.pins.find(
        (pin) => pin.id === this.activeAnnotationPinId,
      );
      const previewPin = group.pins.find(
        (pin) => pin.id === this.previewedAnnotationPinId,
      );

      return {
        ...group,
        activePin,
        count: group.pins.length,
        previewPin,
        savedPins,
      };
    });
  }

  _getAnnotationGroupTitle(group) {
    const countLabel =
      group.count === 1 ? "1 annotation" : `${group.count} annotations`;
    return `${group.featureLabel}: ${countLabel}`;
  }

  _getAnnotationGroupCountLabel(group) {
    return group.count > 99 ? "99+" : String(group.count);
  }

  _getAnnotationPinTitle(pin) {
    const note = pin.note?.trim();
    return note ? `${pin.featureLabel}: ${note}` : pin.featureLabel;
  }

  _getAnnotationEditorOffset(pin) {
    return {
      x: pin.rx >= 0 ? 18 : -PIN_EDITOR_WIDTH - 18,
      y: pin.ry >= 0 ? -PIN_EDITOR_HEIGHT - 24 : 16,
    };
  }

  _setActiveAnnotationPin(pinId) {
    this.activeAnnotationPinId = pinId;
    this._renderAnnotationPins();
  }

  _closeAnnotationEditor({ discardUnsaved = false } = {}) {
    const activePin = this.getAnnotationPin(this.activeAnnotationPinId);

    if (discardUnsaved && activePin && !activePin.isSaved) {
      this._deleteAnnotationPin(activePin.id);
      return;
    }

    this.activeAnnotationPinId = null;
    this._clearAnnotationEditorDismiss();
    this._renderAnnotationPins();
  }

  _deleteAnnotationPin(pinId, { emit = false } = {}) {
    const pin = this.getAnnotationPin(pinId);

    if (pin && this.previewedAnnotationPinId === pinId) {
      this.dehighlightArea(pin.featureId);
    }

    this.annotationPins = this.annotationPins.filter((pin) => pin.id !== pinId);

    if (this.activeAnnotationPinId === pinId) {
      this.activeAnnotationPinId = null;
      this._clearAnnotationEditorDismiss();
    }

    if (this.previewedAnnotationPinId === pinId) {
      this.previewedAnnotationPinId = null;
    }

    this._renderAnnotationPins();
    if (emit) this.manager.emitAnnotationsChange();
  }

  _updateAnnotationPinNote(pin, note, activeNode) {
    pin.note = note;
    activeNode.select("title").text(this._getAnnotationPinTitle(pin));
  }

  _appendAnnotationActionButton(actions, { label, ariaLabel, onClick }) {
    const button = actions
      .append("xhtml:button")
      .attr("type", "button")
      .text(label)
      .on("click", (event) => {
        event.stopPropagation();
        onClick();
      });

    if (ariaLabel) button.attr("aria-label", ariaLabel);

    return button;
  }

  _renderAnnotationPins() {
    const pins = this._bindAnnotationPinNodes();

    pins
      .classed(
        "is-active",
        (group) => Boolean(group.activePin),
      )
      .classed(
        "is-previewed",
        (group) => Boolean(group.previewPin),
      )
      .attr("transform", (group) => {
        const [x, y] = this._getPinPosition(group);
        return `translate(${x},${y})`;
      });

    pins.select("title").text((group) => this._getAnnotationGroupTitle(group));
    pins
      .select("text.annotation-pin-count")
      .text((group) => this._getAnnotationGroupCountLabel(group));
    pins.selectAll("foreignObject.annotation-pin-editor").remove();

    const activePin = this.annotationPins.find(
      (pin) => pin.id === this.activeAnnotationPinId,
    );
    if (!activePin) {
      this._clearAnnotationEditorDismiss();
      return;
    }

    this._drawAnnotationEditor(pins, activePin);
  }

  _bindAnnotationPinNodes() {
    return this.gPins
      .selectAll("g.annotation-pin")
      .data(this._getAnnotationPinGroups(), (group) => group.key)
      .join(
        (enter) => {
          const pin = enter
            .append("g")
            .attr("class", "annotation-pin")
            .style("pointer-events", "all")
            .on("mousedown", (event) => event.stopPropagation())
            .on("mouseenter", (event, group) => {
              const targetPin = group.savedPins[group.savedPins.length - 1];
              if (!targetPin) return;

              this.manager.previewAnnotation(targetPin.id, { pan: false });
            })
            .on("mouseleave", (event, group) => {
              if (!group.savedPins.length) return;
              this.manager.clearAnnotationPreview();
            })
            .on("click", (event, group) => {
              event.stopPropagation();

              if (group.activePin && !group.activePin.isSaved) {
                this._setActiveAnnotationPin(group.activePin.id);
                return;
              }

              const targetPin = group.savedPins[group.savedPins.length - 1];
              if (targetPin) {
                this.manager.previewAnnotation(targetPin.id, { pan: false });
                return;
              }
            })
            .on("dblclick", (event) => event.stopPropagation());

          pin
            .append("path")
            .attr("class", "annotation-pin-icon")
            .attr("d", ANNOTATION_PIN_PATH);

          pin
            .append("circle")
            .attr("class", "annotation-pin-dot")
            .attr("cy", ANNOTATION_PIN_DOT_CY)
            .attr("r", ANNOTATION_PIN_DOT_RADIUS);
          pin
            .append("text")
            .attr("class", "annotation-pin-count")
            .attr("y", ANNOTATION_PIN_DOT_CY)
            .attr("dy", "0.05em");
          pin.append("title");
          return pin;
        },
        (update) => update,
        (exit) => exit.remove(),
      );
  }

  /**
   * Keep the annotation editor mounted on the active pin so it follows node
   * resize and drag transforms without separate screen-space bookkeeping.
   */
  _drawAnnotationEditor(pins, activePin) {
    const activeNode = pins.filter((group) =>
      group.pins.some((pin) => pin.id === activePin.id),
    );
    const { x: editorX, y: editorY } =
      this._getAnnotationEditorOffset(activePin);

    const editor = activeNode
      .append("foreignObject")
      .attr("class", "annotation-pin-editor")
      .attr("x", editorX)
      .attr("y", editorY)
      .attr("width", PIN_EDITOR_WIDTH)
      .attr("height", PIN_EDITOR_HEIGHT)
      .on("mousedown", (event) => event.stopPropagation())
      .on("click", (event) => event.stopPropagation())
      .on("dblclick", (event) => event.stopPropagation());

    const panel = editor
      .append("xhtml:div")
      .attr("class", "annotation-pin-panel");

    panel.append("xhtml:strong").text(activePin.featureLabel);

    const textarea = panel
      .append("xhtml:textarea")
      .attr("class", "annotation-pin-textarea")
      .attr("placeholder", "Write an annotation")
      .property("value", activePin.note)
      .on("input", (event) => {
        this._updateAnnotationPinNote(activePin, event.target.value, activeNode);
      });

    const actions = panel
      .append("xhtml:div")
      .attr("class", "annotation-pin-actions");

    this._appendAnnotationActionButton(actions, {
      label: "save",
      onClick: () => this.saveAnnotationPin(activePin),
    });

    this._appendAnnotationActionButton(actions, {
      label: "close",
      ariaLabel: "close annotation editor",
      onClick: () => this._closeAnnotationEditor({ discardUnsaved: true }),
    });

    this._bindAnnotationEditorDismiss();
    setTimeout(() => textarea.node()?.focus(), 0);
  }

  _bindAnnotationEditorDismiss() {
    this._clearAnnotationEditorDismiss();

    setTimeout(() => {
      d3.select(document).on(this.annotationEditorDismissEvent, (event) => {
        const editor = this.root.node()?.querySelector(".annotation-pin-editor");
        if (editor?.contains(event.target)) return;

        this._closeAnnotationEditor({ discardUnsaved: true });
      });
    }, 0);
  }

  _clearAnnotationEditorDismiss() {
    d3.select(document).on(this.annotationEditorDismissEvent, null);
  }

  /**
   * Feature hover serves two visual channels: grouped maps highlight the same
   * feature id, while the tooltip/drill-down affordance stays local to the
   * active node.
   */
  _handleFeatureHover(event, feature) {
    const geoProperties = feature.properties;
    const targetAreaID = geoProperties.ID;

    this.highlightArea(targetAreaID);
    this._showDrillDownAffordance(event, feature);
    this._getComparisonInstances().forEach((instance) => {
      instance.highlightArea(targetAreaID);
    });

    showMapFeatureTooltip(event, geoProperties, {
      title: this.geoResolution.toLowerCase(),
        valueKey: this.curVar,
        valueLabel: getDataVariableById(this.curVar).label,
      });
  }

  _handleFeatureLeave(feature) {
    const targetAreaID = feature.properties.ID;

    this.dehighlightArea(targetAreaID);
    this._hideDrillDownAffordance();
    this._getComparisonInstances().forEach((instance) => {
      instance.dehighlightArea(targetAreaID);
    });

    hideMapFeatureTooltip();
  }

  _drawNodeHeader() {
    const handleHeaderPointerDown = (event) => {
      event.stopPropagation();
      if (event.shiftKey || !this.manager.isInstanceSelected(this.instanceId)) {
        this.manager.selectInstance(this.instanceId, {
          additive: event.shiftKey,
        });
      }
    };
    const stopHeaderClick = (event) => event.stopPropagation();

    this.nodeHeader = this.gChrome
      .append("g")
      .attr("class", "map-node-header")
      .attr("id", `${this.instanceId}-header`)
      .attr("aria-label", `${this.getNodeTitle()} node handle`)
      .style("cursor", "move")
      .style("pointer-events", "all")
      .on("mousedown.select", handleHeaderPointerDown)
      .on("click", stopHeaderClick)
      .on("dblclick", stopHeaderClick);

    this.nodeHeaderRect = this.nodeHeader
      .append("rect")
      .attr("id", `${this.instanceId}-header-hitbox`)
      .attr("rx", 6)
      .attr("ry", 6)
      .style("pointer-events", "all")
      .on("mousedown.select", handleHeaderPointerDown)
      .on("click", stopHeaderClick)
      .on("dblclick", stopHeaderClick);

    this.nodeHeaderTitle = this.nodeHeader
      .append("text")
      .attr("class", "map-node-header-title")
      .attr("x", NODE_HEADER_PAD_X)
      // .attr("y", 21);

    this.nodeHeaderControl = this.nodeHeader
      .append("foreignObject")
      .attr("class", "map-node-header-control-object");
    this.nodeHeaderControlBody = this.nodeHeaderControl
      .append("xhtml:div")
      .attr("class", "map-node-header-control");
    this.nodeHeaderAreaLabel = this.nodeHeaderControlBody
      .append("xhtml:span")
      .attr("class", "map-node-area-label");

    const stopControlEvent = (event) => event.stopPropagation();
    this.displayLevelSelect = this.nodeHeaderControlBody
      .append("xhtml:select")
      .attr("class", "map-node-display-level-select")
      .attr("aria-label", "display subdivision level")
      .on("mousedown", stopControlEvent)
      .on("click", stopControlEvent)
      .on("dblclick", stopControlEvent)
      .on("change", (event) => {
        event.stopPropagation();
        this.setDisplayLevel(event.target.value).catch((error) => {
          console.error("Failed to update map display level:", error);
          this.displayLevelSelect?.property("value", this.displayLevel);
        });
      });

    // this.nodeHeaderMeta = this.nodeHeader
    //   .append("text")
    //   .attr("class", "map-node-header-meta")
    //   .attr("x", 12)
    //   .attr("y", 40);

    this._updateNodeHeader();
    this._layoutNodeChrome();
  }

  /**
   * Small affordance shown near the hovered feature; the actual child map can
   * be created either by double-clicking or by dragging the source feature out.
   */
  _drawDrillDownAffordance() {
    this.drillDownAffordance = this.gChrome
      .append("g")
      .attr("class", "drill-down-affordance")
      .style("display", "none")
      .style("pointer-events", "none");

    this.drillDownAffordance.append("circle").attr("r", 14);
    this.drillDownAffordance
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .text("+");
  }

  /**
   * Nodes are circular, so resizing uses one radius value and keeps width and
   * height proportional. The handle lives in chrome so it stays above the map.
   */
  _drawResizeHandle() {
    this.resizeHandle = this.gChrome
      .append("g")
      .attr("class", "map-resize-handle")
      .attr("id", `${this.instanceId}-resize-handle`)
      .attr("aria-label", "resize map node")
      .style("pointer-events", "all")
      .on("click", (event) => event.stopPropagation())
      .on("dblclick", (event) => event.stopPropagation());

    this.resizeHandle
      .append("circle")
      .attr("class", "map-resize-handle-target")
      .attr("id", `${this.instanceId}-resize-handle-target`)
      .attr("r", 12);

    this.resizeHandle
      .append("path")
      .attr("class", "map-resize-handle-grip")
      .attr("d", "M -4,5 L 5,-4 M 1,6 L 6,1");

    this.resizeHandle.call(this._resizeDrag());
    this._layoutNodeChrome();
  }

  _drawLoadingOverlay() {
    this.gLoading = this.root
      .append("g")
      .attr("class", "map-node-loading")
      .style("display", "none")
      .style("pointer-events", "none");

    this.gLoading
      .append("circle")
      .attr("class", "map-node-loading-backdrop")
      .attr("r", 44);

    this.gLoading
      .append("circle")
      .attr("class", "map-node-loading-spinner")
      .attr("r", 20);

    this.loadingText = this.gLoading
      .append("text")
      .attr("class", "map-node-loading-text")
      .attr("text-anchor", "middle")
      .attr("y", 42)
      .text("loading");
  }

  setLoading(isLoading, message = "loading") {
    this.isLoading = Boolean(isLoading);
    this.root.classed("is-loading", this.isLoading);
    this.gLoading?.style("display", this.isLoading ? null : "none");
    this.loadingText?.text(message);
    this.variableSelect?.property("disabled", this.isLoading);

    if (this.isLoading) {
      this.displayLevelSelect?.property("disabled", true);
      this.gLegend?.style("display", "none");
      return;
    }

    this._renderDisplayLevelSelect();
    this.gLegend?.style("display", null);
  }

  /**
   * Reposition chrome that depends on the current radius. This is called after
   * initial render and every resize so controls, legend, and handles stay glued
   * to the node.
   */
  _layoutNodeChrome() {
    const headerWidth = this.nodeHeaderWidth ?? Math.min(this.r * 1.45, 250);
    const headerHeight = this.nodeHeaderHeight ?? NODE_HEADER_HEIGHT;

    this.gOptions?.attr("transform", `translate(${-this.r / 2}, ${-this.r})`);
    this.gLegend?.attr("transform", `translate(${-this.r / 2}, ${-this.r})`);
    this.nodeHeader?.attr(
      "transform",
      `translate(${-headerWidth / 2},${+this.r })`,
    );
    this.nodeHeaderRect?.attr("width", headerWidth).attr("height", headerHeight);

    const handleDistance = this.r / Math.SQRT2;
    this.resizeHandle?.attr(
      "transform",
      `translate(${handleDistance},${handleDistance})`,
    );
  }

  _showDrillDownAffordance(event, feature) {
    if (!this._canSpawnChildMap() || !this.drillDownAffordance) return;

    const properties = feature?.properties ?? {};
    this.drillDownAffordance.attr(
      "aria-label",
      `create child map from ${getFeatureDisplayName(properties)}`,
    );
    this._moveDrillDownAffordance(event);
    this.drillDownAffordance.style("display", null);
  }

  _moveDrillDownAffordance(event) {
    if (
      !this.drillDownAffordance ||
      this.drillDownAffordance.style("display") === "none"
    ) {
      return;
    }

    const [x, y] = d3.pointer(event, this.root.node());
    this.drillDownAffordance.attr("transform", `translate(${x + 18},${y - 18})`);
  }

  _hideDrillDownAffordance() {
    this.drillDownAffordance?.style("display", "none");
  }

  _getAutoChildPosition() {
    const childRadius = this._getChildNodeRadius();
    const gap = Math.max(CHILD_NODE_AUTO_GAP, this._getChildNodeGap());
    const distance = this.r + childRadius + gap;
    const hasRoomOnRight =
      this.x + distance + childRadius + 28 <= this.manager.width;
    const targetX = hasRoomOnRight ? this.x + distance : this.x;
    const targetY = hasRoomOnRight
      ? this.y + Math.min(60, this.r * 0.22)
      : this.y + distance;

    return this._getSeparatedChildPosition(targetX, targetY, childRadius, gap);
  }

  /**
   * New child maps inherit a fixed fraction of the parent radius. Repeating
   * this at each hierarchy level gives a predictable 0.75^depth size falloff.
   */
  _getChildNodeRadius() {
    return this.r * CHILD_NODE_RADIUS_SCALE;
  }

  _hasFeatureValue(feature) {
    const value = +feature?.properties?.[this.curVar];
    return Number.isFinite(value) && value >= 0;
  }

  _getFeatureFill(feature) {
    if (!this._hasFeatureValue(feature)) return NO_DATA_FEATURE_FILL;

    const value = Math.max(
      +feature.properties[this.curVar],
      MIN_LOG_COLOR_VALUE,
    );
    return this.colorTheme(Math.log10(value));
  }

  _getFeatureStroke(feature) {
    return MAP_FEATURE_STROKE;
  }

  _getFeatureStrokeWidth(feature) {
    return MAP_FEATURE_STROKE_WIDTH;
  }

  _getChildNodeGap() {
    const rootFontSize =
      typeof window === "undefined"
        ? CHILD_NODE_MIN_VISIBLE_GAP_PX
        : parseFloat(
            window.getComputedStyle(document.documentElement).fontSize,
          ) || CHILD_NODE_MIN_VISIBLE_GAP_PX;
    const zoomScale = d3.zoomTransform(this.manager.svg.node()).k || 1;

    return rootFontSize / zoomScale;
  }

  /**
   * Keep newly-created children visually separated from the parent. Auto-spawn
   * positions can request a compact point, so project outward until there is at
   * least a 1rem visual gap between the two node boundaries.
   */
  _getSeparatedChildPosition(
    targetX,
    targetY,
    childRadius,
    gap = this._getChildNodeGap(),
  ) {
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distance = Math.hypot(dx, dy);
    const minDistance = this.r + childRadius + gap;

    if (distance >= minDistance) return [targetX, targetY];

    const fallbackAngle = -Math.PI / 2;
    const angle = distance > 0 ? Math.atan2(dy, dx) : fallbackAngle;

    return [
      this.x + Math.cos(angle) * minDistance,
      this.y + Math.sin(angle) * minDistance,
    ];
  }

  _canSpawnChildMap() {
    const modeId = this.manager.hierarchyMode?.id;

    if (modeId === HIERARCHY_MODE_IDS.SC_REGION_COUNTY_ZCTA) {
      return this.geoResolution === "REGION" || this.geoResolution === "STATE";
    }

    if (modeId === HIERARCHY_MODE_IDS.REGION_STATE_COUNTY) {
      return this.geoResolution === "REGION" || this.geoResolution === "COUNTRY";
    }

    if (modeId === HIERARCHY_MODE_IDS.DIVISION_STATE_COUNTY) {
      return (
        this.geoResolution === "DIVISION" || this.geoResolution === "COUNTRY"
      );
    }

    return this.geoResolution === "COUNTRY" || this.geoResolution === "STATE";
  }

  _isDropOutsideParentNode(vx, vy) {
    return Math.hypot(vx - this.x, vy - this.y) > this.r;
  }

  /**
   * Shift-click selection is scoped to one map node. Keeping only one active
   * selection set avoids ambiguous batch creation across unrelated parents.
   */
  toggleChildFeatureSelection(pathEl, feature) {
    if (!this._canSpawnChildMap()) return;

    const pathId = d3.select(pathEl).attr("id");
    if (!pathId) return;

    this.manager.instances.forEach((instance) => {
      if (instance !== this) instance.clearChildFeatureSelection?.();
    });

    if (this.selectedChildFeatures.has(pathId)) {
      this.selectedChildFeatures.delete(pathId);
    } else {
      this.selectedChildFeatures.set(pathId, { feature, pathId });
    }

    this.syncChildFeatureSelection();
  }

  /** Clear the pending batch of source features for this map node. */
  clearChildFeatureSelection() {
    if (!this.selectedChildFeatures?.size) return;

    this.selectedChildFeatures.clear();
    this.syncChildFeatureSelection();
  }

  /** Push the selection model into SVG classes used by the visual highlight. */
  syncChildFeatureSelection() {
    const self = this;

    this.gBase
      .selectAll(`.path-${this.instanceId}`)
      .classed("is-child-selected", function () {
        return self.selectedChildFeatures.has(d3.select(this).attr("id"));
      });

    this.root.classed(
      "has-child-selection",
      this.selectedChildFeatures.size > 0,
    );
  }

  /** Resolve selected source paths back to live DOM nodes before drag/drop. */
  getSelectedChildFeatureRecords() {
    return Array.from(this.selectedChildFeatures.values())
      .map((record) => ({
        ...record,
        pathEl: document.getElementById(record.pathId),
      }))
      .filter((record) => record.pathEl);
  }

  _updateNodeHeader() {
    if (this._usesScopedDisplayLevelControl()) {
      this.nodeHeaderTitle?.style("display", "none");
      this.nodeHeaderControl?.style("display", null);
      this.nodeHeaderAreaLabel?.text(this.getNodeAreaLabel());
      this._renderDisplayLevelSelect();
    } else {
      this.nodeHeaderControl?.style("display", "none");
      this.nodeHeaderTitle?.style("display", null).text(this.getNodeTitle());
    }

    this.nodeHeader?.attr(
      "aria-label",
      `${this.getNodeTitle()} node handle`,
    );
    // this.nodeHeaderMeta?.text(`${this.curVar} / ${this.getScaleLabel()}`);
    this._resizeNodeHeaderToContent();
  }

  _resizeNodeHeaderToContent() {
    if (this._usesScopedDisplayLevelControl()) {
      const width = this._getScopedHeaderWidth();
      const height = NODE_HEADER_CONTROL_HEIGHT;

      this.nodeHeaderWidth = width;
      this.nodeHeaderHeight = height;
      this.nodeHeaderControl
        ?.attr("x", 0)
        .attr("y", 0)
        .attr("width", width)
        .attr("height", height);
      this.nodeHeaderRect?.attr("width", width).attr("height", height);
      this._layoutNodeChrome();
      return;
    }

    const titleNode = this.nodeHeaderTitle?.node();
    if (!titleNode) return;

    const titleBBox = titleNode.getBBox();
    const width = Math.max(
      NODE_HEADER_MIN_WIDTH,
      Math.ceil(titleBBox.width + NODE_HEADER_PAD_X * 2),
    );
    const height = Math.max(
      titleBBox.height + NODE_HEADER_PAD_Y * 2,
      NODE_HEADER_PAD_Y * 2 + 14,
    );

    this.nodeHeaderWidth = width;
    this.nodeHeaderHeight = Math.ceil(height);
    this.nodeHeaderTitle
      .attr("x", NODE_HEADER_PAD_X)
      .attr("y", NODE_HEADER_PAD_Y - titleBBox.y);
    this.nodeHeaderRect
      ?.attr("width", width)
      .attr("height", this.nodeHeaderHeight);
    this._layoutNodeChrome();
  }

  _usesScopedDisplayLevelControl() {
    return (
      this.manager.hierarchyMode?.id ===
        HIERARCHY_MODE_IDS.SC_REGION_COUNTY_ZCTA &&
      Boolean(this.scopeLevel)
    );
  }

  _getScopedHeaderWidth() {
    const areaLabelLength = this.getNodeAreaLabel().length;
    const areaLabelWidth = Math.min(
      160,
      Math.max(70, areaLabelLength * 7.4),
    );

    return Math.min(
      NODE_HEADER_MAX_WIDTH,
      Math.max(
        NODE_HEADER_MIN_WIDTH,
        Math.ceil(
          areaLabelWidth +
            NODE_HEADER_LEVEL_SELECT_WIDTH +
            NODE_HEADER_PAD_X * 2,
        ),
      ),
    );
  }

  _renderDisplayLevelSelect() {
    const options = this.getDisplayLevelOptions();

    this.displayLevelSelect
      ?.selectAll("option")
      .data(options)
      .join("option")
      .attr("value", (displayLevel) => displayLevel)
      .text(
        (displayLevel) => DISPLAY_LEVEL_LABELS[displayLevel] ?? displayLevel,
      );

    this.displayLevelSelect
      ?.property("value", this.displayLevel)
      .property("disabled", options.length <= 1 || this.hasHierarchyChildren())
      .attr(
        "title",
        this.hasHierarchyChildren()
          ? "Remove child nodes before changing geographic level"
          : "Change geographic level",
      );
  }

  _updateProjection() {
    const fitGeojson = this._getProjectionFitGeojson();
    if (!fitGeojson?.features?.length) {
      this.projection = d3.geoMercator().translate([0, 0]).scale(1);
      this.path = d3.geoPath(this.projection);
      return;
    }

    this.projection = d3.geoMercator().fitExtent(
      [
        [-this.r, -this.r],
        [this.r, this.r],
      ],
      fitGeojson,
    );

    this.path = d3.geoPath(this.projection);
  }

  _getProjectionFitGeojson() {
    const backgroundFeatures = this.backgroundGeojson?.features ?? [];
    return backgroundFeatures.length ? this.backgroundGeojson : this.geojson;
  }

  /**
   * Radius drag handler. The pointer is converted into the map's local
   * coordinate space and the distance from the center becomes the new radius.
   */
  _resizeDrag() {
    const self = this;

    return d3
      .drag()
      .on("start", function (event) {
        event.sourceEvent?.stopPropagation();
        event.sourceEvent?.preventDefault?.();
        self._hideDrillDownAffordance();
        hideMapFeatureTooltip();

        if (!self.manager.isInstanceSelected(self.instanceId)) {
          self.manager.selectInstance(self.instanceId);
        }

        self.__resizeInstances = self.manager.getResizeSelectionForInstance(
          self.instanceId,
        );
        self.__resizeStartRadii = new Map(
          self.__resizeInstances.map((instance) => [
            instance.instanceId,
            instance.r,
          ]),
        );
        self.__resizeStartRadius = self.r;
        self.__resizeInstances.forEach((instance) => {
          instance.root.classed("is-resizing", true);
        });
      })
      .on("drag", function (event) {
        event.sourceEvent?.stopPropagation();
        event.sourceEvent?.preventDefault?.();

        const [vx, vy] = self.manager.pointerToViewport(event);
        const [ix, iy] = self._viewportToInstance(vx, vy);
        const requestedRadius = Math.hypot(ix, iy);
        const scale =
          self.__resizeStartRadius > 0
            ? requestedRadius / self.__resizeStartRadius
            : 1;

        self.__resizeInstances.forEach((instance) => {
          const startRadius = self.__resizeStartRadii.get(instance.instanceId);
          if (!startRadius) return;
          instance.setRadius(startRadius * scale, { emit: false });
        });

        self.manager.updateGroups?.();
      })
      .on("end", function (event) {
        event.sourceEvent?.stopPropagation();
        self.__resizeInstances?.forEach((instance) => {
          instance.root.classed("is-resizing", false);
        });
        self.__resizeInstances = null;
        self.__resizeStartRadii = null;
        self.__resizeStartRadius = null;
        self.manager.graph.updateLinks();
        self.manager.emitNetworkChange();
        self.manager.updateOverview?.();
        self.manager.updateGroups?.();
      });
  }

  _scheduleCollisionFeedback() {
    if (this.__collisionFrame !== null) return;

    const requestFrame =
      typeof window.requestAnimationFrame === "function"
        ? window.requestAnimationFrame.bind(window)
        : (callback) => window.setTimeout(callback, 16);

    this.__collisionFrame = requestFrame(() => {
      this.__collisionFrame = null;
      this._updateCollisionFeedback();
    });
  }

  _updateCollisionFeedback() {
    const hits = this.manager.findCollisions(this, 4);
    this.circle.classed("colliding", hits.length > 0);

    hits.forEach((hit) => {
      hit.circle.classed("colliding", true);
    });

    this.prevHitObjectRecords.forEach((hit) => {
      hit.circle.classed("colliding", hits.includes(hit));
    });

    this.prevHitObjectRecords = hits;
  }

  _clearCollisionFeedback() {
    if (this.__collisionFrame !== null) {
      const cancelFrame =
        typeof window.cancelAnimationFrame === "function"
          ? window.cancelAnimationFrame.bind(window)
          : window.clearTimeout.bind(window);

      cancelFrame(this.__collisionFrame);
      this.__collisionFrame = null;
    }

    this.circle.classed("colliding", false);
    this.prevHitObjectRecords.forEach((hit) => {
      hit.circle.classed("colliding", false);
    });
    this.prevHitObjectRecords = [];
  }

  _instanceDrag() {
    const self = this;

    return d3
      .drag()
      .on("start", function (event) {
        if (event.sourceEvent) event.sourceEvent.stopPropagation();

        if (self.manager.shouldDragInstanceIndividually(self.instanceId)) {
          self.manager.selectInstance(self.instanceId);
        } else if (
          !event.sourceEvent?.shiftKey &&
          !self.manager.isInstanceSelected(self.instanceId)
        ) {
          self.manager.selectInstance(self.instanceId);
        }

        self.__dragInstances = self.manager.getDragSelectionForInstance(
          self.instanceId,
        );
        self.__dragStartPositions = new Map(
          self.__dragInstances.map((instance) => [
            instance.instanceId,
            { x: instance.x, y: instance.y },
          ]),
        );
        self.__dragStartPointer = self.manager.pointerToViewport(event);
        self.__dragInstances.forEach((instance) => {
          instance.circle.classed("dragging", true);
        });
      })
      .on("drag", function (event) {
        if (event.sourceEvent) event.sourceEvent.stopPropagation();

        const [vx, vy] = self.manager.pointerToViewport(event);
        const [sx, sy] = self.__dragStartPointer;
        const dx = vx - sx;
        const dy = vy - sy;

        self.__dragInstances.forEach((instance) => {
          const startPosition = self.__dragStartPositions.get(
            instance.instanceId,
          );
          if (!startPosition) return;

          instance.setPosition(startPosition.x + dx, startPosition.y + dy, {
            deferRender: true,
          });
        });

        self._scheduleCollisionFeedback();
        self.manager.scheduleGraphUpdate();
        self.manager.updateGroupBoundariesForInstances?.(self.__dragInstances);
      })
      .on("end", function (event) {
        if (event.sourceEvent) event.sourceEvent.stopPropagation();

        self._clearCollisionFeedback();

        self.__dragInstances?.forEach((instance) => {
          instance._flushPositionRender();
          instance.circle.classed("dragging", false);
        });

        self.__dragInstances = null;
        self.__dragStartPositions = null;
        self.__dragStartPointer = null;

        self.manager.flushGraphUpdate();
        self.manager.emitNetworkChange();
        self.manager.updateOverview?.();
        self.manager.updateGroups?.();
      });
  }

  _attachFeatureCloneDrag() {
    const self = this;
    let startVx, startVy;
    let didDragFeature;
    let dragRecords = [];

    const drag = d3
      .drag()
      .on("start", function (event, d) {
        d3.select(this).classed("dragging", true);
        self._hideDrillDownAffordance();
        hideMapFeatureTooltip();

        [startVx, startVy] = self.manager.pointerToViewport(event);
        didDragFeature = false;

        dragRecords = self._getFeatureDragRecords(this, d);
        self._setFeatureDragSourceHighlight(dragRecords, true);
        self.__ghost = self._drawFeatureDragGhost(dragRecords);
      })
      .on("drag", function (event) {
        const [vx, vy] = self.manager.pointerToViewport(event);
        didDragFeature =
          didDragFeature ||
          Math.hypot(vx - startVx, vy - startVy) > DRAG_SPAWN_THRESHOLD;

        const dx = vx - startVx;
        const dy = vy - startVy;
        self.__ghost.attr(
          "transform",
          `translate(${self.x + dx},${self.y + dy})`,
        );
      })
      .on("end", async function (event, d) {
        d3.select(this).classed("dragging", false);
        self._setFeatureDragSourceHighlight(dragRecords, false);
        if (self.__ghost) self.__ghost.remove();
        self.__ghost = null;

        const [vx, vy] = self.manager.pointerToViewport(event);
        const dragDistance = Math.hypot(vx - startVx, vy - startVy);
        if (!didDragFeature || dragDistance <= DRAG_SPAWN_THRESHOLD) return;
        if (!self._isDropOutsideParentNode(vx, vy)) return;

        if (dragRecords.length > 1) {
          await self._spawnChildMapsFromSelection(dragRecords, vx, vy);
          return;
        }

        const childMap = await self._spawnChildMapFromFeature(d, this, vx, vy);
        if (childMap) self.clearChildFeatureSelection();
      });

    this.gBase.selectAll(`.path-${this.instanceId}`).call(drag);
  }

  _setFeatureDragSourceHighlight(records, isActive) {
    records.forEach((record) => {
      if (!record.pathEl) return;
      d3.select(record.pathEl)
        .raise()
        .classed("is-drag-source", isActive);
    });
  }

  /**
   * Build the feature list for a drag gesture. If the dragged source is part of
   * a Shift-selected batch, the whole batch moves together; otherwise we spawn
   * only the feature under the pointer.
   */
  _getFeatureDragRecords(sourcePathEl, feature) {
    const sourcePathId = d3.select(sourcePathEl).attr("id");
    const fallbackRecord = {
      feature,
      pathEl: sourcePathEl,
      pathId: sourcePathId,
    };

    if (!this.selectedChildFeatures.has(sourcePathId)) return [fallbackRecord];

    const selectedRecords = this.getSelectedChildFeatureRecords();
    return selectedRecords.length ? selectedRecords : [fallbackRecord];
  }

  _drawFeatureDragGhost(records) {
    const ghost = this.manager.viewport
      .append("g")
      .attr("class", "feature-selection-ghost")
      .attr("transform", `translate(${this.x},${this.y})`)
      .attr("pointer-events", "none");

    records.forEach((record) => {
      ghost
        .append("path")
        .attr("class", "feature clone ghost")
        .attr("d", d3.select(record.pathEl).attr("d"));
    });

    ghost.raise();
    return ghost;
  }

  /**
   * Batch creation reuses the single-feature path but suppresses per-child
   * focus. Once all children are created, fit the local parent/sibling group
   * without invoking auto arrange.
   */
  async _spawnChildMapsFromSelection(records, x, y) {
    const createdMaps = [];
    const childRadius = this._getChildNodeRadius();
    const spacing = Math.max(44, childRadius * 0.68, this.r * 0.22);
    const clusterRadius = spacing * Math.max(1, Math.sqrt(records.length));

    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / records.length;
      const shouldUseCenter = records.length === 1;
      const targetX = shouldUseCenter ? x : x + Math.cos(angle) * clusterRadius;
      const targetY = shouldUseCenter ? y : y + Math.sin(angle) * clusterRadius;

      const childMap = await this._spawnChildMapFromFeature(
        record.feature,
        record.pathEl,
        targetX,
        targetY,
        { focus: false, select: false },
      );

      if (childMap) createdMaps.push(childMap);
    }

    if (!createdMaps.length) return [];

    this.clearChildFeatureSelection();
    this.manager.selectInstance(createdMaps[createdMaps.length - 1].instanceId);
    this.manager.fitInstancesInView(
      this.manager.getHierarchyLocalFamilyForChildren(
        createdMaps.map((map) => map.instanceId),
      ),
    );
    this.manager.emitNetworkChange();
    this.manager.updateOverview?.();

    return createdMaps;
  }

  async _spawnChildMapFromFeature(
    feature,
    sourcePathEl,
    x,
    y,
    { focus = true, select = true } = {},
  ) {
    const placeholderPayload = this._getSouthCarolinaChildPlaceholderPayload(
      sourcePathEl,
    );

    if (placeholderPayload) {
      return this._spawnLoadingChildMapFromFeature(
        placeholderPayload,
        feature,
        sourcePathEl,
        x,
        y,
        { focus, select },
      );
    }

    const childPayload = await this._loadChildMapPayload(feature, sourcePathEl);
    if (!childPayload) return null;

    const childRadius = this._getChildNodeRadius();
    const [spawnX, spawnY] = this._getSeparatedChildPosition(
      x,
      y,
      childRadius,
    );

    const childMap = this.manager.spawn({
      geojson: childPayload.geojson,
      backgroundGeojson: childPayload.backgroundGeojson,
      x: spawnX,
      y: spawnY,
      radius: childRadius,
      displayLevel: childPayload.displayLevel,
      geoResolution: childPayload.geoResolution,
      geoID: childPayload.geoID,
      geoLabel: childPayload.geoLabel,
      scopeId: childPayload.scopeId,
      scopeLabel: childPayload.scopeLabel,
      scopeLevel: childPayload.scopeLevel,
      variableOfInterest: this.curVar,
    });

    this.manager.graph.addEdge(
      `edge-from_${childPayload.parentUnitID}-to_${childMap.instanceId}`,
      childPayload.parentUnitID,
      childMap.instanceId,
      graphRelationship.hierarchical,
    );
    this._updateNodeHeader();

    if (select) this.manager.selectInstance(childMap.instanceId);
    if (focus) this.manager.focusOnHierarchyBranch(childMap.instanceId);
    return childMap;
  }

  async _spawnLoadingChildMapFromFeature(
    placeholderPayload,
    feature,
    sourcePathEl,
    x,
    y,
    { focus = true, select = true } = {},
  ) {
    const childRadius = this._getChildNodeRadius();
    const [spawnX, spawnY] = this._getSeparatedChildPosition(
      x,
      y,
      childRadius,
    );

    const childMap = this.manager.spawn({
      geojson: createEmptyFeatureCollection(),
      backgroundGeojson: null,
      x: spawnX,
      y: spawnY,
      radius: childRadius,
      displayLevel: placeholderPayload.displayLevel,
      geoResolution: placeholderPayload.geoResolution,
      geoID: placeholderPayload.geoID,
      geoLabel: placeholderPayload.geoLabel,
      scopeId: placeholderPayload.scopeId,
      scopeLabel: placeholderPayload.scopeLabel,
      scopeLevel: placeholderPayload.scopeLevel,
      isLoading: true,
      variableOfInterest: this.curVar,
    });

    this.manager.graph.addEdge(
      `edge-from_${placeholderPayload.parentUnitID}-to_${childMap.instanceId}`,
      placeholderPayload.parentUnitID,
      childMap.instanceId,
      graphRelationship.hierarchical,
    );
    this._updateNodeHeader();

    if (select) this.manager.selectInstance(childMap.instanceId);
    if (focus) this.manager.focusOnHierarchyBranch(childMap.instanceId);

    await waitForNextFrame();

    try {
      const childPayload = await this._loadChildMapPayload(feature, sourcePathEl);
      if (!childPayload) {
        childMap.destroy();
        this._updateNodeHeader();
        return null;
      }

      childMap.replaceLoadedMapPayload(childPayload);
      childMap.setLoading(false);
      this.manager.graph.updateLinks();
      this.manager.emitNetworkChange();
      this.manager.updateOverview?.();
      return childMap;
    } catch (error) {
      console.error("Failed to spawn child map:", error);
      childMap.destroy();
      this._updateNodeHeader();
      return null;
    }
  }

  /**
   * Resolve which lower-resolution GeoJSON should be used for a child map.
   * SC mode uses REGION -> counties and county-node STATE -> ZCTAs.
   * Legacy modes keep COUNTRY -> selected state counties and STATE -> ZIPs.
   */
  async _loadChildMapPayload(feature, sourcePathEl) {
    if (!this._canSpawnChildMap()) return null;

    const parentUnitID = d3.select(sourcePathEl).attr("id");
    const geoProperties = JSON.parse(
      d3.select(sourcePathEl).attr("geo-properties"),
    );

    try {
      if (
        this.manager.hierarchyMode?.id ===
        HIERARCHY_MODE_IDS.SC_REGION_COUNTY_ZCTA
      ) {
        return this._loadSouthCarolinaChildMapPayload(
          feature,
          parentUnitID,
          geoProperties,
        );
      }

      if (
        this.geoResolution === "REGION" ||
        this.geoResolution === "DIVISION"
      ) {
        const parentField =
          this.geoResolution === "REGION" ? "parentRegion" : "parentDivision";
        const selectedAreaId =
          geoProperties.id ?? geoProperties.name ?? geoProperties.NAME;
        if (!selectedAreaId) return null;

        const geojson = await loadGeojsonWithDataset({
          level: DATA_LEVELS.STATE,
          variableId: this.curVar,
        });
        geojson.features = geojson.features.filter(
          (candidateFeature) =>
            candidateFeature.properties?.[parentField] === selectedAreaId,
        );

        if (!geojson.features.length) return null;

        return {
          geojson: preprocessingGeoJSON(geojson, "COUNTRY"),
          parentUnitID,
          geoResolution: "COUNTRY",
          geoID: geoProperties.ID ?? selectedAreaId,
          geoLabel: selectedAreaId,
        };
      }

      if (this.geoResolution === "COUNTRY") {
        const selectedAreaName = getNameByMapResolution(feature, "COUNTRY");
        const stateAbbr = getAbbreviationFromFullName(selectedAreaName);
        if (!stateAbbr) return null;

        const geojson = preprocessingGeoJSON(
          await loadGeojsonWithDataset({
            level: DATA_LEVELS.COUNTY,
            stateAbbr,
            variableId: this.curVar,
          }),
          "STATE",
        );

        return {
          geojson,
          parentUnitID,
          geoResolution: "STATE",
          geoID: stateAbbr,
        };
      }

      if (this.geoResolution === "STATE") {
        if (
          this.manager.hierarchyMode?.id !==
          HIERARCHY_MODE_IDS.STATE_COUNTY_ZCTA
        ) {
          return null;
        }

        const backgroundGeojson = preprocessingGeoJSON(
          {
            type: "FeatureCollection",
            features: [cloneGeojsonFeature(feature)],
          },
          "STATE",
        );
        const geojson = preprocessingGeoJSON(
          await loadGeojsonWithDataset({
            level: DATA_LEVELS.ZCTA,
            stateAbbr: this.geoID,
            variableId: this.curVar,
          }),
          "COUNTY",
        );
        const stateID = geoProperties.STATEFP;
        const countyID = geoProperties.COUNTYFP;
        const fullCountyID = stateID.concat("", countyID);

        geojson.features = geojson.features.filter((candidateFeature) => {
          const parentCountyIds =
            candidateFeature.properties.parentCountyIds ??
            candidateFeature.properties.counties ??
            [];

          return parentCountyIds.includes(fullCountyID);
        });

        if (!geojson.features.length) return null;

        return {
          geojson,
          backgroundGeojson,
          parentUnitID,
          geoResolution: "COUNTY",
          geoID: parentUnitID,
        };
      }

      return null;
    } catch (error) {
      console.error("Failed to spawn child map:", error);
      return null;
    }
  }

  _getSouthCarolinaChildPlaceholderPayload(sourcePathEl) {
    if (
      this.manager.hierarchyMode?.id !==
        HIERARCHY_MODE_IDS.SC_REGION_COUNTY_ZCTA ||
      !this._canSpawnChildMap()
    ) {
      return null;
    }

    const parentUnitID = d3.select(sourcePathEl).attr("id");
    const geoProperties = JSON.parse(
      d3.select(sourcePathEl).attr("geo-properties"),
    );

    if (this.geoResolution === "REGION") {
      const selectedRegionName =
        geoProperties.regionName ??
        geoProperties.Region ??
        geoProperties.name ??
        geoProperties.NAME;
      const selectedRegionId =
        geoProperties.regionId ?? geoProperties.id ?? selectedRegionName;

      if (!selectedRegionName && !selectedRegionId) return null;

      return {
        parentUnitID,
        displayLevel: DATA_LEVELS.COUNTY,
        geoResolution: "STATE",
        geoID: normalizeComparableId(selectedRegionId),
        geoLabel: selectedRegionName,
        scopeId: normalizeComparableId(selectedRegionId),
        scopeLabel: selectedRegionName,
        scopeLevel: SC_SCOPE_LEVELS.REGION,
      };
    }

    if (this.geoResolution === "STATE") {
      const selectedCountyName =
        geoProperties.countyName ??
        geoProperties.NAME ??
        geoProperties.name ??
        geoProperties.county;
      const selectedCountyId =
        geoProperties.countyId ?? geoProperties.id ?? selectedCountyName;

      if (!selectedCountyName && !selectedCountyId) return null;

      return {
        parentUnitID,
        displayLevel: DATA_LEVELS.ZCTA,
        geoResolution: "COUNTY",
        geoID: normalizeComparableId(selectedCountyId),
        geoLabel: selectedCountyName,
        scopeId: normalizeComparableId(selectedCountyId),
        scopeLabel: selectedCountyName,
        scopeLevel: SC_SCOPE_LEVELS.COUNTY,
      };
    }

    return null;
  }

  async _loadSouthCarolinaChildMapPayload(
    feature,
    parentUnitID,
    geoProperties,
  ) {
    if (this.geoResolution === "REGION") {
      const selectedRegionName =
        geoProperties.regionName ??
        geoProperties.Region ??
        geoProperties.name ??
        geoProperties.NAME;
      const selectedRegionId =
        geoProperties.regionId ?? geoProperties.id ?? selectedRegionName;

      if (!selectedRegionName && !selectedRegionId) return null;

      const geojson = await loadGeojsonWithDataset({
        level: DATA_LEVELS.COUNTY,
        variableId: this.curVar,
        featureFilter: (candidateFeature) =>
          hasMatchingComparableId(
            [
              candidateFeature.properties?.parentRegion,
              candidateFeature.properties?.parentRegionId,
            ],
            [selectedRegionName, selectedRegionId],
          ),
      });

      if (!geojson.features.length) return null;

      return {
        geojson: preprocessingGeoJSON(geojson, "STATE"),
        parentUnitID,
        displayLevel: DATA_LEVELS.COUNTY,
        geoResolution: "STATE",
        geoID: normalizeComparableId(selectedRegionId),
        geoLabel: selectedRegionName,
        scopeId: normalizeComparableId(selectedRegionId),
        scopeLabel: selectedRegionName,
        scopeLevel: SC_SCOPE_LEVELS.REGION,
      };
    }

    if (this.geoResolution === "STATE") {
      const selectedCountyName =
        geoProperties.countyName ??
        geoProperties.NAME ??
        geoProperties.name ??
        geoProperties.county;
      const selectedCountyId =
        geoProperties.countyId ?? geoProperties.id ?? selectedCountyName;

      if (!selectedCountyName && !selectedCountyId) return null;

      const backgroundGeojson = preprocessingGeoJSON(
        {
          type: "FeatureCollection",
          features: [cloneGeojsonFeature(feature)],
        },
        "STATE",
      );
      const geojson = preprocessingGeoJSON(
        await loadGeojsonWithDataset({
          level: DATA_LEVELS.ZCTA,
          variableId: this.curVar,
          featureFilter: (candidateFeature) =>
            hasMatchingComparableId(
              [
                candidateFeature.properties?.parentCountyName,
                candidateFeature.properties?.parentCountyId,
              ],
              [selectedCountyName, selectedCountyId],
            ),
        }),
        "COUNTY",
      );

      if (!geojson.features.length) return null;

      return {
        geojson,
        backgroundGeojson,
        parentUnitID,
        displayLevel: DATA_LEVELS.ZCTA,
        geoResolution: "COUNTY",
        geoID: normalizeComparableId(selectedCountyId),
        geoLabel: selectedCountyName,
        scopeId: normalizeComparableId(selectedCountyId),
        scopeLabel: selectedCountyName,
        scopeLevel: SC_SCOPE_LEVELS.COUNTY,
      };
    }

    return null;
  }

  _getTranslate() {
    const tr = this.root.attr("transform") || "translate(0,0)";
    const m = /translate\(([-\d.]+)[ ,]([-\d.]+)\)/.exec(tr);
    return m ? [parseFloat(m[1]), parseFloat(m[2])] : [0, 0];
  }

  _viewportToInstance(vx, vy) {
    const [tx, ty] = this._getTranslate();
    return [vx - tx, vy - ty];
  }

  setVariableOptions() {
    const fo = this.gOptions
      .append("foreignObject")
      .attr("x", -NODE_VARIABLE_SELECT_WIDTH - 12)
      .attr("y", 0)
      .attr("width", NODE_VARIABLE_SELECT_WIDTH)
      .attr("height", NODE_VARIABLE_SELECT_HEIGHT);

    this.variableSelect = fo
      .append("xhtml:div")
      .style("font-family", "sans-serif")
      .style("background", "white")
      .style("box-sizing", "border-box")
      .style("width", "100%")
      .style("height", "100%")
      .style("padding", "4px 6px")
      .style("border-radius", "4px")
      .append("select")
      .attr("id", `${this.instanceId}-geoSelect`)
      .attr("class", "node-variable-select")
      .attr("title", this.getVariableLabel(this.curVar))
      .style("box-sizing", "border-box")
      .style("width", "100%")
      .style("height", "100%")
      .style("font-size", "12px")
      .on("change", (event) => {
        this.setVariable(event.target.value).catch((error) => {
          console.error("Failed to update map variable:", error);
        });
      });

    this.variableSelect
      .selectAll("option")
      .data(this.varOptions)
      .join("option")
      .attr("value", (d) => d.value)
      .attr("title", (d) => d.label)
      .text((d) => d.shortLabel ?? d.label);

    this.variableSelect.property("value", this.curVar);
  }

  async setVariable(
    variable,
    { emit = true, syncColor = true, cascade = true } = {},
  ) {
    if (!this.varOptions.some((option) => option.value === variable)) return;

    this.curVar = variable;
    this.variableSelect
      ?.property("value", variable)
      .attr("title", this.getVariableLabel(variable));
    this._updateNodeHeader();
    await applyDatasetToGeojson(this.geojson, {
      level: getDatasetLevelForGeoResolution(this.geoResolution),
      variableId: variable,
    });

    const affectedInstanceIds = [this.instanceId];

    if (cascade) {
      const descendantIds = await this.manager.syncDescendantVariables(
        this.instanceId,
        variable,
      );
      affectedInstanceIds.push(...descendantIds);
    }

    if (syncColor) {
      this.manager.refreshColorScalesForInstances(affectedInstanceIds);
    }
    if (emit) {
      this.manager.emitNetworkChange();
      this.manager.updateGroups?.();
    }
  }

  async setDisplayLevel(displayLevel, { emit = true } = {}) {
    const options = this.getDisplayLevelOptions();
    if (!options.includes(displayLevel)) return;
    if (displayLevel === this.displayLevel) return;
    if (this.hasHierarchyChildren()) return;

    this.setLoading(true, "loading map");
    await waitForNextFrame();

    try {
      const nextGeojson = await this._loadScopedDisplayGeojson(displayLevel);
      if (!nextGeojson.features.length) return;

      const nextBackgroundGeojson =
        await this._loadScopedBackgroundGeojson(displayLevel);

      this.clearChildFeatureSelection();
      this.displayLevel = displayLevel;
      this.geoResolution = getGeoResolutionForDisplayLevel(displayLevel);
      this.geojson = nextGeojson;
      this.backgroundGeojson = nextBackgroundGeojson;

      this._refreshRenderedGeography();
      this._updateNodeHeader();
      this.manager.graph.updateLinks();

      if (emit) {
        this.manager.emitNetworkChange();
        this.manager.updateOverview?.();
      }
    } finally {
      this.setLoading(false);
      this._updateNodeHeader();
    }
  }

  replaceLoadedMapPayload(childPayload) {
    this.displayLevel = childPayload.displayLevel ?? this.displayLevel;
    this.geoResolution = childPayload.geoResolution ?? this.geoResolution;
    this.geoID = childPayload.geoID ?? this.geoID;
    this.geoLabel = childPayload.geoLabel ?? this.geoLabel;
    this.scopeId = childPayload.scopeId ?? this.scopeId;
    this.scopeLabel = childPayload.scopeLabel ?? this.scopeLabel;
    this.scopeLevel = childPayload.scopeLevel ?? this.scopeLevel;
    this.geojson = childPayload.geojson ?? createEmptyFeatureCollection();
    this.backgroundGeojson = childPayload.backgroundGeojson ?? null;

    this._refreshRenderedGeography();
    this._updateNodeHeader();
  }

  async _loadScopedDisplayGeojson(displayLevel) {
    const geojson = await loadGeojsonWithDataset({
      level: displayLevel,
      variableId: this.curVar,
      featureFilter: (feature) =>
        this._isFeatureInCurrentScope(feature.properties, displayLevel),
    });

    return preprocessingGeoJSON(
      geojson,
      getPreprocessResolutionForDisplayLevel(displayLevel),
    );
  }

  async _loadScopedBackgroundGeojson(displayLevel) {
    if (
      this.scopeLevel !== SC_SCOPE_LEVELS.COUNTY ||
      displayLevel !== DATA_LEVELS.ZCTA
    ) {
      return null;
    }

    const backgroundGeojson = await loadGeojsonWithDataset({
      level: DATA_LEVELS.COUNTY,
      variableId: this.curVar,
      featureFilter: (feature) =>
        this._isFeatureInCurrentScope(feature.properties, DATA_LEVELS.COUNTY),
    });

    if (!backgroundGeojson.features.length) return null;

    return preprocessingGeoJSON(backgroundGeojson, "STATE");
  }

  _isFeatureInCurrentScope(properties = {}, displayLevel = this.displayLevel) {
    if (this.scopeLevel === SC_SCOPE_LEVELS.STATE) return true;

    if (this.scopeLevel === SC_SCOPE_LEVELS.REGION) {
      if (displayLevel === DATA_LEVELS.REGION) {
        return hasMatchingComparableId(
          [
            properties.regionName,
            properties.Region,
            properties.regionId,
            properties.id,
          ],
          [this.scopeLabel, this.scopeId],
        );
      }

      return hasMatchingComparableId(
        [
          properties.parentRegion,
          properties.parentRegionId,
          properties.regionName,
          properties.Region,
        ],
        [this.scopeLabel, this.scopeId],
      );
    }

    if (this.scopeLevel === SC_SCOPE_LEVELS.COUNTY) {
      if (displayLevel === DATA_LEVELS.COUNTY) {
        return hasMatchingComparableId(
          [
            properties.countyName,
            properties.NAME,
            properties.countyId,
            properties.id,
          ],
          [this.scopeLabel, this.scopeId],
        );
      }

      return hasMatchingComparableId(
        [
          properties.parentCountyName,
          properties.parentCountyId,
          properties.countyName,
          properties.county,
        ],
        [this.scopeLabel, this.scopeId],
      );
    }

    return true;
  }

  _refreshRenderedGeography() {
    this._updateProjection();
    this._drawBackgroundFeatures();
    this._drawFeatures();
    this._registerFeatureGraphNodes();
    this._attachFeatureCloneDrag();
    this.setColorScheme(this.getCurrentFeatureValues());
    this._renderAnnotationPins();
  }

  getVariableLabel(variable) {
    return (
      this.varOptions.find((option) => option.value === variable)?.label ??
      variable
    );
  }

  setGroupedChromeHidden(isHidden) {
    const display = isHidden ? "none" : null;

    this.gOptions?.style("display", display);
    this.gLegend?.style("display", display);
  }

  setPosition(x, y, { deferRender = false } = {}) {
    this.x = x;
    this.y = y;

    if (deferRender) {
      this._schedulePositionRender();
      return;
    }

    this._flushPositionRender();
    this._renderPosition();
  }

  _renderPosition() {
    this.root.attr("transform", `translate(${this.x},${this.y})`);
  }

  _schedulePositionRender() {
    if (this.__positionRenderFrame !== null) return;

    const requestFrame =
      typeof window.requestAnimationFrame === "function"
        ? window.requestAnimationFrame.bind(window)
        : (callback) => window.setTimeout(callback, 16);

    this.__positionRenderFrame = requestFrame(() => {
      this.__positionRenderFrame = null;
      this._renderPosition();
    });
  }

  _flushPositionRender() {
    if (this.__positionRenderFrame === null) return;

    const cancelFrame =
      typeof window.cancelAnimationFrame === "function"
        ? window.cancelAnimationFrame.bind(window)
        : window.clearTimeout.bind(window);

    cancelFrame(this.__positionRenderFrame);
    this.__positionRenderFrame = null;
    this._renderPosition();
  }

  setRadius(radius, { emit = true } = {}) {
    const nextRadius = clamp(radius, this.minRadius, this.maxRadius);

    if (Math.abs(nextRadius - this.r) < 0.5) return;

    this.r = nextRadius;
    this.circle.attr("r", nextRadius);
    this._applyCircleClip(nextRadius);
    this._updateProjection();
    this.gBase
      .selectAll(`.background-path-${this.instanceId}`)
      .attr("d", this.path);
    this.gBase.selectAll(`.path-${this.instanceId}`).attr("d", this.path);
    this._layoutNodeChrome();
    this._renderAnnotationPins();
    this.manager.graph.updateLinks();

    if (emit) {
      this.manager.emitNetworkChange();
      this.manager.updateOverview?.();
    }
  }

  setSelected(isSelected) {
    this.root.classed("is-selected", isSelected);
    this.circle.classed("is-selected", isSelected);
  }

  getNodeAreaLabel() {
    return this.scopeLabel ?? this.geoLabel ?? this.geoID ?? "selected area";
  }

  getDisplayLevelOptions() {
    return (
      DISPLAY_LEVEL_OPTIONS_BY_SCOPE[this.scopeLevel] ?? [this.displayLevel]
    );
  }

  hasHierarchyChildren() {
    const featureIdPrefix = `${this.instanceId}-innerarea-`;

    return this.manager.graph.edges.some(
      (edge) =>
        edge.edgeType === graphRelationship.hierarchical &&
        String(edge.parentId).startsWith(featureIdPrefix),
    );
  }

  getDisplayLevelLabel(displayLevel = this.displayLevel) {
    return DISPLAY_LEVEL_LABELS[displayLevel] ?? displayLevel;
  }

  getNodeTitle() {
    if (this._usesScopedDisplayLevelControl()) {
      return `${this.getNodeAreaLabel()} ${this.getDisplayLevelLabel()}`;
    }

    if (this.geoResolution === "REGION") {
      if (
        this.manager.hierarchyMode?.id ===
        HIERARCHY_MODE_IDS.SC_REGION_COUNTY_ZCTA
      ) {
        return this.geoLabel ?? "South Carolina regions";
      }

      return "US regions";
    }

    if (this.geoResolution === "DIVISION") {
      return "US divisions";
    }

    if (this.geoResolution === "COUNTRY" && this.geoID === "USA") {
      return "US states";
    }

    if (this.geoResolution === "COUNTRY") {
      return `${this.geoLabel} states`;
    }

    if (this.geoResolution === "STATE") {
      return `${this.geoLabel ?? this.geoID} counties`;
    }

    if (this.geoResolution === "COUNTY") {
      return `${this.geoLabel ?? "county"} ZCTAs`;
    }

    return `${this.geoResolution.toLowerCase()} map`;
  }

  getScaleLabel() {
    if (this._usesScopedDisplayLevelControl()) {
      if (this.displayLevel === DATA_LEVELS.REGION) return "region scale";
      if (this.displayLevel === DATA_LEVELS.COUNTY) return "county scale";
      if (this.displayLevel === DATA_LEVELS.ZCTA) return "ZCTA scale";
    }

    if (this.geoResolution === "REGION") return "region scale";
    if (this.geoResolution === "DIVISION") return "division scale";
    if (this.geoResolution === "COUNTRY") return "state scale";
    if (this.geoResolution === "STATE") return "county scale";
    if (this.geoResolution === "COUNTY") return "ZCTA scale";
    return `${this.geoResolution.toLowerCase()} scale`;
  }

  getNetworkSummary(parentLabel = "workspace root") {
    return {
      id: this.instanceId,
      title: this.getNodeTitle(),
      scale: this.getScaleLabel(),
      variable: this.curVar,
      featureCount: this.geojson.features.length,
      parentLabel,
      x: Math.round(this.x),
      y: Math.round(this.y),
      radius: Math.round(this.r),
    };
  }

  highlightArea(targetID) {
    d3.selectAll(`.path-${this.instanceId}`).sort(function (a, b) {
      const isA = a.properties.ID === targetID;
      const isB = b.properties.ID === targetID;
      return isA === isB ? 0 : isA ? 1 : -1;
    });

    d3.select(`#${this.instanceId}-innerarea-${targetID}`)
      .attr("stroke", "blue")
      .attr("stroke-width", 3);
  }

  dehighlightArea(targetID) {
    d3.select(`#${this.instanceId}-innerarea-${targetID}`)
      .attr("stroke", (d) => this._getFeatureStroke(d))
      .attr("stroke-width", (d) => this._getFeatureStrokeWidth(d));
  }

  highlightParentNodeArea() {
    this.manager.setHierarchyHoverForInstance(this.instanceId);
  }

  dehighlightParentNodeArea() {
    this.manager.clearHierarchyHoverForInstance(this.instanceId);
  }

  updateColorScheme() {
    const group = this.manager.getGroupForInstance(this.instanceId);

    if (group) {
      this.manager.applyGroupColorScheme(group);
      return;
    }

    this.resetColorScheme();
  }

  getCurrentFeatureValues() {
    return this.geojson.features.map(
      (feature) => feature.properties[this.curVar],
    );
  }

  resetColorScheme() {
    this.setColorScheme(this.getCurrentFeatureValues());
  }

  setColorScheme(featureVals) {
    this.colorTheme = getColorTheme(featureVals, "sequential", "discrete");

    this.gLegend.html("");
    drawColorLegend(this.gLegend, this.colorTheme);

    this.gBase
      .selectAll(`.path-${this.instanceId}`)
      .transition()
      .duration(250)
      .attr("fill", (d) => this._getFeatureFill(d))
      .attr("stroke", (d) => this._getFeatureStroke(d))
      .attr("stroke-width", (d) => this._getFeatureStrokeWidth(d));
  }

  _getComparisonInstances() {
    return this.manager.getGroupedPeerInstances(this.instanceId);
  }

  _isInternalPointerTransition(event) {
    const rootNode = this.root.node();
    const relatedTarget = event.relatedTarget;

    return Boolean(
      rootNode &&
        relatedTarget &&
        relatedTarget instanceof Node &&
        rootNode.contains(relatedTarget),
    );
  }
}

function clamp(value, min, max) {
  if (max < min) return (min + max) / 2;
  return Math.min(Math.max(value, min), max);
}
