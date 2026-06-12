(function () {
  const conditionSelector = document.getElementById("maternal-child-condition");
  const measureSelector = document.getElementById("maternal-child-measure");
  const yearSelector = document.getElementById("maternal-child-year");
  const maternalChildMetadata = window.metadata ?? {};

  if (!conditionSelector || !measureSelector || !yearSelector) {
    return;
  }

  function getOptionEntries(source, { formatLabels = false } = {}) {
    if (!source) {
      return [];
    }

    if (Array.isArray(source)) {
      return addOptionValues(
        source.map((value) => ({
          rawValue: String(value),
          label: formatLabels ? formatOptionLabel(value) : String(value),
        })),
      );
    }

    if (typeof source === "object") {
      return addOptionValues(
        Object.entries(source).map(([value, label]) => ({
          rawValue: String(value),
          label: getDisplayLabel(value, label, formatLabels),
        })),
      );
    }

    return [];
  }

  function addOptionValues(entries) {
    const usedValues = new Set();

    return entries.map((entry, index) => {
      const baseValue = getSafeOptionValue(entry.rawValue, index);
      let value = baseValue;
      let duplicateIndex = 2;

      while (usedValues.has(value)) {
        value = `${baseValue}_${duplicateIndex}`;
        duplicateIndex += 1;
      }

      usedValues.add(value);

      return {
        ...entry,
        value,
      };
    });
  }

  function getSafeOptionValue(value, index) {
    const safeValue = String(value).trim().replace(/\s+/g, "_");
    return safeValue || `option_${index + 1}`;
  }

  function getDisplayLabel(value, label, formatLabels) {
    if (label && typeof label === "object") {
      return String(label.display ?? label.name ?? label.label ?? value);
    }

    return String(label ?? (formatLabels ? formatOptionLabel(value) : value));
  }

  function formatOptionLabel(value) {
    return String(value)
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  function getConditionValue() {
    return getSelectedRawValue(conditionSelector);
  }

  function getMeasureEntries(condition) {
    return getOptionEntries(
      maternalChildMetadata.data_metrics_by_condition?.[condition]
        ?? maternalChildMetadata.data_metrics,
    );
  }

  function getYearEntries(condition) {
    return getOptionEntries(
      maternalChildMetadata.data_years_by_condition?.[condition]
        ?? maternalChildMetadata.data_years,
    );
  }

  function getFirstValue(entries) {
    return entries[0]?.rawValue ?? "";
  }

  function getLatestValue(entries) {
    return [...entries].sort((left, right) => {
      return compareYearValues(left.rawValue, right.rawValue);
    }).at(-1)?.rawValue ?? "";
  }

  function compareYearValues(left, right) {
    const leftNumber = Number(left);
    const rightNumber = Number(right);

    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      return leftNumber - rightNumber;
    }

    const leftDate = Date.parse(left);
    const rightDate = Date.parse(right);

    if (Number.isFinite(leftDate) && Number.isFinite(rightDate)) {
      return leftDate - rightDate;
    }

    return String(left).localeCompare(String(right), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  }

  function replaceOptions(selector, entries, selectedValue) {
    const persistentChildren = Array.from(selector.children).filter((child) => {
      return child.tagName.toLowerCase() !== "sl-option";
    });

    selector.replaceChildren(
      ...persistentChildren,
      ...entries.map(({ value, rawValue, label }) => {
        const option = document.createElement("sl-option");
        option.setAttribute("value", value);
        option.dataset.rawValue = rawValue;
        option.textContent = label;
        return option;
      }),
    );

    selector.disabled = entries.length === 0;
    const nextEntry = entries.find(({ rawValue }) => rawValue === selectedValue)
      ?? entries[0];

    setSelectorValue(selector, nextEntry?.value ?? "", nextEntry?.rawValue ?? "");

    if (entries.length > 0) {
      selector.dataset.pendingValue = nextEntry.value;
      customElements.whenDefined("sl-option").then(() => {
        if (selector.dataset.pendingValue === nextEntry.value) {
          setSelectorValue(selector, nextEntry.value, nextEntry.rawValue);
        }
      });
    }
  }

  function setSelectorValue(selector, value, rawValue) {
    if (value) {
      selector.setAttribute("value", value);
    } else {
      selector.removeAttribute("value");
    }

    selector.dataset.rawValue = rawValue;
    selector.value = value;
  }

  function getSelectedRawValue(selector) {
    const selectedValue = selector.value || selector.getAttribute("value") || "";
    const selectedOption = Array.from(selector.querySelectorAll("sl-option"))
      .find((option) => option.getAttribute("value") === selectedValue);

    const rawValue = selectedOption?.dataset.rawValue
      ?? selector.dataset.rawValue
      ?? "";

    selector.dataset.rawValue = rawValue;
    return rawValue;
  }

  function getRawOptionValue(selectorOrId, value) {
    const selector = typeof selectorOrId === "string"
      ? document.getElementById(selectorOrId)
      : selectorOrId;

    if (!selector) {
      return "";
    }

    const selectedValue = value
      ?? selector.value
      ?? selector.getAttribute("value")
      ?? "";
    const selectedOption = Array.from(selector.querySelectorAll("sl-option"))
      .find((option) => option.getAttribute("value") === selectedValue);

    return selectedOption?.dataset.rawValue
      ?? selector.dataset.rawValue
      ?? selectedValue;
  }

  function getControlState() {
    return {
      condition: getSelectedRawValue(conditionSelector),
      measure: getSelectedRawValue(measureSelector),
      year: getSelectedRawValue(yearSelector),
    };
  }

  function syncSelectedRawValue(selector) {
    getSelectedRawValue(selector);
  }

  function updateDependentSelectors() {
    const condition = getConditionValue();
    const measureEntries = getMeasureEntries(condition);
    const yearEntries = getYearEntries(condition);

    replaceOptions(measureSelector, measureEntries, getFirstValue(measureEntries));
    replaceOptions(yearSelector, yearEntries, getLatestValue(yearEntries));
  }

  async function initializeMaternalChildOptions() {
    await customElements.whenDefined("sl-select");

    const conditionEntries = getOptionEntries(
      maternalChildMetadata.data_conditions,
      { formatLabels: true },
    );

    replaceOptions(
      conditionSelector,
      conditionEntries,
      getFirstValue(conditionEntries),
    );
    updateDependentSelectors();
    window.dispatchEvent(new CustomEvent("maternal-child-options-ready", {
      detail: getControlState(),
    }));
  }

  window.maternalChildOptionValue = {
    getControlState,
    getRawOptionValue,
    getSelectedRawValue: getRawOptionValue,
    toRawValue: getRawOptionValue,
    toSafeValue: getSafeOptionValue,
  };

  conditionSelector.addEventListener("sl-change", updateDependentSelectors);
  measureSelector.addEventListener("sl-change", () => {
    syncSelectedRawValue(measureSelector);
  });
  yearSelector.addEventListener("sl-change", () => {
    syncSelectedRawValue(yearSelector);
  });
  initializeMaternalChildOptions();
})();
