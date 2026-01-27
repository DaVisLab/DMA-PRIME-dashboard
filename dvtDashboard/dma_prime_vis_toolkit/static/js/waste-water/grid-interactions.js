gridDiseaseSelector.addEventListener("sl-change", () => {
  drawCharts();
  drawMap();
});

gridMapResizer.addEventListener("sl-resize", (e) => {
  drawMap(
    e.detail.entries[0].contentRect.height,
    e.detail.entries[0].contentRect.width
  );
});

gridContainerResizer.addEventListener("sl-resize", () => {
  drawCharts();
  drawMap();
});
