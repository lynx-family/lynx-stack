import { defineConfig } from '@lynx-js/rspeedy';
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
} from '@lynx-js/template-webpack-plugin';

export default defineConfig({
  plugins: [
    pluginQRCode({
      schema(url) {
        // We use `?fullscreen=true` to open the page in LynxExplorer in full screen mode
        return `${url}?fullscreen=true`;
      },
    }),
  ],
  source: {
    entry: './src/index.tsx',
  },
  tools: {
    swc: {
      jsc: {
        parser: {
          tsx: true,
          syntax: 'typescript',
        },
        transform: {
          react: {
            runtime: 'automatic',
            throwIfNamespace: false,
          },
        },
      },
    },
    rspack: {
      optimization: {
        splitChunks: false,
      },
      plugins: [
        new LynxEncodePlugin(
          {
            inlineScripts: true,
          },
        ),
        new LynxTemplatePlugin({
          debugInfoOutside: false,
          filename: 'main.lynx.bundle',
          intermediate: 'main',
        }),
      ],
    },
  },
});
