const DEFAULT_TAB_NAME = "Workspace";
const TAB_TITLE_LIMIT = 42;

export function initializeWorkspaceTabs({
  addButton,
  createPanel,
  onTabAdded,
  onTabChange,
  onTabClosed,
  onTabRenamed,
  panelsEl,
  renameButton,
  tabListEl,
} = {}) {
  if (!tabListEl || !panelsEl) return null;

  const state = {
    activeTabId: null,
    customTabSeq: 0,
    editingTabId: null,
    tabs: discoverTabs(panelsEl),
  };

  state.activeTabId = state.tabs[0]?.id ?? null;

  addButton?.addEventListener("click", () => {
    const tab = addTab();
    beginRename(tab.id);
  });

  renameButton?.addEventListener("click", () => {
    beginRename(state.activeTabId);
  });

  render();

  return {
    addTab,
    getActiveTab() {
      return state.tabs.find((tab) => tab.id === state.activeTabId) ?? null;
    },
    getTabById(tabId) {
      return state.tabs.find((tab) => tab.id === tabId) ?? null;
    },
    getTabs() {
      return [...state.tabs];
    },
    renameActiveTab(title) {
      renameTab(state.activeTabId, title);
    },
    clearTabs,
    closeTab,
    setActiveTab,
  };

  function addTab({ activate = true, title } = {}) {
    const tab = createCustomTab(panelsEl, state, createPanel, { title });
    state.tabs.push(tab);
    onTabAdded?.(tab);

    if (activate) {
      setActiveTab(tab.id);
    } else {
      render();
    }

    return tab;
  }

  function setActiveTab(tabId) {
    if (!state.tabs.some((tab) => tab.id === tabId)) return;

    state.activeTabId = tabId;
    state.editingTabId = null;
    render();

    const activeTab = state.tabs.find((tab) => tab.id === tabId);
    onTabChange?.(activeTab);
  }

  function beginRename(tabId) {
    if (!state.tabs.some((tab) => tab.id === tabId)) return;

    state.activeTabId = tabId;
    state.editingTabId = tabId;
    render();

    const input = tabListEl.querySelector(
      `[data-tab-input="${escapeCssValue(tabId)}"]`,
    );
    input?.focus();
    input?.select();
  }

  function closeTab(tabId) {
    const closedIndex = state.tabs.findIndex((tab) => tab.id === tabId);
    if (closedIndex < 0) return;

    const [closedTab] = state.tabs.splice(closedIndex, 1);
    const wasActive = closedTab.id === state.activeTabId;
    closedTab.paneEl.remove();
    onTabClosed?.(closedTab);

    if (state.editingTabId === closedTab.id) state.editingTabId = null;

    if (!state.tabs.length) {
      state.activeTabId = null;
      render();
      onTabChange?.(null);
      return;
    }

    if (wasActive) {
      const nextIndex = Math.min(closedIndex, state.tabs.length - 1);
      state.activeTabId = state.tabs[nextIndex].id;
      render();
      onTabChange?.(state.tabs[nextIndex]);
      focusTab(state.activeTabId);
      return;
    }

    render();
  }

  function clearTabs() {
    if (!state.tabs.length) return;

    const closedTabs = [...state.tabs];
    state.tabs = [];
    state.activeTabId = null;
    state.editingTabId = null;

    closedTabs.forEach((tab) => {
      tab.paneEl.remove();
      onTabClosed?.(tab);
    });

    render();
    onTabChange?.(null);
  }

  function renameTab(tabId, title) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab) return;

    const nextTitle = normalizeTitle(title, tab.title);
    const didChange = tab.title !== nextTitle;
    tab.title = nextTitle;
    tab.paneEl.dataset.tabTitle = tab.title;
    state.editingTabId = null;
    render();
    if (didChange) onTabRenamed?.(tab);
  }

  function render() {
    tabListEl.replaceChildren(
      ...state.tabs.map((tab) => createTabItem(tab)),
    );

    state.tabs.forEach((tab) => {
      const selected = tab.id === state.activeTabId;
      const tabButtonId = getTabButtonId(tab.id);
      tab.paneEl.hidden = !selected;
      tab.paneEl.classList.add("app-tab-pane");
      tab.paneEl.setAttribute("role", "tabpanel");
      tab.paneEl.setAttribute("aria-labelledby", tabButtonId);
    });
  }

  function createTabItem(tab) {
    const selected = tab.id === state.activeTabId;
    const isEditing = tab.id === state.editingTabId;
    const item = document.createElement("div");
    item.className = [
      "authoring-tab-item",
      selected ? "is-active" : "",
      isEditing ? "is-editing" : "",
    ]
      .filter(Boolean)
      .join(" ");
    item.dataset.tabItem = tab.id;

    let labelControl;

    if (isEditing) {
      labelControl = createTabNameInput(tab);
    } else {
      labelControl = createTabButton(tab, selected);
    }

    const closeButton = document.createElement("button");
    closeButton.className = "authoring-tab-close";
    closeButton.type = "button";
    closeButton.textContent = "x";
    closeButton.setAttribute("aria-label", `Close ${tab.title}`);
    closeButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeTab(tab.id);
    });

    item.append(labelControl, closeButton);
    return item;
  }

  function createTabButton(tab, selected) {
    const button = document.createElement("button");
    button.className = "authoring-tab-button";
    button.type = "button";
    button.id = getTabButtonId(tab.id);
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", tab.id);
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
    button.dataset.tabId = tab.id;

    button.addEventListener("click", () => setActiveTab(tab.id));
    button.addEventListener("dblclick", () => beginRename(tab.id));
    button.addEventListener("keydown", (event) => {
      handleTabKeydown(event, tab.id);
    });

    const title = document.createElement("span");
    title.className = "authoring-tab-title";
    title.textContent = tab.title;
    button.appendChild(title);
    return button;
  }

  function createTabNameInput(tab) {
    const input = document.createElement("input");
    input.className = "authoring-tab-input";
    input.dataset.tabInput = tab.id;
    input.id = getTabButtonId(tab.id);
    input.maxLength = TAB_TITLE_LIMIT;
    input.value = tab.title;
    input.setAttribute("aria-label", "Tab name");
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("dblclick", (event) => event.stopPropagation());
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        renameTab(tab.id, input.value);
      }

      if (event.key === "Escape") {
        event.preventDefault();
        state.editingTabId = null;
        render();
        document.getElementById(getTabButtonId(tab.id))?.focus();
      }
    });
    input.addEventListener("blur", () => renameTab(tab.id, input.value));
    return input;
  }

  function handleTabKeydown(event, tabId) {
    const currentIndex = state.tabs.findIndex((tab) => tab.id === tabId);
    if (currentIndex < 0) return;

    if (event.key === "F2") {
      event.preventDefault();
      beginRename(tabId);
      return;
    }

    const keyDirections = {
      ArrowLeft: -1,
      ArrowUp: -1,
      ArrowRight: 1,
      ArrowDown: 1,
    };
    const direction = keyDirections[event.key];
    if (!direction) return;

    event.preventDefault();
    const nextIndex =
      (currentIndex + direction + state.tabs.length) % state.tabs.length;
    setActiveTab(state.tabs[nextIndex].id);
    document.getElementById(getTabButtonId(state.activeTabId))?.focus();
  }
}

