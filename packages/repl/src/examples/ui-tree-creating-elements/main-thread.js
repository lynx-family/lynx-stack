// Demonstrates: __CreatePage, __CreateView, __CreateText, __CreateRawText,
//               __CreateImage, __AppendElement, __FlushElementTree
//
// These are the element factory functions. Every framework needs them
// to create and mount an element tree.

globalThis.renderPage = function renderPage() {
  const page = __CreatePage('page', 0);

  // __CreateView — generic container (like <div>)
  const container = __CreateView(0);
  __AppendElement(page, container);

  // __CreateText + __CreateRawText — text display
  const heading = __CreateText(0);
  const headingContent = __CreateRawText('Element Factories');
  __AppendElement(container, heading);
  __AppendElement(heading, headingContent);

  const description = __CreateText(0);
  const descContent = __CreateRawText(
    '__CreateView, __CreateText, __CreateRawText, __CreateImage',
  );
  __AppendElement(container, description);
  __AppendElement(description, descContent);

  // __CreateImage — image element
  const img = __CreateImage(0);
  __SetAttribute(img, 'src', 'https://lynxjs.org/img/lynx-logo.svg');
  __AppendElement(container, img);

  // Minimal styling to make it visible
  __SetInlineStyles(container, 'padding:40px; align-items:center;');
  __SetInlineStyles(heading, 'font-size:20px; font-weight:700;');
  __SetInlineStyles(description, 'font-size:13px; color:#666; margin-top:8px;');
  __SetInlineStyles(img, 'width:80px; height:80px; margin-top:16px;');

  // __FlushElementTree — commit all pending changes to the renderer
  __FlushElementTree();
};
