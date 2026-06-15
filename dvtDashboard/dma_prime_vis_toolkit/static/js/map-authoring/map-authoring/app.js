import { initializeBubbleMap } from "./init.js";
import { DEFAULT_HIERARCHY_MODE_ID } from "./HierarchyConfig.js";
import { initializeWorkspaceTabs } from "./WorkspaceTabs.js";

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
const SAVE_SCHEMA_VERSION = "map-authoring-tabs/v1";
const ARCHIVE_SAVE_DELAY_MS = 800;

const appState = {
  activePhaseIndex: 0,
  activeWorkspaceId: null,
  archiveSaveInFlight: false,
  archiveSaveQueued: false,
  archiveSaveSuppressionDepth: 0,
  archiveSaveTimer: null,
  workspaces: new Map(),
};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  els.addTabButton = document.getElementById("add-authoring-tab");
  els.loadJsonButton = document.getElementById("load-authoring-tab-json");
  els.loadJsonInput = document.getElementById("load-authoring-tab-file");
  els.progress = document.getElementById("study-progress");
  els.renameTabButton = document.getElementById("rename-authoring-tab");
  els.saveJsonButton = document.getElementById("save-authoring-tab-json");
  els.tabList = document.getElementById("authoring-tab-list");
  els.tabPanels = document.getElementById("authoring-tab-panels");

  els.tabPanels
    ?.querySelectorAll("[data-authoring-workspace-panel]")
    .forEach((paneEl) => {
      createWorkspaceFromPane(paneEl);
    });

  els.tabs = initializeWorkspaceTabs({
    addButton: els.addTabButton,
    createPanel: createWorkspacePane,
    onTabAdded: (tab) => {
      createWorkspaceFromPane(tab.paneEl);
      scheduleArchiveSave();
    },
    onTabClosed: (tab) => {
      removeWorkspace(tab.id);
      scheduleArchiveSave();
    },
    onTabChange: (tab) => {
      handleWorkspaceTabChange(tab);
      scheduleArchiveSave();
    },
    onTabRenamed: () => {
      scheduleArchiveSave();
    },
    panelsEl: els.tabPanels,
    renameButton: els.renameTabButton,
    tabListEl: els.tabList,
  });

  renderStudyProgress();
  exposeWorkspacePersistenceApi();

  els.saveJsonButton?.addEventListener("click", () => {
    downloadActiveWorkspaceJson();
  });
  els.loadJsonButton?.addEventListener("click", () => {
    els.loadJsonInput?.click();
  });
  els.loadJsonInput?.addEventListener("change", () => {
    const file = els.loadJsonInput.files?.[0];
    if (!file) return;

    loadAuthoringJsonFile(file).finally(() => {
      els.loadJsonInput.value = "";
    });
  });
  window.addEventListener("beforeunload", flushPendingArchiveSave);

  bootAuthoringWorkspace();
});

async function bootAuthoringWorkspace() {
  let loadedArchive = false;

  try {
    loadedArchive = await loadArchivedWorkspace();
  } catch (error) {
    console.warn("Failed to load map authoring archive:", error);
  }

  if (!loadedArchive) {
    startDefaultWorkspace();
  }
}

function startDefaultWorkspace() {
  let activeTab = els.tabs?.getActiveTab();

  if (!activeTab) {
    activeTab = els.tabs?.addTab?.({ title: "Workspace 1" });
  }

  if (activeTab && appState.activeWorkspaceId !== activeTab.id) {
    handleWorkspaceTabChange(activeTab);
  }
}

async function loadArchivedWorkspace() {
  const archiveUrl = getArchiveUrl();
  if (!archiveUrl) return false;

  const response = await fetch(archiveUrl, {
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
    },
  });

  if (response.status === 404) return false;
  if (response.redirected || !response.ok) {
    throw new Error(`Archive request failed with ${response.status}.`);
  }

  const payload = await response.json();
  if (payload?.exists === false || !getLoadedTabPayloads(payload).length) {
    return false;
  }

  await runWithArchiveSaveSuppressed(() =>
    loadAuthoringSavePayload(payload, { replaceExisting: true }),
  );

  return true;
}

