// Demonstrates the complete Page Lifecycle:
//
//   processData      — transform raw data before renderPage/updatePage
//   renderPage       — build the initial UI (called once)
//   __OnLifecycleEvent — signal render milestones back to the background
//   updatePage       — update the UI when new data arrives
//
// Data flow:
//   background sends data → processData → renderPage / updatePage
//                         → __OnLifecycleEvent → background observes

let phaseText, counterText;

// processData — runs before renderPage and updatePage.
// Adds a processedAt timestamp to prove it was invoked.
globalThis.processData = function processData(data) {
  return { ...data, processedAt: Date.now() };
};

// renderPage — called once on startup.
globalThis.renderPage = function renderPage(data) {
  const page = __CreatePage('page', 0);
  const container = __CreateView(0);
  __AppendElement(page, container);
  __SetInlineStyles(container, 'padding:40px; align-items:center;');

  const title = __CreateText(0);
  __AppendElement(container, title);
  __AppendElement(title, __CreateRawText('Page Lifecycle'));
  __SetInlineStyles(title, 'font-size:18px; font-weight:700;');

  phaseText = __CreateText(0);
  __AppendElement(container, phaseText);
  __AppendElement(phaseText, __CreateRawText('phase: renderPage'));
  __SetInlineStyles(
    phaseText,
    'font-size:12px; font-family:monospace; color:#888; margin-top:8px;',
  );

  counterText = __CreateText(0);
  __AppendElement(container, counterText);
  __AppendElement(counterText, __CreateRawText('waiting for updates…'));
  __SetInlineStyles(
    counterText,
    'font-size:14px; color:#666; margin-top:12px;',
  );

  __FlushElementTree();

  // Signal to the runtime that the first screen render is complete.
  // React-Lynx calls this automatically after hydration — here we call it manually.
  __OnLifecycleEvent({ type: 'firstScreen' });

  // In the REPL, background.js drives updates via a cross-thread event.
  // In a real Lynx app, the platform triggers this via LynxView.updateData().
  lynx.getJSContext().addEventListener('updateData', (event) => {
    const processed = globalThis.processData
      ? globalThis.processData(event.data)
      : event.data;
    globalThis.updatePage(processed);
  });
};

// updatePage — called on each data-driven update.
globalThis.updatePage = function updatePage(data) {
  if (!counterText) return;

  const phaseChild = __FirstElement(phaseText);
  if (phaseChild) __SetAttribute(phaseChild, 'text', 'phase: updatePage');

  const child = __FirstElement(counterText);
  if (child) {
    __SetAttribute(
      child,
      'text',
      'count: ' + data.count + '  ·  processedAt: ' + data.processedAt,
    );
  }

  __FlushElementTree();

  // Signal that this update cycle is complete.
  __OnLifecycleEvent({ type: 'dataUpdate', count: data.count });
};
