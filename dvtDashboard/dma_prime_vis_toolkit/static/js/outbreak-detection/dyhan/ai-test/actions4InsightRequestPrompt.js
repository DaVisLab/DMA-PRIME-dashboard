import { categorizeStringOrNumber } from "../utils.js";
import { makeAction4GeneralRequest } from "./actions4GeneralRequest.js";

import { data } from "./infoManager.js";
// console.log(data)
export async function makeAction4InsightRequestFromDataPrompt(userInput) {

  const dataOfInterest = data.tableData;
  //   [
  //     { user_id: "U01", condition: "SHORT", response_time: 3.2, accuracy: 0.85 },
  //     { user_id: "U02", condition: "SHORT", response_time: 3.5, accuracy: 0.8 },
  //     { user_id: "U03", condition: "SHORT", response_time: 3.1, accuracy: 0.88 },
  //     { user_id: "U01", condition: "MEDIUM", response_time: 4.1, accuracy: 0.82 },
  //     { user_id: "U02", condition: "MEDIUM", response_time: 4.3, accuracy: 0.79 },
  //     { user_id: "U03", condition: "MEDIUM", response_time: 4.0, accuracy: 0.84 },
  //     { user_id: "U01", condition: "LONG", response_time: 5.2, accuracy: 0.75 },
  //     { user_id: "U02", condition: "LONG", response_time: 5.5, accuracy: 0.72 },
  //     { user_id: "U03", condition: "LONG", response_time: 5.3, accuracy: 0.74 },
  //   ];

  const fields = categorizeStringOrNumber(dataOfInterest);
  let resp = await generateInsightsFromData(fields, userInput);

  console.log("Insights from data response:", resp);

  makeAction4GeneralRequest(resp);
}

async function generateInsightsFromData(fields, userRequest) {
  let prompt = buildPrompt(fields, userRequest);

  console.log(prompt);
  const encoded = encodeURIComponent(prompt);

  const output = await fetch("/ai/request_insights_from_data", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ prompt: prompt }),
  });

  const contentType = output.headers.get("content-type") || "";
  let body;

  if (contentType.includes("application/json")) {
    body = await output.json();
  } else {
    body = await output.text();
  }

  console.log("body:", body);
  body = body.response;

  console.log(body);
  return body;
}

function buildPrompt(fields, userRequest) {
  return `
DATASET SCHEMA:
- Format: csv
- Fields:
${fields.map((f) => `  - ${f.name}: ${f.type}`).join("\n")}

USER REQUEST:
${userRequest}
`;
}
