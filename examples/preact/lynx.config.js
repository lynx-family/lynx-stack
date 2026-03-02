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
 * Unlike the React plugin (dual-thread with BSI/snapshot), Preact runs entirely
 * on the main thread. This plugin:
 *   1. Applies LynxTemplatePlugin per entry to produce .lynx.bundle files
 *   2. Applies LynxEncodePlugin to encode the template
 *   3. Marks ALL JS assets as lynx:main-thread so they become lepusCode
 */
function pluginPreactLynx() {
  return {
    name: 'plugin-preact-lynx',
    setup(api) {
      // Disable runtime CSS injection (style-loader) for all environments.
      // Without this, rsbuild uses style-loader which tries to inject <style>
      // tags at runtime — that API doesn't exist in the Lynx JS runtime and
      // crashes. Setting injectStyles:false switches to CssExtractRspackPlugin
      // which emits a .css asset that LynxTemplatePlugin can embed in the bundle.
      api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
        return mergeRsbuildConfig(config, {
          output: { injectStyles: false },
        });
      });

      api.modifyBundlerChain((chain, { environment, CHAIN_ID }) => {
        const isLynx = environment.name === 'lynx'
          || environment.name.startsWith('lynx-');

        if (!isLynx) return;

        // Strip CSS runtime injection code from the Lynx JS bundle.
        // CssExtractRspackPlugin.loader (enabled by injectStyles:false) still
        // injects cssReload/HMR code into the CSS JS module. That crashes in the
        // Lynx JS runtime. We add ignore-css-loader BEFORE mini-css-extract in
        // the chain (i.e. runs AFTER it in webpack's right-to-left order) so the
        // CSS is extracted as an asset (for LynxTemplatePlugin to embed), but the
        // JS module output is replaced with a harmless `export {}`.
        for (const ruleId of [CHAIN_ID.RULE.CSS]) {
          if (!chain.module.rules.has(ruleId)) continue;
          chain.module.rule(ruleId)
            .use('lynx:ignore-css')
            .before(CHAIN_ID.USE.MINI_CSS_EXTRACT)
            .loader(require.resolve('./lynx-ignore-css-loader.cjs'));
        }

        // Disable chunk splitting — lepus runtime has no module system,
        // so split chunks use `exports.ids`/`exports.modules` which is undefined.
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
              // Without @cssId scoping from @lynx-js/css-extract-webpack-plugin,
              // CSS class selectors require scope IDs on elements that Preact never
              // sets. enableRemoveCSSScope:true removes the scope requirement so
              // class names match directly.
              enableRemoveCSSScope: true,
            }]);
        }

        chain
          .plugin('LynxEncodePlugin')
          .use(LynxEncodePlugin);

        // Mark all JS assets as main-thread so they become lepusCode.
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
    web: {},
    lynx: {
      tools: {
        swc: {
          jsc: {
            transform: {
              react: {
                runtime: 'automatic',
                importSource: 'preact',
              },
            },
          },
        },
      },
    },
  },
});
