const TIMELINE_LAYOUT_FALLBACKS = {
  leftOffset: 14,
  valueGap: 5,
  valueWidth: 34,
};

const TIMELINE_LAYOUT_VARIABLES = {
  leftOffset: "--time-animation-left-offset",
  valueGap: "--time-animation-date-gap",
  valueWidth: "--small-multiple-value-width",
};

function getCssNumber(element, propertyName, fallback) {
  if (!element) return fallback;

  const value = window
    .getComputedStyle(element)
    .getPropertyValue(propertyName)
    .trim();
  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getTimelineLayoutMetrics(
  sourceElement = document.getElementById("time-animation-slider-frame"),
) {
  return {
    leftOffset: getCssNumber(
      sourceElement,
      TIMELINE_LAYOUT_VARIABLES.leftOffset,
      TIMELINE_LAYOUT_FALLBACKS.leftOffset,
    ),
    valueGap: getCssNumber(
      sourceElement,
      TIMELINE_LAYOUT_VARIABLES.valueGap,
      TIMELINE_LAYOUT_FALLBACKS.valueGap,
    ),
    valueWidth: getCssNumber(
      sourceElement,
      TIMELINE_LAYOUT_VARIABLES.valueWidth,
      TIMELINE_LAYOUT_FALLBACKS.valueWidth,
    ),
  };
}
