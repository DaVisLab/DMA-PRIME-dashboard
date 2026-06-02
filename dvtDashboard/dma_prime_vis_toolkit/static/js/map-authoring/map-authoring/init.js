import { MapManager } from "./MapManager.js";
import { preprocessingGeoJSON } from "./helper.js";
import {
  DEFAULT_DATA_VARIABLE_ID,
  loadGeojsonWithDataset,
} from "./DataRepository.js";
import {
  DEFAULT_HIERARCHY_MODE_ID,
  getHierarchyModeById,
} from "./HierarchyConfig.js";

const d3 = window.d3;

// Vanilla replacement for the former React BubbleMapInit wrapper.
export async function initializeBubbleMap({
  hierarchyModeId = DEFAULT_HIERARCHY_MODE_ID,
  onAnnotationsChange,
  onAnnotationHover,
  onNetworkChange,
  onSelectionChange,
  svgEl,
} = {}) {
  if (!svgEl) throw new Error("initializeBubbleMap requires an SVG element.");
  if (!d3) throw new Error("D3 must be loaded before map-authoring modules.");

  d3.select(svgEl).selectAll("*").remove();

  const hierarchyMode = getHierarchyModeById(hierarchyModeId);
  const geo = await loadGeojsonWithDataset({
    level: hierarchyMode.root.dataLevel,
    variableId: DEFAULT_DATA_VARIABLE_ID,
  });
  const processedGeo = preprocessingGeoJSON(
    geo,
    hierarchyMode.root.preprocessResolution,
  );

  const manager = new MapManager(svgEl, {
    hierarchyMode,
    onAnnotationsChange,
    onAnnotationHover,
    onNetworkChange,
    onSelectionChange,
  });

  const rootMap = manager.spawn({
    geojson: processedGeo,
    x: manager.width / 2,
    y: manager.height / 2,
    radius: manager.getDefaultRadius(),
    displayLevel: hierarchyMode.root.displayLevel,
    geoResolution: hierarchyMode.root.geoResolution,
    geoID: hierarchyMode.root.geoID,
    geoLabel: hierarchyMode.root.geoLabel,
    scopeId: hierarchyMode.root.scopeId,
    scopeLabel: hierarchyMode.root.scopeLabel,
    scopeLevel: hierarchyMode.root.scopeLevel,
  });
  manager.selectInstance(rootMap.instanceId);

  return {
    manager,
    destroy() {
      [...(manager.instances ?? [])].forEach((instance) => {
        instance.destroy?.();
      });
      manager.instances = [];
      d3.select(window).on("keydown.mapManagerDelete", null);
      d3.select(document)
        .on("click.mapManagerSelection", null)
        .on("mousedown.annotationEditor", null);
      d3.select(svgEl)
        .on("contextmenu", null)
        .on(".zoom", null)
        .selectAll("*")
        .remove();
    },
  };
}
