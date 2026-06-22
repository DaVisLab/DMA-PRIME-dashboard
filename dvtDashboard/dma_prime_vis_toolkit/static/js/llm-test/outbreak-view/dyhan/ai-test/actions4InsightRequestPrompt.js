import { categorizeStringOrNumber } from "../utils.js";
import { makeAction4GeneralRequest } from "./actions4GeneralRequest.js";
import { dataUrlToBlob } from "./helper.js";
import { data } from "./infoManager.js";
import { presentAIResponse } from "./aiPromptManager.js";

// console.log(data)
export async function makeAction4InsightRequestFromDataPrompt(userInput) {
  //   const dataOfInterest = data.tableData;
  //   const dataOfInterest = data.tableData;
  console.log("makeAction4InsightRequestFromDataPrompt");
  
  const imageBlob = dataUrlToBlob(data.mapVegaSpecs.mapViewPng);
  const vegaLiteSpecStructure = data.mapVegaSpecs.mapSpecStructure;
  const dataOfInterest = data.mapVegaSpecs.transformedData;
  const imageFile = new File([imageBlob], "map.png", { type: "image/png" });

  console.log("dataOfInterest:", dataOfInterest);

  const payload = {
    chart_type: "vega_lite_map",
    vega_lite_spec_structure: vegaLiteSpecStructure,
    data_interest: dataOfInterest,
    image_file: imageFile,
  };

  //   const fields = categorizeStringOrNumber(dataOfInterest);
  //   let resp = await generateInsightsFromData(fields, userInput);
  const resp = await generateInsightsFromData(payload, userInput);
  console.log("Insights from data response:", resp);

  // Continue your pipeline
  //   makeAction4GeneralRequest(resp);
  console.log(typeof resp);
  presentAIResponse(JSON.parse(resp));
  //   console.log("Insights from data response:", resp);

  //   makeAction4GeneralRequest(resp);
}

async function generateInsightsFromData(payload, userRequest) {
  //   let prompt = buildPrompt(payload, userRequest);

  console.log("generateInsightsFromData");
  console.log(payload.image_file);
  //   const encoded = encodeURIComponent(prompt);
  const fd = new FormData();
  fd.append("prompt", userRequest);
  fd.append(
    "vega_lite_spec_structure",
    JSON.stringify(payload.vega_lite_spec_structure)
  );
  fd.append("transformed_data", JSON.stringify(payload.data_interest));
  fd.append("image_file", payload.image_file);

  const output = await fetch("/ai/request_insights_from_data", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
    },
    body: fd,
  });

  const contentType = output.headers.get("content-type") || "";
  let body;

  if (contentType.includes("application/json")) {
    body = await output.json();
  } else {
    body = await output.text();
  }

  //   console.log("body:", body);
  body = body.response;

  //   console.log(body);
  return body;
}

function buildPrompt(fields, userRequest) {
  return `
DATASET SCHEMA:
- Format: csv
${fields.map((f) => `  - ${f.name}: ${f.type}`).join("\n")}

USER REQUEST:
${userRequest}
`;
}
