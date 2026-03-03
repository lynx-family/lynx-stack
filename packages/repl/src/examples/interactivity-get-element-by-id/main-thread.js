// Demonstrates: __SetID + __QuerySelector for ID-based element lookup
//
// Assign IDs to elements with __SetID, then find them at any time
// using __QuerySelector with "#id" syntax — similar to
// document.getElementById in the browser DOM.

globalThis.renderPage = function renderPage() {
  const page = __CreatePage('page', 0);
  const container = __CreateView(0);
  __AppendElement(page, container);
  __SetInlineStyles(container, 'padding:40px; align-items:center;');

  const title = __CreateText(0);
  __AppendElement(container, title);
  __AppendElement(title, __CreateRawText('getElementById'));
  __SetInlineStyles(title, 'font-size:18px; font-weight:700;');

  // Create colored boxes with unique IDs
  const boxes = [
    { id: 'box-red', color: '#ef4444', label: 'Red' },
    { id: 'box-green', color: '#22c55e', label: 'Green' },
    { id: 'box-blue', color: '#3b82f6', label: 'Blue' },
  ];

  for (const { id, color, label } of boxes) {
    const box = __CreateView(0);
    __AppendElement(container, box);
    __SetID(box, id);
    __SetInlineStyles(
      box,
      'width:180px; height:50px; background-color:' + color
        + '; border-radius:8px; margin-top:10px; align-items:center; justify-content:center;',
    );

    const text = __CreateText(0);
    __AppendElement(box, text);
    __AppendElement(text, __CreateRawText(label + '  (id="' + id + '")'));
    __SetInlineStyles(text, 'color:#fff; font-size:13px; font-weight:600;');
  }

  // Result display
  const resultText = __CreateText(0);
  const resultRaw = __CreateRawText('Looking up elements by ID...');
  __AppendElement(container, resultText);
  __AppendElement(resultText, resultRaw);
  __SetInlineStyles(
    resultText,
    'font-size:12px; font-family:monospace; color:#555; margin-top:20px;',
  );

  __FlushElementTree();

  // After layout, query each element by its ID
  setTimeout(() => {
    const results = [];
    for (const { id } of boxes) {
      // __QuerySelector with "#id" — equivalent to getElementById
      const el = __QuerySelector(page, '#' + id);
      results.push(id + ': ' + (el ? 'found' : 'not found'));
    }
    __SetAttribute(resultRaw, 'text', results.join('\n'));
    __FlushElementTree();
  }, 100);
};
