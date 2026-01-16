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
