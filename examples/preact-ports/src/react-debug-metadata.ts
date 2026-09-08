// Port entry for the debug-metadata consumer app; see
// react-lazy-bundle-standalone.ts for the approach. Debug-metadata asset
// emission itself is a build-tooling feature outside this runtime.
import { registerRemoteModule } from '@lynx-js/preact-runtime';

registerRemoteModule(
  'LazyComponent.lynx.bundle',
  () => import('../../react-debug-metadata/src/LazyComponent.jsx'),
);
registerRemoteModule(
  'add.lynx.bundle',
  () => import('../../react-debug-metadata/src/utils/add.js'),
);
registerRemoteModule(
  'dynamic.lynx.bundle',
  () => import('../../react-debug-metadata/src/utils/dynamic.js'),
);

void import('../../react-debug-metadata/src/index.jsx');
