import { initializeBubbleMap } from "./init.js";
import { DEFAULT_HIERARCHY_MODE_ID } from "./HierarchyConfig.js";

const STUDY_PHASES = [
  "Start",
  "informed consent form",
  "demographic questionnaire",
  "Training Phase",
  "Main Task 1",
  "Main Task 2",
  "Post Questionnaire",
  "End",
];
const ALL_FILTER_VALUE = "all";
const ANNOTATION_LEVEL_FILTERS = [
  { value: ALL_FILTER_VALUE, label: "all levels" },
  { value: "region", label: "region" },
  { value: "county", label: "county" },
  { value: "zcta", label: "zcta" },
];

const state = {
  activeAnnotationId: null,
  activePhaseIndex: 0,
  annotations: [],
  editingAnnotationId: null,
  filters: {
    level: ALL_FILTER_VALUE,
    node: ALL_FILTER_VALUE,
    parent: ALL_FILTER_VALUE,
  },
  hierarchyModeId: DEFAULT_HIERARCHY_MODE_ID,
  manager: null,
  runtime: null,
};

const els = {};
let mapInitSeq = 0;

document.addEventListener("DOMContentLoaded", () => {
  els.annotationPanel = document.getElementById("annotation-panel");
  els.loadingStatus = document.getElementById("map-loading-status");
  els.progress = document.getElementById("study-progress");
  els.svg = document.getElementById("vis-container");

  renderStudyProgress();
  renderAnnotationPanel();
  restartMap();
});

async function restartMap() {
  if (!els.svg) return;

  const initSeq = ++mapInitSeq;
  state.runtime?.destroy();
  state.runtime = null;
  state.manager = null;
  state.annotations = [];
  state.activeAnnotationId = null;
  renderAnnotationPanel();
  setLoadingStatus("loading map...");

  try {
    const runtime = await initializeBubbleMap({
      hierarchyModeId: state.hierarchyModeId,
      svgEl: els.svg,
      onAnnotationsChange: (annotations) => {
        if (initSeq !== mapInitSeq) return;
        state.annotations = annotations;
        renderAnnotationPanel();
      },
      onAnnotationHover: (annotationId) => {
        if (initSeq !== mapInitSeq) return;
        setActiveAnnotation(annotationId, { scroll: true });
      },
    });

    if (initSeq !== mapInitSeq) {
      runtime.destroy();
      return;
    }

    state.runtime = runtime;
    state.manager = runtime.manager;
    setLoadingStatus("");
  } catch (error) {
    if (initSeq !== mapInitSeq) return;
    console.error("Failed to initialize map authoring view:", error);
    setLoadingStatus("map unavailable");
  }
}

function setLoadingStatus(message) {
  if (!els.loadingStatus) return;

  els.loadingStatus.textContent = message;
  els.loadingStatus.hidden = !message;
}

function renderStudyProgress() {
  if (!els.progress) return;

  const phaseCount = STUDY_PHASES.length;
  const lineInsetPercent = 100 / (phaseCount * 2);
  const trackSpanPercent = 100 - lineInsetPercent * 2;
  const progressPercent =
    (state.activePhaseIndex / (phaseCount - 1)) * trackSpanPercent;

  const hiddenLabel = document.createElement("span");
  hiddenLabel.className = "visually-hidden";
  hiddenLabel.textContent = `Current phase: ${
    STUDY_PHASES[state.activePhaseIndex]
  }`;

  const main = document.createElement("div");
  main.className = "study-progress-main";

  const track = document.createElement("div");
  track.className = "phase-track";
  track.style.setProperty("--line-inset", `${lineInsetPercent}%`);
  track.style.setProperty("--phase-count", String(phaseCount));
  track.style.setProperty("--progress", `${progressPercent}%`);

  STUDY_PHASES.forEach((phase, index) => {
    const step = document.createElement("div");
    step.className = "phase-step";

    const dot = document.createElement("span");
    dot.className = [
      "phase-dot",
      index < state.activePhaseIndex ? "is-complete" : "",
      index === state.activePhaseIndex ? "is-current" : "",
    ]
      .filter(Boolean)
      .join(" ");
    if (index === state.activePhaseIndex) dot.setAttribute("aria-current", "step");

    const label = document.createElement("span");
    label.className = "phase-label";
    label.textContent = phase;

    step.append(dot, label);
    track.appendChild(step);
  });

  const nextButton = document.createElement("button");
  nextButton.className = "btn btn-primary phase-next";
  nextButton.type = "button";
  nextButton.textContent = "next";
  nextButton.disabled = state.activePhaseIndex === STUDY_PHASES.length - 1;
  nextButton.addEventListener("click", () => {
    state.activePhaseIndex = Math.min(
      state.activePhaseIndex + 1,
      STUDY_PHASES.length - 1,
    );
    renderStudyProgress();
  });

  main.appendChild(track);
  els.progress.replaceChildren(hiddenLabel, main, nextButton);
}

