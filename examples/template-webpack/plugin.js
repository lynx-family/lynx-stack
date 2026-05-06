import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { RuntimeWrapperWebpackPlugin } from '@lynx-js/runtime-wrapper-webpack-plugin';
import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
} from '@lynx-js/template-webpack-plugin';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const BACKGROUND_ENTRY = 'card__background';
const MAIN_THREAD_ENTRY = 'card__main-thread';
const MAIN_THREAD_ASSET = '.rspeedy/card/main-thread.js';
const BACKGROUND_ASSET = '.rspeedy/card/background.js';

const PLUGIN_NAME = 'template-webpack';

/**
 * Assemble a Lynx bundle directly from background, main-thread, and CSS assets
 * without using pluginReactLynx().
 */
export function pluginTemplateWebpack() {
  return {
    name: PLUGIN_NAME,
    setup(api) {
      api.modifyBundlerChain((chain) => {
        // Step 1: Replace Rspeedy's default entries with the assets needed
        // by the Lynx template bundle.
        chain.entryPoints.clear();

        // Step 2: Build background code as the JavaScript manifest payload.
        chain.entry(BACKGROUND_ENTRY).add({
          import: path.join(projectRoot, 'src/background.ts'),
          filename: BACKGROUND_ASSET,
        });

        // Step 3: Build main-thread code as the Lepus asset used by native,
        // and attach CSS to the same entry so webpack handles loaders,
        // PostCSS, and watch dependencies.
        chain.entry(MAIN_THREAD_ENTRY).add({
          import: [
            path.join(projectRoot, 'src/main-thread.ts'),
            path.join(projectRoot, 'src/style.css'),
          ],
          filename: MAIN_THREAD_ASSET,
        });

        // Step 4: Create the Lynx template container that will later receive
        // manifest, Lepus, and CSS data.
        chain.plugin('template').use(LynxTemplatePlugin, [{
          ...LynxTemplatePlugin.defaultOptions,
          filename: 'card.bundle',
          intermediate: '.rspeedy/card',
          chunks: [BACKGROUND_ENTRY, MAIN_THREAD_ENTRY],
          dsl: 'react_nodiff',
          cssPlugins: [],
        }]);

        // Step 5: Wrap only background.js with the runtime expected by Lynx.
        chain.plugin('runtime-wrapper').use(
          RuntimeWrapperWebpackPlugin,
          [{
            targetSdkVersion: '3.2',
            test: /background\.js$/,
          }],
        );

        // Step 6: Encode the assembled template data into the final bundle.
        chain.plugin('encode').use(LynxEncodePlugin, []);

        // Step 7: Fill template-webpack encodeData from the generated assets
        // before LynxEncodePlugin serializes the bundle.
        chain.plugin('before-encode').use({
          apply(compiler) {
            compiler.hooks.thisCompilation.tap(
              PLUGIN_NAME,
              compilation => {
                const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
                  compilation,
                );
                hooks.beforeEncode.tap(PLUGIN_NAME, args => {
                  // Step 7.1: Read the assets emitted by the custom entries.
                  const backgroundAsset = compilation.getAsset(
                    BACKGROUND_ASSET,
                  );
                  const mainThreadAsset = compilation.getAsset(
                    MAIN_THREAD_ASSET,
                  );
                  const cssChunk = compilation.namedChunks.get(
                    MAIN_THREAD_ENTRY,
                  );
                  const cssChunkFiles = [...(cssChunk?.files ?? [])];
                  const cssAssets = cssChunkFiles
                    .filter(file => file.endsWith('.css'))
                    .map(file => compilation.getAsset(file))
                    .filter(asset => asset !== undefined);

                  if (!backgroundAsset || !mainThreadAsset) {
                    return args;
                  }

                  // Step 7.2: Put background.js into the manifest section.
                  args.encodeData.manifest = {
                    [backgroundAsset.name]: backgroundAsset.source.source()
                      .toString(),
                  };

                  // Step 7.3: Put main-thread.js into the Lepus section.
                  args.encodeData.lepusCode = {
                    root: mainThreadAsset,
                    chunks: [],
                    filename: mainThreadAsset.name,
                  };

                  // Step 7.4: Convert webpack-processed CSS into the encoded
                  // CSS map.
                  args.encodeData.css = {
                    ...LynxTemplatePlugin.convertCSSChunksToMap(
                      cssAssets.map(asset => asset.source.source().toString()),
                      [],
                      Boolean(
                        args.encodeData.compilerOptions.enableCSSSelector,
                      ),
                    ),
                    chunks: [],
                  };

                  return args;
                });
              },
            );
          },
        });
      });
    },
  };
}
