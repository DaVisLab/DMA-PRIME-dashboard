document.getElementById("ai-send-btn").addEventListener("click", async () => {
  const userInput = document.getElementById("ai-prompt-input").value;

  const encoded = encodeURIComponent(userInput);
  const url = `/ai/${encoded}`;

  console.log("User Input:", userInput);
  try {
    const resp = await fetch(url, {
      method: "GET",
      credentials: "same-origin", // send cookies for @login_required
      headers: {
        Accept: "application/json",
      },
    });

    let responseEl = document.getElementById("ai-response");
    if (!resp.ok) {
      const txt = await resp.text();
      
      responseEl.innerText = `Server error: ${resp.status} ${txt}`;
      return;
    }

    const data = await resp.json();

    console.log(data)
    // // Example response handling: show latest reply and append to conversation history
    const aiReply = data.response || JSON.stringify(data);

    console.log(aiReply)
    responseEl.innerText = aiReply;

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
