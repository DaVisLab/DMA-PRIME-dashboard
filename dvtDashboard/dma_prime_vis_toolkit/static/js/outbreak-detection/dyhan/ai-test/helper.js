/**
 * Convert a data URL to a Blob (useful if your API wants files).
 */
export function dataUrlToBlob(dataUrl) {
  const [header, b64] = dataUrl.split(",");
  const mime = header.match(/data:(.*);base64/)?.[1] || "image/png";
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}

export function summarizeVegaLiteSpecGeneral(spec) {
  const summary = {};

  // -----------------------------
  // Chart type
  // -----------------------------
  const mark = typeof spec.mark === "string" ? spec.mark : spec.mark?.type;
  summary.chart_type = mark || "unknown";

  // -----------------------------
  // Projection (if map)
  // -----------------------------
  if (spec.projection) {
    summary.projection = {
      type: spec.projection.type,
      reflectY: !!spec.projection.reflectY,
    };
  }

  // -----------------------------
  // Encodings
  // -----------------------------
  summary.encoding = {};
  if (spec.encoding) {
    for (const [channel, enc] of Object.entries(spec.encoding)) {
      if (!enc) continue;
      summary.encoding[channel] = {
        field: enc.field,
        type: enc.type,
        aggregate: enc.aggregate,
        scale: enc.scale?.scheme || enc.scale?.type,
      };
    }
  }

  // -----------------------------
  // Transforms
  // -----------------------------
  summary.transforms = [];

  if (Array.isArray(spec.transform)) {
    for (const t of spec.transform) {
      if (t.calculate) {
        summary.transforms.push({
          type: "calculate",
          expr: t.calculate,
          as: t.as,
        });
      }

      if (t.filter) {
        summary.transforms.push({
          type: "filter",
          expr: t.filter,
        });
      }

      if (t.flatten) {
        summary.transforms.push({
          type: "flatten",
          fields: t.flatten,
          as: t.as,
        });
      }

      if (t.aggregate) {
        summary.transforms.push({
          type: "aggregate",
          ops: t.aggregate,
          groupby: t.groupby,
        });
      }

      if (t.joinaggregate) {
        summary.transforms.push({
          type: "joinaggregate",
          ops: t.joinaggregate,
          groupby: t.groupby,
        });
      }

      if (t.window) {
        summary.transforms.push({
          type: "window",
          ops: t.window,
          groupby: t.groupby,
        });
      }

      if (t.lookup) {
        summary.transforms.push({
          type: "lookup",
          from: t.from?.data?.name || "external",
          key: t.lookup,
          fields: t.from?.fields,
        });
      }
    }
  }

  // -----------------------------
  // Data source
  // -----------------------------
  if (spec.data?.url) {
    summary.data_source = "url";
  } else if (spec.data?.values) {
    summary.data_source = "inline";
  }

  // -----------------------------
  // Dimensions
  // -----------------------------
  summary.view = {
    width: spec.width,
    height: spec.height,
  };

  return summary;
}

export function validateVegaLite(spec) {
  try {
    vegaLite.compile(spec);
    return { valid: true };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

export const tempAIResponse = {
  "facts": [
    {
      "id": "F1",
      "title": "Regional Adenovirus Distribution",
      "statement": "The Upstate region has the highest average adenovirus value at 17.74526315789471, while the Pee Dee region has the lowest at 1.783157894736842.",
      "evidence": {
        "fields_used": ["avg_value", "properties.Region"],
        "method": "rank",
        "notes": "Direct comparison of avg_value across regions"
      },
      "confidence": "high"
    },
    {
      "id": "F2",
      "title": "Regional Comparison",
      "statement": "The Upstate region's average adenovirus value is significantly higher than the other regions, with a value of 17.74526315789471, which is more than 5 times the value of the Pee Dee region.",
      "evidence": {
        "fields_used": ["avg_value", "properties.Region"],
        "method": "comparison",
        "notes": "Comparison of Upstate region's value to others"
      },
      "confidence": "high"
    },
    {
      "id": "F3",
      "title": "Regional Adenovirus Prevalence",
      "statement": "The top 2 regions with the highest adenovirus values are Upstate (17.74526315789471) and Lowcountry (9.783157894736846).",
      "evidence": {
        "fields_used": ["avg_value", "properties.Region"],
        "method": "top-2",
        "notes": "Identification of top regions"
      },
      "confidence": "high"
    },
    {
      "id": "F4",
      "title": "Regional Adenovirus Distribution Range",
      "statement": "The range of average adenovirus values across regions is 15.962105263157874 (17.74526315789471 - 1.783157894736842).",
      "evidence": {
        "fields_used": ["avg_value"],
        "method": "range calculation",
        "notes": "Calculation of range"
      },
      "confidence": "high"
    }
  ],
  "highlight_patches": [
    {
      "fact_id": "F1",
      "description": "Highlights the Upstate region with the highest adenovirus value",
      "patch_type": "layer_addition",
      "patch": {
        "layer": [
          {
            "transform": [],
            "mark": { "type": "geoshape", "fillOpacity": 0, "strokeWidth": 3 },
            "encoding": { "stroke": { "value": "black" }, "tooltip": { "field": "properties.Region", "type": "nominal" } }
          }
        ]
      }
    },
    {
      "fact_id": "F3",
      "description": "Highlights the top 2 regions with the highest adenovirus values",
      "patch_type": "layer_addition",
      "patch": {
        "layer": [
          {
            "transform": [
              {
                "type": "filter",
                "expr": "datum.properties.Region === 'Upstate' || datum.properties.Region === 'Lowcountry'"
              }
            ],
            "mark": { "type": "geoshape", "fillOpacity": 0, "strokeWidth": 3 },
            "encoding": { "stroke": { "value": "black" }, "tooltip": { "field": "properties.Region", "type": "nominal" } }
          }
        ]
      }
    }
  ],
  "optional_additional_charts": [
    {
      "chart_id": "C1",
      "purpose": "Comparative bar chart of regional adenovirus values",
      "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
      "data": {
        "values": [
          { "Region": "Upstate", "avg_value": 17.74526315789471 },
          { "Region": "Lowcountry", "avg_value": 9.783157894736846 },
          { "Region": "Midlands", "avg_value": 3.625263157894739 },
          { "Region": "Pee Dee", "avg_value": 1.783157894736842 }
        ]
      },
      "mark": "bar",
      "encoding": {
        "x": { "field": "Region", "type": "nominal" },
        "y": { "field": "avg_value", "type": "quantitative", "title": "Average Adenovirus Value" }
      }
    }
  ]
}