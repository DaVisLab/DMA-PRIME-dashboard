
(function () {
  let latestRequestId = 0;

  [
    conditionSelector,
    measureSelector,
    yearSelector,
  ].forEach((element) => {
    element.addEventListener("sl-change", callMaternalChildData);
  });

  window.addEventListener("maternal-child-options-ready", () => {
    callMaternalChildData();
  });

  function getOriginalSelectorValue(selector) {
    return window.maternalChildOptionValue?.toRawValue(selector)
      ?? selector.dataset.rawValue
      ?? selector.value
      ?? "";
  }

  function buildMaternalChildDataUrl(condition, measure, year) {
    return `/maternal_child_data/${[
      condition,
      measure,
      year,
    ].map((value) => encodeURIComponent(value)).join("/")}`;
  }

  async function callMaternalChildData() {
    const requestId = latestRequestId + 1;
    latestRequestId = requestId;
    const condition = getOriginalSelectorValue(conditionSelector);
    const measure = getOriginalSelectorValue(measureSelector);
    const year = getOriginalSelectorValue(yearSelector);

    if (!condition || !measure || !year) {
      return null;
    }

    const response = await fetch(
      buildMaternalChildDataUrl(condition, measure, year),
    );

    if (!response.ok) {
      throw new Error(
        `Unable to load maternal-child data: ${response.status}`,
      );
    }

    const data = await response.json();

    if (requestId !== latestRequestId) {
      return null;
    }

    const payload = {
      condition,
      data,
      measure,
      year,
    };

    window.latestMaternalChildData = payload;
    window.dispatchEvent(new CustomEvent("maternal-child-data-loaded", {
      detail: payload,
    }));

    return data;
  }

  window.callMaternalChildData = callMaternalChildData;

  if (window.maternalChildOptionValue) {
    setTimeout(callMaternalChildData, 0);
  }
})();
