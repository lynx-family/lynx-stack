// Demonstrates: Element types and their props
//
// Lynx provides several built-in element types, each with specific
// properties (ViewProps, TextProps, ImageProps, etc.):
//   __CreateView  — layout container (like <div>)
//   __CreateText  — styled text display
//   __CreateImage — image with src attribute
//
// Set props via __SetAttribute, __SetInlineStyles, __SetID, etc.

globalThis.renderPage = function renderPage() {
  const page = __CreatePage('page', 0);
  const container = __CreateView(0);
  __AppendElement(page, container);
  __SetInlineStyles(container, 'padding:40px;');

  const title = __CreateText(0);
  __AppendElement(container, title);
  __AppendElement(title, __CreateRawText('Element Types & Props'));
  __SetInlineStyles(title, 'font-size:18px; font-weight:700;');

  // ── View (ViewProps) ──────────────────────────────────────────────
  const viewLabel = __CreateText(0);
  __AppendElement(container, viewLabel);
  __AppendElement(viewLabel, __CreateRawText('View — layout container'));
  __SetInlineStyles(
    viewLabel,
    'font-size:14px; font-weight:600; margin-top:20px;',
  );

  const viewDemo = __CreateView(0);
  __AppendElement(container, viewDemo);
  __SetInlineStyles(
    viewDemo,
    'flex-direction:row; padding:12px; background-color:#dbeafe;'
      + 'border-radius:8px; margin-top:8px; align-items:center; justify-content:space-between;',
  );

  for (let i = 1; i <= 3; i++) {
    const child = __CreateView(0);
    __AppendElement(viewDemo, child);
    __SetInlineStyles(
      child,
      'width:50px; height:50px; background-color:#3b82f6; border-radius:6px; align-items:center; justify-content:center;',
    );

    const num = __CreateText(0);
    __AppendElement(child, num);
    __AppendElement(num, __CreateRawText(String(i)));
    __SetInlineStyles(num, 'color:#fff; font-size:16px; font-weight:700;');
  }

  // ── Text (TextProps) ──────────────────────────────────────────────
  const textLabel = __CreateText(0);
  __AppendElement(container, textLabel);
  __AppendElement(textLabel, __CreateRawText('Text — styled text display'));
  __SetInlineStyles(
    textLabel,
    'font-size:14px; font-weight:600; margin-top:20px;',
  );

  const styles = [
    {
      text: 'Bold 20px',
      style: 'font-size:20px; font-weight:700; color:#111;',
    },
    {
      text: 'Italic purple',
      style: 'font-size:16px; font-style:italic; color:#9333ea;',
    },
    {
      text: 'Monospace small',
      style: 'font-size:12px; font-family:monospace; color:#666;',
    },
  ];

  for (const { text, style } of styles) {
    const t = __CreateText(0);
    __AppendElement(container, t);
    __AppendElement(t, __CreateRawText(text));
    __SetInlineStyles(t, style + ' margin-top:6px;');
  }

  // ── Image (ImageProps) ────────────────────────────────────────────
  const imgLabel = __CreateText(0);
  __AppendElement(container, imgLabel);
  __AppendElement(imgLabel, __CreateRawText('Image — src attribute'));
  __SetInlineStyles(
    imgLabel,
    'font-size:14px; font-weight:600; margin-top:20px;',
  );

  const imgRow = __CreateView(0);
  __AppendElement(container, imgRow);
  __SetInlineStyles(
    imgRow,
    'flex-direction:row; margin-top:8px; align-items:center;',
  );

  const img = __CreateImage(0);
  __AppendElement(imgRow, img);
  __SetAttribute(img, 'src', 'https://lynxjs.org/assets/lynxai-logo-light.svg');
  __SetInlineStyles(img, 'width:64px; height:64px;');

  const imgDesc = __CreateText(0);
  __AppendElement(imgRow, imgDesc);
  __AppendElement(
    imgDesc,
    __CreateRawText('src="https://lynxjs.org/assets/lynxai-logo-light.svg"'),
  );
  __SetInlineStyles(
    imgDesc,
    'font-size:11px; font-family:monospace; color:#666; margin-left:12px;',
  );

  __FlushElementTree();
};
