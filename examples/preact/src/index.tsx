import { createRoot } from '@lynx-js/preact';

import { App } from './App.jsx';

// Lynx lifecycle stubs — the runtime calls these during initialization.
// The React pipeline defines them in its runtime; for direct Preact we stub them.
// eslint-disable-next-line @typescript-eslint/no-unsafe-return
globalThis.processData = (data) => data;

globalThis.renderPage = () => {
  const root = createRoot();
  root.render(<App />);
};
