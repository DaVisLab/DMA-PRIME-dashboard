async function getHospitalizationData(diseaseOfInterest, valueType) {
  let stateData;

  try {
    stateData = await d3.json(
      `/data/respiratory/state/state-cdc?data_version=${
        metadata.data_version
      }&${parseInt(Math.random() * 9999999999)}`
    );

    stateData = Object.entries(stateData[diseaseOfInterest]).map((d) => {
      let temp = { Date: d[0], count: d[1] };

      if (valueType == "rate") {
        temp["count"] /= scPopulation / 1000;
      }

      return temp;
    });
  } catch (error) {
    stateData = [{ Date: "2020-01-01", count: 1 }];
  }

  return stateData;
}

document.addEventListener("DOMContentLoaded", async () => {
  const diseaseOfInterest = mapDiseaseSelector.value;
  const valueType = mapTypeSwitch.value;

  let stateHospitalizationData = await getHospitalizationData(
    diseaseOfInterest,
    valueType
  );

//   drawbar chart
  console.log(stateHospitalizationData);
});

// (async () => {
//   const stateHospitalizationData = await getHospitalizationData(
//     mapDiseaseSelector.value,
//     mapTypeSwitch.value
//   );
//   console.log(stateHospitalizationData);
// })();
