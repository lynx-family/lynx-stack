import { createRoot, root } from '@lynx-js/react';

import { SharedCounter } from './shared/SharedCounter.jsx';

if (__BACKGROUND__) {
  // Bind this page's own lynx. The ambient `lynx` resolves to *this card's*
  // instance when the entry evaluates, even though the framework chunk may
  // already have been evaluated by another card in the group. `root.render`
  // below delegates to the bound root.
  createRoot(lynx);
}

root.render(<SharedCounter page='PAGE A' />);
