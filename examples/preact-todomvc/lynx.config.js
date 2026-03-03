import { createRequire } from 'node:module';

import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';
import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
} from '@lynx-js/template-webpack-plugin';

const require = createRequire(import.meta.url);

/**
 * Inline rsbuild plugin for Preact on Lynx.
 *
 * Preact runs entirely on the main thread via Element PAPI.
 * This plugin:
 *   1. Applies LynxTemplatePlugin per entry to produce .lynx.bundle files
 *   2. Applies LynxEncodePlugin to encode the template
 *   3. Marks ALL JS assets as lynx:main-thread so they become lepusCode
 *   4. Enables CSS selector matching and invalidation
 */
function pluginPreactLynx() {
  return {
    name: 'plugin-preact-lynx',
    setup(api) {
      api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
        return mergeRsbuildConfig(config, {
          output: { injectStyles: false },
        });
      });

      api.modifyBundlerChain((chain, { environment, CHAIN_ID }) => {
        const isLynx = environment.name === 'lynx'
          || environment.name.startsWith('lynx-');

        if (!isLynx) return;

        for (const ruleId of [CHAIN_ID.RULE.CSS]) {
          if (!chain.module.rules.has(ruleId)) continue;
          chain.module.rule(ruleId)
            .use('lynx:ignore-css')
            .before(CHAIN_ID.USE.MINI_CSS_EXTRACT)
            .loader(require.resolve('./lynx-ignore-css-loader.cjs'));
        }

        chain.optimization.splitChunks(false);

        const entries = chain.entryPoints.entries() ?? {};

        for (const entryName of Object.keys(entries)) {
          chain
            .plugin(`lynx:template-${entryName}`)
            .use(LynxTemplatePlugin, [{
              ...LynxTemplatePlugin.defaultOptions,
              dsl: 'react_nodiff',
              chunks: [entryName],
              filename: `${entryName}.lynx.bundle`,
              intermediate: `.rspeedy/${entryName}`,
              enableRemoveCSSScope: true,
              enableCSSSelector: true,
              enableCSSInvalidation: true,
            }]);
        }

        chain
          .plugin('LynxEncodePlugin')
          .use(LynxEncodePlugin);

        chain
          .plugin('mark-main-thread')
          .use(
            class MarkMainThreadPlugin {
              apply(compiler) {
                compiler.hooks.thisCompilation.tap(
                  'MarkMainThreadPlugin',
                  (compilation) => {
                    compilation.hooks.processAssets.tap(
                      'MarkMainThreadPlugin',
                      () => {
                        for (const asset of compilation.getAssets()) {
                          if (asset.name.endsWith('.js')) {
                            compilation.updateAsset(
                              asset.name,
                              asset.source,
                              {
                                ...asset.info,
                                'lynx:main-thread': true,
                              },
                            );
                          }
                        }
                      },
                    );
                  },
                );
              }
            },
          );
      });
    },
  };
}

const swcConfig = {
  jsc: {
    transform: {
      react: {
        runtime: 'automatic',
        importSource: 'preact',
      },
    },
  },
};

export default defineConfig({
  plugins: [
    pluginPreactLynx(),
    pluginQRCode({
      schema(url) {
        return `${url}?fullscreen=true`;
      },
    }),
  ],
  environments: {
    web: {
      tools: { swc: swcConfig },
    },
    lynx: {
      tools: { swc: swcConfig },
    },
  },
});
