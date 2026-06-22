import { highlightNodeInKG } from "./drawKGNetwork.js";
import { returnKGVerifiedId } from "./KGUtils.js";
export { showRecommendationResults, removeVisitedInfoFromRecommendations };

function removeVisitedInfoFromRecommendations(visited) {
  //   console.log(returnKGVerifiedId(visited));
  const id = returnKGVerifiedId(visited);

  d3.select(`#div-recommendation-item-${id}`)
    .transition()
    .duration(300)
    .style("opacity", 0)
    .remove();
}

function showRecommendationResults(results) {
  const recommendationResultsContainer = document.getElementById(
    "exploration-recommendation-container",
  );

  removeVisitedInfoFromRecommendations([]);

  results.forEach((result) => {
    console.log(result);
    const id = returnKGVerifiedId(result.node);
    const selection = d3.select(`#div-recommendation-item-${id}`);
    console.log(id);
    if (!selection.empty()) return;
    const resultItem = returnRecommendationItemUnit(result);
    recommendationResultsContainer.appendChild(resultItem);

    // highlight the recommended node in KG
    highlightNodeInKG(`node-${id}`, "recommended");
  });
}

function returnRecommendationItemUnit(result) {
  const resultItem = document.createElement("div");
  resultItem.id = `div-recommendation-item-${result.node}`;
  resultItem.classList.add("recommendation-result-item");

  resultItem.innerHTML = `
            <p>${result.node}: ${result.score.toFixed(3)}</p>
        `;
  return resultItem;
}
