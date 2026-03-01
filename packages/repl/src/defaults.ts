export const defaultBackground = `\
// background.js — runs in the background thread (Web Worker)
// Keep non-UI logic here (e.g. data processing, module logic).
// For web preview, render Element PAPI code from main-thread.js.
`;

export const defaultMainThread = `\
// main-thread.js — runs on the main thread (Lepus context)
// Define renderPage and build the UI tree with Element PAPIs.
// Use __AddClass to apply CSS classes defined in index.css.
globalThis.renderPage = function renderPage() {
  const page = __CreatePage("page", 0);
  const bg = __CreateElement("view", 0);
  const view = __CreateElement("view", 0);
  const text = __CreateElement("text", 0);
  const rawText = __CreateRawText("Hello from Lynx REPL!");

  __AppendElement(page, bg);
  __AppendElement(page, view);
  __AppendElement(view, text);
  __AppendElement(text, rawText);

  // Apply CSS class from index.css
  __AddClass(bg, "Background");

  __AddInlineStyle(view, "background-color", "#f5f7fb");
  __AddInlineStyle(view, "padding", "20px");
  __AddInlineStyle(view, "align-items", "center");
  __AddInlineStyle(view, "justify-content", "center");
  __AddInlineStyle(view, "height", "100%");
  __AddInlineStyle(view, "border", "1px solid #d8dee8");

  __AddInlineStyle(text, "font-size", "24px");
  __AddInlineStyle(text, "color", "#333");
  __AddInlineStyle(text, "font-weight", "500");

  __FlushElementTree();
};
`;

export const defaultCSS = `\
:root {
  --gradient-end: #ff6448;
}

.Background {
  position: fixed;
  background: radial-gradient(
    71.43% 62.3% at 46.43% 36.43%,
    rgba(18, 229, 229, 0) 15%,
    rgba(239, 155, 255, 0.3) 56.35%,
    var(--gradient-end) 100%
  );
  box-shadow: 0px 12.93px 28.74px 0px #ffd28db2 inset;
  border-radius: 50%;
  width: 200%;
  height: 200%;
  top: -60%;
  left: -14.27%;
  transform: rotate(15.25deg);
}
`;
