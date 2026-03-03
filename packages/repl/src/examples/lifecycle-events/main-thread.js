// Demonstrates: __OnLifecycleEvent, __GetPageElement
//
// __OnLifecycleEvent dispatches lifecycle signals to the runtime.
// Frameworks use this to notify the engine of lifecycle milestones
// (e.g., "jsReady" — the initial render is complete).
//
// __GetPageElement returns the root page element after renderPage.

globalThis.renderPage = function renderPage() {
  const page = __CreatePage('page', 0);
  const container = __CreateView(0);
  __AppendElement(page, container);
  __SetInlineStyles(container, 'padding:40px;');

  const title = __CreateText(0);
  __AppendElement(container, title);
  __AppendElement(title, __CreateRawText('Lifecycle Events'));
  __SetInlineStyles(title, 'font-size:18px; font-weight:700;');

  const output = __CreateView(0);
  __AppendElement(container, output);
  __SetInlineStyles(output, 'margin-top:16px;');

  function addLine(str) {
    const t = __CreateText(0);
    __AppendElement(t, __CreateRawText(str));
    __AppendElement(output, t);
    __SetInlineStyles(
      t,
      'font-size:12px; font-family:monospace; margin-top:4px;',
    );
  }

  // __GetPageElement — retrieve the root page element
  const pageEl = __GetPageElement();
  addLine('__GetPageElement(): ' + (pageEl ? 'exists' : 'null'));
  addLine('Same as page? ' + (pageEl === page));

  // __OnLifecycleEvent — dispatch a lifecycle signal
  // React-Lynx dispatches these for: jsReady, firstScreen, etc.
  addLine('');
  addLine('Dispatching __OnLifecycleEvent...');

  __FlushElementTree();

  // In the web platform, __OnLifecycleEvent sends a cross-thread event
  // of type "__OnLifecycleEvent" to the background thread.
  __OnLifecycleEvent({ type: 'FirstScreen', timestamp: Date.now() });

  addLine('Dispatched: { type: \'FirstScreen\' }');
  __FlushElementTree();
};
