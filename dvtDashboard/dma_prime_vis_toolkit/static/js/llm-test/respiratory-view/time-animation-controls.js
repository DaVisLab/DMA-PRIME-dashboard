import { redraw } from "./map.js";
import {
  buildWeeklyTimeline,
  formatDisplayDate,
  getDateKey,
  getNearestDateIndex,
  getNearestTimelineIndexFromVisualRatio,
  getTimelineVisualRatioFromIndex,
  TIMELINE_TERMINAL_DATE_COUNT,
  toValidDate,
} from "./utils/time_utils.js";

const slider = document.getElementById("time-animation-slider");
const sliderFrame = document.getElementById("time-animation-slider-frame");
const currentDateLabel = document.getElementById(
  "time-animation-current-date",
);
const currentDateText = document.getElementById(
  "time-animation-current-date-text",
);
const sliderTicks = document.getElementById("time-animation-slider-ticks");
const dateRangeLabel = document.getElementById("time-animation-date-range");
const startDateLabel = document.getElementById("time-animation-start-date");
const endDateLabel = document.getElementById("time-animation-end-date");
const playButton = document.getElementById("time-animation-play-button");
const getPlayWindow = () =>
  document.getElementById("time-animation-play-window") ||
  (playButton?.previousElementSibling?.id === "time-animation-play-window"
    ? playButton.previousElementSibling
    : null);

const animationIntervalMs = 700;
const sliderMax = 1000;
const sliderThumbSizePx = 16;
const playWindowPaddingPx = 7;
const playButtonMinSizePx = 25;
const playButtonMaxSizePx = 30;
const playWindowArrowInsetPx = 5;
const terminalDotCount = TIMELINE_TERMINAL_DATE_COUNT;
const dotHoverRadiusPx = 8;
const dotHoverVerticalRadiusPx = 9;
let animationTimer = null;
let currentTimelineIndex = 0;
let sliderDotTooltip = null;

const getTimelineStartDate = () => window.startShortHistory || window.firstDate;

function getFallbackTimelineDates() {
  const weeklyDates = buildWeeklyTimeline(
    getTimelineStartDate(),
    window.lastDate,
  );

  if (weeklyDates.length) return weeklyDates;

  return [getTimelineStartDate(), window.currentDate, window.lastDate]
    .map(toValidDate)
    .filter(Boolean);
}

function normalizeTimelineDates(dates) {
  const seen = new Set();

  return (Array.isArray(dates) ? dates : [])
    .map(toValidDate)
    .filter(Boolean)
    .sort((a, b) => a - b)
    .filter((date) => {
      const key = getDateKey(date);
      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    });
}

const initialTimelineConfig = window.respiratoryTimelineConfig || {};
let timelineDates = normalizeTimelineDates(
  initialTimelineConfig.dates?.length
    ? initialTimelineConfig.dates
    : getFallbackTimelineDates(),
);
let timelineSplitDate =
  toValidDate(
    initialTimelineConfig.splitDate ||
      window.respiratoryTimelineCurrentDate ||
      window.currentDate,
  ) ||
  timelineDates[0] ||
  null;

window.respiratoryTimelineDates = timelineDates;
window.respiratoryTimelineCurrentDate = timelineSplitDate;

function getTimelineSplitDate() {
  return (
    timelineSplitDate ||
    toValidDate(window.respiratoryTimelineCurrentDate || window.currentDate) ||
    timelineDates[0] ||
    null
  );
}

function getInitialTimelineIndex() {
  if (!timelineDates.length) return 0;

  return getTerminalHighlightIndex();
}

function getTimelineIndexFromSliderValue() {
  return getNearestTimelineIndexFromVisualRatio(
    timelineDates,
    Number(slider.value) / sliderMax,
    getTimelineSplitDate(),
  );
}

function getTerminalStartIndex() {
  return Math.max(0, timelineDates.length - terminalDotCount);
}

function getSliderTrackMetrics() {
  const sliderWidth =
    slider?.getBoundingClientRect().width || sliderFrame?.clientWidth || 0;
  const usableTrackWidth = Math.max(sliderWidth - sliderThumbSizePx, 0);
  const thumbOffset = sliderThumbSizePx / 2;

  return { thumbOffset, usableTrackWidth };
}

