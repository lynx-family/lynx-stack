// Demonstrates: theming via globalProps
//
// lynx.__globalProps.theme is set by the REPL host to "dark" or
// "light" before the card loads and updated live via a cross-thread
// event when the user toggles the theme button in the header.

const THEMES = {
  dark: {
    bg: '#1a1a2e',
    surface: '#16213e',
    text: '#e0e0e0',
    accent: '#7c83fd',
    label: '#aaa',
  },
  light: {
    bg: '#f0f4ff',
    surface: '#ffffff',
    text: '#1a1a2e',
    accent: '#5c6bc0',
    label: '#666',
  },
};

let container, themeLabel, themeLabelRaw, accentBar;

function applyTheme(theme) {
  const t = THEMES[theme] || THEMES.light;
  __SetInlineStyles(
    container,
    'padding:32px; align-items:center; background-color:' + t.bg + ';',
  );
  __SetInlineStyles(
    themeLabel,
    'font-size:13px; font-family:monospace; color:' + t.label
      + '; margin-top:4px;',
  );
  __SetAttribute(themeLabelRaw, 'text', 'theme: "' + theme + '"');
  __SetInlineStyles(
    accentBar,
    'width:200px; height:6px; border-radius:3px; background-color:' + t.accent
      + '; margin-top:20px;',
  );
  __FlushElementTree();
}

globalThis.renderPage = function renderPage() {
  const page = __CreatePage('page', 0);

  container = __CreateView(0);
  __AppendElement(page, container);

  const title = __CreateText(0);
  __AppendElement(container, title);
  __AppendElement(title, __CreateRawText('globalProps.theme'));
  __SetInlineStyles(title, 'font-size:20px; font-weight:700;');

  themeLabel = __CreateText(0);
  themeLabelRaw = __CreateRawText('');
  __AppendElement(container, themeLabel);
  __AppendElement(themeLabel, themeLabelRaw);

  const hint = __CreateText(0);
  __AppendElement(container, hint);
  __AppendElement(
    hint,
    __CreateRawText('Toggle ☀/🌙 in the header to see live updates'),
  );
  __SetInlineStyles(
    hint,
    'font-size:11px; color:#999; margin-top:16px; text-align:center;',
  );

  accentBar = __CreateView(0);
  __AppendElement(container, accentBar);

  const initialTheme = lynx.__globalProps?.theme || 'light';
  applyTheme(initialTheme);

  // Live updates: the background thread forwards themeChanged events here
  lynx.getJSContext().addEventListener('themeChanged', function(event) {
    applyTheme(event.data.theme);
  });
};
