import { systemSpecification } from "./helper.js";
import { data } from "./infoManager.js";
import {
  selectorDOMElements,
  returnSelectorDOMElementsWithCurVals,
} from "./DOMInit.js";

export async function makeAction4GeneralRequest(
  userInput,
  selectorDOMElements
) {
  const aiResp = await getAIGeneralResponse(userInput, selectorDOMElements);

  console.log(aiResp);
  presentAIResponse(aiResp);
}

async function getAIGeneralResponse(userInput, selectorDOMElements) {
  const encoded = encodeURIComponent(userInput);
  const responseEl = document.getElementById("ai-response");

  try {
    const resp = await fetch("/ai/general_request", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        prompt: encoded,
        interfaceContext: selectorDOMElements,
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      if (responseEl)
        responseEl.innerText = `Server error: ${resp.status} ${txt}`;
      return;
    }

    const data = await resp.json();
    console.log(data);

    // data.response might already be an object; handle both safely
    const aiResp = JSON.parse(data.response);

    console.log(aiResp);

    return aiResp;
  } catch (err) {
    console.error(err);
    if (responseEl) {
      responseEl.innerText =
        err instanceof Error
          ? `Client error: ${err.message}`
          : `Client error: ${String(err)}`;
    }
  }
}

export async function getAIGeneratedTutorial() {
  const responseEl = document.getElementById("ai-response");

  systemSpecification.viewInfo = [];
  systemSpecification.selectorInfo = [];
  
  systemSpecification.viewInfo.push({
    id: "smallMultiples-container",
    viewDescription: "temporal analysis view",
    chartType: "small multiple - line chart",
    specification: "js/llm-test/outbreak-view/dyhan/ai-test/drawD3SmallMultiples.js"
    // specification: data.smallMultiplesBegaSpecs.viewSpecStructure,
  });

  systemSpecification.viewInfo.push({
    id: "map-container",
    viewDescription: "spatial analysis view",
    chartType: "geographic map view",
    specification: "js/llm-test/outbreak-view/dyhan/ai-test/drawD3Map.js"
    // specification: data.mapVegaSpecs.mapSpecStructure,
  });

  systemSpecification.selectorInfo = returnSelectorDOMElementsWithCurVals();

  console.log(systemSpecification);
  //   try {
  //     const response = await fetch("http://localhost:11434/api/generate", {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //       },
  //       body: JSON.stringify({
  //         model: "gemma3", // ensure you have this model pulled
  //         prompt: "hello ollma",
  //         stream: false, // Set to false to get the complete response at once
  //       }),
  //     });

  //     if (!response.ok) {
  //       throw new Error(`HTTP error! status: ${response.status}`);
  //     }

  //     const data = await response.json();
  //     console.log(data.response);
  //   } catch (error) {
  //     console.error("Error calling the Ollama API:", error);
  //   }

  try {
    const resp = await fetch("/ai/generate_tutorial", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        system_specification: systemSpecification,
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      if (responseEl)
        responseEl.innerText = `Server error: ${resp.status} ${txt}`;
      return;
    }

    const data = await resp.json();
    console.log(data);
    responseEl.innerHTML = data;

    // data.response might already be an object; handle both safely
    const aiResp = JSON.parse(data.response);

    // let responseEl = document.getElementById("ai-response");

    console.log(aiResp);

    return aiResp;
  } catch (err) {
    console.error(err);
    if (responseEl) {
      responseEl.innerText =
        err instanceof Error
          ? `Client error: ${err.message}`
          : `Client error: ${String(err)}`;
    }
  }
}

function presentAIResponse(response) {
  let responseEl = document.getElementById("ai-response");
  responseEl.innerHTML = response;
}
