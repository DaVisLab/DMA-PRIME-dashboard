import { getPredefinedKG } from "../dataManager.js";
import { removeVisitedInfoFromRecommendations } from "./showRecommendataionResults.js";
drawKGNetwork();

function drawKGNetwork() {
  //   const container = document.getElementById(containerId);
  getPredefinedKG().then((data) => {
    const selectedDiv = document.getElementById("kg-graph-container");

    selectedDiv.innerHTML = ""; // clear previous content

    const width = selectedDiv.clientWidth;
    const height = selectedDiv.clientHeight;

    const svg = d3
      .select(selectedDiv)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("display", "block");

    // zoom
    const g = svg.append("g");

    const zoom = d3
      .zoom()
      .scaleExtent([0.2, 5])
      .on("zoom", (event) => g.attr("transform", event.transform));

    svg.call(zoom);

    centerAndZoom(svg, g, zoom, width, height, 0.3);

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

    // console.log(nodes);
    // console.log(links);
    const link = g
      .append("g")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("class", "link")
      .attr("marker-end", "url(#arrow)");

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
      .selectAll("g")
      .data(nodes)
      .enter()
      .append("g")
      .attr("id", (d) => {
        const id = typeof d.id === "string" ? d.id.toLowerCase() : d.id;
        return `node-${id}`;
      })
      .attr("class", "node")
      .call(
        d3
          .drag()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended),
      )
      .attr("opacity", 0.5)
      .on("click", (event, d) => {
        if (d.url) window.open(d.url, "_blank");
      });

    node
      .append("circle")
      .attr("r", 12)
      .attr("fill", (d) =>
        d.group ? d3.schemeCategory10[d.group % 10] : "#69b3a2",
      );

    node
      .append("text")
      //   .attr("opacity", 0)
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
  });
}

export function highlightNodeInKG(nodeId, highlightCategory = "visited") {
  //   console.log(nodeId.toLowerCase());
  //   console.log(d3.select(`#${nodeId.toLowerCase()}`));
  const selectedNode = d3.select(`#${nodeId.toLowerCase()}`);
  selectedNode.attr("opacity", 1);
  switch (highlightCategory) {
    case "visited":
      removeVisitedInfoFromRecommendations(nodeId.toLowerCase());
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