function createWorkspacePane({ id, title }) {
  const pane = document.createElement("section");
  pane.id = id;
  pane.className = "app-tab-pane authoring-workspace-pane";
  pane.dataset.authoringWorkspacePanel = "";
  pane.dataset.tabTitle = title;

  const contentRow = document.createElement("div");
  contentRow.className = "page-content-row";

  const mapPanel = document.createElement("section");
  mapPanel.className = "app-map-panel";
  mapPanel.setAttribute("aria-label", "map authoring canvas");

  const mapView = document.createElement("div");
  mapView.className = "map-view-area";

  const contextMenu = document.createElement("div");
  contextMenu.className = "context-menu";
  contextMenu.dataset.contextMenu = "";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("vis-container");
  svg.dataset.mapSvg = "";
  svg.setAttribute("aria-label", "Interactive bubble map canvas");

  const loadingStatus = document.createElement("div");
  loadingStatus.className = "map-loading-status";
  loadingStatus.dataset.mapLoadingStatus = "";
  loadingStatus.setAttribute("role", "status");
  loadingStatus.hidden = true;

  const annotationPanel = document.createElement("aside");
  annotationPanel.className = "option-panel app-side-panel";
  annotationPanel.dataset.annotationPanel = "";
  annotationPanel.setAttribute("aria-label", "annotation panel");

  mapView.append(contextMenu, svg, loadingStatus);
  mapPanel.appendChild(mapView);
  contentRow.append(mapPanel, annotationPanel);
  pane.appendChild(contentRow);

  return pane;
}

function createWorkspaceFromPane(paneEl) {
  if (!paneEl) return null;
  if (!paneEl.id) paneEl.id = `authoring-workspace-${Date.now()}`;
  if (appState.workspaces.has(paneEl.id)) {
    return appState.workspaces.get(paneEl.id);
  }

  const workspace = {
    activeAnnotationId: null,
    annotations: [],
    editingAnnotationId: null,
    els: {
      annotationPanel: paneEl.querySelector("[data-annotation-panel]"),
      contextMenu: paneEl.querySelector("[data-context-menu]"),
      loadingStatus: paneEl.querySelector("[data-map-loading-status]"),
      svg: paneEl.querySelector("[data-map-svg]"),
    },
    filters: {
      level: ALL_FILTER_VALUE,
      node: ALL_FILTER_VALUE,
      parent: ALL_FILTER_VALUE,
    },
    hierarchyModeId: DEFAULT_HIERARCHY_MODE_ID,
    id: paneEl.id,
    initSeq: 0,
    manager: null,
    paneEl,
    runtime: null,
  };

  appState.workspaces.set(workspace.id, workspace);
  renderAnnotationPanel(workspace);
  return workspace;
}

function handleWorkspaceTabChange(tab) {
  const workspace =
    appState.workspaces.get(tab?.id) ?? createWorkspaceFromPane(tab?.paneEl);
  if (!workspace) {
    appState.activeWorkspaceId = null;
    appState.workspaces.forEach((item) => {
      item.manager?.setActive?.(false);
      item.manager?.hideMenu?.();
    });
    return;
  }

  appState.activeWorkspaceId = workspace.id;
  appState.workspaces.forEach((item) => {
    const isActive = item.id === workspace.id;
    item.manager?.setActive?.(isActive);
    if (!isActive) item.manager?.hideMenu?.();
  });

  if (!workspace.runtime) {
    restartMap(workspace);
    return;
  }

  workspace.manager?.flushGraphUpdate?.();
  workspace.manager?.updateOverview?.();
}

function removeWorkspace(workspaceId) {
  const workspace = appState.workspaces.get(workspaceId);
  if (!workspace) return;

  workspace.runtime?.destroy();
  workspace.runtime = null;
  workspace.manager = null;
  appState.workspaces.delete(workspaceId);

  if (appState.activeWorkspaceId === workspaceId) {
    appState.activeWorkspaceId = null;
  }
}

