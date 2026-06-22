import { getTimeFrameStartDate } from "./time_utils.js";

function finiteNumber(value, fallback = NaN) {
  const parsedValue = parseFloat(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function safeRate(value, population) {
  const numericValue = finiteNumber(value);
  const numericPopulation = finiteNumber(population);

  if (
    !Number.isFinite(numericValue) ||
    !Number.isFinite(numericPopulation) ||
    numericPopulation <= 0
  ) {
    return NaN;
  }

  return (numericValue / numericPopulation) * 1000;
}

function safePercentDifference(currentValue, previousValue) {
  const currentNumber = finiteNumber(currentValue);
  const previousNumber = finiteNumber(previousValue);

  if (!Number.isFinite(currentNumber) || !Number.isFinite(previousNumber)) {
    return undefined;
  }

  // A zero previous value has no meaningful percent-change denominator.
  if (previousNumber === 0) {
    return undefined;
  }

  return ((currentNumber - previousNumber) / Math.abs(previousNumber)) * 100;
}

function emptyFeatureCollection() {
  return {
    type: "FeatureCollection",
    features: [],
  };
}

function getVariableData(feature, population, outcomeVariable) {
  return feature.properties.data[population][outcomeVariable];
}

function getMissingCurrentValue(panelType) {
  return panelType === "percentDifference" ? [NaN, NaN, NaN] : NaN;
}

function getDateIndexedData(feature, population, outcomeVariable, date) {
  const variableData = getVariableData(feature, population, outcomeVariable);
  const targetDate = dayjs(date);
  const projectedStart = variableData.projected?.start_date;
  const timeFrames =
    projectedStart && !targetDate.isBefore(dayjs(projectedStart))
      ? ["projected", "historical"]
      : ["historical", "projected"];

  for (const timeFrame of timeFrames) {
    const timeFrameData = variableData[timeFrame];
    if (!timeFrameData?.values?.length) {
      continue;
    }

    const startDate = getTimeFrameStartDate(timeFrame, variableData);
    if (!startDate?.isValid()) {
      continue;
    }

    const dateIndex = targetDate.diff(startDate, "week");

    if (dateIndex >= 0 && dateIndex < timeFrameData.values.length) {
      return {
        timeFrame,
        data: timeFrameData,
        index: dateIndex,
      };
    }
  }

  return null;
}

function getRawDateValue(feature, population, outcomeVariable, date) {
  const dateIndexedData = getDateIndexedData(
    feature,
    population,
    outcomeVariable,
    date,
  );

  if (!dateIndexedData) {
    return NaN;
  }

  return finiteNumber(dateIndexedData.data.values.at(dateIndexedData.index));
}

export async function call_data(geoSelected, diseaseSelected, data_version) {
  const url = `/recommendation/respiratory/${geoSelected}/${
    diseaseSelected
  }?data_version=${data_version}&${parseInt(Math.random() * 9999999999)}`;

  try {
    const data = await d3.json(url);
    return Array.isArray(data?.features) ? data : emptyFeatureCollection();
  } catch (error) {
    return emptyFeatureCollection();
  }
}

export function facility_dataProcessing(features, facility_unit) {
  switch (facility_unit) {
    case "individual-unit":
      features = features.filter(
        (item) =>
          item.properties.id !== "MUSC" && item.properties.id !== "PRISMA",
      );
      break;
    case "prisma":
      features = features.filter((item) => item.properties.id === "PRISMA");
      break;
    case "musc":
      features = features.filter((item) => item.properties.id === "MUSC");
      break;
  }
  return features;
}

export function getAllCurDateValuesFromFeatures(
  features,
  population,
  outcomeVariable,
  panelType,
  imputations,
) {
  return features.map((feature) =>
    getCurDateValueFromFeature(
      feature,
      population,
      outcomeVariable,
      panelType,
      imputations,
    ),
  );
}

export function getCurDateValueFromFeature(
  feature,
  population,
  outcomeVariable,
  panelType,
  imputations,
  projectionType = undefined,
  targetDate = window.currentDate,
) {
  let dateIndexedData;

  if (projectionType) {
    const thisData = getVariableData(
      feature,
      population,
      outcomeVariable,
    )[projectionType];
    dateIndexedData = {
      data: thisData,
      index: dayjs(targetDate).diff(dayjs(thisData.start_date), "week"),
    };
  } else {
    dateIndexedData = getDateIndexedData(
      feature,
      population,
      outcomeVariable,
      targetDate,
    );
  }

  if (
    !dateIndexedData ||
    dateIndexedData.index < 0 ||
    dateIndexedData.index >= dateIndexedData.data.values.length
  ) {
    return getMissingCurrentValue(panelType);
  }

  const thisData = dateIndexedData.data;

  if (!imputations && thisData.imputed) {
    return getMissingCurrentValue(panelType);
  }

  let thisWeekDatum = finiteNumber(thisData.values.at(dateIndexedData.index));

  if (panelType === "rate") {
    thisWeekDatum = safeRate(thisWeekDatum, feature.properties.population);
  }

  if (panelType === "percentDifference") {
    const previousDate = dayjs(targetDate).subtract(1, "week").toDate();
    const lastWeekDatum = getRawDateValue(
      feature,
      population,
      outcomeVariable,
      previousDate,
    );

    const percentDifference = safePercentDifference(
      thisWeekDatum,
      lastWeekDatum,
    );

    return [lastWeekDatum, thisWeekDatum, percentDifference];
  }

  return thisWeekDatum;
}

export function getAllValuesFromFeature(
  featureProperties,
  population,
  outcomeVariable,
  panelType,
  timeFrame,
) {
  const thisData =
    featureProperties.data[population][outcomeVariable][timeFrame];

  const newData = [];

  for (let i = 0; i < thisData.values.length; i++) {
    let value = NaN;

    try {
      if (panelType === "percentDifference") {
        const thisWeekDatum = finiteNumber(thisData.values[i]);
        const lastWeekDatum = finiteNumber(thisData.values[i - 1]);
        value = safePercentDifference(thisWeekDatum, lastWeekDatum) ?? 0;

        if (!isFinite(value)) {
          value = 0;
        }
      } else if (panelType === "rate") {
        value = safeRate(thisData.values[i], featureProperties.population);
      } else {
        value = thisData.values[i];
      }
    } catch (error) {
      value = NaN;
    }

    newData.push(value);
  }

  if (
    timeFrame === "projected" &&
    panelType === "percentDifference" &&
    newData.length > 0
  ) {
    const lastWeekDatum =
      featureProperties.data[population][outcomeVariable][
        "historical"
      ].values.at(-1);

    const thisWeekDatum = thisData.values[0];

    const projectedPercentDifference = safePercentDifference(
      thisWeekDatum,
      lastWeekDatum,
    );

    if (projectedPercentDifference !== undefined) {
      // newData.unshift(
      //   ((thisWeekDatum - lastWeekDatum) / Math.abs(lastWeekDatum)) * 100,
      // );
      newData[0] = projectedPercentDifference;
    }
  }

  return newData;
}