function focusTab(tabId) {
  window.requestAnimationFrame?.(() => {
    document.getElementById(getTabButtonId(tabId))?.focus();
  });
}

function discoverTabs(panelsEl) {
  return Array.from(panelsEl.children)
    .filter((paneEl) => paneEl instanceof HTMLElement)
    .map((paneEl, index) => {
      if (!paneEl.id) paneEl.id = `authoring-tab-panel-${index + 1}`;

      return {
        id: paneEl.id,
        paneEl,
        title: normalizeTitle(
          paneEl.dataset.tabTitle,
          `${DEFAULT_TAB_NAME} ${index + 1}`,
        ),
      };
    });
}

function createCustomTab(panelsEl, state, createPanel, { title } = {}) {
  state.customTabSeq += 1;

  const tabTitle = normalizeTitle(
    title,
    `${DEFAULT_TAB_NAME} ${state.tabs.length + 1}`,
  );
  const id = `authoring-workspace-${Date.now()}-${state.customTabSeq}`;
  const paneEl =
    createPanel?.({
      id,
      index: state.tabs.length,
      title: tabTitle,
    }) ?? createEmptyPanel(id, tabTitle);

  if (!paneEl.id) paneEl.id = id;
  paneEl.dataset.tabTitle = normalizeTitle(paneEl.dataset.tabTitle, tabTitle);
  panelsEl.appendChild(paneEl);

  return {
    id: paneEl.id,
    paneEl,
    title: paneEl.dataset.tabTitle,
  };
}

function createEmptyPanel(id, title) {
  const paneEl = document.createElement("section");
  paneEl.id = id;
  paneEl.className = "app-tab-pane authoring-empty-tab";
  paneEl.dataset.tabTitle = title;

  const empty = document.createElement("div");
  empty.className = "authoring-empty-tab-content";
  empty.setAttribute("role", "status");
  empty.textContent = "Empty view";

  paneEl.appendChild(empty);
  return paneEl;
}

function normalizeTitle(title, fallback = DEFAULT_TAB_NAME) {
  const normalized = String(title ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TAB_TITLE_LIMIT);

  return normalized || fallback || DEFAULT_TAB_NAME;
}

function getTabButtonId(tabId) {
  return `${tabId}-tab`;
}

function escapeCssValue(value) {
  if (window.CSS?.escape) return CSS.escape(value);

  return String(value).replace(/["\\]/g, "\\$&");
}