function getWorkspaceSavePayload(workspace = getActiveWorkspace()) {
  if (!workspace) return null;

  const tab = getWorkspaceTab(workspace.id);
  const title = tab?.title ?? workspace.paneEl.dataset.tabTitle ?? workspace.id;
  const mapAuthoring =
    workspace.manager?.getAuthoringState?.() ??
    createEmptyMapAuthoringState(workspace);

  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    userId: null,
    tab: {
      id: workspace.id,
      title,
    },
    workspace: {
      id: workspace.id,
      hierarchyModeId: workspace.hierarchyModeId,
      filters: { ...workspace.filters },
      activeAnnotationId: workspace.activeAnnotationId,
      editingAnnotationId: workspace.editingAnnotationId,
      isInitialized: Boolean(workspace.runtime),
    },
    mapAuthoring,
  };
}

function getAllWorkspacesSavePayload({ userId = null } = {}) {
  const tabs = els.tabs?.getTabs?.() ?? [];
  const savedAt = new Date().toISOString();

  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    savedAt,
    userId,
    activeTabId: appState.activeWorkspaceId,
    tabs: tabs
      .map((tab) => {
        const workspace = appState.workspaces.get(tab.id);
        if (!workspace) return null;

        return {
          ...getWorkspaceSavePayload(workspace),
          savedAt,
          userId,
          tab: {
            id: tab.id,
            title: tab.title,
          },
        };
      })
      .filter(Boolean),
  };
}

function createEmptyMapAuthoringState(workspace) {
  return {
    stateVersion: 1,
    canvas: null,
    maps: [],
    connections: [],
    annotations: [...(workspace?.annotations ?? [])],
    groups: [],
    selection: {
      selectedMapId: null,
      selectedMapIds: [],
      activeGroupId: null,
    },
    network: {
      nodes: [],
      edges: [],
      selectedNodeId: null,
      selectedNodeIds: [],
    },
  };
}

function getWorkspaceTab(workspaceId) {
  return (
    els.tabs?.getTabById?.(workspaceId) ??
    els.tabs?.getTabs?.().find((tab) => tab.id === workspaceId) ??
    null
  );
}

function downloadActiveWorkspaceJson() {
  const payload = getWorkspaceSavePayload();
  if (!payload) return;

  const fileBaseName = normalizeFileName(payload.tab.title);
  downloadJson(payload, `${fileBaseName}.map-authoring.json`);
}

function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function getArchiveConfig() {
  return window.mapAuthoringConfig?.archive ?? {};
}

function getArchiveUrl() {
  return getArchiveConfig().url ?? null;
}

function getArchiveUserKey() {
  return getArchiveConfig().userKey ?? null;
}

function isArchiveSaveSuppressed() {
  return appState.archiveSaveSuppressionDepth > 0;
}

async function runWithArchiveSaveSuppressed(callback) {
  appState.archiveSaveSuppressionDepth += 1;
  try {
    return await callback();
  } finally {
    appState.archiveSaveSuppressionDepth = Math.max(
      0,
      appState.archiveSaveSuppressionDepth - 1,
    );
  }
}

function scheduleArchiveSave({ immediate = false } = {}) {
  if (isArchiveSaveSuppressed() || !getArchiveUrl()) return;

  if (appState.archiveSaveTimer) {
    window.clearTimeout(appState.archiveSaveTimer);
  }

  appState.archiveSaveTimer = window.setTimeout(
    () => {
      appState.archiveSaveTimer = null;
      saveArchiveNow();
    },
    immediate ? 0 : ARCHIVE_SAVE_DELAY_MS,
  );
}

