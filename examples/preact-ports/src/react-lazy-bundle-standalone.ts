// Port entry: register the producer modules locally, then run the original
// consumer app. On the transform-free runtime the producer/consumer pair
// shares one build; the import(url, { with }) surface still goes through
// the runtime's remote-import path.
import { registerRemoteModule } from '@lynx-js/preact-runtime';

registerRemoteModule(
  'LazyComponent.lynx.bundle',
  () => import('../../react-lazy-bundle-standalone/src/LazyComponent.jsx'),
);
registerRemoteModule(
  'LazyComponentSync.lynx.bundle',
  () => import('../../react-lazy-bundle-standalone/src/LazyComponentSync.jsx'),
);
registerRemoteModule(
  'LazyComponentAsync.lynx.bundle',
  () => import('../../react-lazy-bundle-standalone/src/LazyComponentAsync.jsx'),
);
registerRemoteModule(
  'add.lynx.bundle',
  () => import('../../react-lazy-bundle-standalone/src/utils/add.js'),
);
registerRemoteModule(
  'minus.lynx.bundle',
  () => import('../../react-lazy-bundle-standalone/src/utils/minus.js'),
);
registerRemoteModule(
  'dynamic.lynx.bundle',
  () => import('../../react-lazy-bundle-standalone/src/utils/dynamic.js'),
);

void import('../../react-lazy-bundle-standalone/src/index.jsx');