function renderAnnotationPanel() {
  if (!els.annotationPanel) return;

  const nodeOptions = buildAnnotationFilterOptions(
    state.annotations,
    getAnnotationNodeFilterValue,
    (annotation) => annotation.nodeTitle,
  );
  const parentOptions = buildAnnotationFilterOptions(
    state.annotations,
    getAnnotationParentFilterValue,
    (annotation) => annotation.parentLabel,
  );

  ensureFilterStillValid("node", nodeOptions);
  ensureFilterStillValid("parent", parentOptions);

  const filteredAnnotations = getFilteredAnnotations();
  const hasFilters =
    state.filters.level !== ALL_FILTER_VALUE ||
    state.filters.node !== ALL_FILTER_VALUE ||
    state.filters.parent !== ALL_FILTER_VALUE;

  const header = document.createElement("header");
  header.className = "annotation-panel-header";
  header.innerHTML = `
    <h2 id="annotation-view-heading">Annotation View</h2>
    <span>${hasFilters ? `${filteredAnnotations.length}/${state.annotations.length}` : state.annotations.length}</span>
  `;

  const filterBar = document.createElement("div");
  filterBar.className = "annotation-filter-bar";
  filterBar.setAttribute("aria-label", "annotation filters");
  filterBar.append(
    createFilterField("level", ANNOTATION_LEVEL_FILTERS),
    createFilterField("node", [
      { value: ALL_FILTER_VALUE, label: "all nodes" },
      ...nodeOptions,
    ]),
    createFilterField("parent", [
      { value: ALL_FILTER_VALUE, label: "all parents" },
      ...parentOptions,
    ]),
  );

  const list = document.createElement("div");
  list.className = "annotation-card-list";
  list.setAttribute("aria-labelledby", "annotation-view-heading");
  list.setAttribute("role", "list");

  if (!state.annotations.length) {
    list.appendChild(createEmptyMessage("saved annotations will appear here"));
  } else if (!filteredAnnotations.length) {
    list.appendChild(
      createEmptyMessage("no annotations match the selected filters"),
    );
  } else {
    filteredAnnotations.forEach((annotation) => {
      list.appendChild(createAnnotationCard(annotation));
    });
  }

  els.annotationPanel.replaceChildren(header, filterBar, list);
  updateAnnotationCardActiveStates();
}

function createFilterField(name, options) {
  const label = document.createElement("label");
  label.className = "annotation-filter-field";

  const text = document.createElement("span");
  text.textContent = name;

  const select = document.createElement("select");
  select.value = state.filters[name];
  options.forEach((optionData) => {
    const option = document.createElement("option");
    option.value = optionData.value;
    option.textContent = optionData.label;
    select.appendChild(option);
  });
  select.addEventListener("change", (event) => {
    state.filters[name] = event.target.value;
    renderAnnotationPanel();
  });

  label.append(text, select);
  return label;
}

function createAnnotationCard(annotation) {
  const card = document.createElement("article");
  card.className = "annotation-card";
  card.dataset.annotationId = annotation.id;
  card.setAttribute("aria-label", `${annotation.areaLabel} annotation`);
  card.setAttribute("role", "listitem");

  card.addEventListener("mouseenter", () => {
    setActiveAnnotation(annotation.id);
    state.manager?.previewAnnotation(annotation.id, {
      pan: true,
      notify: false,
    });
  });
  card.addEventListener("mouseleave", () => {
    setActiveAnnotation(null);
    state.manager?.clearAnnotationPreview({ notify: false });
  });

  const topLine = document.createElement("div");
  topLine.className = "annotation-card-topline";

  const nodeTitle = document.createElement("span");
  nodeTitle.textContent = annotation.nodeTitle;

  const actions = document.createElement("div");
  actions.className = "annotation-card-actions";

  if (state.editingAnnotationId === annotation.id) {
    const saveButton = createButton("save", "outline-primary");
    saveButton.disabled = false;
    saveButton.addEventListener("click", () => {
      const textarea = card.querySelector(".annotation-card-textarea");
      const nextNote = textarea?.value.trim();
      if (!nextNote) return;
      state.manager?.updateAnnotation(annotation.id, nextNote);
      state.editingAnnotationId = null;
      renderAnnotationPanel();
    });

    const closeButton = createButton("close", "outline-secondary");
    closeButton.addEventListener("click", () => {
      state.editingAnnotationId = null;
      renderAnnotationPanel();
    });
    actions.append(saveButton, closeButton);
  } else {
    const editButton = createButton("edit", "outline-secondary");
    editButton.addEventListener("click", () => {
      state.editingAnnotationId = annotation.id;
      renderAnnotationPanel();
    });
    actions.appendChild(editButton);
  }

  const deleteButton = createButton("delete", "outline-danger");
  deleteButton.addEventListener("click", () => {
    state.manager?.deleteAnnotation(annotation.id);
  });
  actions.appendChild(deleteButton);

  topLine.append(nodeTitle, actions);

  const area = document.createElement("strong");
  area.textContent = annotation.areaLabel;

  const body =
    state.editingAnnotationId === annotation.id
      ? createAnnotationEditor(annotation)
      : createAnnotationText(annotation.note);

  const meta = document.createElement("small");
  meta.textContent = getAnnotationCardMeta(annotation);

  card.append(topLine, area, body, meta);
  return card;
}

