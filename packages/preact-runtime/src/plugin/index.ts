// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @packageDocumentation
 *
 * The rspeedy/rsbuild plugin for the transform-free preact runtime.
 *
 * Unlike `pluginReactLynx`, there is no per-app main-thread build and no SWC
 * transform: the main-thread chunk is a fixed prebuilt runtime shipped by
 * `@lynx-js/preact-runtime/main-thread`, and user code is compiled once for
 * the background thread with the standard preact JSX runtime.
 */

import { createRequire } from 'node:module';
import path from 'node:path';

import type { RsbuildPlugin, Rspack } from '@rsbuild/core';

import { RuntimeWrapperWebpackPlugin } from '@lynx-js/runtime-wrapper-webpack-plugin';
import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
  WebEncodePlugin,
} from '@lynx-js/template-webpack-plugin';

const DEFAULT_DIST_PATH_INTERMEDIATE = '.rspeedy';

class MarkMainThreadAssetPlugin {
  constructor(private mainThreadChunks: string[]) {}

  apply(compiler: Rspack.Compiler): void {
    compiler.hooks.thisCompilation.tap(
      'MarkMainThreadAssetPlugin',
      (compilation) => {
        compilation.hooks.processAssets.tap(
          {
            name: 'MarkMainThreadAssetPlugin',
            stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
          },
          () => {
            for (const name of this.mainThreadChunks) {
              const asset = compilation.getAsset(name);
              if (asset) {
                compilation.updateAsset(asset.name, asset.source, {
                  ...asset.info,
                  'lynx:main-thread': true,
                });
              }
            }
          },
        );
      },
    );
  }
}

/**
 * Create the rsbuild plugin for the transform-free preact runtime.
 *
 * @public
 */
