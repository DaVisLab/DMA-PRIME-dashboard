const DATE_KEY_FORMAT = "YYYY-MM-DD";
export const TIMELINE_CURRENT_DATE_RATIO = 0.7;
export const TIMELINE_TERMINAL_DATE_COUNT = 4;
export const TIMELINE_TERMINAL_WIDTH_RATIO = 0.25;

export function toValidDate(date) {
  const parsed = dayjs(date);
  return parsed.isValid() ? parsed.toDate() : null;
}

export function getDateKey(date) {
  return dayjs(date).format(DATE_KEY_FORMAT);
}

export function formatDisplayDate(date) {
  return dayjs(date).format("MMM D, YYYY");
}

export function formatDisplayDateParts(date) {
  return {
    date: dayjs(date).format("MMM D"),
    year: dayjs(date).format("YYYY"),
  };
}

export function buildWeeklyTimeline(startDate, endDate) {
  const start = toValidDate(startDate);
  const end = toValidDate(endDate);

  if (!start || !end) return [];

  const dates = [];
  let cursor = dayjs(start);
  const endDay = dayjs(end);

  while (cursor.isSameOrBefore(endDay, "day")) {
    dates.push(cursor.toDate());
    cursor = cursor.add(1, "week");
  }

  if (dates.length && getDateKey(dates.at(-1)) !== getDateKey(end)) {
    dates.push(end);
  }

  return dates;
}

export function buildWeeklyDates(startDate, count) {
  const start = dayjs(startDate);
  if (!start.isValid()) return [];

  return Array.from({ length: count }, (_, index) =>
    start.add(index, "week").toDate(),
  );
}

export function hasFiniteTimelineValue(value) {
  if (value === null || value === undefined || value === "") return false;

  return Number.isFinite(Number(value));
}

export function getFiniteDateAtIndex(dates, values, index) {
  const date = toValidDate(dates?.[index]);
  const value = values?.[index];

  return date && hasFiniteTimelineValue(value) ? date : null;
}

export function getFirstFiniteDateFromSeries(dates, values) {
  const length = Math.min(dates?.length || 0, values?.length || 0);

  for (let index = 0; index < length; index += 1) {
    const date = getFiniteDateAtIndex(dates, values, index);

    if (date) return date;
  }

  return null;
}

export function getLastFiniteDateFromSeries(dates, values) {
  const length = Math.min(dates?.length || 0, values?.length || 0);

  for (let index = length - 1; index >= 0; index -= 1) {
    const date = getFiniteDateAtIndex(dates, values, index);

    if (date) return date;
  }

  return null;
}

export function getLastFiniteWeeklyDate(startDate, values) {
  const start = dayjs(startDate);
  const timeSeries = Array.isArray(values) ? values : [];

  if (!start.isValid()) return null;

  for (let index = timeSeries.length - 1; index >= 0; index -= 1) {
    if (hasFiniteTimelineValue(timeSeries[index])) {
      return start.add(index, "week").toDate();
    }
  }

  return null;
}

export function getTimeFrameStartDate(timeFrame, variableData) {
  const timeFrameData = variableData?.[timeFrame];

  if (timeFrameData?.start_date) {
    return dayjs(timeFrameData.start_date);
  }

  if (timeFrame === "historical" && variableData?.projected?.start_date) {
    return dayjs(variableData.projected.start_date).subtract(
      timeFrameData?.values?.length || 0,
      "week",
    );
  }

  return null;
}

export function getCombinedWeeklyDates(variableData) {
  const historicalLength = variableData?.historical?.values?.length || 0;
  const projectedLength = variableData?.projected?.values?.length || 0;
  const historicalStart = getTimeFrameStartDate("historical", variableData);
  const projectedStart = getTimeFrameStartDate("projected", variableData);

  return buildWeeklyDates(historicalStart, historicalLength).concat(
    buildWeeklyDates(projectedStart, projectedLength),
  );
}

