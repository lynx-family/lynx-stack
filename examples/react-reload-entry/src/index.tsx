import { root } from '@lynx-js/react';

import { App } from './App.js';
import { entryEvalCount } from './module-state.js';

console.info(
  `[reload-entry] ${
    __MAIN_THREAD__ ? 'main-thread' : 'background'
  } entry eval #${entryEvalCount}`,
);

root.render(<App />);
