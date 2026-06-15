import { getUnitVector, getMagnitude } from "./helper.js";

const d3 = window.d3;

// Maintains graph edges between map bubbles and renders them as SVG links.
export const graphRelationship = {
  hierarchical: 1,
};

const HIERARCHY_LINK_STROKE = "#344054";
const HIERARCHY_LINK_HOVER_STROKE = "#0d6efd";
const HIERARCHY_LINK_WIDTH = 3.5;
const HIERARCHY_LINK_HOVER_WIDTH = 6;
const LINK_OPACITY = 0.85;
const START_POINT_RADIUS = 5;
const START_POINT_HOVER_RADIUS = 7;

export class GraphManager {
  constructor(manager, svgSel, viewportSel, layerGroupID) {
    this.manager = manager;
    this.svg = svgSel;
    this.viewport = viewportSel;
    this.gLinks = this.viewport.append("g").attr("id", layerGroupID);

    this.nodes = new Map();
    this.edges = [];
  }

  addNode(nodeId, getCenter) {
    this.nodes.set(nodeId, { getCenter });
  }

  removeNode(nodeId) {
    for (const key of Array.from(this.nodes.keys())) {
      if (typeof key === "string" && key.includes(nodeId)) {
        const allEdges = this.findAllEdgesConnectedToNode(key);

        allEdges.forEach((edge) => this.disconnectEdgeById(edge.id));
        this.nodes.delete(key);
      }
    }
  }

  addEdge(id, parentId, childId, edgeType) {
    if (this.edges.some((edge) => edge.id === id)) return false;
    this.edges.push({ id, parentId, childId, edgeType });
    this.updateLinks();
    return true;
  }

  findAllEdgesConnectedToNode(nodeId) {
    return this.edges.filter(
      (d) => d.parentId === nodeId || d.childId === nodeId,
    );
  }

  disconnectEdgeById(edgeId) {
    const idx = this.edges.findIndex((e) => e.id === edgeId);
    if (idx !== -1) this.edges.splice(idx, 1);
    this.updateLinks();
  }

  /**
   * Re-render all graph links from live node center getters. Nodes move and
   * resize frequently, so links are computed from DOM geometry at update time.
   */
  updateLinks() {
    const self = this;
    const hierarchyEdges = this.edges.filter(
      (edge) => edge.edgeType === graphRelationship.hierarchical,
    );
    const isHighlighted = (edge) =>
      self.manager.isHierarchyEdgeHighlighted(edge.id);

    this.gLinks
      .selectAll("path.link")
      .data(hierarchyEdges, (d) => d.id)
      .join(
        (enter) =>
          enter
            .append("path")
            .attr("class", (d) =>
              getLinkClassName(isHighlighted(d)),
            )
            .attr("fill", "none")
            .attr("opacity", LINK_OPACITY)
            .style("pointer-events", "none"),
        (update) =>
          update.attr("class", (d) =>
            getLinkClassName(isHighlighted(d)),
          ),
        (exit) => exit.remove(),
      )
      .each(function (d) {
        const highlighted = isHighlighted(d);
        const p = self.nodes.get(d.parentId);
        const c = self.nodes.get(d.childId);
        if (!p || !c) return;

        // Hierarchical links anchor to a feature inside the parent map and stop
        // at the child node boundary, so the branch reads like a mind-map edge.
        const [x1, y1] = p.getCenter();
        const [x2, y2] = c.getCenter();

        const dist = getMagnitude([x2 - x1, y2 - y1]);
        const childNode = document.getElementById(d.childId);
        const circleRadius = childNode
          ? +d3.select(childNode).attr("r") || 0
          : 0;
        const [ux, uy] = getUnitVector([x1, y1], [x2, y2]);

        const x2_ = x1 + ux * (dist - circleRadius);
        const y2_ = y1 + uy * (dist - circleRadius);

        d3.select(this)
          .attr("d", getMindMapPath([x1, y1], [x2_, y2_]))
          .attr(
            "stroke",
            highlighted ? HIERARCHY_LINK_HOVER_STROKE : HIERARCHY_LINK_STROKE,
          )
          .attr(
            "stroke-width",
            highlighted ? HIERARCHY_LINK_HOVER_WIDTH : HIERARCHY_LINK_WIDTH,
          )
          .attr("stroke-dasharray", null)
          .attr("stroke-linecap", "round")
          .attr("opacity", highlighted ? 1 : LINK_OPACITY);
      });

    this.gLinks
      .selectAll("circle.startPoint")
      .data(hierarchyEdges, (d) => d.id)
      .join("circle")
      .attr("class", (d) =>
        [
          "startPoint",
          isHighlighted(d) ? "is-highlighted" : "",
        ]
          .filter(Boolean)
          .join(" "),
      )
      .attr("r", (d) =>
        isHighlighted(d) ? START_POINT_HOVER_RADIUS : START_POINT_RADIUS,
      )
      .style("fill", HIERARCHY_LINK_HOVER_STROKE)
      .attr("id", (d) => `startPoint-${d.parentId}`)
      .attr("cx", (d) => self.nodes.get(d.parentId)?.getCenter()?.[0] ?? 0)
      .attr("cy", (d) => self.nodes.get(d.parentId)?.getCenter()?.[1] ?? 0);

    this.manager.updateOverview?.();
  }
}

function getLinkClassName(isHighlighted = false) {
  return [
    "link",
    "link-hierarchical",
    isHighlighted ? "is-highlighted" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Hierarchical links should feel like mind-map branches instead of straight
 * connector wires. The control points bend mostly along the dominant axis so
 * links stay readable whether a child is left/right or above/below its parent.
 */
function getMindMapPath([x1, y1], [x2, y2]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const horizontalBend = Math.max(56, Math.abs(dx) * 0.48);
  const verticalBend = Math.max(44, Math.abs(dy) * 0.32);
  const direction = dx === 0 ? 1 : Math.sign(dx);

  if (Math.abs(dx) >= Math.abs(dy) * 0.65) {
    return [
      `M ${x1},${y1}`,
      `C ${x1 + direction * horizontalBend},${y1}`,
      `${x2 - direction * horizontalBend * 0.55},${y2}`,
      `${x2},${y2}`,
    ].join(" ");
  }

  const yDirection = dy === 0 ? 1 : Math.sign(dy);
  return [
    `M ${x1},${y1}`,
    `C ${x1},${y1 + yDirection * verticalBend}`,
    `${x2},${y2 - yDirection * verticalBend * 0.55}`,
    `${x2},${y2}`,
  ].join(" ");
}
