const DATE_KEY_FORMAT = "YYYY-MM-DD";

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
