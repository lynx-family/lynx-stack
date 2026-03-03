// Demonstrates: __SetAttribute, __GetAttributes, __GetAttributeByName, __SetID
//
// __SetAttribute sets any attribute on an element.
// __GetAttributes returns all attributes as a record.
// __GetAttributeByName reads a single attribute.
// __SetID is a shorthand for setting the element ID.

globalThis.renderPage = function renderPage() {
  const page = __CreatePage('page', 0);
  const container = __CreateView(0);
  __AppendElement(page, container);
  __SetInlineStyles(container, 'padding:40px;');

  // Set various attributes
  const el = __CreateView(0);
  __AppendElement(container, el);
  __SetID(el, 'my-element');
  __SetAttribute(el, 'aria-label', 'demo element');
  __SetAttribute(el, 'custom-data', 'hello');
  __SetInlineStyles(
    el,
    'padding:16px; background-color:#f0f4ff; border-radius:8px;',
  );

  const elLabel = __CreateText(0);
  __AppendElement(el, elLabel);
  __AppendElement(elLabel, __CreateRawText('Element with attributes'));
  __SetInlineStyles(elLabel, 'font-size:14px; font-weight:600;');

  // Read them back
  const output = __CreateView(0);
  __AppendElement(container, output);
  __SetInlineStyles(output, 'margin-top:20px;');

  function addLine(str) {
    const t = __CreateText(0);
    __AppendElement(t, __CreateRawText(str));
    __AppendElement(output, t);
    __SetInlineStyles(
      t,
      'font-size:12px; font-family:monospace; margin-top:4px;',
    );
  }

  // __GetAttributeByName — read a single attribute
  const customVal = __GetAttributeByName(el, 'custom-data');
  addLine('__GetAttributeByName("custom-data"): ' + customVal);

  // __GetAttributes — read all attributes
  const allAttrs = __GetAttributes(el);
  addLine('__GetAttributes(): ' + JSON.stringify(allAttrs, null, 0));

  // Update an attribute and re-read
  __SetAttribute(el, 'custom-data', 'updated!');
  const newVal = __GetAttributeByName(el, 'custom-data');
  addLine('After update: ' + newVal);

  __FlushElementTree();
};
