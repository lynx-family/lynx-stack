// Demonstrates: fetch API + cross-thread rendering
//
// The background thread uses globalThis.fetch() to load remote data,
// then sends it to the main thread for rendering via
// cross-thread events.

globalThis.renderPage = function renderPage() {
  const page = __CreatePage('page', 0);
  const container = __CreateView(0);
  __AppendElement(page, container);
  __SetInlineStyles(container, 'padding:40px; align-items:center;');

  const title = __CreateText(0);
  __AppendElement(container, title);
  __AppendElement(title, __CreateRawText('Fetch API'));
  __SetInlineStyles(title, 'font-size:18px; font-weight:700;');

  const statusText = __CreateText(0);
  const statusRaw = __CreateRawText('Fetching data from background thread...');
  __AppendElement(container, statusText);
  __AppendElement(statusText, statusRaw);
  __SetInlineStyles(statusText, 'font-size:13px; color:#888; margin-top:16px;');

  const resultBox = __CreateView(0);
  __AppendElement(container, resultBox);
  __SetInlineStyles(
    resultBox,
    'margin-top:12px; background-color:#f1f5f9; padding:16px; border-radius:8px; width:280px;',
  );

  const resultText = __CreateText(0);
  const resultRaw = __CreateRawText('...');
  __AppendElement(resultBox, resultText);
  __AppendElement(resultText, resultRaw);
  __SetInlineStyles(
    resultText,
    'font-size:12px; font-family:monospace; color:#333;',
  );

  __FlushElementTree();

  // Listen for the fetch result from background thread
  lynx.getJSContext().addEventListener('fetchResult', (event) => {
    const d = event.data;
    if (d.success) {
      __SetAttribute(statusRaw, 'text', 'Fetch succeeded!');
      __SetAttribute(resultRaw, 'text', JSON.stringify(d.payload, null, 2));
    } else {
      __SetAttribute(statusRaw, 'text', 'Fetch failed: ' + d.error);
    }
    __FlushElementTree();
  });
};