function getSliderLeftOffset() {
  if (!slider || !sliderFrame) return 0;

  const sliderRect = slider.getBoundingClientRect();
  const frameRect = sliderFrame.getBoundingClientRect();

  return sliderRect.left - frameRect.left;
}

function getVisualTrackPosition(index) {
  const { thumbOffset, usableTrackWidth } = getSliderTrackMetrics();
  const ratio = getTimelineVisualRatioFromIndex(
    timelineDates,
    index,
    getTimelineSplitDate(),
  );

  return thumbOffset + ratio * usableTrackWidth;
}

function getTerminalTrackRange() {
  const leftPx = getVisualTrackPosition(getTerminalStartIndex());
  const rightPx = getVisualTrackPosition(timelineDates.length - 1);

  return {
    leftPx,
    rightPx,
    widthPx: Math.max(rightPx - leftPx, sliderThumbSizePx),
  };
}

function clampValue(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getSliderDotTooltip() {
  if (!sliderFrame) return null;

  if (sliderDotTooltip) return sliderDotTooltip;

  sliderDotTooltip = document.createElement("div");
  sliderDotTooltip.id = "time-animation-dot-tooltip";
  sliderDotTooltip.setAttribute("role", "tooltip");
  Object.assign(sliderDotTooltip.style, {
    position: "absolute",
    top: "calc(1.2rem + 1.32rem)",
    left: "0",
    transform: "translateX(-50%)",
    display: "none",
    padding: "0.12rem 0.28rem",
    border: "1px solid lightgray",
    borderRadius: "0.2rem",
    background: "white",
    color: "#222",
    fontSize: "0.62rem",
    lineHeight: "0.72rem",
    whiteSpace: "nowrap",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.16)",
    pointerEvents: "none",
    zIndex: "6",
  });

  sliderFrame.appendChild(sliderDotTooltip);

  return sliderDotTooltip;
}

function hideSliderDotTooltip() {
  if (!sliderDotTooltip) return;

  sliderDotTooltip.style.display = "none";
}

function showSliderDotTooltip(label, dotLeftPx) {
  const tooltip = getSliderDotTooltip();

  if (!tooltip || !sliderFrame) return;

  tooltip.textContent = label;
  tooltip.style.display = "block";

  const frameWidth = sliderFrame.clientWidth;
  const tooltipHalfWidth = tooltip.offsetWidth / 2;
  const preferredLeftPx = getSliderLeftOffset() + dotLeftPx;
  const leftPx =
    frameWidth <= tooltip.offsetWidth
      ? frameWidth / 2
      : clampValue(
          preferredLeftPx,
          tooltipHalfWidth,
          frameWidth - tooltipHalfWidth,
        );

  tooltip.style.left = `${leftPx}px`;
}

function getTerminalDotFromPointer(event) {
  if (!slider || !sliderTicks || !timelineDates.length) return null;

  const sliderRect = slider.getBoundingClientRect();
  const ticksRect = sliderTicks.getBoundingClientRect();
  const pointerX = event.clientX - sliderRect.left;
  const pointerY = event.clientY - (ticksRect.top + ticksRect.height / 2);

  if (Math.abs(pointerY) > dotHoverVerticalRadiusPx) return null;

  let closestDot = null;
  for (const index of getMarkedTimelineIndexes()) {
    const leftPx = getVisualTrackPosition(index);
    const distancePx = Math.abs(pointerX - leftPx);

    if (distancePx > dotHoverRadiusPx) continue;

    if (!closestDot || distancePx < closestDot.distancePx) {
      closestDot = {
        date: timelineDates[index],
        distancePx,
        leftPx,
      };
    }
  }

  return closestDot;
}

function updateSliderDotTooltipFromPointer(event) {
  if (event.buttons > 0) {
    hideSliderDotTooltip();
    return;
  }

  const dot = getTerminalDotFromPointer(event);

  if (!dot) {
    hideSliderDotTooltip();
    return;
  }

  showSliderDotTooltip(formatDisplayDate(dot.date), dot.leftPx);
}

function setTimelineChromeVisible(isVisible) {
  [getPlayWindow(), playButton, currentDateLabel].forEach((element) => {
    if (!element) return;

    element.style.visibility = isVisible ? "visible" : "hidden";
  });
}

