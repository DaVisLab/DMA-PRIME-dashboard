import { categorizeStringOrNumber } from "../utils.js";
import { data } from "./infoManager.js";
import { validateVegaLite } from "./helper.js";

export async function makeAction4VisRequest(userInput) {
  console.log(userInput);
  const visContainer = document.getElementById("ai-generated-vis-container");

  let numVis = d3.select(visContainer).selectAll(".vis").size();
  let divVisId = `vis-${numVis + 1}`;
  d3.select(visContainer)
    .append("div")
    .attr("class", "vis")
    .attr("id", divVisId)
    .style("width", "600px")
    .style("height", "400px");
  const dataOfInterest = data.tableData;

  const fields = categorizeStringOrNumber(dataOfInterest);

  //   console.log(fields)
  const datasetSchema = {
    format: "json",
    fields: fields,
  };

  let resp = await generateVis(datasetSchema, userInput);

  console.log("resp type:", typeof resp);
  console.log(resp);

  const out = structuredClone(resp);
  // Always force a named data source to avoid remote URL surprises
  out.data = { name: "test" };
  // Attach actual rows
  out.datasets = out.datasets || {};
  out.datasets["test"] = dataOfInterest;

  // Re-validate after injection (should still be valid)
  const v2 = validateVegaLite(out);
  if (!v2.valid) {
    throw new Error("Spec became invalid after data injection: " + v2.error);
  }

  await vegaEmbed(`#${divVisId}`, out, { actions: false });
}

async function generateVis(schema, userRequest) {
  let prompt = buildPrompt(schema, userRequest);

  console.log(prompt);
  for (let i = 0; i < 3; i++) {
    const encoded = encodeURIComponent(prompt);

    const output = await fetch("/ai/request_chart", {
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
    let spec;
    try {
      spec = JSON.parse(body);
    } catch {
      prompt = retryPrompt(prompt, "Invalid JSON");
      continue;
    }

    console.log(spec);
    const fieldErrors = checkFields(
      spec,
      schema.fields.map((f) => f.name)
    );

    if (fieldErrors.length > 0) {
      prompt = retryPrompt(prompt, `Invalid fields: ${fieldErrors.join(", ")}`);
      continue;
    }

    const validation = validateVegaLite(spec);
    console.log(validation);
    if (!validation.valid) {
      prompt = retryPrompt(prompt, validation.error);
      continue;
    }

    return spec; // ✅ success
  }

  throw new Error("Failed to generate valid Vega-Lite spec");
}

function buildPrompt(schema, userRequest) {
  return `
DATASET SCHEMA:
- Format: ${schema.format}
- Fields:
${schema.fields.map((f) => `  - ${f.name}: ${f.type}`).join("\n")}

USER REQUEST:
${userRequest}
`;
}

function checkFields(spec, allowedFields) {
  const usedFields =
    JSON.stringify(spec)
      .match(/"field"\s*:\s*"([^"]+)"/g)
      ?.map((s) => s.split('"')[3]) || [];

  const invalid = usedFields.filter((f) => !allowedFields.includes(f));
  return invalid;
}

function retryPrompt(originalPrompt, error) {
  return `The previous Vega-Lite specification is invalid.

            ERROR:
            ${error}

            Fix the specification.
            Follow all original rules.
            Output ONLY valid JSON.
            `;
}