async function saveArchiveNow() {
  const archiveUrl = getArchiveUrl();
  if (!archiveUrl || isArchiveSaveSuppressed()) return;

  if (appState.archiveSaveTimer) {
    window.clearTimeout(appState.archiveSaveTimer);
    appState.archiveSaveTimer = null;
  }

  if (appState.archiveSaveInFlight) {
    appState.archiveSaveQueued = true;
    return;
  }

  appState.archiveSaveInFlight = true;

  try {
    const payload = getAllWorkspacesSavePayload({
      userId: getArchiveUserKey(),
    });
    const response = await fetch(archiveUrl, {
      method: "PUT",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (response.redirected || !response.ok) {
      throw new Error(`Archive save failed with ${response.status}.`);
    }
  } catch (error) {
    console.error("Failed to save map authoring archive:", error);
  } finally {
    appState.archiveSaveInFlight = false;

    const shouldSaveAgain = appState.archiveSaveQueued;
    appState.archiveSaveQueued = false;
    if (shouldSaveAgain) scheduleArchiveSave();
  }
}

function flushPendingArchiveSave() {
  const archiveUrl = getArchiveUrl();
  if (!archiveUrl || isArchiveSaveSuppressed() || !appState.archiveSaveTimer) {
    return;
  }

  window.clearTimeout(appState.archiveSaveTimer);
  appState.archiveSaveTimer = null;

  const payload = getAllWorkspacesSavePayload({
    userId: getArchiveUserKey(),
  });
  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon(archiveUrl, blob)) return;
  }

  saveArchiveNow();
}

async function loadAuthoringJsonFile(file) {
  try {
    const payload = JSON.parse(await file.text());
    await runWithArchiveSaveSuppressed(() => loadAuthoringSavePayload(payload));
    scheduleArchiveSave();
  } catch (error) {
    console.error("Failed to load map authoring JSON:", error);
    window.alert?.("Unable to load this map authoring JSON file.");
  }
}

async function loadAuthoringSavePayload(payload, { replaceExisting = false } = {}) {
  const tabPayloads = getLoadedTabPayloads(payload);
  if (!tabPayloads.length) {
    throw new Error("Map authoring JSON does not contain any tabs.");
  }

  if (replaceExisting) {
    els.tabs?.clearTabs?.();
    appState.activeWorkspaceId = null;
  }

  const loadedTabsBySourceId = new Map();
  let fallbackLoadedTabId = null;

  for (const tabPayload of tabPayloads) {
    const loadedTab = els.tabs.addTab({
      activate: false,
      title: tabPayload.tab?.title ?? "Loaded Workspace",
    });
    const workspace = appState.workspaces.get(loadedTab.id);

    await replaceWorkspaceFromPayload(workspace, tabPayload);
    fallbackLoadedTabId ??= loadedTab.id;
    if (tabPayload.tab?.id) {
      loadedTabsBySourceId.set(tabPayload.tab.id, loadedTab.id);
    }
  }

  const activeLoadedTabId =
    loadedTabsBySourceId.get(payload.activeTabId) ?? fallbackLoadedTabId;
  if (activeLoadedTabId) els.tabs.setActiveTab(activeLoadedTabId);
}

function getLoadedTabPayloads(payload) {
  if (Array.isArray(payload?.tabs)) return payload.tabs;
  if (payload?.mapAuthoring) return [payload];

  return [];
}

function resetWorkspaceRuntime(workspace) {
  if (!workspace) return;

  workspace.annotations = [];
  workspace.runtime?.destroy();
  workspace.runtime = null;
  workspace.manager = null;
}

function createMapRuntimeCallbacks(workspace, initSeq, isApplyingInitialState) {
  return {
    onAnnotationsChange: (annotations) => {
      if (initSeq !== workspace.initSeq) return;

      workspace.annotations = annotations;
      renderAnnotationPanel(workspace);
      if (!isApplyingInitialState()) scheduleArchiveSave();
    },
    onAnnotationHover: (annotationId) => {
      if (initSeq !== workspace.initSeq) return;
      setActiveAnnotation(workspace, annotationId, { scroll: true });
    },
    onNetworkChange: () => {
      if (initSeq !== workspace.initSeq || isApplyingInitialState()) return;
      scheduleArchiveSave();
    },
  };
}

