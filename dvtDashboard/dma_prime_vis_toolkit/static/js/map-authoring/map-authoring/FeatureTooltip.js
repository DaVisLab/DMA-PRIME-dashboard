const TOOLTIP_ID = "map-feature-tooltip";

function getTooltipElement({ create = true } = {}) {
  if (typeof document === "undefined") return null;

  let tooltip = document.getElementById(TOOLTIP_ID);
  if (tooltip) return tooltip;
  if (!create) return null;

  tooltip = document.createElement("div");
  tooltip.id = TOOLTIP_ID;
  tooltip.className = "map-feature-tooltip";
  tooltip.setAttribute("role", "tooltip");
  document.body.appendChild(tooltip);
  return tooltip;
}

// GeoJSON sources use different naming fields across state/county/ZIP levels.
export function getFeatureDisplayName(properties = {}) {
  return (
    properties.regionName ||
    properties.Region ||
    properties.countyName ||
    properties.zipName ||
    properties.ZCTA ||
    properties.NAME ||
    properties.name ||
    properties.ZCTA5CE10 ||
    properties.ZCTA5CE ||
    properties.GEOID10 ||
    properties.GEOID ||
    properties.ID ||
    "selected area"
  );
}

// Numeric fields are shown with lightweight formatting; missing values stay explicit.
export function formatFeatureValue(value) {
  const numericValue = +value;
  if (Number.isFinite(numericValue)) {
    return new Intl.NumberFormat("en", {
      maximumFractionDigits: numericValue >= 100 ? 0 : 2,
    }).format(numericValue);
  }

  if (value === null || value === undefined || value === "") return "n/a";
  return String(value);
}

function appendTooltipRow(tooltip, label, value, className = "") {
  const row = document.createElement("div");
  row.className = ["map-feature-tooltip-row", className]
    .filter(Boolean)
    .join(" ");

  const labelEl = document.createElement("span");
  labelEl.className = "map-feature-tooltip-label";
  labelEl.textContent = label;

  const valueEl = document.createElement("strong");
  valueEl.textContent = value;

  row.append(labelEl, valueEl);
  tooltip.appendChild(row);
}

export function showMapFeatureTooltip(
  event,
  properties = {},
  { title, valueKey = "population", valueLabel = valueKey } = {},
) {
  const tooltip = getTooltipElement();
  if (!tooltip) return;

  tooltip.replaceChildren();

  if (title) {
    const titleEl = document.createElement("div");
    titleEl.className = "map-feature-tooltip-title";
    titleEl.textContent = title;
    tooltip.appendChild(titleEl);
  }

  appendTooltipRow(tooltip, "area", getFeatureDisplayName(properties));
  appendTooltipRow(
    tooltip,
    valueLabel,
    formatFeatureValue(properties?.[valueKey]),
    "is-value-row",
  );

  tooltip.classList.add("is-visible");
  moveMapFeatureTooltip(event);
}

export function moveMapFeatureTooltip(event) {
  const tooltip = getTooltipElement({ create: false });
  if (!tooltip || !tooltip.classList.contains("is-visible")) return;

  const offset = 14;
  const viewportPadding = 8;
  const rect = tooltip.getBoundingClientRect();
  let x = event.clientX + offset;
  let y = event.clientY + offset;

  if (x + rect.width + viewportPadding > window.innerWidth) {
    x = event.clientX - rect.width - offset;
  }

  if (y + rect.height + viewportPadding > window.innerHeight) {
    y = event.clientY - rect.height - offset;
  }

  tooltip.style.transform = `translate(${Math.max(viewportPadding, x)}px, ${Math.max(
    viewportPadding,
    y,
  )}px)`;
}

export function hideMapFeatureTooltip() {
  const tooltip = getTooltipElement({ create: false });
  if (!tooltip) return;

  tooltip.classList.remove("is-visible");
}
