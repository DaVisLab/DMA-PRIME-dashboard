import { GraphManager, graphRelationship } from "./LineConnector.js";
import { DraggableMap } from "./DraggableMap.js";
import { drawColorLegend, preprocessingGeoJSON } from "./helper.js";
import { getFeatureDisplayName } from "./FeatureTooltip.js";
import {
  DEFAULT_DATA_VARIABLE_ID,
  loadGeojsonWithDataset,
} from "./DataRepository.js";
import {
  DEFAULT_HIERARCHY_MODE_ID,
  getHierarchyModeById,
} from "./HierarchyConfig.js";

const d3 = window.d3;

export const mapResolutions = {
  WORLD: 0,
  COUNTRY: 1,
  STATE: 2,
  REGION: 3,
  COUNTY: 4,
  ZIP: 5,
};

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 12;
const VIEW_FIT_PADDING = 72;
const VIEW_CONTAINMENT_PADDING = 8;
const NODE_CONTAINMENT_PAD = 4;
const NODE_VIEW_SIDE_PAD = 24;
const NODE_VIEW_TOP_PAD = 92;
const NODE_VIEW_BOTTOM_PAD = 28;
const HIERARCHY_HOVER_STROKE = "#0d6efd";
const HIERARCHY_HOVER_STROKE_WIDTH = 4;
const DEFAULT_FEATURE_STROKE = "#ffffff";
const DEFAULT_FEATURE_STROKE_WIDTH = 1;
const MARQUEE_SELECTION_MIN_DISTANCE = 4;
const GROUP_CONTROL_GAP = 10;
const GROUP_VARIABLE_WIDTH = 132;
const GROUP_VARIABLE_HEIGHT = 30;
const GROUP_LEGEND_WIDTH = 156;
const GROUP_LEGEND_HEIGHT = 38;
const GROUP_HEADER_MIN_WIDTH =
  14 + 72 + GROUP_CONTROL_GAP + GROUP_VARIABLE_WIDTH + GROUP_CONTROL_GAP +
  GROUP_LEGEND_WIDTH + 14;
const INTERACTION_SURFACE_SELECTOR =
  ".map-instance, .map-overview, .context-menu";
const TEXT_ENTRY_SELECTOR =
  "input, textarea, select, [contenteditable='true'], [contenteditable='']";
const CONTEXT_MENU_VIEWPORT_MARGIN = 8;
const CONTEXT_MENU_OPTIONS = [
  { label: "New Map", value: "spawnNewMap" },
  { label: "Make Annotation", value: "makeAnnotation" },
  { label: "Delete Map", value: "deleteMap" },
  { label: "Group Selected", value: "groupSelected" },
  { label: "Ungroup Selected", value: "ungroupSelected" },
];

export class MapManager {
  constructor(
    svgEl,
    {
      onNetworkChange,
      onSelectionChange,
      onAnnotationsChange,
      onAnnotationHover,
      hierarchyMode = DEFAULT_HIERARCHY_MODE_ID,
    } = {},
  ) {
    this.svg = d3.select(svgEl);
    this.width = svgEl.clientWidth || 960;
    this.height = svgEl.clientHeight || 600;
    this.menu = document.getElementById("contextMenu");
    this.onNetworkChange = onNetworkChange;
    this.onSelectionChange = onSelectionChange;
    this.onAnnotationsChange = onAnnotationsChange;
    this.onAnnotationHover = onAnnotationHover;
    this.hierarchyMode = getHierarchyModeById(hierarchyMode?.id ?? hierarchyMode);
    this.selectedInstanceId = null;
    this.selectedInstanceIds = new Set();
    this.activeGroupSelectionId = null;
    this.groups = new Map();
    this.groupSeq = 0;
    this.previewedAnnotationId = null;
    this.contextMenuWorldPoint = null;
    this.contextMenuTargetInstances = [];
    this.contextMenuAnnotationTarget = null;
    this.hoveredHierarchySourceId = null;
    this.hoveredHierarchyFeatureIds = new Set();
    this.hoveredHierarchyEdgeIds = new Set();
    this.hoveredHierarchyInstanceIds = new Set();
    this.instances = [];
    this.graphUpdateFrame = null;
    this.marqueeSelectionBaseIds = new Set();
    this.marqueeSelectionStartScreen = null;
    this.marqueeSelectionStartWorld = null;
    this.marqueeSelectionRect = null;
    this.didMarqueeSelect = false;

    this.svg.attr("viewBox", `0 0 ${this.width} ${this.height}`);
    this.bindWorkspaceEvents();
    this.initLayers();
    this.initZoom();
    this.initMarqueeSelection();
    this.initMenuOptions();
    this.updateOverview();
  }

