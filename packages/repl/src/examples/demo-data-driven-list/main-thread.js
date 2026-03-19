// Demo: Data-Driven List
// Combines: renderPage, cross-thread events, dynamic tree building
//
// The background thread simulates a data source feeding items
// to the main thread one by one.

let statusText, listContainer;

globalThis.renderPage = function renderPage() {
  const page = __CreatePage('page', 0);
  const container = __CreateView(0);
  __AppendElement(page, container);
  __SetInlineStyles(
    container,
    'display:flex; flex-direction:column; align-items:center; padding-top:60px; height:100%; background-color:#eff6ff;',
  );

  const title = __CreateText(0);
  __AppendElement(container, title);
  __AppendElement(title, __CreateRawText('Data-Driven List'));
  __SetInlineStyles(title, 'font-size:22px; font-weight:700; color:#1e40af;');

  const status = __CreateText(0);
  statusText = __CreateRawText('Waiting for data...');
  __AppendElement(container, status);
  __AppendElement(status, statusText);
  __SetInlineStyles(status, 'font-size:14px; color:#6b7280; margin-top:8px;');

  listContainer = __CreateView(0);
  __AppendElement(container, listContainer);
  __SetInlineStyles(listContainer, 'margin-top:20px; width:240px;');

  __FlushElementTree();

  // Listen for data updates from the background thread
  lynx.getJSContext().addEventListener('addItem', (event) => {
    const { name, count } = event.data;
    __SetAttribute(statusText, 'text', count + ' items loaded');

    const row = __CreateView(0);
    const label = __CreateText(0);
    const labelText = __CreateRawText(name);
    __AppendElement(listContainer, row);
    __AppendElement(row, label);
    __AppendElement(label, labelText);
    __SetInlineStyles(
      row,
      'background-color:#dbeafe; padding:10px 16px; border-radius:8px; margin-top:8px;',
    );
    __SetInlineStyles(label, 'font-size:15px; color:#1e3a5f;');

    __FlushElementTree();
  });
};
