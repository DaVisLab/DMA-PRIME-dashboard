export function generateCheckboxListForRiskIndexPanel(diseaseList) {
//   const container = document.getElementById(
//     "map-disease-selector-container"
//   );
}

function generateCheckBoxUnitForDisease(diseaseName, displayName) {
  const checkbox = document.createElement("sl-checkbox");
  checkbox.classList.add("disease-checkbox", "map-option");
}
export function setRiskIndexByDiseaseInPanel(data) {
  const normalizedRIByDiseaseAndArea = data.features.map(
    (item) => item.properties.historical_disease_risk_index_normalized
  );

  const diseaseNames = Object.keys(normalizedRIByDiseaseAndArea[0]);

  for (let disease of diseaseNames) {
    let lastRI = 0;
    let curRI = 0;

    for (let areaData of normalizedRIByDiseaseAndArea) {
      lastRI += areaData[disease].at(-2);
      curRI += areaData[disease].at(-1);
    }

    // console.log(disease, lastRI, curRI);
    const spanCurRI = document.getElementById(`riskindex-${disease}-curRI`);
    const spanRIChange = document.getElementById(
      `riskindex-${disease}-RIChange`
    );
    if (!spanCurRI || !spanRIChange) return;

    spanCurRI.textContent = curRI.toFixed(2);

    if (curRI - lastRI > 0) {
      spanRIChange.style.color = "red";
      spanRIChange.textContent =  (curRI - lastRI).toFixed(2) +" ↑";
    } else if (curRI - lastRI < 0) {
      spanRIChange.style.color = "green";
      spanRIChange.textContent =  (curRI - lastRI).toFixed(2) + " ↓";
    } else {
      spanRIChange.style.color = "black";
      spanRIChange.textContent = (curRI - lastRI).toFixed(2) + " →";
    }
  }

  // console.log(normalizedRIByDiseaseAndArea);
}
