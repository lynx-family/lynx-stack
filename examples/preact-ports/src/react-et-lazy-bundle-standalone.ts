// Port entry for the ET standalone consumer; see
// react-lazy-bundle-standalone.ts for the approach.
import { registerRemoteModule } from '@lynx-js/preact-runtime';

registerRemoteModule(
  'LazyComponent.lynx.bundle',
  () => import('../../react-et-lazy-bundle-standalone/src/LazyComponent.jsx'),
);
registerRemoteModule(
  'add.lynx.bundle',
  () => import('../../react-et-lazy-bundle-standalone/src/utils/add.js'),
);
registerRemoteModule(
  'dynamic.lynx.bundle',
  () => import('../../react-et-lazy-bundle-standalone/src/utils/dynamic.js'),
);

void import('../../react-et-lazy-bundle-standalone/src/index.jsx');
