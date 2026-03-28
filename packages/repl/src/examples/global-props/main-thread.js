// Demonstrates: lynx.__globalProps
//
// __globalProps holds application-wide properties set by the host
// during initialization. The REPL passes { locale, theme }
// by default; real apps add theme tokens, feature flags, etc.

globalThis.renderPage = function renderPage() {
  const page = __CreatePage('page', 0);
  const container = __CreateView(0);
  __AppendElement(page, container);
  __SetInlineStyles(container, 'padding:40px;');

  const title = __CreateText(0);
  __AppendElement(container, title);
  __AppendElement(title, __CreateRawText('lynx.__globalProps'));
  __SetInlineStyles(title, 'font-size:18px; font-weight:700;');

  const desc = __CreateText(0);
  __AppendElement(container, desc);
  __AppendElement(
    desc,
    __CreateRawText('Global properties from the host application:'),
  );
  __SetInlineStyles(desc, 'font-size:13px; color:#666; margin-top:8px;');

  // Read __globalProps
  const globalProps = lynx.__globalProps;

  const propsBox = __CreateView(0);
  __AppendElement(container, propsBox);
  __SetInlineStyles(
    propsBox,
    'margin-top:16px; background-color:#f1f5f9; padding:16px; border-radius:8px;',
  );

  const propsText = __CreateText(0);
  __AppendElement(propsBox, propsText);

  __AppendElement(
    propsText,
    __CreateRawText(JSON.stringify(globalProps, null, 2)),
  );
  __SetInlineStyles(propsText, 'font-size:12px; font-family:monospace;');

  // Note about typical usage
  const noteBox = __CreateView(0);
  __AppendElement(container, noteBox);
  __SetInlineStyles(
    noteBox,
    'margin-top:16px; padding:12px; background-color:#fefce8; border-radius:8px;',
  );

  const noteText = __CreateText(0);
  __AppendElement(noteBox, noteText);
  __AppendElement(
    noteText,
    __CreateRawText(
      'Set globalProps on <lynx-view> before load. Access them in any '
        + 'thread via lynx.__globalProps. Typical uses: theme tokens, '
        + 'user locale, feature flags.',
    ),
  );
  __SetInlineStyles(
    noteText,
    'font-size:12px; color:#854d0e; line-height:18px;',
  );

  __FlushElementTree();
};
