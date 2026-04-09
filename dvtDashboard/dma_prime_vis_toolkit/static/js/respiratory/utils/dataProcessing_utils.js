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
  // console.log(dateIndex);
  let thisWeekDatum = parseFloat(thisData.values.at(dateIndex));

  if (panelType === "rate") {
    thisWeekDatum = (thisWeekDatum / feature.properties.population) * 1000;
  }

  if (panelType === "percentDifference") {
    let lastWeekDatum;

    if (dateIndex === 0) {
      const histData =
        feature.properties.data[population][outcomeVariable]["historical"]
          .values;

      lastWeekDatum = parseFloat(histData.at(histData.length - 1));
    } else {
      lastWeekDatum = parseFloat(thisData.values.at(dateIndex - 1));
    }

    let percentDifference = undefined;
    if (!isNaN(thisWeekDatum) && !isNaN(lastWeekDatum)) {
      percentDifference =
        ((thisWeekDatum - lastWeekDatum) / Math.abs(lastWeekDatum)) * 100;
    }

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
        const thisWeekDatum = parseFloat(thisData.values[i]);
        const lastWeekDatum = parseFloat(thisData.values[i - 1]);

        if (!isNaN(thisWeekDatum) && !isNaN(lastWeekDatum)) {
          value =
            ((thisWeekDatum - lastWeekDatum) / Math.abs(lastWeekDatum)) * 100;
        }

        if (!isFinite(value)) {
          value = 0;
        }
      } else if (panelType === "rate") {
        value = (thisData.values[i] / featureProperties.population) * 1000;
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

    if (!isNaN(thisWeekDatum) && !isNaN(lastWeekDatum)) {
      // newData.unshift(
      //   ((thisWeekDatum - lastWeekDatum) / Math.abs(lastWeekDatum)) * 100,
      // );
      newData[0] =
        ((thisWeekDatum - lastWeekDatum) / Math.abs(lastWeekDatum)) * 100;
    }
  }

  return newData;
}