  bindWorkspaceEvents() {
    this.svg.on("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showMenu(e);
    });
    this.svg.on("click.selection", (event) => {
      if (this.didMarqueeSelect) {
        this.didMarqueeSelect = false;
        return;
      }
      if (event.defaultPrevented) return;
      if (event.shiftKey) return;

      this.hideMenu();
      this.clearAllChildFeatureSelections();
      this.clearInstanceSelection();
    });
    d3.select(document).on("click.mapManagerSelection", (event) => {
      if (event.defaultPrevented) return;
      if (event.target?.closest?.(INTERACTION_SURFACE_SELECTOR)) return;

      this.hideMenu();
      this.clearAllChildFeatureSelections();
      this.clearInstanceSelection();
    });
    d3.select(window).on("keydown.mapManagerDelete", (event) => {
      if (this.isTextEntryTarget(event.target)) return;

      if (event.key !== "Delete" && event.key !== "Backspace") return;

      const selectedInstances = this.getSelectedInstances();
      if (!selectedInstances.length) return;

      event.preventDefault();
      this.deleteInstances(selectedInstances);
    });
  }

  initLayers() {
    this.viewport = this.svg.append("g").attr("class", "viewport");

    this.graph = new GraphManager(
      this,
      this.svg,
      this.viewport,
      "g-layer-links",
    );
    this.graphLayer = d3.select(`#g-layer-links`);
    this.groupLayer = this.viewport
      .insert("g", "#g-layer-links")
      .attr("class", "map-group-layer");
    this.selectionLayer = this.svg
      .append("g")
      .attr("class", "selection-layer")
      .style("pointer-events", "none");
    this.overviewLayer = this.svg
      .append("g")
      .attr("class", "map-overview")
      .attr("aria-label", "layout overview");
  }

  initZoom() {
    this.zoom = d3
      .zoom()
      .filter((event) => this.shouldHandleZoomEvent(event))
      .scaleExtent([MIN_ZOOM, MAX_ZOOM])
      .on("zoom", (event) => {
        this.hideMenu();
        this.viewport.attr("transform", event.transform);
        this.graph.updateLinks();
      });

    this.svg.call(this.zoom);
    this.svg.on("dblclick.zoom", null);
  }

  shouldHandleZoomEvent(event) {
    if (event?.type === "mousedown" && event.shiftKey) return false;

    return (!event.ctrlKey || event.type === "wheel") && !event.button;
  }

  /**
   * Shift-dragging empty canvas space is reserved for marquee selection. Keeping
   * this separate from d3.zoom lets normal drag still pan the viewport.
   */
  initMarqueeSelection() {
    this.marqueeDrag = d3
      .drag()
      .filter((event) => this.shouldStartMarqueeSelection(event))
      .on("start", (event) => this.startMarqueeSelection(event))
      .on("drag", (event) => this.updateMarqueeSelection(event))
      .on("end", (event) => this.endMarqueeSelection(event));

    this.svg.call(this.marqueeDrag);
  }

  shouldStartMarqueeSelection(event) {
    if (!event.shiftKey || event.button) return false;
    if (this.isTextEntryTarget(event.target)) return false;
    if (event.target?.closest?.(INTERACTION_SURFACE_SELECTOR)) return false;

    return true;
  }

  startMarqueeSelection(event) {
    event.sourceEvent?.preventDefault();
    event.sourceEvent?.stopPropagation();

    this.hideMenu();
    this.clearAllChildFeatureSelections();
    this.marqueeSelectionBaseIds = new Set(this.selectedInstanceIds);
    this.marqueeSelectionStartScreen = this.getSvgPointer(event);
    this.marqueeSelectionStartWorld = this.pointerToViewport(event);
    this.didMarqueeSelect = false;

    const [x, y] = this.marqueeSelectionStartScreen;
    this.selectionLayer.selectAll("*").remove();
    this.marqueeSelectionRect = this.selectionLayer
      .append("rect")
      .attr("class", "selection-marquee")
      .attr("x", x)
      .attr("y", y)
      .attr("width", 0)
      .attr("height", 0);

    this.svg.classed("is-marquee-selecting", true);
  }

  updateMarqueeSelection(event) {
    event.sourceEvent?.preventDefault();
    event.sourceEvent?.stopPropagation();
    if (!this.marqueeSelectionStartScreen || !this.marqueeSelectionStartWorld) {
      return;
    }

    const currentScreen = this.getSvgPointer(event);
    const currentWorld = this.pointerToViewport(event);
    const screenRect = this.getNormalizedRect(
      this.marqueeSelectionStartScreen,
      currentScreen,
    );
    const dragDistance = Math.hypot(
      currentScreen[0] - this.marqueeSelectionStartScreen[0],
      currentScreen[1] - this.marqueeSelectionStartScreen[1],
    );

    this.marqueeSelectionRect
      ?.attr("x", screenRect.minX)
      .attr("y", screenRect.minY)
      .attr("width", screenRect.maxX - screenRect.minX)
      .attr("height", screenRect.maxY - screenRect.minY);

    if (dragDistance < MARQUEE_SELECTION_MIN_DISTANCE) return;

    const worldRect = this.getNormalizedRect(
      this.marqueeSelectionStartWorld,
      currentWorld,
    );
    const hitIds = this.getInstancesInSelectionRect(worldRect).map(
      (instance) => instance.instanceId,
    );
    const selectedIds = new Set(this.marqueeSelectionBaseIds);

    hitIds.forEach((id) => selectedIds.add(id));
    this.setInstanceSelection(Array.from(selectedIds), {
      clearChildSelections: false,
    });
    this.didMarqueeSelect = true;
  }

  endMarqueeSelection(event) {
    event.sourceEvent?.preventDefault();
    event.sourceEvent?.stopPropagation();

    this.marqueeSelectionRect?.remove();
    this.marqueeSelectionRect = null;
    this.marqueeSelectionBaseIds = new Set();
    this.marqueeSelectionStartScreen = null;
    this.marqueeSelectionStartWorld = null;
    this.svg.classed("is-marquee-selecting", false);

    if (this.didMarqueeSelect) {
      window.setTimeout(() => {
        this.didMarqueeSelect = false;
      }, 0);
    }
  }

  getSvgPointer(event) {
    return d3.pointer(event.sourceEvent ?? event, this.svg.node());
  }

  getNormalizedRect([x0, y0], [x1, y1]) {
    return {
      minX: Math.min(x0, x1),
      maxX: Math.max(x0, x1),
      minY: Math.min(y0, y1),
      maxY: Math.max(y0, y1),
    };
  }

  getInstancesInSelectionRect(rect) {
    return this.instances.filter((instance) =>
      this.circleIntersectsRect(instance.x, instance.y, instance.r, rect),
    );
  }

  circleIntersectsRect(cx, cy, r, rect) {
    const closestX = clamp(cx, rect.minX, rect.maxX);
    const closestY = clamp(cy, rect.minY, rect.maxY);
    return Math.hypot(cx - closestX, cy - closestY) <= r;
  }

  isTextEntryTarget(target) {
    return Boolean(target?.closest?.(TEXT_ENTRY_SELECTOR));
  }

  /**
   * Spawn a brand-new DraggableMap instance at (x,y) in SVG coords.
   */
  spawn({
    geojson,
    backgroundGeojson,
    x,
    y,
    radius,
    geoResolution,
    geoID,
    geoLabel,
    displayLevel,
    scopeId,
    scopeLabel,
    scopeLevel,
    isLoading,
    variableOfInterest,
  }) {
    const map = new DraggableMap({
      manager: this,
      geojson,
      backgroundGeojson,
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
      isLoading,
      variableOfInterest,
    });

    this.instances.push(map);
    this.graphLayer.raise();
    this.emitNetworkChange();
    this.updateOverview();
    return map;
  }

  getDefaultRadius() {
    const shortSide = Math.min(this.width, this.height);
    return Math.min(220, Math.max(110, shortSide * 0.34));
  }

  selectInstance(instanceId, { additive = false } = {}) {
    if (!this.instances.some((instance) => instance.instanceId === instanceId)) {
      return;
    }

    this.clearAllChildFeatureSelections();
    this.activeGroupSelectionId = null;
    const targetIds = this.getSelectionTargetIds(instanceId);

    if (additive) {
      const isSelected = targetIds.every((id) => this.selectedInstanceIds.has(id));

      if (isSelected && this.selectedInstanceIds.size > targetIds.length) {
        targetIds.forEach((id) => this.selectedInstanceIds.delete(id));
      } else {
        targetIds.forEach((id) => this.selectedInstanceIds.add(id));
      }
    } else {
      this.selectedInstanceIds = new Set(targetIds);
    }

    if (!this.selectedInstanceIds.has(instanceId)) {
      const selectedIds = Array.from(this.selectedInstanceIds);
      this.selectedInstanceId = selectedIds[selectedIds.length - 1] ?? null;
    } else {
      this.selectedInstanceId = instanceId;
    }

    this.syncInstanceSelection();
  }

  getSelectionTargetIds(instanceId) {
    return [instanceId];
  }

  clearInstanceSelection() {
    if (!this.selectedInstanceIds.size && !this.selectedInstanceId) return;

    this.selectedInstanceIds.clear();
    this.selectedInstanceId = null;
    this.activeGroupSelectionId = null;
    this.syncInstanceSelection();
  }

  clearAllChildFeatureSelections() {
    this.instances.forEach((instance) => {
      instance.clearChildFeatureSelection?.();
    });
  }

  setInstanceSelection(instanceIds, { clearChildSelections = true } = {}) {
    if (clearChildSelections) this.clearAllChildFeatureSelections();

    const nextSelectedIds = new Set();
    instanceIds.forEach((instanceId) => {
      this.getSelectionTargetIds(instanceId).forEach((id) => {
        if (this.getInstanceById(id)) nextSelectedIds.add(id);
      });
    });

    const orderedSelectedIds = Array.from(nextSelectedIds);
    const nextSelectedId =
      orderedSelectedIds[orderedSelectedIds.length - 1] ?? null;
    if (
      this.selectedInstanceId === nextSelectedId &&
      this.areSetsEqual(this.selectedInstanceIds, nextSelectedIds)
    ) {
      return;
    }

    this.selectedInstanceIds = nextSelectedIds;
    this.selectedInstanceId = nextSelectedId;
    this.activeGroupSelectionId = null;
    this.syncInstanceSelection();
  }

  areSetsEqual(a, b) {
    if (a.size !== b.size) return false;
    return Array.from(a).every((value) => b.has(value));
  }

  isInstanceSelected(instanceId) {
    return this.selectedInstanceIds.has(instanceId);
  }

  getSelectedInstances() {
    return this.instances.filter((instance) =>
      this.selectedInstanceIds.has(instance.instanceId),
    );
  }

  getDragSelectionForInstance(instanceId) {
    const selectedInstances = this.getSelectedInstances();
    const activeInstance = this.getInstanceById(instanceId);

    if (this.shouldDragInstanceIndividually(instanceId)) {
      return activeInstance ? [activeInstance] : [];
    }

    if (
      activeInstance &&
      this.selectedInstanceIds.has(instanceId) &&
      selectedInstances.length > 1
    ) {
      return selectedInstances;
    }

    return activeInstance ? [activeInstance] : [];
  }

  shouldDragInstanceIndividually(instanceId) {
    if (!this.activeGroupSelectionId) return false;

    const group = this.groups.get(this.activeGroupSelectionId);
    return Boolean(group?.memberIds.includes(instanceId));
  }

  getResizeSelectionForInstance(instanceId) {
    return this.getDragSelectionForInstance(instanceId);
  }

  syncInstanceSelection() {
    const groupedIds = new Set();
    this.groups.forEach((group) => {
      group.memberIds.forEach((id) => groupedIds.add(id));
    });

    this.instances.forEach((instance) => {
      instance.setSelected(this.selectedInstanceIds.has(instance.instanceId));
      instance.root?.classed("is-grouped", groupedIds.has(instance.instanceId));
    });

    this.onSelectionChange?.(this.selectedInstanceId);
    this.emitNetworkChange();
    this.updateOverview();
    this.updateGroups();
  }

  scheduleGraphUpdate() {
    if (this.graphUpdateFrame !== null) return;

    const requestFrame =
      typeof window.requestAnimationFrame === "function"
        ? window.requestAnimationFrame.bind(window)
        : (callback) => window.setTimeout(callback, 16);

    this.graphUpdateFrame = requestFrame(() => {
      this.graphUpdateFrame = null;
      this.graph.updateLinks();
    });
  }

  flushGraphUpdate() {
    if (this.graphUpdateFrame !== null) {
      const cancelFrame =
        typeof window.cancelAnimationFrame === "function"
          ? window.cancelAnimationFrame.bind(window)
          : window.clearTimeout.bind(window);
      cancelFrame(this.graphUpdateFrame);
      this.graphUpdateFrame = null;
    }

    this.graph.updateLinks();
  }

  emitNetworkChange() {
    this.onNetworkChange?.(this.getNetworkSnapshot());
  }

  emitAnnotationsChange() {
    this.onAnnotationsChange?.(this.getAnnotationSnapshot());
  }

  getAnnotationSnapshot() {
    return this.instances.flatMap((instance) =>
      instance.getSavedAnnotations?.() ?? [],
    );
  }

  getAnnotationTarget(annotationId) {
    for (const instance of this.instances) {
      const pin = instance.getAnnotationPin?.(annotationId);
      if (pin) return { instance, pin };
    }

    return null;
  }

  updateAnnotation(annotationId, note) {
    const target = this.getAnnotationTarget(annotationId);
    if (!target) return;

    target.instance.updateAnnotationPinNote(annotationId, note, { emit: true });
    this.previewAnnotation(annotationId, { pan: false });
  }

  deleteAnnotation(annotationId) {
    const target = this.getAnnotationTarget(annotationId);
    if (!target) return;

    this.clearAnnotationPreview({ notify: false });
    target.instance.deleteAnnotationPin(annotationId, { emit: true });
    this.onAnnotationHover?.(null);
  }

  previewAnnotation(
    annotationId,
    { pan = false, notify = true } = {},
  ) {
    const target = this.getAnnotationTarget(annotationId);
    if (!target) return;

    this.clearAnnotationPreview({ notify: false });
    this.previewedAnnotationId = annotationId;
    target.instance.setAnnotationPreview(annotationId, true);
    target.instance.highlightArea(target.pin.featureId);

    if (pan) this.panToInstance(target.instance);
    if (notify) this.onAnnotationHover?.(annotationId);
  }

  clearAnnotationPreview({ notify = true } = {}) {
    if (!this.previewedAnnotationId) {
      if (notify) this.onAnnotationHover?.(null);
      return;
    }

    const target = this.getAnnotationTarget(this.previewedAnnotationId);
    if (target) {
      target.instance.setAnnotationPreview(this.previewedAnnotationId, false);
      target.instance.dehighlightArea(target.pin.featureId);
    }

    this.previewedAnnotationId = null;
    if (notify) this.onAnnotationHover?.(null);
  }

  getNetworkSnapshot() {
    const nodes = this.instances.map((instance) =>
      instance.getNetworkSummary(this.getParentAreaLabel(instance.instanceId)),
    );

    const edges = this.graph.edges
      .filter((edge) => edge.edgeType === graphRelationship.hierarchical)
      .map((edge) => ({
        id: edge.id,
        type: "hierarchical",
        parentId: edge.parentId,
        childId: edge.childId,
        parentLabel: this.getParentAreaLabel(edge.childId),
        childLabel: this.getInstanceTitle(edge.childId),
      }));

    return {
      nodes,
      edges,
      selectedNodeId: this.selectedInstanceId,
      selectedNodeIds: Array.from(this.selectedInstanceIds),
    };
  }

  getInstanceTitle(instanceId) {
    return (
      this.instances
        .find((instance) => instance.instanceId === instanceId)
        ?.getNetworkSummary()?.title ?? instanceId
    );
  }

  getParentAreaLabel(instanceId) {
    const parentEdge = this.graph.edges.find(
      (edge) =>
        edge.edgeType === graphRelationship.hierarchical &&
        edge.childId === instanceId,
    );

    if (!parentEdge) return "workspace root";

    const parentPath = document.getElementById(parentEdge.parentId);
    const geoProperties = parentPath?.getAttribute("geo-properties");

    if (!geoProperties) return "parent region";

    try {
      return getFeatureDisplayName(JSON.parse(geoProperties));
    } catch (error) {
      return "parent region";
    }
  }

  /**
   * Walk upward from a hovered child node through every hierarchical edge.
   * The resulting trail lets the canvas, parent/root regions, and overview all
   * render the same analysis-path highlight without each view re-deriving it.
   */
  getHierarchyHoverTrail(instanceId) {
    const featureIds = [];
    const edgeIds = [];
    const instanceIds = [instanceId];
    const visitedInstances = new Set(instanceIds);

    let childId = instanceId;

    while (childId) {
      const edge = this.getHierarchyEdgeForChild(childId);
      if (!edge || edgeIds.includes(edge.id)) break;

      edgeIds.push(edge.id);
      featureIds.push(edge.parentId);

      const parentInstance = this.getParentInstanceForFeature(edge.parentId);
      if (!parentInstance || visitedInstances.has(parentInstance.instanceId)) {
        break;
      }

      instanceIds.push(parentInstance.instanceId);
      visitedInstances.add(parentInstance.instanceId);
      childId = parentInstance.instanceId;
    }

    return { edgeIds, featureIds, instanceIds };
  }

  /**
   * Cache and render the current hierarchy hover trail. Root nodes are ignored
   * because they do not have an incoming hierarchy edge to explain.
   */
  setHierarchyHoverForInstance(instanceId) {
    const trail = this.getHierarchyHoverTrail(instanceId);
    const hadHover =
      this.hoveredHierarchyFeatureIds.size ||
      this.hoveredHierarchyEdgeIds.size ||
      this.hoveredHierarchyInstanceIds.size;

    this.clearHierarchyHover({ sync: false });
    if (!trail.edgeIds.length) {
      if (hadHover) this.graph.updateLinks();
      return;
    }

    this.hoveredHierarchySourceId = instanceId;
    this.hoveredHierarchyFeatureIds = new Set(trail.featureIds);
    this.hoveredHierarchyEdgeIds = new Set(trail.edgeIds);
    this.hoveredHierarchyInstanceIds = new Set(trail.instanceIds);

    this.hoveredHierarchyFeatureIds.forEach((featureId) => {
      this.setFeatureElementHighlight(featureId, true);
    });

    this.graph.updateLinks();
  }

  clearHierarchyHoverForInstance(instanceId) {
    if (
      this.hoveredHierarchySourceId &&
      this.hoveredHierarchySourceId !== instanceId
    ) {
      return;
    }

    this.clearHierarchyHover();
  }

  clearHierarchyHover({ sync = true } = {}) {
    if (
      !this.hoveredHierarchyFeatureIds.size &&
      !this.hoveredHierarchyEdgeIds.size &&
      !this.hoveredHierarchyInstanceIds.size
    ) {
      this.hoveredHierarchySourceId = null;
      return;
    }

    this.hoveredHierarchyFeatureIds.forEach((featureId) => {
      this.setFeatureElementHighlight(featureId, false);
    });

    this.hoveredHierarchySourceId = null;
    this.hoveredHierarchyFeatureIds.clear();
    this.hoveredHierarchyEdgeIds.clear();
    this.hoveredHierarchyInstanceIds.clear();
    if (sync) this.graph.updateLinks();
  }

  /**
   * Feature highlights are applied directly to map paths because parent/root
   * regions can live in a different DraggableMap instance from the hovered node.
   */
  setFeatureElementHighlight(featureId, isHighlighted) {
    const featureElement = document.getElementById(featureId);
    if (!featureElement) return;

    const parentInstance = this.getParentInstanceForFeature(featureId);
    const selection = d3.select(featureElement);

    if (isHighlighted) {
      selection
        .raise()
        .classed("is-hierarchy-area-highlight", true)
        .attr("stroke", HIERARCHY_HOVER_STROKE)
        .attr("stroke-width", HIERARCHY_HOVER_STROKE_WIDTH);
      return;
    }

    selection
      .classed("is-hierarchy-area-highlight", false)
      .attr("stroke", (d) =>
        parentInstance?._getFeatureStroke
          ? parentInstance._getFeatureStroke(d)
          : DEFAULT_FEATURE_STROKE,
      )
      .attr("stroke-width", (d) =>
        parentInstance?._getFeatureStrokeWidth
          ? parentInstance._getFeatureStrokeWidth(d)
          : DEFAULT_FEATURE_STROKE_WIDTH,
      );
  }

  isHierarchyEdgeHighlighted(edgeId) {
    return this.hoveredHierarchyEdgeIds.has(edgeId);
  }

  isHierarchyInstanceHighlighted(instanceId) {
    return this.hoveredHierarchyInstanceIds.has(instanceId);
  }

  getGroupForInstance(instanceId) {
    return Array.from(this.groups.values()).find((group) =>
      group.memberIds.includes(instanceId),
    );
  }

  getGroupInstances(group) {
    return group.memberIds.map((id) => this.getInstanceById(id)).filter(Boolean);
  }

  getGroupedPeerInstances(instanceId) {
    const group = this.getGroupForInstance(instanceId);
    if (!group) return [];

    return this.getGroupInstances(group).filter(
      (instance) => instance.instanceId !== instanceId,
    );
  }

  getColorScaleValuesForInstances(instances) {
    return instances.flatMap((instance) => instance.getCurrentFeatureValues());
  }

  /**
   * Grouped maps share one color scale computed from the values currently shown
   * by every member. Each map can still display its own variable, but the domain
   * and legend become comparable across the group.
   */
  applyGroupColorScheme(group) {
    const instances = this.getGroupInstances(group);
    if (instances.length < 2) return;

    const featureVals = this.getColorScaleValuesForInstances(instances);
    instances.forEach((instance) => instance.setColorScheme(featureVals));
  }

  async setGroupVariable(groupId, variable) {
    const group = this.groups.get(groupId);
    if (!group) return;

    const instances = this.getGroupInstances(group);
    if (!instances.length) return;

    const affectedIds = this.getHierarchySubtreeInstanceIds(group.memberIds);

    await Promise.all(
      instances.map((instance) =>
        instance.setVariable(variable, {
          emit: false,
          syncColor: false,
          cascade: true,
        }),
      ),
    );
    this.refreshColorScalesForInstances(affectedIds);
    this.emitNetworkChange();
    this.updateGroups();
  }

  /**
   * Keep a branch analytically consistent: when a parent map changes variable,
   * every child/descendant map in that hierarchy should show the same measure.
   */
  async syncDescendantVariables(parentInstanceId, variable) {
    const subtreeIds = this.getHierarchySubtreeInstanceIds([parentInstanceId]);
    subtreeIds.delete(parentInstanceId);

    const descendants = Array.from(subtreeIds)
      .map((id) => this.getInstanceById(id))
      .filter(Boolean);

    if (!descendants.length) return [];

    await Promise.all(
      descendants.map((instance) =>
        instance.setVariable(variable, {
          emit: false,
          syncColor: false,
          cascade: false,
        }),
      ),
    );

    return descendants.map((instance) => instance.instanceId);
  }

  syncGroupedChromeVisibility() {
    const groupedIds = new Set();
    this.groups.forEach((group) => {
      group.memberIds.forEach((id) => groupedIds.add(id));
    });

    this.instances.forEach((instance) => {
      instance.setGroupedChromeHidden?.(groupedIds.has(instance.instanceId));
    });
  }

  refreshColorScalesForInstances(instanceIds) {
    const ids = Array.from(new Set(instanceIds)).filter(Boolean);
    const groupedIds = new Set();
    const refreshedGroupIds = new Set();

    ids.forEach((id) => {
      const group = this.getGroupForInstance(id);
      if (!group) return;
      if (refreshedGroupIds.has(group.id)) return;

      refreshedGroupIds.add(group.id);
      this.applyGroupColorScheme(group);
      group.memberIds.forEach((memberId) => groupedIds.add(memberId));
    });

    ids.forEach((id) => {
      if (groupedIds.has(id)) return;
      this.getInstanceById(id)?.resetColorScheme();
    });
  }

  syncColorScaleForInstance(instance) {
    const group = this.getGroupForInstance(instance.instanceId);

    if (group) {
      this.applyGroupColorScheme(group);
      return;
    }

    instance.updateColorScheme();
  }

  /**
   * A group is only meaningful when every selected node was carved out of the
   * same parent map. This keeps batch move/resize/delete scoped to sibling
   * analysis alternatives instead of mixing unrelated branches.
   */
  getCommonHierarchyParent(instances) {
    if (instances.length < 2) return null;

    let parentInstance = null;

    for (const instance of instances) {
      const edge = this.getHierarchyEdgeForChild(instance.instanceId);
      if (!edge) return null;

      const candidateParent = this.getParentInstanceForFeature(edge.parentId);
      if (!candidateParent) return null;

      if (!parentInstance) {
        parentInstance = candidateParent;
      } else if (parentInstance.instanceId !== candidateParent.instanceId) {
        return null;
      }
    }

    return parentInstance;
  }

  canGroupSelection() {
    return Boolean(this.getCommonHierarchyParent(this.getSelectedInstances()));
  }

  canUngroupSelection() {
    const targetIds = this.getUngroupTargetIds();
    if (!targetIds.size) return false;

    return Array.from(this.groups.values()).some((group) =>
      group.memberIds.some((id) => targetIds.has(id)),
    );
  }

  getUngroupTargetIds() {
    return new Set([
      ...Array.from(this.selectedInstanceIds),
      ...this.contextMenuTargetInstances.map((instance) => instance.instanceId),
    ]);
  }

  createGroupFromSelection() {
    const selectedInstances = this.getSelectedInstances();
    const parentInstance = this.getCommonHierarchyParent(selectedInstances);
    if (!parentInstance) return null;

    const memberIds = selectedInstances.map((instance) => instance.instanceId);
    const affectedIds = this.removeMembersFromGroups(memberIds, {
      refreshColorScales: false,
    });

    const groupId = `map-group-${this.groupSeq++}`;
    const group = {
      id: groupId,
      memberIds,
      parentInstanceId: parentInstance.instanceId,
    };

    this.groups.set(groupId, group);
    this.selectedInstanceIds = new Set(memberIds);
    this.selectedInstanceId = memberIds[memberIds.length - 1] ?? null;
    this.activeGroupSelectionId = groupId;
    this.refreshColorScalesForInstances([...affectedIds, ...memberIds]);
    this.syncInstanceSelection();
    this.updateGroups();
    return group;
  }

  ungroupSelection() {
    const targetIds = this.getUngroupTargetIds();
    if (!targetIds.size) return;

    const affectedIds = new Set();

    Array.from(this.groups.entries()).forEach(([groupId, group]) => {
      if (group.memberIds.some((id) => targetIds.has(id))) {
        group.memberIds.forEach((id) => affectedIds.add(id));
        this.groups.delete(groupId);
      }
    });

    this.refreshColorScalesForInstances(affectedIds);
    this.activeGroupSelectionId = null;
    this.syncInstanceSelection();
    this.updateGroups();
  }

  selectGroup(groupId, { additive = false } = {}) {
    const group = this.groups.get(groupId);
    if (!group) return;

    if (!additive) this.selectedInstanceIds.clear();
    group.memberIds.forEach((id) => this.selectedInstanceIds.add(id));
    this.selectedInstanceId = group.memberIds[group.memberIds.length - 1] ?? null;
    this.activeGroupSelectionId = additive ? null : group.id;
    this.syncInstanceSelection();
  }

  removeMembersFromGroups(memberIds, { refreshColorScales = true } = {}) {
    const ids = new Set(memberIds);
    const affectedIds = new Set();

    Array.from(this.groups.entries()).forEach(([groupId, group]) => {
      const originalMemberIds = [...group.memberIds];
      const hadRemovedMembers = originalMemberIds.some((id) => ids.has(id));
      if (!hadRemovedMembers) return;

      originalMemberIds.forEach((id) => affectedIds.add(id));
      group.memberIds = group.memberIds.filter((id) => !ids.has(id));

      if (group.memberIds.length < 2) {
        this.groups.delete(groupId);
        if (this.activeGroupSelectionId === groupId) {
          this.activeGroupSelectionId = null;
        }
      }
    });

    if (refreshColorScales) {
      this.refreshColorScalesForInstances(affectedIds);
    }

    return affectedIds;
  }

  getGroupBounds(group) {
    const members = group.memberIds
      .map((id) => this.getInstanceById(id))
      .filter(Boolean);

    if (members.length < 2) return null;

    const pad = 28;
    const headerPad = 88;

    const bounds = members.reduce(
      (acc, instance) => ({
        minX: Math.min(acc.minX, instance.x - instance.r - pad),
        maxX: Math.max(acc.maxX, instance.x + instance.r + pad),
        minY: Math.min(acc.minY, instance.y - instance.r - headerPad),
        maxY: Math.max(acc.maxY, instance.y + instance.r + pad),
      }),
      {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity,
      },
    );

    bounds.maxX = Math.max(bounds.maxX, bounds.minX + GROUP_HEADER_MIN_WIDTH);
    return bounds;
  }

  /** Create or update the hulls that visualize manually grouped sibling maps. */
  updateGroups() {
    if (!this.groupLayer) return;

    Array.from(this.groups.entries()).forEach(([groupId, group]) => {
      group.memberIds = group.memberIds.filter((id) => this.getInstanceById(id));
      if (group.memberIds.length < 2) {
        this.groups.delete(groupId);
        if (this.activeGroupSelectionId === groupId) {
          this.activeGroupSelectionId = null;
        }
      }
    });
    this.syncGroupedChromeVisibility();

    const groups = Array.from(this.groups.values())
      .map((group) => ({
        ...group,
        bounds: this.getGroupBounds(group),
      }))
      .filter((group) => group.bounds);

    const groupNodes = this.groupLayer
      .selectAll("g.map-node-group")
      .data(groups, (group) => group.id)
      .join(
        (enter) => {
          const group = enter
            .append("g")
            .attr("class", "map-node-group")
            .style("cursor", "pointer")
            .on("click", (event, d) => {
              event.stopPropagation();
              this.selectGroup(d.id, { additive: event.shiftKey });
            })
            .on("contextmenu", (event, d) => {
              event.preventDefault();
              event.stopPropagation();
              this.selectGroup(d.id, { additive: event.shiftKey });
              this.showMenu(event, null, {
                forcedTargetInstances: this.getSelectedInstances(),
              });
            });

          group.append("rect").attr("class", "map-node-group-hull");
          group.append("text").attr("class", "map-node-group-label");
          group.append("foreignObject").attr("class", "map-node-group-option");
          group.append("g").attr("class", "map-node-group-legend");
          return group;
        },
        (update) => update,
        (exit) => {
          exit.remove();
        },
      );

    groupNodes
      .attr("transform", null)
      .classed("is-selected", (group) => this.activeGroupSelectionId === group.id)
      .call(this.getGroupDragBehavior());

    const manager = this;
    groupNodes.each(function (group) {
      const node = d3.select(this);
      manager.layoutGroupNode(node, group, { renderControls: true });
    });
  }

  layoutGroupNode(groupNode, group, { renderControls = true } = {}) {
    const bounds = group.bounds ?? this.getGroupBounds(group);
    if (!bounds) return;

    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    const labelX = bounds.minX + 14;
    const labelY = bounds.minY + 22;

    groupNode
      .select("rect")
      .attr("x", bounds.minX)
      .attr("y", bounds.minY)
      .attr("width", width)
      .attr("height", height)
      .attr("rx", 18)
      .attr("ry", 18);

    const label = groupNode
      .select("text.map-node-group-label")
      .attr("x", labelX)
      .attr("y", labelY)
      .text(`group (${group.memberIds.length})`);

    const controlLayout = {
      labelBBox: label.node()?.getBBox(),
      labelX,
      labelY,
    };

    if (renderControls) {
      this.renderGroupControls(groupNode, group, controlLayout);
      return;
    }

    this.positionGroupControls(groupNode, controlLayout);
  }

  /**
   * Keep group boundaries live while a single member is dragged without
   * rebuilding select boxes or legends on every pointer event.
   */
  updateGroupBoundariesForInstances(instances = []) {
    const groupIds = new Set();

    instances.forEach((instance) => {
      const group = this.getGroupForInstance(instance.instanceId);
      if (group) groupIds.add(group.id);
    });

    groupIds.forEach((groupId) => {
      const group = this.groups.get(groupId);
      if (!group) return;

      const bounds = this.getGroupBounds(group);
      if (!bounds) return;

      const groupNode = this.groupLayer
        .selectAll("g.map-node-group")
        .filter((datum) => datum.id === groupId);
      if (groupNode.empty()) return;

      this.layoutGroupNode(groupNode, { ...group, bounds }, {
        renderControls: false,
      });
    });
  }

  renderGroupControls(groupNode, group, { labelBBox, labelX, labelY }) {
    const instances = this.getGroupInstances(group);
    const leadInstance = instances[0];
    if (!leadInstance) return;

    const { option, legend } = this.positionGroupControls(groupNode, {
      labelBBox,
      labelX,
      labelY,
    });

    option
      .on("mousedown", (event) => event.stopPropagation())
      .on("click", (event) => event.stopPropagation())
      .on("dblclick", (event) => event.stopPropagation());

    const wrapper = option
      .selectAll("div.map-node-group-select-wrap")
      .data([group.id])
      .join("xhtml:div")
      .attr("class", "map-node-group-select-wrap")
      .on("mousedown", (event) => event.stopPropagation())
      .on("click", (event) => event.stopPropagation())
      .on("dblclick", (event) => event.stopPropagation());

    const select = wrapper
      .selectAll("select")
      .data([group.id])
      .join("xhtml:select")
      .attr("title", leadInstance.getVariableLabel?.(leadInstance.curVar))
      .on("mousedown", (event) => event.stopPropagation())
      .on("click", (event) => event.stopPropagation())
      .on("change", (event) => {
        event.stopPropagation();
        this.setGroupVariable(group.id, event.target.value).catch((error) => {
          console.error("Failed to update group variable:", error);
        });
      });

    select
      .selectAll("option")
      .data(leadInstance.varOptions, (option) => option.value)
      .join("xhtml:option")
      .attr("value", (option) => option.value)
      .attr("title", (option) => option.label)
      .text((option) => option.shortLabel ?? option.label);

    select
      .property("value", leadInstance.curVar)
      .attr("title", leadInstance.getVariableLabel?.(leadInstance.curVar));

    const legendKey = this.getGroupLegendRenderKey(group, leadInstance);

    if (legend.attr("data-render-key") !== legendKey) {
      legend.attr("data-render-key", legendKey).selectAll("*").remove();
      drawColorLegend(legend, leadInstance.colorTheme, {
        width: GROUP_LEGEND_WIDTH,
        height: GROUP_LEGEND_HEIGHT,
        margin: { top: 2, right: 10, bottom: 16, left: 6 },
        ticks: 3,
      });
    }
  }

  positionGroupControls(groupNode, { labelBBox, labelX, labelY }) {
    const labelWidth = labelBBox?.width ?? 72;
    const controlX = labelX + labelWidth + GROUP_CONTROL_GAP;
    const controlY = labelY - 20;
    const legendX = controlX + GROUP_VARIABLE_WIDTH + GROUP_CONTROL_GAP;

    const option = groupNode
      .select("foreignObject.map-node-group-option")
      .attr("x", controlX)
      .attr("y", controlY)
      .attr("width", GROUP_VARIABLE_WIDTH)
      .attr("height", GROUP_VARIABLE_HEIGHT)
      .style("pointer-events", "all");
    const legend = groupNode
      .select("g.map-node-group-legend")
      .attr("transform", `translate(${legendX},${controlY - 1})`);

    return { option, legend };
  }

  getGroupLegendRenderKey(group, leadInstance) {
    const domain = leadInstance.colorTheme?.domain?.() ?? [];

    return [
      group.id,
      group.memberIds.join(","),
      leadInstance.curVar,
      domain.join(","),
    ].join("|");
  }

  getGroupDragBehavior() {
    if (!this.groupDragBehavior) {
      this.groupDragBehavior = d3
        .drag()
        .filter((event) => this.shouldStartGroupDrag(event))
        .on("start", (event, group) => this.startGroupDrag(event, group))
        .on("drag", (event) => this.dragGroup(event))
        .on("end", (event) => this.endGroupDrag(event));
    }

    return this.groupDragBehavior;
  }

  shouldStartGroupDrag(event) {
    if (event.button) return false;
    if (event.target?.closest?.(".map-node-group-option")) return false;

    return true;
  }

  startGroupDrag(event, group) {
    event.sourceEvent?.preventDefault?.();
    event.sourceEvent?.stopPropagation?.();

    this.selectGroup(group.id, { additive: event.sourceEvent?.shiftKey });
    const dragInstances = this.getGroupInstances(group);
    const groupNode = this.groupLayer
      .selectAll("g.map-node-group")
      .filter((item) => item.id === group.id);

    this.groupDragState = {
      groupId: group.id,
      groupNode,
      instances: dragInstances,
      startPointer: this.pointerToViewport(event),
      startPositions: new Map(
        dragInstances.map((instance) => [
          instance.instanceId,
          { x: instance.x, y: instance.y },
        ]),
      ),
    };

    this.groupLayer
      .selectAll("g.map-node-group")
      .classed("is-dragging", (item) => item.id === group.id);
    groupNode.attr("transform", null);
    dragInstances.forEach((instance) => {
      instance.circle.classed("dragging", true);
    });
  }

  dragGroup(event) {
    event.sourceEvent?.preventDefault?.();
    event.sourceEvent?.stopPropagation?.();
    if (!this.groupDragState) return;

    const [vx, vy] = this.pointerToViewport(event);
    const [sx, sy] = this.groupDragState.startPointer;
    const dx = vx - sx;
    const dy = vy - sy;

    this.groupDragState.instances.forEach((instance) => {
      const startPosition = this.groupDragState.startPositions.get(
        instance.instanceId,
      );
      if (!startPosition) return;

      instance.setPosition(startPosition.x + dx, startPosition.y + dy, {
        deferRender: true,
      });
    });

    // Moving the hull with a single transform avoids rebuilding the expensive
    // group controls and legend on every pointer event.
    this.groupDragState.groupNode?.attr("transform", `translate(${dx},${dy})`);
    this.scheduleGraphUpdate();
  }

  endGroupDrag(event) {
    event.sourceEvent?.stopPropagation?.();

    this.groupDragState?.instances.forEach((instance) => {
      instance._flushPositionRender?.();
      instance.circle.classed("dragging", false);
    });
    this.groupDragState?.groupNode?.attr("transform", null);
    this.groupLayer.selectAll("g.map-node-group").classed("is-dragging", false);
    this.groupDragState = null;

    this.flushGraphUpdate();
    this.emitNetworkChange();
    this.updateOverview();
    this.updateGroups();
  }

  /**
   * Arrange child maps radially around their parent map. The direction comes
   * from the source feature's position inside the parent, while the distance is
   * adjusted by subtree height so shallow leaves stay closer to the root.
   */
  arrangeAsTree() {
    if (!this.instances.length) return;

    const instanceById = new Map(
      this.instances.map((instance) => [instance.instanceId, instance]),
    );
    const { parentByChild, childrenByParent } =
      this.buildHierarchyIndex(instanceById);

    let roots = this.instances.filter(
      (instance) => !parentByChild.has(instance.instanceId),
    );

    if (!roots.length) roots = [this.instances[0]];

    const treeMetrics = this.getTreeMetrics(roots, childrenByParent);
    const visited = new Set();

    const placeSubtree = (parentInstance, depth = 0) => {
      if (!parentInstance || visited.has(parentInstance.instanceId)) return;

      visited.add(parentInstance.instanceId);

      const placements = this.getRadialChildPlacements(
        parentInstance,
        childrenByParent.get(parentInstance.instanceId) ?? [],
        instanceById,
        depth,
        treeMetrics,
      );

      placements.forEach(({ child, angle, distance }) => {
        child.setPosition(
          parentInstance.x + Math.cos(angle) * distance,
          parentInstance.y + Math.sin(angle) * distance,
        );
      });

      placements.forEach(({ child }) => placeSubtree(child, depth + 1));
    };

    roots
      .sort((a, b) => a.instanceId.localeCompare(b.instanceId))
      .forEach((root) => placeSubtree(root));

    this.resolveOverlaps();
    this.graph.updateLinks();
    this.emitNetworkChange();
    this.updateOverview();
    this.updateGroups();
  }

  /** Translate graph edges into lookup tables used by tree layout. */
  buildHierarchyIndex(instanceById) {
    const parentByChild = new Map();
    const childrenByParent = new Map();

    this.graph.edges
      .filter((edge) => edge.edgeType === graphRelationship.hierarchical)
      .forEach((edge) => {
        const parentInstance = this.getParentInstanceForFeature(edge.parentId);
        const childInstance = instanceById.get(edge.childId);

        if (!parentInstance || !childInstance) return;

        parentByChild.set(childInstance.instanceId, parentInstance.instanceId);
        const children = childrenByParent.get(parentInstance.instanceId) ?? [];
        children.push({
          childId: childInstance.instanceId,
          featureId: edge.parentId,
        });
        childrenByParent.set(parentInstance.instanceId, children);
      });

    return { parentByChild, childrenByParent };
  }

  /**
   * Compute root-relative depth and remaining subtree height for each node.
   * Placement uses these metrics to keep leaf nodes compact while reserving
   * more room for branches that will continue to expand.
   */
  getTreeMetrics(roots, childrenByParent) {
    const depthById = new Map();
    const heightById = new Map();
    const visiting = new Set();

    const setDepth = (instanceId, depth) => {
      const existingDepth = depthById.get(instanceId);
      if (existingDepth !== undefined && existingDepth <= depth) return;

      depthById.set(instanceId, depth);
      (childrenByParent.get(instanceId) ?? []).forEach(({ childId }) => {
        setDepth(childId, depth + 1);
      });
    };

    const getHeight = (instanceId) => {
      if (heightById.has(instanceId)) return heightById.get(instanceId);
      if (visiting.has(instanceId)) return 0;

      visiting.add(instanceId);

      const childHeights = (childrenByParent.get(instanceId) ?? []).map(
        ({ childId }) => getHeight(childId) + 1,
      );
      const height = childHeights.length ? Math.max(...childHeights) : 0;

      visiting.delete(instanceId);
      heightById.set(instanceId, height);
      return height;
    };

    roots.forEach((root) => {
      setDepth(root.instanceId, 0);
      getHeight(root.instanceId);
    });

    return {
      depthById,
      heightById,
      totalTreeHeight: Math.max(
        1,
        ...roots.map((root) => heightById.get(root.instanceId) ?? 0),
      ),
    };
  }

  getRadialChildPlacements(
    parentInstance,
    childRecords,
    instanceById,
    depth,
    treeMetrics,
  ) {
    const children = childRecords
      .map((record, index) => {
        const child = instanceById.get(record.childId);
        if (!child) return null;

        const fallbackStep = (Math.PI * 2) / Math.max(childRecords.length, 1);
        const fallbackAngle = -Math.PI / 2 + index * fallbackStep;
        const baseAngle = this.getFeatureDirection(
          parentInstance,
          record.featureId,
          fallbackAngle,
        );

        return {
          child,
          featureId: record.featureId,
          baseAngle,
          childDepth: treeMetrics.depthById.get(child.instanceId) ?? depth + 1,
          childHeight: treeMetrics.heightById.get(child.instanceId) ?? 0,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.baseAngle - b.baseAngle);

    const angleBucketWidth = Math.PI / 8;
    const buckets = new Map();

    children.forEach((entry) => {
      const key = Math.round(normalizeAngle(entry.baseAngle) / angleBucketWidth);
      const bucket = buckets.get(key) ?? [];
      bucket.push(entry);
      buckets.set(key, bucket);
    });

    return children.map((entry) => {
      const key = Math.round(normalizeAngle(entry.baseAngle) / angleBucketWidth);
      const bucket = buckets.get(key) ?? [entry];
      const localIndex = bucket.indexOf(entry);
      const centeredIndex = localIndex - (bucket.length - 1) / 2;
      const angle = entry.baseAngle + centeredIndex * 0.34;
      const minDistance = parentInstance.r + entry.child.r + 28;
      const closeGap = Math.max(48, parentInstance.r * 0.36);
      const subtreeRatio =
        entry.childHeight / Math.max(treeMetrics.totalTreeHeight, 1);
      const subtreeReserve = Math.max(34, parentInstance.r * 0.44) * subtreeRatio;
      const descendantReserve =
        Math.max(0, entry.childHeight - 1) * Math.max(18, parentInstance.r * 0.08);
      const siblingReserve = Math.min(64, Math.max(0, children.length - 1) * 10);
      const leafPull =
        entry.childHeight === 0
          ? Math.max(0, 20 - Math.min(entry.childDepth, 4) * 4)
          : 0;
      const distance = Math.max(
        minDistance,
        parentInstance.r +
          entry.child.r +
          closeGap +
          subtreeReserve +
          descendantReserve +
          siblingReserve -
          leafPull,
      );

      return {
        ...entry,
        angle,
        distance,
      };
    });
  }

  /**
   * Source feature centers are registered as graph nodes, so this turns the
   * feature's location inside its parent map into a polar layout direction.
   */
  getFeatureDirection(parentInstance, featureId, fallbackAngle) {
    const sourceCenter = this.graph.nodes.get(featureId)?.getCenter?.();

    if (!sourceCenter) return fallbackAngle;

    const dx = sourceCenter[0] - parentInstance.x;
    const dy = sourceCenter[1] - parentInstance.y;

    if (Math.hypot(dx, dy) < 1) return fallbackAngle;

    return Math.atan2(dy, dx);
  }

  getOverviewBounds() {
    if (!this.instances.length) return null;

    const bounds = this.instances.reduce(
      (acc, instance) => ({
        minX: Math.min(acc.minX, instance.x - instance.r),
        maxX: Math.max(acc.maxX, instance.x + instance.r),
        minY: Math.min(acc.minY, instance.y - instance.r),
        maxY: Math.max(acc.maxY, instance.y + instance.r),
      }),
      {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity,
      },
    );

    const pad = Math.max(
      80,
      Math.max(...this.instances.map((item) => item.r)) * 0.35,
    );

    return {
      minX: bounds.minX - pad,
      maxX: bounds.maxX + pad,
      minY: bounds.minY - pad,
      maxY: bounds.maxY + pad,
    };
  }

  /**
   * Draw and wire the bottom-right minimap. The overview is a separate SVG
   * layer, so it stays fixed on screen while the main viewport is panned/zoomed.
   */
  updateOverview() {
    if (!this.overviewLayer) return;

    this.overviewLayer.selectAll("*").remove();
    this.overviewProjection = null;

    const bounds = this.getOverviewBounds();
    if (!bounds) return;

    this.overviewProjection = this.createOverviewProjection(bounds);
    const { originX, originY } = this.overviewProjection;
    const overview = this.overviewLayer.attr(
      "transform",
      `translate(${originX},${originY})`,
    );

    this.bindOverviewInteractions(overview);
    this.drawOverviewFrame(overview);
    this.drawOverviewViewport(overview);
    this.drawOverviewLinks(overview);
    this.drawOverviewNodes(overview);
  }

  createOverviewProjection(bounds) {
    const overviewWidth = Math.min(190, Math.max(150, this.width * 0.23));
    const overviewHeight = Math.min(132, Math.max(104, this.height * 0.22));
    const outerMargin = 14;
    const innerPad = 12;
    const originX = Math.max(8, this.width - overviewWidth - outerMargin);
    const originY = Math.max(8, this.height - overviewHeight - outerMargin);
    const spanX = Math.max(1, bounds.maxX - bounds.minX);
    const spanY = Math.max(1, bounds.maxY - bounds.minY);
    const scale = Math.min(
      (overviewWidth - innerPad * 2) / spanX,
      (overviewHeight - innerPad * 2) / spanY,
    );
    const contentWidth = spanX * scale;
    const contentHeight = spanY * scale;
    const offsetX = (overviewWidth - innerPad * 2 - contentWidth) / 2;
    const offsetY = (overviewHeight - innerPad * 2 - contentHeight) / 2;

    return {
      bounds,
      contentHeight,
      contentWidth,
      innerPad,
      offsetX,
      offsetY,
      overviewHeight,
      overviewWidth,
      originX,
      originY,
      scale,
    };
  }

  projectOverviewPoint([x, y]) {
    const projection = this.overviewProjection;
    if (!projection) return [0, 0];

    return [
      projection.innerPad +
        projection.offsetX +
        (x - projection.bounds.minX) * projection.scale,
      projection.innerPad +
        projection.offsetY +
        (y - projection.bounds.minY) * projection.scale,
    ];
  }

  getOverviewNodeRadius(instance) {
    const scale = this.overviewProjection?.scale ?? 1;
    return clamp(instance.r * scale, 8, 22);
  }

  getOverviewNodeFullName(instance) {
    if (instance.geoResolution === "COUNTRY" && instance.geoID === "USA") {
      return "US states";
    }

    if (instance.geoResolution === "STATE") {
      return `${instance.geoID} counties`;
    }

    const parentLabel = this.getParentAreaLabel(instance.instanceId);
    if (parentLabel !== "workspace root" && parentLabel !== "parent region") {
      return parentLabel;
    }

    return instance.getNodeTitle();
  }

  getOverviewNodeLabel(instance) {
    if (instance.geoResolution === "COUNTRY" && instance.geoID === "USA") {
      return "US";
    }

    if (instance.geoResolution === "STATE") {
      return instance.geoID;
    }

    return abbreviateOverviewLabel(this.getOverviewNodeFullName(instance));
  }

  /**
   * Overview links connect node boundaries along the parent-center -> child-center
   * vector. This keeps the miniature tree readable and prevents highlighted
   * links from appearing behind either overview node.
   */
  getOverviewLinkAnchors(parent, child) {
    const parentCenter = this.projectOverviewPoint([parent.x, parent.y]);
    const childCenter = this.projectOverviewPoint([child.x, child.y]);
    const parentRadius = this.getOverviewNodeRadius(parent);
    const childRadius = this.getOverviewNodeRadius(child);
    const dx = childCenter[0] - parentCenter[0];
    const dy = childCenter[1] - parentCenter[1];
    const distance = Math.hypot(dx, dy);

    if (distance === 0) {
      return { start: parentCenter, end: childCenter };
    }

    const ux = dx / distance;
    const uy = dy / distance;
    const start =
      distance > parentRadius
        ? [
            parentCenter[0] + ux * parentRadius,
            parentCenter[1] + uy * parentRadius,
          ]
        : parentCenter;
    const end =
      distance > childRadius
        ? [
            childCenter[0] - ux * childRadius,
            childCenter[1] - uy * childRadius,
          ]
        : childCenter;

    return { start, end };
  }

  bindOverviewInteractions(overview) {
    const panFromOverviewPointer = (event) => {
      event.sourceEvent?.stopPropagation();
      event.stopPropagation?.();
      event.sourceEvent?.preventDefault?.();
      event.preventDefault?.();

      const [overviewX, overviewY] = d3.pointer(
        event,
        this.overviewLayer.node(),
      );
      this.centerViewportOnOverviewPoint(overviewX, overviewY);
    };

    overview
      .on("click.overview", panFromOverviewPointer)
      .call(
        d3
          .drag()
          .on("start", (event) => {
            this.hideMenu();
            this.overviewLayer.classed("is-dragging", true);
            panFromOverviewPointer(event);
          })
          .on("drag", panFromOverviewPointer)
          .on("end", (event) => {
            event.sourceEvent?.stopPropagation();
            event.stopPropagation?.();
            this.overviewLayer.classed("is-dragging", false);
          }),
      );
  }

  drawOverviewFrame(overview) {
    const { overviewWidth, overviewHeight } = this.overviewProjection;

    overview
      .append("rect")
      .attr("class", "map-overview-frame")
      .attr("width", overviewWidth)
      .attr("height", overviewHeight)
      .attr("rx", 7)
      .attr("ry", 7);

    overview
      .append("text")
      .attr("class", "map-overview-title")
      .attr("x", 10)
      .attr("y", 15)
      .text("overview");
  }

  drawOverviewViewport(overview) {
    const { overviewWidth, overviewHeight } = this.overviewProjection;

    const transform = d3.zoomTransform(this.svg.node());
    const [viewX0, viewY0] = this.projectOverviewPoint([
      transform.invertX(0),
      transform.invertY(0),
    ]);
    const [viewX1, viewY1] = this.projectOverviewPoint([
      transform.invertX(this.width),
      transform.invertY(this.height),
    ]);
    const viewportX0 = clamp(Math.min(viewX0, viewX1), 0, overviewWidth);
    const viewportY0 = clamp(Math.min(viewY0, viewY1), 0, overviewHeight);
    const viewportX1 = clamp(Math.max(viewX0, viewX1), 0, overviewWidth);
    const viewportY1 = clamp(Math.max(viewY0, viewY1), 0, overviewHeight);

    overview
      .append("rect")
      .attr("class", "map-overview-viewport")
      .attr("x", viewportX0)
      .attr("y", viewportY0)
      .attr("width", Math.max(0, viewportX1 - viewportX0))
      .attr("height", Math.max(0, viewportY1 - viewportY0));
  }

  drawOverviewLinks(overview) {
    this.graph.edges
      .filter((edge) => edge.edgeType === graphRelationship.hierarchical)
      .forEach((edge) => {
        const child = this.instances.find(
          (instance) => instance.instanceId === edge.childId,
        );
        const parent = this.getParentInstanceForFeature(edge.parentId);
        if (!child || !parent) return;

        const { start, end } = this.getOverviewLinkAnchors(parent, child);

        overview
          .append("line")
          .attr(
            "class",
            [
              "map-overview-link",
              this.isHierarchyEdgeHighlighted(edge.id) ? "is-highlighted" : "",
            ]
              .filter(Boolean)
              .join(" "),
          )
          .attr("x1", start[0])
          .attr("y1", start[1])
          .attr("x2", end[0])
          .attr("y2", end[1]);
      });
  }

  drawOverviewNodes(overview) {
    this.instances.forEach((instance) => {
      const [cx, cy] = this.projectOverviewPoint([instance.x, instance.y]);
      const radius = this.getOverviewNodeRadius(instance);
      const label = this.getOverviewNodeLabel(instance);
      const fullName = this.getOverviewNodeFullName(instance);

      const node = overview
        .append("g")
        .attr(
          "class",
          [
            "map-overview-node-item",
            this.selectedInstanceIds.has(instance.instanceId)
              ? "is-selected"
              : "",
            this.isHierarchyInstanceHighlighted(instance.instanceId)
              ? "is-hierarchy-highlight"
              : "",
          ]
            .filter(Boolean)
            .join(" "),
        )
        .attr("transform", `translate(${cx},${cy})`);

      node.append("title").text(fullName);

      node
        .append("circle")
        .attr("class", "map-overview-node")
        .attr("r", radius);

      node
        .append("text")
        .attr("class", "map-overview-node-label")
        .attr("dy", "0.04em")
        .style("font-size", `${clamp(radius * 0.62, 6.5, 10)}px`)
        .text(label);
    });
  }

  /**
   * Convert an overview pointer position back into world coordinates and pan
   * the main viewport so that location becomes the visual center.
   */
  centerViewportOnOverviewPoint(overviewX, overviewY) {
    const projection = this.overviewProjection;
    if (!projection) return;

    const contentX0 = projection.innerPad + projection.offsetX;
    const contentY0 = projection.innerPad + projection.offsetY;
    const contentX1 = contentX0 + projection.contentWidth;
    const contentY1 = contentY0 + projection.contentHeight;
    const clampedX = clamp(overviewX, contentX0, contentX1);
    const clampedY = clamp(overviewY, contentY0, contentY1);
    const targetX =
      projection.bounds.minX +
      (clampedX - contentX0) / projection.scale;
    const targetY =
      projection.bounds.minY +
      (clampedY - contentY0) / projection.scale;
    const currentTransform = d3.zoomTransform(this.svg.node());
    const nextTransform = d3.zoomIdentity
      .translate(
        this.width / 2 - targetX * currentTransform.k,
        this.height / 2 - targetY * currentTransform.k,
      )
      .scale(currentTransform.k);

    this.svg.call(this.zoom.transform, nextTransform);
  }

  /** Small collision pass after auto arrange to keep resized nodes apart. */
  resolveOverlaps() {
    const pad = 18;
    const maxIterations = 18;

    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      let moved = false;

      for (let i = 0; i < this.instances.length; i += 1) {
        for (let j = i + 1; j < this.instances.length; j += 1) {
          const a = this.instances[i];
          const b = this.instances[j];
          const minDistance = a.r + b.r + pad;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distance = Math.hypot(dx, dy) || 1;

          if (distance >= minDistance) continue;

          const overlap = (minDistance - distance) / 2;
          const ux = dx / distance;
          const uy = dy / distance;
          b.setPosition(b.x + ux * overlap, b.y + uy * overlap);
          a.setPosition(a.x - ux * overlap, a.y - uy * overlap);
          moved = true;
        }
      }

      if (!moved) break;
    }
  }

  getParentInstanceForFeature(featureId) {
    return this.instances.find((instance) =>
      featureId.startsWith(`${instance.instanceId}-innerarea-`),
    );
  }

  getInstanceById(instanceId) {
    return this.instances.find((instance) => instance.instanceId === instanceId);
  }

  /**
   * Expand a delete target into its full hierarchy subtree before mutating the
   * graph. Once a parent node is destroyed its feature edges disappear, so the
   * descendant set has to be captured up front.
   */
  getHierarchySubtreeInstanceIds(instanceIds) {
    const ids = new Set(instanceIds);
    let addedChild = true;

    while (addedChild) {
      addedChild = false;

      for (const edge of this.graph.edges) {
        if (edge.edgeType !== graphRelationship.hierarchical) continue;
        if (ids.has(edge.childId)) continue;

        const parentInstance = this.getParentInstanceForFeature(edge.parentId);
        if (!parentInstance || !ids.has(parentInstance.instanceId)) continue;

        ids.add(edge.childId);
        addedChild = true;
      }
    }

    return ids;
  }

  /**
   * Delete is intentionally selection-aware: removing a grouped or multi-selected
   * node removes its hierarchy descendants and cleans graph edges, group
   * membership, hover state, and panels.
   */
  deleteInstances(instances) {
    const targetIds = instances
      .map((instance) => instance?.instanceId)
      .filter(Boolean);
    const ids = this.getHierarchySubtreeInstanceIds(targetIds);

    Array.from(ids).forEach((id) => {
      if (!this.getInstanceById(id)) ids.delete(id);
    });

    if (!ids.size) return;

    if (
      ids.has(this.hoveredHierarchySourceId) ||
      Array.from(ids).some((id) => this.hoveredHierarchyInstanceIds.has(id))
    ) {
      this.clearHierarchyHover({ sync: false });
    }

    this.removeMembersFromGroups(ids);

    // Destroy descendants in deepest-first order so edge cleanup stays local to
    // the disappearing branch rather than leaving child maps detached on screen.
    const orderedIds = Array.from(ids).sort(
      (a, b) =>
        this.getHierarchyHoverTrail(b).edgeIds.length -
        this.getHierarchyHoverTrail(a).edgeIds.length,
    );

    orderedIds.forEach((instanceId) => {
      const instance = this.getInstanceById(instanceId);
      if (!instance) return;

      instance.destroy();
    });

    ids.forEach((id) => this.selectedInstanceIds.delete(id));
    const selectedIds = Array.from(this.selectedInstanceIds);
    this.selectedInstanceId = selectedIds[selectedIds.length - 1] ?? null;

    this.graph.updateLinks();
    this.syncInstanceSelection();
    this.emitAnnotationsChange();
  }

  /**
   * Right-click targeting mirrors batch operations: if the pointer hits one of
   * several selected nodes, the whole selection becomes the delete target.
   */
  getContextTargetInstances(x, y) {
    const hitCircles = this.isMouseInCircles(x, y).sort((a, b) => {
      const da = Math.hypot(a.x - x, a.y - y);
      const db = Math.hypot(b.x - x, b.y - y);
      return da - db;
    });

    if (!hitCircles.length) return [];

    const selectedInstances = this.getSelectedInstances();
    const hitSelectedNode = hitCircles.some((hit) =>
      this.selectedInstanceIds.has(hit.instanceId),
    );

    if (selectedInstances.length > 1 && hitSelectedNode) {
      return selectedInstances;
    }

    return [hitCircles[0]];
  }

  getHierarchyEdgeForChild(childInstanceId) {
    return this.graph.edges.find(
      (edge) =>
        edge.edgeType === graphRelationship.hierarchical &&
        edge.childId === childInstanceId,
    );
  }

  /**
   * Return the local family around a newly-created node: its parent plus every
   * sibling child under that same parent. This keeps focus local instead of
   * zooming out to the entire tree.
   */
  getHierarchyLocalFamilyForChild(childInstanceId) {
    const child = this.getInstanceById(childInstanceId);
    const edge = this.getHierarchyEdgeForChild(childInstanceId);
    const parent = edge ? this.getParentInstanceForFeature(edge.parentId) : null;

    if (!child || !parent) return child ? [child] : [];

    const familyById = new Map([[parent.instanceId, parent]]);

    this.graph.edges
      .filter((item) => item.edgeType === graphRelationship.hierarchical)
      .forEach((item) => {
        const itemParent = this.getParentInstanceForFeature(item.parentId);
        if (itemParent?.instanceId !== parent.instanceId) return;

        const sibling = this.getInstanceById(item.childId);
        if (sibling) familyById.set(sibling.instanceId, sibling);
      });

    familyById.set(child.instanceId, child);
    return Array.from(familyById.values());
  }

  getHierarchyLocalFamilyForChildren(childInstanceIds) {
    const familyById = new Map();

    childInstanceIds.forEach((childInstanceId) => {
      this.getHierarchyLocalFamilyForChild(childInstanceId).forEach(
        (instance) => {
          familyById.set(instance.instanceId, instance);
        },
      );
    });

    return Array.from(familyById.values());
  }

  focusOnInstance(instanceId) {
    const instance = this.getInstanceById(instanceId);
    if (!instance) return;

    const transform = d3.zoomIdentity.translate(
      this.width / 2 - instance.x,
      this.height / 2 - instance.y,
    );

    this.svg
      .transition()
      .duration(260)
      .call(this.zoom.transform, transform);
  }

  panToInstance(instance, { duration = 260 } = {}) {
    if (!instance) return;

    const currentTransform = d3.zoomTransform(this.svg.node());
    const transform = d3.zoomIdentity
      .translate(
        this.width / 2 - instance.x * currentTransform.k,
        this.height / 2 - instance.y * currentTransform.k,
      )
      .scale(currentTransform.k);

    this.svg
      .transition()
      .duration(duration)
      .call(this.zoom.transform, transform);
  }

  focusOnHierarchyBranch(childInstanceId) {
    const localFamily = this.getHierarchyLocalFamilyForChild(childInstanceId);

    if (localFamily.length <= 1) {
      this.focusOnInstance(childInstanceId);
      return;
    }

    this.fitInstancesInView(localFamily);
  }

  getInstancesViewBounds(instances) {
    return instances.reduce(
      (acc, instance) => ({
        minX: Math.min(acc.minX, instance.x - instance.r - NODE_VIEW_SIDE_PAD),
        maxX: Math.max(acc.maxX, instance.x + instance.r + NODE_VIEW_SIDE_PAD),
        minY: Math.min(acc.minY, instance.y - instance.r - NODE_VIEW_TOP_PAD),
        maxY: Math.max(acc.maxY, instance.y + instance.r + NODE_VIEW_BOTTOM_PAD),
      }),
      {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity,
      },
    );
  }

  getInstancesCircleBounds(instances) {
    return instances.reduce(
      (acc, instance) => ({
        minX: Math.min(acc.minX, instance.x - instance.r - NODE_CONTAINMENT_PAD),
        maxX: Math.max(acc.maxX, instance.x + instance.r + NODE_CONTAINMENT_PAD),
        minY: Math.min(acc.minY, instance.y - instance.r - NODE_CONTAINMENT_PAD),
        maxY: Math.max(acc.maxY, instance.y + instance.r + NODE_CONTAINMENT_PAD),
      }),
      {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity,
      },
    );
  }

  isWorldBoundsVisible(bounds, transform, padding = VIEW_CONTAINMENT_PADDING) {
    const visibleBounds = {
      minX: transform.invertX(padding),
      maxX: transform.invertX(this.width - padding),
      minY: transform.invertY(padding),
      maxY: transform.invertY(this.height - padding),
    };

    return (
      bounds.minX >= visibleBounds.minX &&
      bounds.maxX <= visibleBounds.maxX &&
      bounds.minY >= visibleBounds.minY &&
      bounds.maxY <= visibleBounds.maxY
    );
  }

  /**
   * Pan and, only when needed, zoom out so the requested map nodes are visible.
   * If the local parent/sibling group is already inside the current viewport,
   * leave the user's current zoom and pan untouched.
   */
  fitInstancesInView(
    instances,
    {
      padding = VIEW_FIT_PADDING,
      visibilityPadding = VIEW_CONTAINMENT_PADDING,
      maxScale = 1,
      duration = 260,
    } = {},
  ) {
    const visibleInstances = instances.filter(Boolean);
    if (!visibleInstances.length) return;

    const bounds = this.getInstancesViewBounds(visibleInstances);
    const visibleNodeBounds = this.getInstancesCircleBounds(visibleInstances);
    const currentTransform = d3.zoomTransform(this.svg.node());

    if (
      this.isWorldBoundsVisible(
        visibleNodeBounds,
        currentTransform,
        visibilityPadding,
      )
    ) {
      return;
    }

    const contentWidth = Math.max(1, bounds.maxX - bounds.minX);
    const contentHeight = Math.max(1, bounds.maxY - bounds.minY);
    const availableWidth = Math.max(1, this.width - padding * 2);
    const availableHeight = Math.max(1, this.height - padding * 2);
    const fitScale = Math.min(
      availableWidth / contentWidth,
      availableHeight / contentHeight,
    );
    const currentScale = currentTransform.k;
    const nextScale = clamp(
      Math.min(currentScale, fitScale, maxScale),
      MIN_ZOOM,
      MAX_ZOOM,
    );
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const transform = d3.zoomIdentity
      .translate(
        this.width / 2 - centerX * nextScale,
        this.height / 2 - centerY * nextScale,
      )
      .scale(nextScale);

    this.svg
      .transition()
      .duration(duration)
      .call(this.zoom.transform, transform);
  }

  findCollisions(active, pad = 0) {
    const ax = active.x,
      ay = active.y,
      ar = active.r;

    return this.instances.filter((m) => {
      if (m === active) return false;
      const dx = m.x - ax;
      const dy = m.y - ay;
      const dist = Math.hypot(dx, dy);
      return dist <= m.r + ar + pad;
    });
  }

  isMouseInCircles(mx, my) {
    return this.instances.filter((c) => {
      const dx = c.x - mx;
      const dy = c.y - my;
      const r = c.r;

      const dist = Math.hypot(dx, dy);

      return dist <= r;
    });
  }

  /**
   * Convert pointer event -> SVG viewport coords (accounting for zoom/pan).
   */
  pointerToViewport(event) {
    const [sx, sy] = d3.pointer(event, this.svg.node());
    const t = d3.zoomTransform(this.svg.node());

    return [t.invertX(sx), t.invertY(sy)];
  }

  transformInterfacePosInSVGPos(mx, my) {
    const svgPos = this.svg.node().getBoundingClientRect();

    const t = d3.zoomTransform(this.svg.node());
    return [t.invertX(mx - svgPos.left), t.invertY(my - svgPos.top)];
  }

  initMenuOptions() {
    if (!this.menu) return;

    this.renderContextMenuOptions();
    this.bindContextMenuActions();
  }

  renderContextMenuOptions() {
    this.menu.innerHTML = "";

    CONTEXT_MENU_OPTIONS.forEach((opt) => {
      const item = document.createElement("div");
      item.className = "context-menu-item";
      item.id = `context-menu-item-${opt.value}`;
      item.textContent = opt.label;

      this.menu.appendChild(item);
    });
  }

  bindContextMenuActions() {
    const actions = {
      spawnNewMap: () => this.spawnRootMapFromContext(),
      makeAnnotation: () => this.createAnnotationFromContext(),
      deleteMap: () => this.deleteInstances(this.contextMenuTargetInstances),
      groupSelected: () => this.createGroupFromSelection(),
      ungroupSelected: () => this.ungroupSelection(),
    };

    Object.entries(actions).forEach(([value, handler]) => {
      this.bindContextMenuAction(value, handler);
    });
  }

  bindContextMenuAction(value, handler) {
    this.getContextMenuItem(value)?.addEventListener("click", async (event) => {
      event.stopPropagation();
      if (event.currentTarget.classList.contains("disabled")) return;

      await handler(event);
      this.hideMenu();
    });
  }

  getContextMenuItem(value) {
    return document.getElementById(`context-menu-item-${value}`);
  }

  setContextMenuItemState(value, { disabled, text } = {}) {
    const item = this.getContextMenuItem(value);
    if (!item) return;

    if (typeof disabled === "boolean") {
      item.classList.toggle("disabled", disabled);
    }

    if (text !== undefined) item.textContent = text;
  }

  async spawnRootMapFromContext() {
    const rootConfig = this.hierarchyMode.root;
    const geo = await loadGeojsonWithDataset({
      level: rootConfig.dataLevel,
      variableId: DEFAULT_DATA_VARIABLE_ID,
    });
    const processedGeo = preprocessingGeoJSON(
      geo,
      rootConfig.preprocessResolution,
    );
    const [x, y] = this.contextMenuWorldPoint ?? [
      this.width / 2,
      this.height / 2,
    ];

    this.spawn({
      geojson: processedGeo,
      x,
      y,
      radius: this.getDefaultRadius(),
      displayLevel: rootConfig.displayLevel,
      geoResolution: rootConfig.geoResolution,
      geoID: rootConfig.geoID,
      geoLabel: rootConfig.geoLabel,
      scopeId: rootConfig.scopeId,
      scopeLabel: rootConfig.scopeLabel,
      scopeLevel: rootConfig.scopeLevel,
    });

    this.emitNetworkChange();
  }

  createAnnotationFromContext() {
    const target = this.contextMenuAnnotationTarget;
    if (!target) return;

    target.instance.createAnnotationPin(
      target.localX,
      target.localY,
      target.feature,
    );
  }

  getContextMenuClientPoint(eventOrX, y = null) {
    return [
      typeof eventOrX === "object" ? eventOrX.clientX : Number(eventOrX),
      typeof eventOrX === "object" ? eventOrX.clientY : Number(y),
    ];
  }

  updateContextMenuTarget(
    clientX,
    clientY,
    { annotationTarget = null, forcedTargetInstances = null } = {},
  ) {
    // The menu itself is positioned in viewport coordinates, while hit-testing
    // and new-node placement need the same click translated into SVG space.
    const [tx, ty] = this.transformInterfacePosInSVGPos(clientX, clientY);
    this.contextMenuWorldPoint = [tx, ty];
    this.contextMenuAnnotationTarget = annotationTarget;
    this.contextMenuTargetInstances =
      forcedTargetInstances ?? this.getContextTargetInstances(tx, ty);
  }

  /** Enable/disable menu commands from the latest click target and selection. */
  updateContextMenuItems() {
    const targetInstances = this.contextMenuTargetInstances;
    const hasTarget = targetInstances.length >= 1;

    this.setContextMenuItemState("spawnNewMap", { disabled: hasTarget });
    this.setContextMenuItemState("makeAnnotation", {
      disabled: !this.contextMenuAnnotationTarget,
    });
    this.setContextMenuItemState("deleteMap", {
      disabled: !hasTarget,
      text: targetInstances.length > 1 ? "Delete Selected" : "Delete Map",
    });
    this.setContextMenuItemState("groupSelected", {
      disabled: !this.canGroupSelection(),
    });
    this.setContextMenuItemState("ungroupSelected", {
      disabled: !this.canUngroupSelection(),
    });
  }

  positionContextMenu(clientX, clientY) {
    this.menu.style.left = `${clientX}px`;
    this.menu.style.top = `${clientY}px`;
    this.menu.style.display = "block";

    const rect = this.menu.getBoundingClientRect();
    const maxLeft =
      window.innerWidth - rect.width - CONTEXT_MENU_VIEWPORT_MARGIN;
    const maxTop =
      window.innerHeight - rect.height - CONTEXT_MENU_VIEWPORT_MARGIN;

    this.menu.style.left = `${clamp(
      clientX,
      CONTEXT_MENU_VIEWPORT_MARGIN,
      maxLeft,
    )}px`;
    this.menu.style.top = `${clamp(
      clientY,
      CONTEXT_MENU_VIEWPORT_MARGIN,
      maxTop,
    )}px`;
  }

  showMenu(
    eventOrX,
    y = null,
    { annotationTarget = null, forcedTargetInstances = null } = {},
  ) {
    if (!this.menu) return;

    const [clientX, clientY] = this.getContextMenuClientPoint(eventOrX, y);

    this.positionContextMenu(clientX, clientY);

    this.updateContextMenuTarget(clientX, clientY, {
      annotationTarget,
      forcedTargetInstances,
    });
    this.updateContextMenuItems();
  }

  hideMenu() {
    if (!this.menu) return;

    this.menu.style.display = "none";
    this.resetContextMenuState();
  }

  resetContextMenuState() {
    this.contextMenuWorldPoint = null;
    this.contextMenuTargetInstances = [];
    this.contextMenuAnnotationTarget = null;
  }
}

function clamp(value, min, max) {
  if (max < min) return (min + max) / 2;
  return Math.min(Math.max(value, min), max);
}

function abbreviateOverviewLabel(label) {
  const normalized = String(label ?? "").trim();
  if (!normalized) return "";
  if (normalized.length <= 4) return normalized;

  return `${normalized.slice(0, 3)}...`;
}

function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
