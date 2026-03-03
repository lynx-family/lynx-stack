import { createRoot } from '@lynx-js/preact';

import { App } from './app/index.jsx';

// eslint-disable-next-line @typescript-eslint/no-unsafe-return
globalThis.processData = (data) => data;

globalThis.renderPage = () => {
  const root = createRoot();
  root.render(<App />);
};
