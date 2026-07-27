import { pluginPreactLynx } from '@lynx-js/preact-runtime/plugin';
import { defineConfig } from '@lynx-js/rspeedy';

// Each entry mounts an original example's source, unmodified, onto the
// transform-free preact runtime (`@lynx-js/react` is aliased to the compat
// layer by the plugin).
export default defineConfig({
  source: {
    entry: {
      'react': '../react/src/index.tsx',
      'react-element': '../react-element/src/index.tsx',
      'react-keyboard': '../react-keyboard/src/index.tsx',
      'react-main-thread-function':
        '../react-main-thread-function/src/index.tsx',
      'react-et-list': '../react-et-list/src/index.tsx',
      'react-element-template': '../react-element-template/src/index.tsx',
      'react-compiler': '../react-compiler/src/index.tsx',
      'react-ui-sourcemap': '../react-ui-sourcemap/src/index.tsx',
      'react-et-mtf': '../react-et-mtf/src/index.tsx',
      'react-lazy-bundle': '../react-lazy-bundle/src/index.tsx',
      'react-et-lazy-bundle': '../react-et-lazy-bundle/src/index.tsx',
    },
  },
  plugins: [
    pluginPreactLynx(),
  ],
  environments: {
    web: {},
    lynx: {},
  },
});
