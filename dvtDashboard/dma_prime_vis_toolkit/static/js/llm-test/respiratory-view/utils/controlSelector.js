export function getAllFacilityOptionContainers() {
  return document.getElementsByClassName("facility-option-container");
}

export function getFacilityOptionContainerInView(view) {
  return document.getElementById(`${view}-facility-option-container`);
}