async function initializeWorkspaceRuntime(
  workspace,
  {
    authoringState,
    errorLogMessage,
    errorMessage,
    loadingMessage,
    rethrow = false,
    resetActiveAnnotation = false,
  } = {},
) {
  if (!workspace?.els.svg) return null;

  const initSeq = ++workspace.initSeq;
  resetWorkspaceRuntime(workspace);
  if (resetActiveAnnotation) workspace.activeAnnotationId = null;

  renderAnnotationPanel(workspace);
  setLoadingStatus(workspace, loadingMessage);

  let isApplyingInitialState = true;

  try {
    const runtime = await initializeBubbleMap({
      authoringState,
      contextMenuEl: workspace.els.contextMenu,
      hierarchyModeId: workspace.hierarchyModeId,
      managerId: workspace.id,
      svgEl: workspace.els.svg,
      ...createMapRuntimeCallbacks(
        workspace,
        initSeq,
        () => isApplyingInitialState,
      ),
    });

    if (initSeq !== workspace.initSeq) {
      runtime.destroy();
      return null;
    }

    workspace.runtime = runtime;
    workspace.manager = runtime.manager;
    workspace.manager?.setActive?.(workspace.id === appState.activeWorkspaceId);
    workspace.annotations = runtime.manager.getAnnotationSnapshot();
    renderAnnotationPanel(workspace);
    setLoadingStatus(workspace, "");
    isApplyingInitialState = false;
    return runtime;
  } catch (error) {
    if (initSeq !== workspace.initSeq) return null;

    console.error(errorLogMessage, error);
    setLoadingStatus(workspace, errorMessage);
    if (rethrow) throw error;
    return null;
  }
}

async function replaceWorkspaceFromPayload(workspace, payload) {
  if (!workspace) return;

  workspace.activeAnnotationId = payload.workspace?.activeAnnotationId ?? null;
  workspace.editingAnnotationId = null;
  workspace.filters = {
    level: ALL_FILTER_VALUE,
    node: ALL_FILTER_VALUE,
    parent: ALL_FILTER_VALUE,
    ...(payload.workspace?.filters ?? {}),
  };
  workspace.hierarchyModeId =
    payload.workspace?.hierarchyModeId ?? DEFAULT_HIERARCHY_MODE_ID;

  await initializeWorkspaceRuntime(workspace, {
    authoringState: payload.mapAuthoring,
    errorLogMessage: "Failed to restore map authoring JSON:",
    errorMessage: "saved map unavailable",
    loadingMessage: "loading saved map...",
    rethrow: true,
  });
}

function exposeWorkspacePersistenceApi() {
  window.mapAuthoringWorkspaceStore = {
    getActiveTabJson() {
      return getWorkspaceSavePayload();
    },
    getActiveTabJsonString() {
      return JSON.stringify(getWorkspaceSavePayload(), null, 2);
    },
    getAllTabsJson(options = {}) {
      return getAllWorkspacesSavePayload(options);
    },
    getAllTabsJsonString(options = {}) {
      return JSON.stringify(getAllWorkspacesSavePayload(options), null, 2);
    },
    async loadJson(payload, options = {}) {
      const result = await runWithArchiveSaveSuppressed(() =>
        loadAuthoringSavePayload(payload, options),
      );
      scheduleArchiveSave();
      return result;
    },
    getTabJson(tabId) {
      const workspace = appState.workspaces.get(tabId);
      return workspace ? getWorkspaceSavePayload(workspace) : null;
    },
    getTabJsonString(tabId) {
      const payload = this.getTabJson(tabId);
      return payload ? JSON.stringify(payload, null, 2) : null;
    },
  };
}

function normalizeFileName(value) {
  return String(value ?? "workspace")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "workspace";
}

async function restartMap(workspace = getActiveWorkspace()) {
  await initializeWorkspaceRuntime(workspace, {
    errorLogMessage: "Failed to initialize map authoring view:",
    errorMessage: "map unavailable",
    loadingMessage: "loading map...",
    resetActiveAnnotation: true,
  });
}

function setLoadingStatus(workspace, message) {
  if (!workspace?.els.loadingStatus) return;

  workspace.els.loadingStatus.textContent = message;
  workspace.els.loadingStatus.hidden = !message;
}

function getActiveWorkspace() {
  return appState.workspaces.get(appState.activeWorkspaceId) ?? null;
}

