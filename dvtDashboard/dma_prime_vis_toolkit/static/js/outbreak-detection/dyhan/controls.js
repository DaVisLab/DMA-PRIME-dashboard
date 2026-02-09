export const months = [
  "Jan.",
  "Feb.",
  "Mar.",
  "Apr.",
  "May",
  "Jun.",
  "Jul.",
  "Aug.",
  "Sep.",
  "Oct.",
  "Nov.",
  "Dec.",
];

const slider = document.getElementById("monthRange");
const label = document.getElementById("monthValue");

label.textContent = months[slider.value];

slider.addEventListener("input", () => {
  label.textContent = months[slider.value];
  document.getElementById("popupMonthRange").value = slider.value;
});

const slider_popup = document.getElementById("popupMonthRange");
const label_popup = document.getElementById("popupMonthValue");

label_popup.textContent = months[slider_popup.value];

slider_popup.addEventListener("input", () => {
  label_popup.textContent = months[slider_popup.value];
});
