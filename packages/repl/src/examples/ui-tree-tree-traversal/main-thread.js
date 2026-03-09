// Demonstrates: __FirstElement, __NextElement, __LastElement,
//               __GetElementUniqueID, __GetTag
//
// These let you walk the element tree and inspect elements.
// A framework reconciler uses these to find siblings, read identity, etc.

globalThis.renderPage = function renderPage() {
  const page = __CreatePage('page', 0);
  const container = __CreateView(0);
  __AppendElement(page, container);
  __SetInlineStyles(container, 'padding:40px;');

  // Build a small tree to traverse
  const tags = ['view', 'text', 'image'];
  for (const tag of tags) {
    const el = __CreateElement(tag, 0);
    __AppendElement(container, el);
    __SetInlineStyles(
      el,
      'padding:8px; margin-top:4px; background-color:#f0f0f0; border-radius:4px;',
    );
    if (tag === 'text') {
      __AppendElement(el, __CreateRawText('I am a <text>'));
    }
  }
  __FlushElementTree();

  // Now traverse and display results
  const results = __CreateView(0);
  __AppendElement(page, results);
  __SetInlineStyles(results, 'padding:20px 40px;');

  function addLine(str) {
    const t = __CreateText(0);
    __AppendElement(t, __CreateRawText(str));
    __AppendElement(results, t);
    __SetInlineStyles(
      t,
      'font-size:13px; font-family:monospace; margin-top:4px;',
    );
  }

  addLine('--- Walking with __FirstElement / __NextElement ---');

  // __FirstElement — get first child
  let current = __FirstElement(container);
  while (current) {
    const tag = __GetTag(current);
    const uid = __GetElementUniqueID(current);
    addLine('tag: ' + tag + '  uniqueID: ' + uid);
    // __NextElement — get next sibling
    current = __NextElement(current);
  }

  // __LastElement — get last child
  const last = __LastElement(container);
  if (last) {
    addLine('--- __LastElement ---');
    addLine('last child tag: ' + __GetTag(last));
  }

  __FlushElementTree();
};