function showTimelineChromeAfterLayout() {
  const reveal = () => {
    window.requestAnimationFrame(() => {
      setTimelineChromeVisible(true);
    });
  };

  if (!window.customElements?.whenDefined) {
    reveal();
    return;
  }

  Promise.race([
    window.customElements.whenDefined("sl-icon").catch(() => undefined),
    new Promise((resolve) => {
      window.setTimeout(resolve, 500);
    }),
  ]).then(reveal);
}

function updateDateRangeLabel() {
  if (!dateRangeLabel || !timelineDates.length) return;

  if (startDateLabel && endDateLabel) {
    startDateLabel.textContent = formatDisplayDate(timelineDates[0]);
    endDateLabel.textContent = formatDisplayDate(timelineDates.at(-1));
    return;
  }

  dateRangeLabel.textContent = `${formatDisplayDate(
    timelineDates[0],
  )} - ${formatDisplayDate(timelineDates.at(-1))}`;
}

function setPlaying(isPlaying) {
  if (animationTimer) {
    window.clearInterval(animationTimer);
    animationTimer = null;
  }

  const playButtonIcon = playButton?.querySelector("sl-icon");

  if (playButtonIcon) {
    playButtonIcon.name = isPlaying ? "pause-fill" : "play-fill";
  }
  playButton?.setAttribute(
    "aria-label",
    isPlaying ? "Pause animation" : "Play animation",
  );

  if (!isPlaying) return;

  animationTimer = window.setInterval(() => {
    const currentIndex = currentTimelineIndex;

    if (currentIndex >= timelineDates.length - 1) {
      setPlaying(false);
      return;
    }

    setTimelineIndex(currentIndex + 1);
  }, animationIntervalMs);
}

function prepareTerminalAnimationStart() {
  const terminalStartIndex = getTerminalStartIndex();

  if (
    currentTimelineIndex < terminalStartIndex ||
    currentTimelineIndex >= timelineDates.length - 1
  ) {
    setTimelineIndex(terminalStartIndex);
  }
}

function updateCurrentDateLabel(date) {
  if (!currentDateLabel) return;

  if (currentDateText) {
    currentDateText.textContent = formatDisplayDate(date);
    return;
  }

  currentDateLabel.textContent = formatDisplayDate(date);
}

function createPlayWindowArrow(relativeLeftPx) {
  const arrow = document.createElement("span");

  arrow.setAttribute("aria-hidden", "true");
  Object.assign(arrow.style, {
    position: "absolute",
    top: "50%",
    left: `${relativeLeftPx}px`,
    width: "0.3rem",
    height: "0.3rem",
    borderTop: "2px solid rgba(55, 76, 92, 0.5)",
    borderRight: "2px solid rgba(55, 76, 92, 0.5)",
    borderRadius: "0.02rem",
    transform: "translate(-50%, -50%) rotate(45deg)",
  });

  return arrow;
}

function renderPlayWindowArrows(playWindow, playWindowLeftPx, playWindowWidthPx) {
  if (!playWindow) return;

  const fragment = document.createDocumentFragment();
  const firstMarkedIndex = getTerminalStartIndex();
  const maxArrowLeftPx = Math.max(playWindowWidthPx - playWindowArrowInsetPx, 0);

  playWindow.replaceChildren();

  for (let index = firstMarkedIndex; index < timelineDates.length; index += 1) {
    const relativeLeftPx = clampValue(
      getVisualTrackPosition(index) - playWindowLeftPx,
      playWindowArrowInsetPx,
      maxArrowLeftPx,
    );

    fragment.appendChild(createPlayWindowArrow(relativeLeftPx));
  }

  playWindow.appendChild(fragment);
}

function updateCurrentDateLabelPosition() {
  if (!currentDateLabel || !sliderFrame || !slider || !timelineDates.length) {
    return;
  }

  const frameWidth = sliderFrame.clientWidth;
  const labelHalfWidth = currentDateLabel.offsetWidth / 2;
  const preferredLeftPx =
    getSliderLeftOffset() + getVisualTrackPosition(currentTimelineIndex);
  const leftPx =
    frameWidth <= currentDateLabel.offsetWidth
      ? frameWidth / 2
      : clampValue(preferredLeftPx, labelHalfWidth, frameWidth - labelHalfWidth);

  currentDateLabel.style.left = `${leftPx}px`;
}

