import { root } from '@lynx-js/react';

import { bindRenderContext } from './bindRenderContext.js';
import { PageB } from './components/PageB.js';

bindRenderContext();
root.render(<PageB />);

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept();
}
