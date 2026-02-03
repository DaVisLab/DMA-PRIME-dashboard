/**
 * Convert a data URL to a Blob (useful if your API wants files).
 */
export function dataUrlToBlob(dataUrl) {
  const [header, b64] = dataUrl.split(",");
  const mime = header.match(/data:(.*);base64/)?.[1] || "image/png";
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}

export async function interfaceUpdate(item) {
  const selectorName = item.selector_name;
  const targetVal = item.target.value;
  let el;
  switch (selectorName) {
    case "geographicResolutionSelector":
      el = document.getElementById("map-region-selector");
      el.value = targetVal;
      await el.updateComplete;
      el.dispatchEvent(new CustomEvent("sl-change", { bubbles: true }));

      break;
    case "tempotalComparisonSelector":
      document.getElementById("surveillance-time-window-switch").value =
        targetVal;
      break;
    case "riskIndexSelector":
      break;
    case "diseaseSector":
      break;
    default:
      break;
  }
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
  facts: [
    {
      id: "F1",
      title: "Regional Adenovirus Distribution",
      statement:
        "The adenovirus values vary across regions in South Carolina, with Upstate having the highest value of 7 and Pee Dee having the lowest value of 0.",
      evidence: {
        fields_used: ["adenovirus value", "properties.Region"],
        method: "direct observation",
        notes: "Comparing adenovirus values across regions",
      },
      confidence: "high",
    },
    {
      id: "F2",
      title: "Average Value Comparison",
      statement:
        "The average values across regions show that Upstate has the highest average value of 17.84, while Pee Dee has the lowest average value of 1.76.",
      evidence: {
        fields_used: ["avg_value", "properties.Region"],
        method: "direct observation",
        notes: "Comparing average values across regions",
      },
      confidence: "high",
    },
    {
      id: "F3",
      title: "Regional Adenovirus Hotspot",
      statement:
        "The Upstate region stands out as a hotspot with the highest adenovirus value and average value, indicating a potential area of concern.",
      evidence: {
        fields_used: ["adenovirus value", "avg_value", "properties.Region"],
        method: "top-1",
        notes: "Identifying the region with the highest values",
      },
      confidence: "high",
    },
    {
      id: "F4",
      title: "Low Adenovirus Regions",
      statement:
        "The Midlands and Pee Dee regions have relatively low adenovirus values and average values, suggesting lower prevalence in these areas.",
      evidence: {
        fields_used: ["adenovirus value", "avg_value", "properties.Region"],
        method: "below-mean",
        notes: "Identifying regions with lower values",
      },
      confidence: "high",
    },
  ],

  highlight_patches: [
    {
      fact_id: "F3",
      description: "Highlight the Upstate region as a hotspot",
      patch_type: "layer_addition",
      patch: {
        layer: [
          {
            transform: [{ filter: "datum.properties.Region === 'Upstate'" }],
            mark: {
              type: "geoshape",
              fillOpacity: 0,
              stroke: "black",
              strokeWidth: 2,
            },
            encoding: {},
          },
        ],
      },
    },
    {
      fact_id: "F4",
      description: "Highlight the Midlands and Pee Dee regions",
      patch_type: "layer_addition",
      patch: {
        layer: [
          {
            transform: [
              {
                filter:
                  "datum.properties.Region === 'Midlands' || datum.properties.Region === 'Pee Dee'",
              },
            ],
            mark: {
              type: "geoshape",
              fillOpacity: 0,
              stroke: "black",
              strokeWidth: 2,
            },
            encoding: {},
          },
        ],
      },
    },
  ],

  optional_additional_charts: [
    {
      chart_id: "C1",
      purpose: "Compare average values across regions",
      vega_lite_spec: {
        $schema: "https://vega.github.io/schema/vega-lite/v6.json",
        data: {
          values: [
            { Region: "Lowcountry", avg_value: 9.603340292275574 },
            { Region: "Midlands", avg_value: 3.649269311064718 },
            { Region: "Pee Dee", avg_value: 1.7640918580375782 },
            { Region: "Upstate", avg_value: 17.843423799582478 },
          ],
        },
        mark: "bar",
        encoding: {
          x: { field: "Region", type: "nominal" },
          y: {
            field: "avg_value",
            type: "quantitative",
            title: "Average Value",
          },
        },
      },
    },
  ],
};

export const systemSpecification = {
  systemInfo: {
    systemName:
      "exploration and analysis system for outbreak detection in South Carolina",
    viewNumber: 2,
    selectorNumber: 4,
  },
  viewInfo: [],
  selectorInfo: [],
  // viewCoordinationInfo: [],
};


export function computeStatistics(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("Input must be a non-empty array of numbers");
  }

  const clean = values
    .map(Number)
    .filter(v => !Number.isNaN(v) && Number.isFinite(v));

  const n = clean.length;
  if (n === 0) {
    throw new Error("No valid numeric values");
  }

  // Sort once (ascending)
  const sorted = [...clean].sort((a, b) => a - b);

  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / n;

  const min = sorted[0];
  const max = sorted[n - 1];
  const range = max - min;

  const median = (n % 2 === 0)
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];

  // Variance & standard deviation (sample)
  const variance = sorted.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (n - 1);
  const stdDev = Math.sqrt(variance);

  // Quartiles (Tukey method)
  const q1 = percentile(sorted, 25);
  const q3 = percentile(sorted, 75);
  const iqr = q3 - q1;

  return {
    count: n,
    min,
    max,
    range,
    mean,
    median,
    variance,
    stdDev,
    q1,
    q3,
    iqr
  };
}


function percentile(sorted, p) {
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);

  if (lower === upper) return sorted[lower];

  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}