function updatePlayButtonPosition() {
  if (!slider || !timelineDates.length) return;

  const terminalRange = getTerminalTrackRange();
  const { usableTrackWidth } = getSliderTrackMetrics();
  const sliderWidth = usableTrackWidth + sliderThumbSizePx;
  const sliderLeftOffset = getSliderLeftOffset();
  const buttonSizePx = clampValue(
    terminalRange.widthPx * 0.52,
    playButtonMinSizePx,
    Math.min(playButtonMaxSizePx, sliderWidth),
  );
  const maxPlayWindowLeftPx = Math.max(sliderWidth - buttonSizePx, 0);
  const playWindowLeftPx = clampValue(
    terminalRange.leftPx - playWindowPaddingPx,
    0,
    maxPlayWindowLeftPx,
  );
  const minPlayWindowRightPx = playWindowLeftPx + buttonSizePx;
  const playWindowRightPx = clampValue(
    Math.max(terminalRange.rightPx + playWindowPaddingPx, minPlayWindowRightPx),
    minPlayWindowRightPx,
    sliderWidth,
  );
  const playWindowWidthPx = playWindowRightPx - playWindowLeftPx;
  const playWindow = getPlayWindow();

  if (playWindow) {
    playWindow.style.left = `${sliderLeftOffset + playWindowLeftPx}px`;
    playWindow.style.width = `${playWindowWidthPx}px`;
    renderPlayWindowArrows(playWindow, playWindowLeftPx, playWindowWidthPx);
  }

  if (playButton) {
    playButton.style.width = `${buttonSizePx}px`;
    playButton.style.height = `${buttonSizePx}px`;
  }

  updateCurrentDateLabelPosition();
}

function getTerminalHighlightIndex() {
  return Math.max(0, timelineDates.length - 4);
}

function getPredictionDotStyle(index, currentIndex, highlightIndex) {
  const isHighlightedDot = index === highlightIndex;
  const isObservedDateDot = index <= currentIndex;

  return {
    width: isHighlightedDot ? "0.5rem" : "0.32rem",
    height: isHighlightedDot ? "0.5rem" : "0.32rem",
    border: isHighlightedDot ? "2px solid #111" : "1px solid #777",
    background: isHighlightedDot
      ? "#111"
      : isObservedDateDot
        ? "#fff"
        : "#9a9a9a",
    boxShadow: isHighlightedDot
      ? "0 0 0 2px rgba(255, 255, 255, 0.95), 0 0 0 4px rgba(17, 17, 17, 0.24)"
      : "0 0 0 1px rgba(255, 255, 255, 0.85)",
    opacity: isHighlightedDot ? "1" : "0.8",
    zIndex: isHighlightedDot ? "2" : "1",
  };
}

function createPredictionDot(date, index, currentIndex, highlightIndex) {
  const dot = document.createElement("span");
  const displayDate = formatDisplayDate(date);
  const dotLeftPx = getVisualTrackPosition(index);

  dot.dataset.date = displayDate;
  Object.assign(dot.style, {
    position: "absolute",
    left: `${dotLeftPx}px`,
    top: "50%",
    borderRadius: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
    ...getPredictionDotStyle(index, currentIndex, highlightIndex),
  });

  return dot;
}

function getMarkedTimelineIndexes() {
  const firstTerminalIndex = getTerminalStartIndex();
  const indexes = new Set();

  for (let index = firstTerminalIndex; index < timelineDates.length; index += 1) {
    indexes.add(index);
  }

  return [...indexes].sort((a, b) => a - b);
}

function renderDiscretePredictionDots() {
  if (!sliderTicks || !slider || !timelineDates.length) return;

  const currentIndex = getNearestDateIndex(
    timelineDates,
    getTimelineSplitDate(),
  );
  const highlightIndex = getTerminalHighlightIndex();
  const fragment = document.createDocumentFragment();

  hideSliderDotTooltip();
  sliderTicks.innerHTML = "";

  getMarkedTimelineIndexes().forEach((index) => {
    fragment.appendChild(
      createPredictionDot(
        timelineDates[index],
        index,
        currentIndex,
        highlightIndex,
      ),
    );
  });

  sliderTicks.appendChild(fragment);
}

