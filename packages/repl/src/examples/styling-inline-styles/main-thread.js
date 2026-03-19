// Demonstrates: __AddInlineStyle (single) vs __SetInlineStyles (batch)
//
// __AddInlineStyle sets one property at a time.
// __SetInlineStyles sets multiple properties in one call (more efficient).

globalThis.renderPage = function renderPage() {
  const page = __CreatePage('page', 0);
  const container = __CreateView(0);
  __AppendElement(page, container);
  __SetInlineStyles(container, 'padding:40px; align-items:center;');

  // Using __AddInlineStyle — one property at a time
  const box1 = __CreateView(0);
  __AppendElement(container, box1);
  __AddInlineStyle(box1, 'width', '200px');
  __AddInlineStyle(box1, 'height', '60px');
  __AddInlineStyle(box1, 'background-color', '#3b82f6');
  __AddInlineStyle(box1, 'border-radius', '8px');
  __AddInlineStyle(box1, 'align-items', 'center');
  __AddInlineStyle(box1, 'justify-content', 'center');
  const label1 = __CreateText(0);
  __AppendElement(box1, label1);
  __AppendElement(label1, __CreateRawText('__AddInlineStyle'));
  __AddInlineStyle(label1, 'color', '#fff');
  __AddInlineStyle(label1, 'font-size', '13px');

  // Using __SetInlineStyles — batch string
  const box2 = __CreateView(0);
  __AppendElement(container, box2);
  __SetInlineStyles(
    box2,
    'width:200px; height:60px; background-color:#8b5cf6; border-radius:8px; margin-top:12px; align-items:center; justify-content:center;',
  );
  const label2 = __CreateText(0);
  __AppendElement(box2, label2);
  __AppendElement(label2, __CreateRawText('__SetInlineStyles'));
  __SetInlineStyles(label2, 'color:#fff; font-size:13px;');

  // Updating styles after initial render
  __FlushElementTree();

  setTimeout(() => {
    __SetInlineStyles(
      box1,
      'width:200px; height:60px; background-color:#ef4444; border-radius:8px; align-items:center; justify-content:center;',
    );
    __SetInlineStyles(
      box2,
      'width:200px; height:60px; background-color:#10b981; border-radius:8px; margin-top:12px; align-items:center; justify-content:center;',
    );
    __FlushElementTree();
  }, 2000);
};
