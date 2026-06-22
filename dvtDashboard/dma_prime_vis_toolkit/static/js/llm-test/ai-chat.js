const widget = document.getElementById("llm-ai-chat-widget");
const panel = document.getElementById("llm-ai-chat-panel");
const toggleButton = document.getElementById("llm-ai-chat-toggle");
const closeButton = document.getElementById("llm-ai-chat-close");
const form = document.getElementById("llm-ai-chat-form");
const input = document.getElementById("llm-ai-chat-input");
const sendButton = form?.querySelector("button[type='submit']");
const messages = document.getElementById("llm-ai-chat-messages");
const contextLabel = document.getElementById("llm-ai-chat-context");
const promptButtons = widget?.querySelectorAll(".llm-ai-chat-prompts button") || [];
const navBar = document.getElementById("nav-bar");
const chatHistory = [];

const viewLabels = {
  respiratory: "Respiratory View",
  "outbreak-detection": "Outbreak View",
  kg: "KG View",
};

function setOpen(isOpen) {
  if (!panel || !toggleButton) return;

  panel.hidden = !isOpen;
  toggleButton.setAttribute("aria-expanded", String(isOpen));
  toggleButton.setAttribute("aria-label", isOpen ? "Close AI chat" : "Open AI chat");

  if (isOpen) {
    requestAnimationFrame(() => input?.focus());
  } else {
    toggleButton.focus();
  }
}

function addMessage(text, owner = "user") {
  if (!messages || !text.trim()) return;

  const message = document.createElement("div");
  message.className = `llm-ai-chat-message llm-ai-chat-message--${owner}`;

  if (owner === "assistant") {
    const avatar = document.createElement("div");
    avatar.className = "llm-ai-chat-message-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.innerHTML = '<sl-icon name="stars"></sl-icon>';
    message.append(avatar);
  }

  const bubble = document.createElement("div");
  bubble.className = "llm-ai-chat-message-bubble";
  bubble.textContent = text.trim();
  message.append(bubble);

  messages.append(message);
  messages.scrollTop = messages.scrollHeight;

  return { message, bubble };
}

function autosizeInput() {
  if (!input) return;

  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
}

function syncContextLabel(panelName) {
  if (!contextLabel) return;

  const selectedPanel = panelName || getActivePanelName();
  contextLabel.textContent = viewLabels[selectedPanel] || "LLM Test";
}

function getActivePanelName() {
  const activeTab = navBar?.querySelector("sl-tab[active]");
  return activeTab?.getAttribute("panel") || activeTab?.panel || "llm-test";
}

function getControlValue(control) {
  if ("checked" in control) {
    return Boolean(control.checked);
  }

  if ("value" in control) {
    return control.value;
  }

  return control.getAttribute("value") || "";
}

function collectInterfaceContext() {
  const view = getActivePanelName();
  const panelElement = document.getElementById(`${view}-panel`);
  const controls = panelElement
    ? Array.from(
        panelElement.querySelectorAll(
          "sl-select, sl-radio-group, sl-checkbox, sl-radio-button",
        ),
      ).slice(0, 50)
    : [];

  return {
    view,
    controls: controls.map((control) => ({
      id: control.id || "",
      tag: control.tagName.toLowerCase(),
      label: control.textContent.trim().replace(/\s+/g, " ").slice(0, 160),
      value: getControlValue(control),
      disabled: Boolean(control.disabled),
    })),
  };
}

function setBusy(isBusy) {
  if (input) input.disabled = isBusy;
  if (sendButton) sendButton.disabled = isBusy;
}

async function requestAssistantResponse(message, history) {
  const context = collectInterfaceContext();
  const response = await fetch("/ai/llm_test_chat", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      history,
      view: context.view,
      interfaceContext: context,
    }),
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(payload.error || "AI request failed.");
  }

  return payload.response || "";
}

toggleButton?.addEventListener("click", () => {
  setOpen(panel?.hidden);
});

closeButton?.addEventListener("click", () => {
  setOpen(false);
});

input?.addEventListener("input", autosizeInput);

input?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form?.requestSubmit();
  }
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = input?.value || "";

  if (!message.trim()) return;

  const historyForRequest = chatHistory.slice(-12);
  addMessage(message);
  chatHistory.push({ role: "user", content: message.trim() });
  input.value = "";
  autosizeInput();
  setBusy(true);

  const pending = addMessage("Thinking...", "assistant");
  pending?.message.classList.add("llm-ai-chat-message--pending");

  try {
    const answer = await requestAssistantResponse(message, historyForRequest);
    const safeAnswer = answer || "No response was returned.";
    pending.bubble.textContent = safeAnswer;
    pending.message.classList.remove("llm-ai-chat-message--pending");
    chatHistory.push({ role: "assistant", content: safeAnswer });
  } catch (error) {
    pending.bubble.textContent =
      error.message || "The AI service is unavailable right now.";
    pending.message.classList.remove("llm-ai-chat-message--pending");
    pending.message.classList.add("llm-ai-chat-message--error");
  } finally {
    setBusy(false);
    input?.focus();
  }
});

promptButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (!input) return;

    input.value = button.textContent?.trim() || "";
    autosizeInput();
    input.focus();
  });
});

navBar?.addEventListener("sl-tab-show", (event) => {
  syncContextLabel(event.detail?.name);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !panel?.hidden) {
    setOpen(false);
  }
});

syncContextLabel();
