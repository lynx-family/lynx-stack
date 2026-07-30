import { root } from '@lynx-js/react';

import { App } from './App.jsx';

// A first-screen App that DELEGATES to `'background only'` components living
// in other modules — the realistic multi-module shape the assembly must keep
// hydratable: `<Feed/>` (named import), `<UI.Card/>` (namespace import), and
// a `<Shared/>` component used by both the first-screen and the
// background-only trees.
root.render(<App />);