function createAnnotationEditor(annotation) {
  const textarea = document.createElement("textarea");
  textarea.className = "annotation-card-textarea";
  textarea.setAttribute(
    "aria-label",
    `annotation text for ${annotation.areaLabel}`,
  );
  textarea.value = annotation.note ?? "";
  return textarea;
}

function createAnnotationText(note) {
  const text = document.createElement("p");
  text.textContent = note;
  return text;
}

function createButton(label, variant) {
  const button = document.createElement("button");
  button.className = `btn btn-sm btn-${variant}`;
  button.type = "button";
  button.textContent = label;
  return button;
}

function createEmptyMessage(message) {
  const empty = document.createElement("div");
  empty.className = "annotation-empty";
  empty.setAttribute("role", "status");
  empty.textContent = message;
  return empty;
}

function setActiveAnnotation(annotationId, { scroll = false } = {}) {
  state.activeAnnotationId = annotationId;
  updateAnnotationCardActiveStates();

  if (scroll && annotationId) {
    const card = els.annotationPanel?.querySelector(
      `[data-annotation-id="${escapeCssValue(annotationId)}"]`,
    );
    card?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }
}

function updateAnnotationCardActiveStates() {
  els.annotationPanel
    ?.querySelectorAll(".annotation-card")
    .forEach((card) => {
      card.classList.toggle(
        "is-active",
        card.dataset.annotationId === state.activeAnnotationId,
      );
    });
}

function getFilteredAnnotations() {
  return state.annotations.filter((annotation) => {
    const matchesLevel =
      state.filters.level === ALL_FILTER_VALUE ||
      getAnnotationLevelFilterValue(annotation) === state.filters.level;
    const matchesNode =
      state.filters.node === ALL_FILTER_VALUE ||
      getAnnotationNodeFilterValue(annotation) === state.filters.node;
    const matchesParent =
      state.filters.parent === ALL_FILTER_VALUE ||
      getAnnotationParentFilterValue(annotation) === state.filters.parent;

    return matchesLevel && matchesNode && matchesParent;
  });
}

function buildAnnotationFilterOptions(annotations, getValue, getLabel) {
  const optionsByValue = new Map();

  annotations.forEach((annotation) => {
    const value = getValue(annotation);
    if (!value || optionsByValue.has(value)) return;

    optionsByValue.set(value, {
      value,
      label: getLabel(annotation) || value,
    });
  });

  return Array.from(optionsByValue.values()).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
}

function ensureFilterStillValid(name, options) {
  if (
    state.filters[name] !== ALL_FILTER_VALUE &&
    !options.some((option) => option.value === state.filters[name])
  ) {
    state.filters[name] = ALL_FILTER_VALUE;
  }
}

function getAnnotationLevelFilterValue(annotation) {
  return String(annotation.level ?? annotation.scaleLabel ?? "")
    .replace(/\s+scale$/i, "")
    .trim()
    .toLowerCase();
}

function getAnnotationNodeFilterValue(annotation) {
  return annotation.nodeId ?? annotation.nodeTitle ?? "";
}

function getAnnotationParentFilterValue(annotation) {
  return annotation.parentLabel ?? "no parent";
}

function getAnnotationCardMeta(annotation) {
  const metaParts = [
    annotation.level ? `${annotation.level} level` : annotation.scaleLabel,
    annotation.parentLabel ? `parent: ${annotation.parentLabel}` : null,
  ].filter(Boolean);

  return metaParts.join(" | ");
}

function escapeCssValue(value) {
  if (window.CSS?.escape) return CSS.escape(value);

  return String(value).replace(/["\\]/g, "\\$&");
}
