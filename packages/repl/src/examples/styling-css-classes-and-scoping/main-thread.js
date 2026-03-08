// Demonstrates: __SetClasses, __SetCSSId + external CSS
//
// __SetClasses replaces all CSS classes on an element.
// __SetCSSId assigns a CSS scope ID — this is how React-Lynx
// isolates component styles (like CSS Modules).

globalThis.renderPage = function renderPage() {
  const page = __CreatePage('page', 0);
  const container = __CreateView(0);
  __AppendElement(page, container);
  __SetInlineStyles(container, 'padding:40px; align-items:center;');

  // Apply classes from the CSS tab
  const card = __CreateView(0);
  __AppendElement(container, card);
  __SetClasses(card, ['card']);

  const title = __CreateText(0);
  __AppendElement(card, title);
  __AppendElement(title, __CreateRawText('Styled with CSS Classes'));
  __SetClasses(title, ['title']);

  const subtitle = __CreateText(0);
  __AppendElement(card, subtitle);
  __AppendElement(subtitle, __CreateRawText('Using __SetClasses'));
  __SetClasses(subtitle, ['subtitle']);

  // __SetCSSId — scope CSS to a "component"
  // In React-Lynx, each snapshot gets a cssId at compile time.
  // Here we demonstrate the raw API.
  const scopedSection = __CreateView(0);
  __AppendElement(container, scopedSection);
  __SetInlineStyles(scopedSection, 'margin-top:20px; align-items:center;');

  const scopedText = __CreateText(0);
  __AppendElement(scopedSection, scopedText);
  __AppendElement(scopedText, __CreateRawText('This element has cssId=1'));
  __SetCSSId([scopedText], 1);
  __SetClasses(scopedText, ['scoped-label']);

  __FlushElementTree();
};
