const DEFAULT_CHANNEL_NAME = "cluster";
const MESSAGE_NAMESPACE = "outbreak-detection-recommendation-test";

function createBridgeId(role) {
  const randomId =
    globalThis.crypto?.randomUUID?.() ||
    Math.random().toString(36).slice(2, 10);

  return `${role}-${randomId}`;
}

function normalizeTargets(to) {
  if (Array.isArray(to)) return to;
  if (!to) return ["*"];

  return [to];
}

function isMessageForPeer(message, peer) {
  const targets = normalizeTargets(message.to);

  return (
    targets.includes("*") ||
    targets.includes(peer.role) ||
    targets.includes(peer.id)
  );
}

export function createRecommendationBridge({
  role,
  channelName = DEFAULT_CHANNEL_NAME,
  id = createBridgeId(role),
} = {}) {
  if (!role) {
    throw new Error("createRecommendationBridge requires a role.");
  }

  const channel = new BroadcastChannel(channelName);
  const handlers = new Map();
  const peer = { id, role };

  function emit(type, payload = {}, { to = "*", meta = {} } = {}) {
    const message = {
      namespace: MESSAGE_NAMESPACE,
      type,
      payload,
      from: peer.id,
      fromRole: peer.role,
      to: normalizeTargets(to),
      meta,
      time: Date.now(),
    };

    channel.postMessage(message);
    return message;
  }

  function on(type, handler) {
    const typeHandlers = handlers.get(type) || new Set();
    typeHandlers.add(handler);
    handlers.set(type, typeHandlers);

    return () => typeHandlers.delete(handler);
  }

  function dispatch(message) {
    const typeHandlers = handlers.get(message.type);
    const wildcardHandlers = handlers.get("*");

    typeHandlers?.forEach((handler) => handler(message.payload, message));
    wildcardHandlers?.forEach((handler) => handler(message.payload, message));
  }

  channel.onmessage = (event) => {
    const message = event.data;

    if (
      !message ||
      message.namespace !== MESSAGE_NAMESPACE ||
      message.from === peer.id ||
      !isMessageForPeer(message, peer)
    ) {
      return;
    }

    dispatch(message);
  };

  function destroy() {
    handlers.clear();
    channel.close();
  }

  return {
    ...peer,
    channel,
    destroy,
    emit,
    on,
    sendToMaster: (type, payload = {}, options = {}) =>
      emit(type, payload, { ...options, to: "master" }),
    sendToSlaves: (type, payload = {}, options = {}) =>
      emit(type, payload, { ...options, to: "slave" }),
    sendToPeer: (targetId, type, payload = {}, options = {}) =>
      emit(type, payload, { ...options, to: targetId }),
  };
}

export function createMasterBridge(options = {}) {
  const bridge = createRecommendationBridge({ ...options, role: "master" });

  bridge.on("SLAVE_HELLO", (payload, message) => {
    bridge.sendToPeer(message.from, "MASTER_READY", {
      masterId: bridge.id,
      received: payload,
    });
  });

  bridge.emit("MASTER_HELLO", { masterId: bridge.id }, { to: "slave" });

  return bridge;
}

export function createSlaveBridge(options = {}) {
  const bridge = createRecommendationBridge({ ...options, role: "slave" });

  bridge.sendToMaster("SLAVE_HELLO", { slaveId: bridge.id });

  return bridge;
}
