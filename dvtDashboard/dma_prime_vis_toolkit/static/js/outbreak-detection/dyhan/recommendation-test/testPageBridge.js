import { getNodeID, returnKGVerifiedId } from "./KGUtils.js";
import { createSlaveBridge } from "./recommendationBridge.js";

const bridge = createSlaveBridge();

function normalizeExploredInfo(input) {
  if (typeof input === "string") {
    return { id: input };
  }

  return input || {};
}

function resolveExploredNodeId(input) {
  const exploredInfo = normalizeExploredInfo(input);
  const sourceId =
    exploredInfo.id || exploredInfo.elementId || exploredInfo.nodeId;

  if (!sourceId) return null;

  if (sourceId.startsWith("node-")) {
    return sourceId;
  }

  return getNodeID(sourceId);
}

export function sendExploredInfoToKG(input, options = {}) {
  const exploredInfo = normalizeExploredInfo(input);
  const nodeId = options.nodeId || resolveExploredNodeId(exploredInfo);

  if (!nodeId) {
    console.warn("No KG node id could be resolved from explored info.", input);
    return null;
  }

  return bridge.sendToMaster("KG_HIGHLIGHT_NODE", {
    ...exploredInfo,
    nodeId,
    kgId: returnKGVerifiedId(nodeId),
    highlightCategory: options.highlightCategory || "visited",
  });
}

window.outbreakRecommendationSlaveBridge = bridge;
window.sendExploredInfoToKG = sendExploredInfoToKG;
window.testHighlightExploredInfoInKG = (input, options = {}) =>
  sendExploredInfoToKG(input, options);

bridge.on("*", (payload, message) => {
  console.log("SLAVE RECEIVED:", message.type, payload);
});

console.log("SLAVE STARTED:", bridge.id);
