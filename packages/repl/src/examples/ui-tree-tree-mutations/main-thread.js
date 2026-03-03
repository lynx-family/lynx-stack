// Demonstrates: __InsertElementBefore, __RemoveElement, __ReplaceElement
//
// These are the 3 reconciler primitives. Any VDOM diffing algorithm
// (React, Vue, Solid) emits these operations to update the tree.

globalThis.renderPage = function renderPage() {
  const page = __CreatePage('page', 0);
  const container = __CreateView(0);
  __AppendElement(page, container);
  __SetInlineStyles(container, 'padding:40px; align-items:center;');

  function createItem(label, color) {
    const item = __CreateView(0);
    const text = __CreateText(0);
    __AppendElement(item, text);
    __AppendElement(text, __CreateRawText(label));
    __SetInlineStyles(
      item,
      'background-color:' + color
        + '; padding:12px 24px; border-radius:8px; margin-top:8px; width:220px; align-items:center;',
    );
    __SetInlineStyles(text, 'color:#fff; font-size:15px; font-weight:600;');
    return item;
  }

  // Initial tree: A, B, C
  const itemA = createItem('A - Original', '#3b82f6');
  const itemB = createItem('B - Original', '#8b5cf6');
  const itemC = createItem('C - Original', '#ec4899');
  __AppendElement(container, itemA);
  __AppendElement(container, itemB);
  __AppendElement(container, itemC);
  __FlushElementTree();

  // __InsertElementBefore — insert before a reference node
  setTimeout(() => {
    const inserted = createItem('Inserted before B', '#10b981');
    __InsertElementBefore(container, inserted, itemB);
    __FlushElementTree();
  }, 1500);

  // __RemoveElement — remove a child
  setTimeout(() => {
    __RemoveElement(container, itemA);
    __FlushElementTree();
  }, 3000);

  // __ReplaceElement — replace one element with another
  setTimeout(() => {
    const replacement = createItem('C - Replaced', '#f59e0b');
    __ReplaceElement(replacement, itemC);
    __FlushElementTree();
  }, 4500);
};
