import os from 'node:os';

import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';
import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin';

function detectLanHost() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  throw new Error('No external IPv4 interface found.');
}

const port = Number(process.env['SHARED_STATE_PORT'] ?? '8080');
// `adb reverse` setups serve through the device's own loopback.
const host = process.env['SHARED_STATE_HOST'] ?? detectLanHost();

/**
 * Opt both pages into cross-card module sharing. The engine defaults the
 * page config to off; cards with it off neither consume nor contribute
 * shared modules even inside a shared-context LynxGroup.
 */
function pluginSharedContextPageConfig() {
  return {
    name: 'shared-context-page-config',
    setup(api) {
      api.modifyBundlerChain((chain) => {
        chain.plugin('shared-context-page-config').use(
          class {
            apply(compiler) {
              compiler.hooks.thisCompilation.tap('sharedContextPageConfig', (compilation) => {
                const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(compilation);
                hooks.beforeEncode.tap('sharedContextPageConfig', (args) => {
                  args.encodeData.sourceContent.config.enableSharedContextModules = true;
                  return args;
                });
              });
            }
          },
        );
      });
    },
  };
}

export default defineConfig({
  source: {
    entry: {
      pageA: './src/pageA.tsx',
      pageB: './src/pageB.tsx',
    },
  },
  output: {
    // Absolute assetPrefix so split chunks resolve when the built bundle is
    // opened on a device, and so both pages request byte-identical URLs —
    // the shared-module cache is keyed by request path.
    assetPrefix: `http://${host}:${port}/`,
  },
  plugins: [
    pluginReactLynx({
      experimental_multiRootRenderContext: true,
    }),
    pluginSharedContextPageConfig(),
  ],
  environments: {
    lynx: {},
  },
  // 方案三 split strategy: everything except the page entries goes into
  // shared chunks, loaded at runtime through lynx.requireModuleAsync and
  // therefore shared across cards of the group.
  splitChunks: {
    chunks: 'all',
    cacheGroups: {
      lib: {
        name: 'lib',
        // No per-group `chunks`: the react plugin rewrites the global
        // `chunks` to exclude *__main-thread chunks, and a group-level value
        // would override that and drag main-thread modules into this chunk.
        enforce: true,
        reuseExistingChunk: true,
        test: /[\\/]node_modules[\\/]|[\\/]packages[\\/]react[\\/]|[\\/]src[\\/]shared[\\/]/,
      },
    },
  },
});
