import { root } from '@lynx-js/react';

import { bindRenderContext } from './bindRenderContext.js';
import { PageA } from './components/PageA.js';

bindRenderContext();
root.render(<PageA />);

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept();
}
