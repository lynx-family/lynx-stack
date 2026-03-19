// Demonstrates: __QuerySelector, __InvokeUIMethod("boundingClientRect")
//
// __QuerySelector finds elements by CSS selector within a subtree.
// __InvokeUIMethod calls a UI method on an element — here we use
// "boundingClientRect" to measure an element's layout position and size.

globalThis.renderPage = function renderPage() {
  const page = __CreatePage('page', 0);
  const container = __CreateView(0);
  __AppendElement(page, container);
  __SetInlineStyles(container, 'padding:40px; align-items:center;');

  const title = __CreateText(0);
  __AppendElement(container, title);
  __AppendElement(title, __CreateRawText('SelectorQuery & Measurement'));
  __SetInlineStyles(title, 'font-size:18px; font-weight:700;');

  // Create a box with an ID so we can query it
  const box = __CreateView(0);
  __AppendElement(container, box);
  __SetID(box, 'measure-target');
  __SetInlineStyles(
    box,
    'width:200px; height:100px; background-color:#22c55e; border-radius:12px; margin-top:20px; align-items:center; justify-content:center;',
  );

  const boxLabel = __CreateText(0);
  __AppendElement(box, boxLabel);
  __AppendElement(boxLabel, __CreateRawText('Measure me'));
  __SetInlineStyles(boxLabel, 'color:#fff; font-size:15px; font-weight:600;');

  // Result display
  const resultText = __CreateText(0);
  const resultRaw = __CreateRawText('Measuring...');
  __AppendElement(container, resultText);
  __AppendElement(resultText, resultRaw);
  __SetInlineStyles(
    resultText,
    'font-size:12px; font-family:monospace; color:#555; margin-top:16px;',
  );

  __FlushElementTree();

  // After layout, query and measure
  setTimeout(() => {
    // __QuerySelector — find element by CSS selector
    const found = __QuerySelector(page, '#measure-target');
    if (found) {
      // __InvokeUIMethod — call "boundingClientRect" to measure layout
      __InvokeUIMethod(found, 'boundingClientRect', {}, (result) => {
        if (result.code === 0) {
          const r = result.data;
          __SetAttribute(
            resultRaw,
            'text',
            'boundingClientRect:\n'
              + '  width:  ' + r.width.toFixed(0) + 'px\n'
              + '  height: ' + r.height.toFixed(0) + 'px\n'
              + '  top:    ' + r.top.toFixed(0) + 'px\n'
              + '  left:   ' + r.left.toFixed(0) + 'px',
          );
          __FlushElementTree();
        }
      });
    }
  }, 100);
};
