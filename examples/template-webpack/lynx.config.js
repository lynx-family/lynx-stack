import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';
import { RuntimeWrapperWebpackPlugin } from '@lynx-js/runtime-wrapper-webpack-plugin';
import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
} from '@lynx-js/template-webpack-plugin';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const MAIN_THREAD_ASSET = '.rspeedy/card/main-thread.js';
const BACKGROUND_ASSET = '.rspeedy/card/background.js';
const CSS_SOURCE = readFileSync(
  path.join(projectRoot, 'src/style.css'),
  'utf8',
);

function pluginTemplateWebpack() {
  return {
    name: 'example:template-webpack',
    setup(api) {
      api.modifyBundlerChain((chain) => {
        chain.entryPoints.clear();

        chain.entry('card__background').add({
          import: path.join(projectRoot, 'src/background.ts'),
          filename: BACKGROUND_ASSET,
        });

        chain.entry('card__main-thread').add({
          import: path.join(projectRoot, 'src/main-thread.ts'),
          filename: MAIN_THREAD_ASSET,
        });

        chain.plugin('example:template').use(LynxTemplatePlugin, [{
          ...LynxTemplatePlugin.defaultOptions,
          filename: 'card.bundle',
          intermediate: '.rspeedy/card',
          chunks: ['card__background', 'card__main-thread'],
          dsl: 'react_nodiff',
          cssPlugins: [],
        }]);

        chain.plugin('example:runtime-wrapper').use(
          RuntimeWrapperWebpackPlugin,
          [{
            targetSdkVersion: '3.2',
            test: /background\.js$/,
          }],
        );

        chain.plugin('example:encode').use(LynxEncodePlugin, []);

        chain.plugin('example:before-encode').use({
          apply(compiler) {
            compiler.hooks.thisCompilation.tap(
              'example:template-webpack',
              compilation => {
                const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
                  compilation,
                );
                hooks.beforeEncode.tap('example:template-webpack', args => {
                  const backgroundAsset = compilation.getAsset(
                    BACKGROUND_ASSET,
                  );
                  const mainThreadAsset = compilation.getAsset(
                    MAIN_THREAD_ASSET,
                  );

                  if (!backgroundAsset || !mainThreadAsset) {
                    return args;
                  }

                  args.encodeData.manifest = {
                    [backgroundAsset.name]: backgroundAsset.source.source()
                      .toString(),
                  };
                  args.encodeData.lepusCode = {
                    root: mainThreadAsset,
                    chunks: [],
                    filename: mainThreadAsset.name,
                  };
                  args.encodeData.css = {
                    ...LynxTemplatePlugin.convertCSSChunksToMap(
                      [CSS_SOURCE],
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

export default defineConfig({
  dev: {
    hmr: false,
    liveReload: false,
  },
  output: {
    distPath: {
      root: path.join(projectRoot, 'dist'),
    },
    filename: 'card.bundle',
  },
  plugins: [
    pluginTemplateWebpack(),
    pluginQRCode({
      schema(url) {
        return `${url}?fullscreen=true`;
      },
    }),
  ],
});
