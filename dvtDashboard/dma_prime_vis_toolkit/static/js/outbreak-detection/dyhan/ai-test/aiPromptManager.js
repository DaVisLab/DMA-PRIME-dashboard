import { makeAction4GeneralRequest } from "./actions4GeneralRequest.js";
import { makeAction4VisRequest } from "./actions4VisRequest.js";
import { makeAction4InsightRequestFromDataPrompt } from "./actions4InsightRequestPrompt.js";

document.getElementById("ai-send-btn").addEventListener("click", async () => {
  const userInput = document.getElementById("ai-prompt-input").value;

  const encoded = encodeURIComponent(userInput);
  // const url = `/ai?prompt=${encoded}`;

  console.log("User Input:", userInput);
  try {
    // const resp = await fetch(url, {
    //   method: "GET",
    //   credentials: "same-origin", // send cookies for @login_required
    //   headers: {
    //     Accept: "application/json",
    //   },
    // });

    const resp = await fetch("/ai", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ prompt: userInput }),
    });

    let responseEl = document.getElementById("ai-response");
    if (!resp.ok) {
      const txt = await resp.text();

      responseEl.innerText = `Server error: ${resp.status} ${txt}`;
      return;
    }

    const data = await resp.json();

    console.log(data);
    // // Example response handling: show latest reply and append to conversation history
    const aiReply = data.response || JSON.stringify(data);
    const promptType = data.prompt_type;

    switch (promptType) {
      case "GeneralRequest":
        makeAction4GeneralRequest(aiReply);
        break;
      case "VisRequest":
        console.log(
          "vis request: make action4VisRequest with data and userInput"
        );
        makeAction4VisRequest(userInput);
        break;
      case "InsightRequestFromVis":
        console.log(
          "insight request: make action4InsightRequestFromVisPrompt with userInput"
        );
        break;
      case "InsightRequestFromData":
        console.log(
          "insight request: make action4InsightRequestFromDataPrompt with userInput"
        );
        makeAction4InsightRequestFromDataPrompt(userInput);
        break;

      default:
        makeAction4GeneralRequest(aiReply);
        break;
    }
    // const userEntry = document.createElement("div");
    // userEntry.className = "ai-history-item";
    // userEntry.innerHTML = `<strong>You:</strong> ${escapeHtml(promptText)}`;
    // convoEl.appendChild(userEntry);

    // const aiEntry = document.createElement("div");
    // aiEntry.className = "ai-history-item";
    // aiEntry.innerHTML = `<strong>AI:</strong> ${escapeHtml(aiReply)}`;
    // convoEl.appendChild(aiEntry);

    // // scroll to bottom
    // convoEl.scrollTop = convoEl.scrollHeight;
  } catch (err) {
    // responseEl.innerText = `Request failed: ${err.message}`;
  }
});