export function getNearestDateIndex(dates, targetDate) {
  const timelineDates = Array.isArray(dates) ? dates : [];

  if (!timelineDates.length) return 0;

  const target = toValidDate(targetDate);
  if (!target) return 0;

  const targetDateKey = getDateKey(target);
  const exactIndex = timelineDates.findIndex(
    (date) => getDateKey(date) === targetDateKey,
  );

  if (exactIndex >= 0) return exactIndex;

  let nearestIndex = 0;
  let nearestDistance = Infinity;

  timelineDates.forEach((date, index) => {
    const distance = Math.abs(date - target);

    if (distance < nearestDistance) {
      nearestIndex = index;
      nearestDistance = distance;
    }
  });

  return nearestIndex;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getTimelineSplitIndex(dates, splitDate) {
  return getNearestDateIndex(dates, splitDate);
}

function getTerminalSplitRatio() {
  return 1 - TIMELINE_TERMINAL_WIDTH_RATIO;
}

function getTimelineVisualAnchors(
  dates,
  splitDate,
  splitRatio = TIMELINE_CURRENT_DATE_RATIO,
  terminalCount = TIMELINE_TERMINAL_DATE_COUNT,
) {
  const timelineDates = Array.isArray(dates) ? dates : [];
  const lastIndex = timelineDates.length - 1;
  const boundedSplitRatio = clamp(splitRatio, 0.05, 0.95);

  if (lastIndex <= 0) {
    return [{ index: 0, ratio: 0 }];
  }

  const splitIndex = getTimelineSplitIndex(timelineDates, splitDate);
  const terminalStartIndex = Math.max(0, timelineDates.length - terminalCount);
  const hasTerminalSegment =
    terminalStartIndex > 0 && terminalStartIndex < lastIndex;
  const anchorsByIndex = new Map([
    [0, 0],
    [lastIndex, 1],
  ]);

  if (
    splitIndex > 0 &&
    splitIndex < lastIndex &&
    (!hasTerminalSegment || splitIndex < terminalStartIndex)
  ) {
    anchorsByIndex.set(splitIndex, boundedSplitRatio);
  }

  if (hasTerminalSegment) {
    anchorsByIndex.set(terminalStartIndex, getTerminalSplitRatio());
  }

  return Array.from(anchorsByIndex, ([index, ratio]) => ({ index, ratio }))
    .sort((a, b) => a.index - b.index)
    .map((anchor, index, anchors) => {
      if (index === 0 || anchor.ratio > anchors[index - 1].ratio) {
        return anchor;
      }

      return {
        ...anchor,
        ratio: Math.min(1, anchors[index - 1].ratio + 0.001),
      };
    });
}

export function getTimelineVisualRatioFromIndex(
  dates,
  index,
  splitDate,
  splitRatio = TIMELINE_CURRENT_DATE_RATIO,
  terminalCount = TIMELINE_TERMINAL_DATE_COUNT,
) {
  const timelineDates = Array.isArray(dates) ? dates : [];

  if (timelineDates.length <= 1) return 0;

  const lastIndex = timelineDates.length - 1;
  const boundedIndex = clamp(Math.round(index), 0, lastIndex);
  const anchors = getTimelineVisualAnchors(
    timelineDates,
    splitDate,
    splitRatio,
    terminalCount,
  );

  for (let anchorIndex = 0; anchorIndex < anchors.length - 1; anchorIndex++) {
    const startAnchor = anchors[anchorIndex];
    const endAnchor = anchors[anchorIndex + 1];

    if (
      boundedIndex >= startAnchor.index &&
      boundedIndex <= endAnchor.index
    ) {
      const indexSpan = endAnchor.index - startAnchor.index;

      if (indexSpan === 0) return startAnchor.ratio;

      return (
        startAnchor.ratio +
        ((boundedIndex - startAnchor.index) / indexSpan) *
          (endAnchor.ratio - startAnchor.ratio)
      );
    }
  }

  return anchors.at(-1).ratio;
}

export function getTimelineVisualPositionFromIndex(
  dates,
  index,
  splitDate,
  width,
  splitRatio = TIMELINE_CURRENT_DATE_RATIO,
  terminalCount = TIMELINE_TERMINAL_DATE_COUNT,
) {
  return (
    getTimelineVisualRatioFromIndex(
      dates,
      index,
      splitDate,
      splitRatio,
      terminalCount,
    ) * width
  );
}

export function getNearestTimelineIndexFromVisualRatio(
  dates,
  visualRatio,
  splitDate,
  splitRatio = TIMELINE_CURRENT_DATE_RATIO,
  terminalCount = TIMELINE_TERMINAL_DATE_COUNT,
) {
  const timelineDates = Array.isArray(dates) ? dates : [];

  if (timelineDates.length <= 1) return 0;

  const boundedRatio = clamp(Number(visualRatio) || 0, 0, 1);
  let nearestIndex = 0;
  let nearestDistance = Infinity;

  timelineDates.forEach((_, index) => {
    const distance = Math.abs(
      getTimelineVisualRatioFromIndex(
        timelineDates,
        index,
        splitDate,
        splitRatio,
        terminalCount,
      ) - boundedRatio,
    );

    if (distance < nearestDistance) {
      nearestIndex = index;
      nearestDistance = distance;
    }
  });

  return nearestIndex;
}