export function pluginPreactLynx(): RsbuildPlugin {
  return {
    name: 'lynx:preact',
    setup(api) {
      api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
        return mergeRsbuildConfig(config, {
          output: {
            // Route CSS through CssExtractRspackPlugin (replaced below with
            // the Lynx-aware fork) instead of injecting <style> tags.
            injectStyles: false,
          },
          source: {
            define: {
              // The web BTS evaluates the chunk via
              // `new Function('document', ...)` with an undefined `document`
              // parameter that would shadow the worker global preact needs.
              document: 'globalThis.document',
            },
          },
          tools: {
            swc: {
              jsc: {
                transform: {
                  react: {
                    runtime: 'automatic',
                    importSource: 'preact',
                    // `main-thread:bindtap` etc. are namespaced JSX attributes.
                    throwIfNamespace: false,
                  },
                },
              },
            },
          },
        });
      });

      // Swap rsbuild's CSS extraction for the Lynx-aware fork so `.css`
      // assets become template style sections.
      api.modifyBundlerChain(async (chain, { CHAIN_ID }) => {
        const { CssExtractRspackPlugin } = await import(
          '@lynx-js/css-extract-webpack-plugin'
        );
        const cssRules = [
          CHAIN_ID.RULE.CSS,
          CHAIN_ID.RULE.SASS,
          CHAIN_ID.RULE.LESS,
          CHAIN_ID.RULE.STYLUS,
        ] as const;
        cssRules
          .filter((rule) => chain.module.rules.has(rule))
          .forEach((ruleName) => {
            const mainRuleName = ruleName === CHAIN_ID.RULE.CSS
              ? CHAIN_ID.ONE_OF.CSS_MAIN
              : ruleName;
            const mainRule = chain.module.rule(ruleName).oneOf(mainRuleName);
            if (mainRule.uses.has(CHAIN_ID.USE.LIGHTNINGCSS)) {
              mainRule.uses.delete(CHAIN_ID.USE.LIGHTNINGCSS);
            }
            if (mainRule.uses.has(CHAIN_ID.USE.MINI_CSS_EXTRACT)) {
              mainRule
                .use(CHAIN_ID.USE.MINI_CSS_EXTRACT)
                .loader(CssExtractRspackPlugin.loader);
            }
          });
        if (chain.plugins.has(CHAIN_ID.PLUGIN.MINI_CSS_EXTRACT)) {
          chain
            .plugin(CHAIN_ID.PLUGIN.MINI_CSS_EXTRACT)
            .init(
              (_, args: unknown[]) =>
                new CssExtractRspackPlugin(
                  args[0] as ConstructorParameters<
                    typeof CssExtractRspackPlugin
                  >[0],
                ),
            );
        }
      });

      api.modifyBundlerChain((chain, { environment, isDev }) => {
        const isRspeedy = api.context.callerName === 'rspeedy';
        if (!isRspeedy) {
          return;
        }
        const isLynx = environment.name === 'lynx'
          || environment.name.startsWith('lynx-');
        const isWeb = environment.name === 'web'
          || environment.name.startsWith('web-');

        const require = createRequire(import.meta.url);
        const mainThreadRuntime = require.resolve(
          '@lynx-js/preact-runtime/main-thread',
        );

        // Resolve preact from this package so apps do not need a direct
        // dependency and the whole build shares a single copy.
        for (
          const specifier of [
            'preact',
            'preact/hooks',
            'preact/compat',
            'preact/jsx-runtime',
            'preact/jsx-dev-runtime',
            'preact/debug',
            'preact/devtools',
          ]
        ) {
          chain.resolve.alias.set(`${specifier}$`, require.resolve(specifier));
        }

        // Let sources written against `@lynx-js/react` run unmodified.
        chain.resolve.alias.set(
          '@lynx-js/react$',
          require.resolve('@lynx-js/preact-runtime/compat'),
        );
        chain.resolve.alias.set(
          '@lynx-js/react/debug$',
          require.resolve('@lynx-js/preact-runtime/compat/debug'),
        );
        chain.resolve.alias.set(
          '@lynx-js/preact-devtools$',
          require.resolve('@lynx-js/preact-runtime/compat/debug'),
        );

        // Example sources import './App.jsx' while the file is `App.tsx`.
        chain.resolve.merge({
          extensionAlias: {
            '.js': ['.js', '.ts', '.tsx'],
            '.jsx': ['.jsx', '.tsx'],
          },
        });

        const { hmr, liveReload } = environment.config.dev ?? {};
        const enabledHMR = isDev && hmr !== false;
        const enabledLiveReload = isDev && liveReload !== false;

        const entries = chain.entryPoints.entries() ?? {};
        chain.entryPoints.clear();

        const mainThreadChunks: string[] = [];

        Object.entries(entries).forEach(([entryName, entryPoint]) => {
          const imports = entryPoint.values().flatMap((item) => {
            if (typeof item === 'string') {
              return [item];
            }
            if (Array.isArray(item)) {
              return item;
            }
            const importValue = (item as { import: string | string[] }).import;
            return Array.isArray(importValue) ? importValue : [importValue];
          });

          const mainThreadEntry = `${entryName}__main-thread`;
          const intermediate = isLynx ? DEFAULT_DIST_PATH_INTERMEDIATE : '';
          const mainThreadName = path.posix.join(
            intermediate,
            `${entryName}/main-thread.js`,
          );
          const backgroundName = path.posix.join(
            intermediate,
            `${entryName}/background.js`,
          );

          mainThreadChunks.push(mainThreadName);

          chain
            .entry(mainThreadEntry)
            .add({
              import: [mainThreadRuntime],
              filename: mainThreadName,
            })
            .end()
            .entry(entryName)
            .add({
              import: imports,
              filename: backgroundName,
            })
            .when(enabledHMR || enabledLiveReload, (entry) => {
              // This is aliased in `@lynx-js/rspeedy`
              entry.prepend('@lynx-js/webpack-dev-transport/client');
            })
            .end()
            .plugin(`lynx:preact-template-${entryName}`)
            .use(LynxTemplatePlugin, [{
              ...LynxTemplatePlugin.defaultOptions,
              dsl: 'react_nodiff',
              chunks: [mainThreadEntry, entryName],
              filename: `${entryName}.[platform].bundle`.replaceAll(
                '[platform]',
                environment.name,
              ),
              intermediate: path.posix.join(
                DEFAULT_DIST_PATH_INTERMEDIATE,
                entryName,
              ),
              enableRemoveCSSScope: true,
              defaultDisplayLinear: true,
            }])
            .end();
        });

        chain
          .plugin('lynx:preact-mark-main-thread')
          .use(MarkMainThreadAssetPlugin, [mainThreadChunks])
          .end();

        if (isLynx) {
          chain
            .plugin('lynx:preact-runtime-wrapper')
            .use(RuntimeWrapperWebpackPlugin, [{
              targetSdkVersion: '3.2',
              // Wrap all `.js` but not `main-thread.js`.
              test: /^(?!.*main-thread(?:\.[A-Fa-f0-9]*)?\.js$).*\.js$/,
            }])
            .end()
            .plugin(LynxEncodePlugin.name)
            .use(LynxEncodePlugin, [{}])
            .end();
        }

        if (isWeb) {
          chain
            .plugin('lynx:preact-web-encode')
            .use(WebEncodePlugin, [])
            .end();
        }
      });
    },
  };
}
