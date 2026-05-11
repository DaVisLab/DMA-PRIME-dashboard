import { redraw } from "./map.js";
import {
  buildWeeklyTimeline,
  formatDisplayDate,
  getNearestDateIndex,
  toValidDate,
} from "./utils/time_utils.js";

const slider = document.getElementById("time-animation-slider");
const sliderFrame = document.getElementById("time-animation-slider-frame");
const currentDateLabel = document.getElementById(
  "time-animation-current-date",
);
const startDateLabel = document.getElementById("time-animation-start-date");
const endDateLabel = document.getElementById("time-animation-end-date");
const playButton = document.getElementById("time-animation-play-button");

const animationIntervalMs = 700;
let animationTimer = null;

const getTimelineStartDate = () => window.startShortHistory || window.firstDate;

const timelineDates = buildWeeklyTimeline(
  getTimelineStartDate(),
  window.lastDate,
);

if (!timelineDates.length) {
  [getTimelineStartDate(), window.currentDate, window.lastDate]
    .map(toValidDate)
    .forEach((date) => {
      if (date) timelineDates.push(date);
    });
}

function getInitialTimelineIndex() {
  if (!timelineDates.length) return 0;

  return getNearestDateIndex(timelineDates, window.currentDate);
}

function setPlaying(isPlaying) {
  if (animationTimer) {
    window.clearInterval(animationTimer);
    animationTimer = null;
  }

  playButton.name = isPlaying ? "pause-fill" : "play-fill";
  playButton.label = isPlaying ? "Pause animation" : "Play animation";

  if (!isPlaying) return;

  animationTimer = window.setInterval(() => {
    const currentIndex = Number(slider.value);

    if (currentIndex >= timelineDates.length - 1) {
      setPlaying(false);
      return;
    }

    setTimelineIndex(currentIndex + 1);
  }, animationIntervalMs);
}

function updateCurrentDateLabelPosition() {
  if (!sliderFrame || !currentDateLabel || !slider) return;

  const max = Number(slider.max) || 0;
  const ratio = max === 0 ? 0 : Number(slider.value) / max;
  const labelHalfWidth = currentDateLabel.offsetWidth / 2;
  const frameWidth = sliderFrame.clientWidth;
  const left =
    frameWidth <= currentDateLabel.offsetWidth
      ? frameWidth / 2
      : Math.min(
          Math.max(frameWidth * ratio, labelHalfWidth),
          frameWidth - labelHalfWidth,
        );

  currentDateLabel.style.left = `${left}px`;
  currentDateLabel.style.transform = "translateX(-50%)";
}

function setTimelineIndex(index, shouldRedraw = true) {
  if (!timelineDates.length) return;

  const boundedIndex = Math.min(Math.max(index, 0), timelineDates.length - 1);
  slider.value = boundedIndex;

  window.respiratoryAnimationDate = timelineDates[boundedIndex];
  currentDateLabel.textContent = formatDisplayDate(
    window.respiratoryAnimationDate,
  );

  updateCurrentDateLabelPosition();
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

function initTimeAnimationControl() {
  if (
    !slider ||
    !sliderFrame ||
    !currentDateLabel ||
    !startDateLabel ||
    !endDateLabel ||
    !playButton ||
    !timelineDates.length
  ) {
    return;
  }

  slider.max = timelineDates.length - 1;
  slider.disabled = timelineDates.length <= 1;
  playButton.disabled = timelineDates.length <= 1;

  startDateLabel.textContent = formatDisplayDate(timelineDates[0]);
  endDateLabel.textContent = formatDisplayDate(timelineDates.at(-1));

  setTimelineIndex(getInitialTimelineIndex());

  const updateFromSlider = () => {
    setPlaying(false);
    setTimelineIndex(Number(slider.value));
  };

  slider.addEventListener("input", updateFromSlider);
  slider.addEventListener("change", updateFromSlider);

  playButton.addEventListener("click", () => {
    if (animationTimer) {
      setPlaying(false);
      return;
    }

    if (Number(slider.value) >= timelineDates.length - 1) {
      setTimelineIndex(0);
    }

    setPlaying(true);
  });

  window.addEventListener("resize", updateCurrentDateLabelPosition);
}

initTimeAnimationControl();
