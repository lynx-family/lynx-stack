import { createRoot, root } from '@lynx-js/react';

import { SharedCounter } from './shared/SharedCounter.jsx';

if (__BACKGROUND__) {
  // Bind this page's own environment. The ambient `lynx` / `lynxCoreInject`
  // resolve to *this card's* objects when the entry evaluates, even though
  // the framework chunk may already have been evaluated by another card in
  // the group. `root.render` below delegates to the bound root.
  createRoot({ lynx, lynxCoreInject });
}

root.render(<SharedCounter page='PAGE B' />);
