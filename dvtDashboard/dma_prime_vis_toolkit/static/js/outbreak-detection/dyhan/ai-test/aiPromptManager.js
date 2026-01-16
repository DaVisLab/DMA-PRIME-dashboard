import { makeAction4GeneralRequest } from "./actions4GeneralRequest.js";
import { makeAction4VisRequest } from "./actions4VisRequest.js";
import { makeAction4InsightRequestFromDataPrompt } from "./actions4InsightRequestPrompt.js";
import { validateVegaLite,interfaceUpdate } from "./helper.js";
import { data } from "./infoManager.js";
import { selectorDOMElements } from "./DOMInit.js";
document.getElementById("ai-send-btn").addEventListener("click", async () => {
  const userInput = document.getElementById("ai-prompt-input").value;

  const encoded = encodeURIComponent(userInput);
  // const url = `/ai?prompt=${encoded}`;

  console.log("User Input:", userInput);
  try {
    // const resp = await fetch(url, {
    //   method: "GET",
    //   credentials: "same-origin", // send cookies for @login_required
    //   headers: {
    //     Accept: "application/json",
    //   },
    // });

    const resp = await fetch("/ai", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        prompt: userInput,
        interfaceContext: selectorDOMElements,
      }),
    });

    
    let responseEl = document.getElementById("ai-response");
    if (!resp.ok) {
      const txt = await resp.text();

      responseEl.innerText = `Server error: ${resp.status} ${txt}`;
      return;
    }

    const data = await resp.json();

    console.log(data);
    // // Example response handling: show latest reply and append to conversation history
    const aiResp = JSON.parse(data.response);
    
    console.log(aiResp)
    
    if(aiResp.interface_update_needed){
      const updateRequires = aiResp.updates;

      for(const updateItem of updateRequires){
        console.log(updateItem)
        interfaceUpdate(updateItem)
      }

    }
    return 
    const promptType = data.prompt_type;

    makeAction4InsightRequestFromDataPrompt(userInput);
    // switch (promptType) {
    //   case "GeneralRequest":
    //     makeAction4GeneralRequest(aiReply);
    //     break;
    //   case "VisRequest":
    //     console.log(
    //       "vis request: make action4VisRequest with data and userInput"
    //     );
    //     makeAction4VisRequest(userInput);
    //     break;
    //   case "InsightRequestFromVis":
    //     console.log(
    //       "insight request: make action4InsightRequestFromVisPrompt with userInput"
    //     );
    //     break;
    //   case "InsightRequestFromData":
    //     console.log(
    //       "insight request: make action4InsightRequestFromDataPrompt with userInput"
    //     );
    //     makeAction4InsightRequestFromDataPrompt(userInput);
    //     break;

    //   default:
    //     makeAction4GeneralRequest(aiReply);
    //     break;
    // }
  } catch (err) {
    // responseEl.innerText = `Request failed: ${err.message}`;
  }
});

export async function presentAIResponse(response) {
  let responseEl = document.getElementById("ai-response");

  let factItems = response.facts
    .map(
      (fact) => `<div id="${fact.id}">
      <div style="font-weight: bold;">${fact.title}</div> 
      ${fact.statement}
      <hr/>
      </div>`
    )
    .join("");

  responseEl.innerHTML = `${factItems}`;

  response.highlight_patches.forEach(async (d) => {
    const highligh_id = d.fact_id;
    const corresponsidingFactId = `F${highligh_id.replace("F", "")}`;

    const factEl = document.getElementById(corresponsidingFactId);

    factEl.addEventListener("mouseover", async () => {
      const highlightedVegaSpec = structuredClone(
        data.mapVegaSpecs.originalMapVegaSpec
      );

      // Modify the spec to highlight patches
      highlightedVegaSpec.layer = highlightedVegaSpec.layer || [];
      console.log(d);
      console.log(d.patch.layer);
      highlightedVegaSpec.layer.push(...d.patch.layer);
      await vegaEmbed("#map-container", highlightedVegaSpec, {
        actions: true,
      });
    });

    factEl.addEventListener("mouseout", async () => {
      await vegaEmbed("#map-container", data.mapVegaSpecs.originalMapVegaSpec, {
        actions: true,
      });
    });
  });

  response.optional_additional_charts.forEach((d) => {
    const chart_id = d.chart_id;
    const corresponsidingFactId = `F${chart_id.replace("C", "")}`;

    const factEl = document.getElementById(corresponsidingFactId);
    const width = factEl.getBoundingClientRect().width;
    const height = factEl.getBoundingClientRect().height;
    d.width = width / 2;
    d.height = height;

    factEl.addEventListener("mouseover", async () => {
      let validation = validateVegaLite(d.vega_lite_spec);

      console.log("Validation result:", validation);
      await vegaEmbed(
        `#ai-generated-helper-vis-container`,
        // vegaSpec,
        d.vega_lite_spec,
        { actions: false }
      );
    });

    factEl.addEventListener("mouseout", async () => {
      document.getElementById("ai-generated-helper-vis-container").innerHTML =
        "";
    });
  });
}
