function returnMapElementInfo(el) {
  return {
    tag: el.tagName,
    id: el.id || null,
    class: el.className || null,
    text: (el.innerText || "").slice(0, 50),
  };
}