function renderStudyProgress() {
  if (!els.progress) return;

  const phaseCount = STUDY_PHASES.length;
  const lineInsetPercent = 100 / (phaseCount * 2);
  const trackSpanPercent = 100 - lineInsetPercent * 2;
  const progressPercent =
    (appState.activePhaseIndex / (phaseCount - 1)) * trackSpanPercent;

  const hiddenLabel = document.createElement("span");
  hiddenLabel.className = "visually-hidden";
  hiddenLabel.textContent = `Current phase: ${
    STUDY_PHASES[appState.activePhaseIndex]
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
      index < appState.activePhaseIndex ? "is-complete" : "",
      index === appState.activePhaseIndex ? "is-current" : "",
    ]
      .filter(Boolean)
      .join(" ");
    if (index === appState.activePhaseIndex) {
      dot.setAttribute("aria-current", "step");
    }

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
  nextButton.disabled = appState.activePhaseIndex === STUDY_PHASES.length - 1;
  nextButton.addEventListener("click", () => {
    appState.activePhaseIndex = Math.min(
      appState.activePhaseIndex + 1,
      STUDY_PHASES.length - 1,
    );
    renderStudyProgress();
  });

  main.appendChild(track);
  els.progress.replaceChildren(hiddenLabel, main, nextButton);
}

function renderAnnotationPanel(workspace = getActiveWorkspace()) {
  if (!workspace?.els.annotationPanel) return;

  const nodeOptions = buildAnnotationFilterOptions(
    workspace.annotations,
    getAnnotationNodeFilterValue,
    (annotation) => annotation.nodeTitle,
  );
  const parentOptions = buildAnnotationFilterOptions(
    workspace.annotations,
    getAnnotationParentFilterValue,
    (annotation) => annotation.parentLabel,
  );

  ensureFilterStillValid(workspace, "node", nodeOptions);
  ensureFilterStillValid(workspace, "parent", parentOptions);

  const filteredAnnotations = getFilteredAnnotations(workspace);
  const hasFilters =
    workspace.filters.level !== ALL_FILTER_VALUE ||
    workspace.filters.node !== ALL_FILTER_VALUE ||
    workspace.filters.parent !== ALL_FILTER_VALUE;
  const headingId = `${workspace.id}-annotation-view-heading`;

  const header = document.createElement("header");
  header.className = "annotation-panel-header";

  const heading = document.createElement("h2");
  heading.id = headingId;
  heading.textContent = "Annotation View";

  const count = document.createElement("span");
  count.textContent = hasFilters
    ? `${filteredAnnotations.length}/${workspace.annotations.length}`
    : String(workspace.annotations.length);

  header.append(heading, count);

  const filterBar = document.createElement("div");
  filterBar.className = "annotation-filter-bar";
  filterBar.setAttribute("aria-label", "annotation filters");
  filterBar.append(
    createFilterField(workspace, "level", ANNOTATION_LEVEL_FILTERS),
    createFilterField(workspace, "node", [
      { value: ALL_FILTER_VALUE, label: "all nodes" },
      ...nodeOptions,
    ]),
    createFilterField(workspace, "parent", [
      { value: ALL_FILTER_VALUE, label: "all parents" },
      ...parentOptions,
    ]),
  );

  const list = document.createElement("div");
  list.className = "annotation-card-list";
  list.setAttribute("aria-labelledby", headingId);
  list.setAttribute("role", "list");

  if (!workspace.annotations.length) {
    list.appendChild(createEmptyMessage("saved annotations will appear here"));
  } else if (!filteredAnnotations.length) {
    list.appendChild(
      createEmptyMessage("no annotations match the selected filters"),
    );
  } else {
    filteredAnnotations.forEach((annotation) => {
      list.appendChild(createAnnotationCard(workspace, annotation));
    });
  }

  workspace.els.annotationPanel.replaceChildren(header, filterBar, list);
  updateAnnotationCardActiveStates(workspace);
}

function createFilterField(workspace, name, options) {
  const label = document.createElement("label");
  label.className = "annotation-filter-field";

  const text = document.createElement("span");
  text.textContent = name;

  const select = document.createElement("select");
  options.forEach((optionData) => {
    const option = document.createElement("option");
    option.value = optionData.value;
    option.textContent = optionData.label;
    select.appendChild(option);
  });
  select.value = workspace.filters[name];
  select.addEventListener("change", (event) => {
    workspace.filters[name] = event.target.value;
    renderAnnotationPanel(workspace);
    scheduleArchiveSave();
  });

  label.append(text, select);
  return label;
}

function createAnnotationCard(workspace, annotation) {
  const card = document.createElement("article");
  card.className = "annotation-card";
  card.dataset.annotationId = annotation.id;
  card.setAttribute("aria-label", `${annotation.areaLabel} annotation`);
  card.setAttribute("role", "listitem");

  card.addEventListener("mouseenter", () => {
    setActiveAnnotation(workspace, annotation.id);
    workspace.manager?.previewAnnotation(annotation.id, {
      pan: true,
      notify: false,
    });
  });
  card.addEventListener("mouseleave", () => {
    setActiveAnnotation(workspace, null);
    workspace.manager?.clearAnnotationPreview({ notify: false });
  });

  const topLine = document.createElement("div");
  topLine.className = "annotation-card-topline";

  const nodeTitle = document.createElement("span");
  nodeTitle.textContent = annotation.nodeTitle;

  const actions = document.createElement("div");
  actions.className = "annotation-card-actions";

  if (workspace.editingAnnotationId === annotation.id) {
    const saveButton = createButton("save", "outline-primary");
    saveButton.disabled = false;
    saveButton.addEventListener("click", () => {
      const textarea = card.querySelector(".annotation-card-textarea");
      const nextNote = textarea?.value.trim();
      if (!nextNote) return;
      workspace.manager?.updateAnnotation(annotation.id, nextNote);
      workspace.editingAnnotationId = null;
      renderAnnotationPanel(workspace);
    });

    const closeButton = createButton("close", "outline-secondary");
    closeButton.addEventListener("click", () => {
      workspace.editingAnnotationId = null;
      renderAnnotationPanel(workspace);
    });
    actions.append(saveButton, closeButton);
  } else {
    const editButton = createButton("edit", "outline-secondary");
    editButton.addEventListener("click", () => {
      workspace.editingAnnotationId = annotation.id;
      renderAnnotationPanel(workspace);
    });
    actions.appendChild(editButton);
  }

  const deleteButton = createButton("delete", "outline-danger");
  deleteButton.addEventListener("click", () => {
    workspace.manager?.deleteAnnotation(annotation.id);
  });
  actions.appendChild(deleteButton);

  topLine.append(nodeTitle, actions);

  const area = document.createElement("strong");
  area.textContent = annotation.areaLabel;

  const body =
    workspace.editingAnnotationId === annotation.id
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

function setActiveAnnotation(workspace, annotationId, { scroll = false } = {}) {
  workspace.activeAnnotationId = annotationId;
  updateAnnotationCardActiveStates(workspace);

  if (scroll && annotationId) {
    const card = workspace.els.annotationPanel?.querySelector(
      `[data-annotation-id="${escapeCssValue(annotationId)}"]`,
    );
    card?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }
}

function updateAnnotationCardActiveStates(workspace = getActiveWorkspace()) {
  workspace?.els.annotationPanel
    ?.querySelectorAll(".annotation-card")
    .forEach((card) => {
      card.classList.toggle(
        "is-active",
        card.dataset.annotationId === workspace.activeAnnotationId,
      );
    });
}

function getFilteredAnnotations(workspace) {
  return workspace.annotations.filter((annotation) => {
    const matchesLevel =
      workspace.filters.level === ALL_FILTER_VALUE ||
      getAnnotationLevelFilterValue(annotation) === workspace.filters.level;
    const matchesNode =
      workspace.filters.node === ALL_FILTER_VALUE ||
      getAnnotationNodeFilterValue(annotation) === workspace.filters.node;
    const matchesParent =
      workspace.filters.parent === ALL_FILTER_VALUE ||
      getAnnotationParentFilterValue(annotation) === workspace.filters.parent;

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

function ensureFilterStillValid(workspace, name, options) {
  if (
    workspace.filters[name] !== ALL_FILTER_VALUE &&
    !options.some((option) => option.value === workspace.filters[name])
  ) {
    workspace.filters[name] = ALL_FILTER_VALUE;
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
