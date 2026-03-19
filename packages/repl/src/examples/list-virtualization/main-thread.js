// Demonstrates: __CreateList, componentAtIndex, enqueueComponent,
//               __UpdateListCallbacks, __SetAttribute("update-list-info")
//
// __CreateList creates a virtualized list driven by engine callbacks.
// The engine calls componentAtIndex(list, listID, index) to request
// each visible item. Must return the element's unique ID.
//
// update-list-info triggers insert/remove operations on the list.

globalThis.renderPage = function renderPage() {
  const page = __CreatePage('page', 0);

  const header = __CreateView(0);
  __AppendElement(page, header);
  __SetInlineStyles(
    header,
    'padding:16px; background-color:#1e40af; align-items:center;',
  );
  const headerText = __CreateText(0);
  __AppendElement(header, headerText);
  __AppendElement(headerText, __CreateRawText('Virtualized List'));
  __SetInlineStyles(headerText, 'color:#fff; font-size:16px; font-weight:700;');

  const items = [];
  for (let i = 0; i < 20; i++) {
    items.push({ label: 'Item ' + i, bg: i % 2 === 0 ? '#f8fafc' : '#fff' });
  }

  // componentAtIndex — called by the engine for each visible position
  function componentAtIndex(listEl, listID, index) {
    const row = __CreateView(0);
    const text = __CreateText(0);
    __AppendElement(row, text);
    __AppendElement(text, __CreateRawText(items[index].label));
    __SetInlineStyles(
      row,
      'padding:14px 20px; background-color:' + items[index].bg + ';',
    );
    __SetInlineStyles(text, 'font-size:15px; color:#1f2937;');
    __FlushElementTree();
    // Must return the element's unique ID
    return __GetElementUniqueID(row);
  }

  // enqueueComponent — called when an item is recycled/removed
  function enqueueComponent(listEl, listID, sign) {
    // A real framework would recycle the element here
  }

  // __CreateList — create the list with callbacks
  const list = __CreateList(0, componentAtIndex, enqueueComponent);
  __AppendElement(page, list);
  __SetInlineStyles(list, 'flex:1;');

  __FlushElementTree();

  // Trigger rendering via update-list-info
  setTimeout(() => {
    __SetAttribute(list, 'update-list-info', {
      insertAction: items.map((_, i) => ({ position: i })),
      removeAction: [],
    });
    __FlushElementTree();
  }, 100);
};
