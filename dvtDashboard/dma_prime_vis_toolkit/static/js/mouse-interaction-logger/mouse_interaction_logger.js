let queue = [];

async function keepUserInteractionLog(type, data) {
  console.log(data);
  //   if (data.tag !== "svg") {
  //     return;
  //   }
  if (data == null) {
    return;
  }

  queue.push({ type, data, time: Date.now() });

  const resp = await fetch("/recommendation/save_user_logs", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      queue: queue,
    }),
  });

  const resp2 = await fetch("/recommendation/get_recommendation", {
    method: "GET",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });
  
  const ttt = await resp2.json();
  console.log(ttt);

  console.log(queue);
}

// setInterval(() => {
//   if (queue.length === 0) return;

//   fetch("/log", {
//     method: "POST",
//     headers: {"Content-Type": "application/json"},
//     body: JSON.stringify(queue)
//   });

//   queue = [];
// }, 3000);

function getElementInfo(el) {
  while (el && !el.id) {
    el = el.parentElement;
  }

  return el ? el.id : null;
}

document.addEventListener("click", (e) => {
  const el = document.elementFromPoint(e.clientX, e.clientY);

  const id = getElementInfo(el);

  keepUserInteractionLog("click", describe(el));
});

const THRESHOLD = 2000; // n초 (2초)

let currentEl = null;
let timer = null;

function isVisualizationElement(el) {
  return el?.closest?.("svg");
}

function describe(el) {
  while (el && el !== document.body) {
    if (isVisualizationElement(el) && el.id) {
      return {
        tag: el.tagName,
        id: el.id,
        el,
      };
    }
    el = el.parentElement;
  }

  return null;
}

document.addEventListener("pointermove", (e) => {
  const el = document.elementFromPoint(e.clientX, e.clientY);

  if (el === currentEl) return;

  clearTimeout(timer);

  currentEl = el;

  if (!el) return;

  timer = setTimeout(() => {
    keepUserInteractionLog("hover_n_sec", describe(el));
  }, THRESHOLD);
});
