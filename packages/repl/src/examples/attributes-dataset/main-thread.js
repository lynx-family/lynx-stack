// Demonstrates: __SetDataset, __GetDataset, __AddDataset
//
// Dataset is an arbitrary key-value store on each element.
// Frameworks use it to attach metadata (component refs, state keys, etc.)
// without polluting the attribute namespace.

globalThis.renderPage = function renderPage() {
  const page = __CreatePage('page', 0);
  const container = __CreateView(0);
  __AppendElement(page, container);
  __SetInlineStyles(container, 'padding:40px;');

  // Create elements and attach dataset
  const items = ['Alpha', 'Beta', 'Gamma'];
  const elements = [];

  for (let i = 0; i < items.length; i++) {
    const row = __CreateView(0);
    __AppendElement(container, row);
    __SetInlineStyles(
      row,
      'padding:12px; background-color:#f8fafc; border-radius:6px; margin-top:8px;',
    );

    const label = __CreateText(0);
    __AppendElement(row, label);
    __AppendElement(label, __CreateRawText(items[i]));
    __SetInlineStyles(label, 'font-size:14px; font-weight:600;');

    // __SetDataset — store entire dataset object
    __SetDataset(row, { index: i, label: items[i], active: i === 0 });
    elements.push(row);
  }

  // __AddDataset — add a single key to existing dataset
  __AddDataset(elements[1], 'extra', 'added-via-AddDataset');

  // Read and display datasets
  const output = __CreateView(0);
  __AppendElement(container, output);
  __SetInlineStyles(output, 'margin-top:20px;');

  for (let i = 0; i < elements.length; i++) {
    // __GetDataset — read entire dataset
    const ds = __GetDataset(elements[i]);
    const t = __CreateText(0);
    __AppendElement(t, __CreateRawText(items[i] + ': ' + JSON.stringify(ds)));
    __AppendElement(output, t);
    __SetInlineStyles(
      t,
      'font-size:11px; font-family:monospace; margin-top:4px;',
    );
  }

  __FlushElementTree();
};
