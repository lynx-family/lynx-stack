import '@lynx-js/preact-devtools';
import '@lynx-js/react/debug';
import { root } from '@lynx-js/react';

import DeclarativeExample from './Example.jsx';

root.render(<DeclarativeExample />);

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept();
}
