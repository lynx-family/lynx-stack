// Demonstrates: SystemInfo global variable
//
// SystemInfo provides device and platform information at runtime.
// On web, it reports platform:"web" with browser viewport dimensions.
// On native, it includes OS version, pixel ratio, theme, etc.

globalThis.renderPage = function renderPage() {
  const page = __CreatePage('page', 0);
  const container = __CreateView(0);
  __AppendElement(page, container);
  __SetInlineStyles(container, 'padding:40px;');

  const title = __CreateText(0);
  __AppendElement(container, title);
  __AppendElement(title, __CreateRawText('SystemInfo'));
  __SetInlineStyles(title, 'font-size:18px; font-weight:700;');

  const desc = __CreateText(0);
  __AppendElement(container, desc);
  __AppendElement(
    desc,
    __CreateRawText('Device & platform info from the SystemInfo global:'),
  );
  __SetInlineStyles(desc, 'font-size:13px; color:#666; margin-top:8px;');

  // Read SystemInfo — available as a global variable
  const info = SystemInfo;
  const entries = [
    ['platform', info.platform],
    ['lynxSdkVersion', info.lynxSdkVersion],
    ['pixelWidth', info.pixelWidth],
    ['pixelHeight', info.pixelHeight],
    ['pixelRatio', info.pixelRatio],
    ['osVersion', info.osVersion],
  ];

  for (const [key, value] of entries) {
    const row = __CreateView(0);
    __AppendElement(container, row);
    __SetInlineStyles(
      row,
      'flex-direction:row; padding:8px 12px; background-color:#f8fafc; border-radius:6px; margin-top:8px;',
    );

    const keyText = __CreateText(0);
    __AppendElement(row, keyText);
    __AppendElement(keyText, __CreateRawText(key));
    __SetInlineStyles(keyText, 'font-size:13px; font-weight:600; width:130px;');

    const valueText = __CreateText(0);
    __AppendElement(row, valueText);
    __AppendElement(valueText, __CreateRawText(String(value ?? 'N/A')));
    __SetInlineStyles(
      valueText,
      'font-size:13px; color:#666; font-family:monospace;',
    );
  }

  // Also accessible via lynx.SystemInfo
  const noteText = __CreateText(0);
  __AppendElement(container, noteText);
  __AppendElement(
    noteText,
    __CreateRawText('Also available as lynx.SystemInfo'),
  );
  __SetInlineStyles(noteText, 'font-size:11px; color:#999; margin-top:16px;');

  __FlushElementTree();
};
