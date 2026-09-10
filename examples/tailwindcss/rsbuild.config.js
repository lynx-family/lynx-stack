import { defineConfig } from '@rsbuild/core';
import { pluginTailwindCSS } from 'rsbuild-plugin-tailwindcss';

import { pluginLynxConfig } from '@lynx-js/config-rsbuild-plugin';
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

export default defineConfig({
  source: {
    entry: {
      main: './src/index.tsx',
    },
  },
  environments: {
    lynx: {},
  },
  plugins: [
    pluginReactLynx(),
    pluginQRCode({
      schema(url) {
        // We use `?fullscreen=true` to open the page in LynxExplorer in full screen mode
        return `${url}?fullscreen=true`;
      },
    }),
    pluginTailwindCSS({
      config: 'tailwind.config.ts',
      exclude: [/[\\/]node_modules[\\/]/],
    }),
    pluginLynxConfig({
      enableCSSInlineVariables: true,
      // required for CSS Logical Properties support
      enableCSSInheritance: true,
    }),
  ],
});
