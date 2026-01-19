export async function makeAction4GeneralRequest(
  userInput,
  selectorDOMElements
) {
  const aiResp = await getAIGeneralResponse(userInput, selectorDOMElements);

  console.log(aiResp)
  presentAIResponse(aiResp);
}

async function getAIGeneralResponse(userInput, selectorDOMElements) {
  const encoded = encodeURIComponent(userInput);
  const responseEl = document.getElementById("ai-response");

  try {
    const resp = await fetch("/ai/general_request", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        prompt: encoded,
        interfaceContext: selectorDOMElements,
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      if (responseEl)
        responseEl.innerText = `Server error: ${resp.status} ${txt}`;
      return;
    }

    const data = await resp.json();
    console.log(data);

    // data.response might already be an object; handle both safely
    const aiResp = JSON.parse(data.response);

    console.log(aiResp);
    
    return aiResp;

  } catch (err) {
    console.error(err);
    if (responseEl) {
      responseEl.innerText =
        err instanceof Error
          ? `Client error: ${err.message}`
          : `Client error: ${String(err)}`;
    }
  }
}
function presentAIResponse(response) {
  let responseEl = document.getElementById("ai-response");
  responseEl.innerHTML = response;

}
