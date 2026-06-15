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
  authoringState,
  contextMenuEl,
  hierarchyModeId = DEFAULT_HIERARCHY_MODE_ID,
  managerId,
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
  const manager = new MapManager(svgEl, {
    contextMenuEl,
    hierarchyMode,
    managerId,
    onAnnotationsChange,
    onAnnotationHover,
    onNetworkChange,
    onSelectionChange,
  });

  if (authoringState?.maps?.length) {
    await manager.restoreAuthoringState(authoringState);
    return {
      manager,
      destroy() {
        manager.destroy();
      },
    };
  }

  const geo = await loadGeojsonWithDataset({
    level: hierarchyMode.root.dataLevel,
    variableId: DEFAULT_DATA_VARIABLE_ID,
  });
  const processedGeo = preprocessingGeoJSON(
    geo,
    hierarchyMode.root.preprocessResolution,
  );

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
      manager.destroy();
    },
  };
}
