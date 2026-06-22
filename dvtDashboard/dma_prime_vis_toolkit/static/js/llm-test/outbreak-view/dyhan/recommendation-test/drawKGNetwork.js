const KG_CONTAINER_ID = "kg-graph-container";
const MIN_RENDER_SIZE = 40;

let kgDataPromise = null;
let activeSimulation = null;
let resizeObserver = null;
let pendingAnimationFrame = null;
const kgNodeElements = new Map();

function normalizeKGNodeKey(nodeId) {
  return String(nodeId ?? "")
    .replace(/^node-/i, "")
    .toLowerCase();
}

async function getPredefinedKG() {
  const resp = await fetch("/recommendation/get_predefined_kg", {
    method: "GET",
    credentials: "same-origin",
  });

  if (!resp.ok) {
    throw new Error(`Failed to load KG data: ${resp.status}`);
  }

  const data = await resp.json();
  return data.knowledge_graph;
}

function getKGData() {
  if (!kgDataPromise) {
    kgDataPromise = getPredefinedKG().catch((error) => {
      kgDataPromise = null;
      throw error;
    });
  }

  return kgDataPromise;
}

function getContainerSize(container) {
  const rect = container.getBoundingClientRect();
  const width = Math.floor(rect.width || container.clientWidth);
  const height = Math.floor(rect.height || container.clientHeight);

  return { width, height };
}

function canRender(container) {
  const { width, height } = getContainerSize(container);
  return width > MIN_RENDER_SIZE && height > MIN_RENDER_SIZE;
}

function removeVisitedInfoFromRecommendations(visited) {
  const id = normalizeKGNodeKey(visited);
  const recommendationItem =
    document.getElementById(`div-recommendation-item-${id}`) ||
    document.getElementById(`div-recommendation-item-node-${id}`);

  recommendationItem?.remove();
}

function registerNodeElement(nodeId, element) {
  const key = normalizeKGNodeKey(nodeId);
  kgNodeElements.set(key, element);
  kgNodeElements.set(`node-${key}`, element);
}

function getRegisteredNodeElement(nodeId) {
  const key = normalizeKGNodeKey(nodeId);
  return (
    kgNodeElements.get(key) ||
    kgNodeElements.get(`node-${key}`) ||
    document.getElementById(`node-${key}`)
  );
}

