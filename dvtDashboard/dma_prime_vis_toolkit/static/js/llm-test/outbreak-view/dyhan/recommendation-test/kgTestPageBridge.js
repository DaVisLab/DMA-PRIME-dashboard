import { highlightNodeInKG } from "./drawKGNetwork.js";
import { createMasterBridge } from "./recommendationBridge.js";

const bridge = createMasterBridge();
const pendingHighlights = [];

function highlightKGNodeFromExploredInfo(payload = {}) {
  const nodeId = payload.nodeId || payload.kgNodeId || payload.id;

  if (!nodeId) {
    console.warn("KG highlight request skipped: missing node id.", payload);
    return;
  }

  const highlighted = highlightNodeInKG(
    nodeId,
    payload.highlightCategory || "visited",
  );

  if (!highlighted) {
    pendingHighlights.push(payload);
  }
}

function flushPendingHighlights() {
  const highlights = pendingHighlights.splice(0);
  highlights.forEach((payload) => highlightKGNodeFromExploredInfo(payload));
}

bridge.on("KG_HIGHLIGHT_NODE", (payload) => {
  highlightKGNodeFromExploredInfo(payload);
});

bridge.on("*", (payload, message) => {
  console.log("MASTER RECEIVED:", message.type, payload);
});

window.outbreakRecommendationMasterBridge = bridge;
window.highlightKGNodeFromExploredInfo = highlightKGNodeFromExploredInfo;
window.addEventListener("kg-network-ready", flushPendingHighlights);

console.log("MASTER STARTED:", bridge.id);