function setTimelineIndex(index, shouldRedraw = true) {
  if (!timelineDates.length) return;

  const boundedIndex = Math.min(Math.max(index, 0), timelineDates.length - 1);
  const visualRatio = getTimelineVisualRatioFromIndex(
    timelineDates,
    boundedIndex,
    getTimelineSplitDate(),
  );

  currentTimelineIndex = boundedIndex;
  slider.value = Math.round(visualRatio * sliderMax);

  window.respiratoryAnimationDate = timelineDates[boundedIndex];
  updateCurrentDateLabel(window.respiratoryAnimationDate);
  updatePlayButtonPosition();

  window.updateRespiratorySmallMultipleDots?.(window.respiratoryAnimationDate);

  document.dispatchEvent(
    new CustomEvent("respiratory-time-change", {
      detail: { date: window.respiratoryAnimationDate, index: boundedIndex },
    }),
  );

  if (shouldRedraw) {
    redraw(false, false, false);
  }
}

function setTimelineDates(
  nextDates,
  { splitDate, preferredDate, shouldRedraw = true } = {},
) {
  const normalizedDates = normalizeTimelineDates(nextDates);

  if (!normalizedDates.length) return false;

  setPlaying(false);

  timelineDates = normalizedDates;
  timelineSplitDate =
    toValidDate(splitDate) ||
    getTimelineSplitDate() ||
    timelineDates[0] ||
    null;
  window.respiratoryTimelineDates = timelineDates;
  window.respiratoryTimelineCurrentDate = timelineSplitDate;

  if (slider) {
    slider.disabled = timelineDates.length <= 1;
  }

  if (playButton) {
    playButton.disabled = timelineDates.length <= 1;
  }

  updateDateRangeLabel();
  renderDiscretePredictionDots();
  updatePlayButtonPosition();

  const targetDate =
    preferredDate || window.respiratoryAnimationDate || timelineSplitDate;
  const targetIndex = getNearestDateIndex(timelineDates, targetDate);
  setTimelineIndex(targetIndex, shouldRedraw);
  showTimelineChromeAfterLayout();

  return true;
}

window.updateRespiratoryTimelineDates = (timelineConfig = {}) => {
  if (!timelineConfig?.dates?.length) return false;

  window.respiratoryTimelineConfig = timelineConfig;

  return setTimelineDates(timelineConfig.dates, timelineConfig);
};

function initTimeAnimationControl() {
  if (
    !slider ||
    !sliderFrame ||
    !currentDateLabel ||
    !dateRangeLabel ||
    !playButton ||
    !timelineDates.length
  ) {
    return;
  }

  setTimelineChromeVisible(false);

  slider.min = 0;
  slider.max = sliderMax;
  slider.step = 1;
  slider.disabled = timelineDates.length <= 1;
  playButton.disabled = timelineDates.length <= 1;

  updateDateRangeLabel();
  renderDiscretePredictionDots();
  updatePlayButtonPosition();
  setTimelineIndex(getInitialTimelineIndex());
  showTimelineChromeAfterLayout();

  const updateFromSlider = () => {
    setPlaying(false);
    setTimelineIndex(getTimelineIndexFromSliderValue());
  };

  slider.addEventListener("input", updateFromSlider);
  slider.addEventListener("change", updateFromSlider);

  playButton.addEventListener("click", () => {
    if (animationTimer) {
      setPlaying(false);
      return;
    }

    if (currentTimelineIndex >= timelineDates.length - 1) {
      setTimelineIndex(0);
    }

    setPlaying(true);
  });

  sliderFrame.addEventListener("mousemove", updateSliderDotTooltipFromPointer);
  sliderFrame.addEventListener("mousedown", hideSliderDotTooltip);
  sliderFrame.addEventListener("mouseleave", hideSliderDotTooltip);

  window.addEventListener("resize", () => {
    renderDiscretePredictionDots();
    updatePlayButtonPosition();
  });
}

initTimeAnimationControl();