async function drawKGNetwork() {
  const selectedDiv = document.getElementById(KG_CONTAINER_ID);
  if (!selectedDiv || !canRender(selectedDiv)) return false;

  const data = await getKGData();
  const { width, height } = getContainerSize(selectedDiv);
  if (width <= MIN_RENDER_SIZE || height <= MIN_RENDER_SIZE) return false;

  if (activeSimulation) {
    activeSimulation.stop();
    activeSimulation = null;
  }

  kgNodeElements.clear();
  selectedDiv.innerHTML = "";

  const svg = d3
    .select(selectedDiv)
      .append("svg")
      .attr("class", "kg-network-svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("display", "block")
      .style("width", "100%")
      .style("height", "100%");

  const defs = svg.append("defs");
  defs
    .append("marker")
    .attr("id", "kg-arrow")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 18)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", "#7a869a");

  const g = svg.append("g").attr("class", "kg-network-layer");

  const zoom = d3
    .zoom()
    .scaleExtent([0.2, 5])
    .on("zoom", (event) => g.attr("transform", event.transform));

  svg.call(zoom);
  centerAndZoom(svg, g, zoom, width, height, 0.75);

  const links = data.edges || data.links || [];
  const nodes = data.nodes || [];

  const simulation = d3
    .forceSimulation(nodes)
    .force(
      "link",
      d3
        .forceLink(links)
        .id((d) => d.id)
        .distance(120),
    )
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius(35));

  activeSimulation = simulation;

  const link = g
    .append("g")
    .attr("class", "kg-links")
    .selectAll("line")
    .data(links)
    .enter()
    .append("line")
    .attr("class", "link")
    .attr("marker-end", "url(#kg-arrow)");

  // const linkLabel = g
  //   .append("g")
  //   .selectAll("text")
  //   .data(links)
  //   .enter()
  //   .append("text")
  //   .attr("class", "link-label")
  //   .text((d) => d.relation || "")
  //   .style("text-anchor", "middle");

  const node = g
    .append("g")
    .attr("class", "kg-nodes")
    .selectAll("g")
    .data(nodes)
    .enter()
    .append("g")
    .attr("id", (d) => `node-${normalizeKGNodeKey(d.id)}`)
    .attr("class", "node")
    .attr("data-kg-id", (d) => normalizeKGNodeKey(d.id))
    .each(function (d) {
      registerNodeElement(d.id, this);
    })
    .call(
      d3
        .drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended),
    )
    .attr("opacity", 0.9)
    .on("click", (event, d) => {
      if (d.url) window.open(d.url, "_blank");
    });

  node
    .append("circle")
    .attr("r", 12)
    .attr("fill", (d) =>
      d.group ? d3.schemeCategory10[d.group % 10] : "#3f8f7a",
    );

  node
    .append("text")
    .attr("x", 16)
    .attr("y", 4)
    .text((d) => d.label || d.id);

  simulation.on("tick", () => {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);

    //   linkLabel
    //     .attr("x", (d) => (d.source.x + d.target.x) / 2)
    //     .attr("y", (d) => (d.source.y + d.target.y) / 2);

    node.attr("transform", (d) => `translate(${d.x},${d.y})`);
  });

  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  window.dispatchEvent(new CustomEvent("kg-network-ready"));
  return true;
}

function scheduleDrawKGNetwork() {
  if (pendingAnimationFrame !== null) return;

  pendingAnimationFrame = requestAnimationFrame(async () => {
    pendingAnimationFrame = null;

    try {
      await drawKGNetwork();
    } catch (error) {
      console.error("KG Network draw failed.", error);
    }
  });
}

function initKGNetwork() {
  const selectedDiv = document.getElementById(KG_CONTAINER_ID);
  if (!selectedDiv) return;

  scheduleDrawKGNetwork();

  if (resizeObserver) {
    resizeObserver.disconnect();
  }

  if ("ResizeObserver" in window) {
    resizeObserver = new ResizeObserver(() => {
      if (canRender(selectedDiv)) {
        scheduleDrawKGNetwork();
      }
    });
    resizeObserver.observe(selectedDiv);
  } else {
    window.addEventListener("resize", scheduleDrawKGNetwork);
  }

  document.addEventListener("sl-tab-show", (event) => {
    if (event.detail?.name === "outbreak-kg") {
      scheduleDrawKGNetwork();
    }
  });
}

export function highlightNodeInKG(nodeId, highlightCategory = "visited") {
  const nodeElement = getRegisteredNodeElement(nodeId);
  const selectedNode = d3.select(nodeElement);
  if (selectedNode.empty()) return false;

  selectedNode.attr("opacity", 1);
  switch (highlightCategory) {
    case "visited":
      removeVisitedInfoFromRecommendations(nodeId);
      selectedNode.classed("visited", true);
      selectedNode.select("circle").attr("opacity", 1).attr("fill", "red");
      // .attr("stroke-width", ".3rem");
      break;
    case "recommended":
      selectedNode
        .select("circle")
        .attr("opacity", 1)
        .attr("stroke", "red") // Border color
        .attr("stroke-width", ".3rem"); // Border thickness in pixels
      // .attr("fill", "red");
      break;
  }

  return true;
}

function centerAndZoom(svg, g, zoom, width, height, scale = 1) {
  svg.call(
    zoom.transform,
    d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(scale)
      .translate(-width / 2, -height / 2),
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initKGNetwork, { once: true });
} else {
  initKGNetwork();
}
