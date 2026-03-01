// Demonstrates: renderPage, updatePage, processData
//
// renderPage(data) — called once on startup with initial data.
// updatePage(data) — called when new data arrives from the background.
// processData(data) — optional pre-processor, runs before renderPage/updatePage.
//
// This is the core data-driven rendering lifecycle.

let counterText;
let container;

// processData — transform data before it reaches render/update
globalThis.processData = function processData(data) {
  // Add a timestamp to every data payload
  return { ...data, processedAt: Date.now() };
};

// renderPage — initial render
globalThis.renderPage = function renderPage(data) {
  const page = __CreatePage("page", 0);
  container = __CreateView(0);
  __AppendElement(page, container);
  __SetInlineStyles(container, "padding:40px; align-items:center;");

  const title = __CreateText(0);
  __AppendElement(container, title);
  __AppendElement(title, __CreateRawText("Render Lifecycle"));
  __SetInlineStyles(title, "font-size:18px; font-weight:700;");

  counterText = __CreateText(0);
  const raw = __CreateRawText("renderPage called. Waiting for updates...");
  __AppendElement(container, counterText);
  __AppendElement(counterText, raw);
  __SetInlineStyles(counterText, "font-size:14px; color:#666; margin-top:12px;");

  __FlushElementTree();
};

// updatePage — subsequent data updates
globalThis.updatePage = function updatePage(data) {
  if (counterText) {
    const firstChild = __FirstElement(counterText);
    if (firstChild) {
      __SetAttribute(firstChild, "text", "updatePage #" + data.count);
    }
    __FlushElementTree();
  }
};
