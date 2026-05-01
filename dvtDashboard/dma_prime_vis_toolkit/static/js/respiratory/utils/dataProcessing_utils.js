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

export async function call_data(geoSelected, diseaseSelected, data_version) {
  return await d3.json(
    `/data/respiratory/${geoSelected}/${
      diseaseSelected
    }?data_version=${data_version}&${parseInt(Math.random() * 9999999999)}`,
  );
}

export function facility_dataProcessing(features, facility_unit) {
  switch (facility_unit) {
    case "individual-unit":
      features = features.filter(
        (item) =>
          item.properties.id != "MUSC" && item.properties.id != "PRISMA",
      );
      break;
    case "prisma":
      features = features.filter((item) => item.properties.id == "PRISMA");
      break;
    case "musc":
      features = features.filter((item) => item.properties.id == "MUSC");
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
  var arr = features.map((feature) => {
    return getCurDateValueFromFeature(
      feature,
      population,
      outcomeVariable,
      panelType,
      imputations,
    );
  });

  return arr;
}

export function getCurDateValueFromFeature(
  feature,
  population,
  outcomeVariable,
  panelType,
  imputations,
  projectionType = "projected",
) {
  const thisData =
    feature.properties.data[population][outcomeVariable][projectionType];

  if (!imputations && thisData.imputed) {
    if (panelType === "percentDifference") {
      return [NaN, NaN, NaN];
    }
    return NaN;
  }

  const dateIndex = dayjs(currentDate).diff(thisData.start_date, "week");
  let thisWeekDatum = finiteNumber(thisData.values.at(dateIndex));

  if (panelType === "rate") {
    thisWeekDatum = safeRate(thisWeekDatum, feature.properties.population);
  }

  if (panelType === "percentDifference") {
    let lastWeekDatum;

    if (dateIndex === 0) {
      const histData =
        feature.properties.data[population][outcomeVariable]["historical"]
          .values;

      lastWeekDatum = finiteNumber(histData.at(histData.length - 1));
    } else {
      lastWeekDatum = finiteNumber(thisData.values.at(dateIndex - 1));
    }

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
    } catch (e) {}

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
