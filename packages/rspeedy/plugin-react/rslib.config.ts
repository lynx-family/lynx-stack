import { defineConfig } from '@rslib/core'
import { pluginAreTheTypesWrong } from 'rsbuild-plugin-arethetypeswrong'
import { pluginPublint } from 'rsbuild-plugin-publint'
import { TypiaRspackPlugin } from 'typia-rspack-plugin'

export default defineConfig({
  lib: [
    { format: 'esm', syntax: 'es2022', dts: { bundle: true, tsgo: false } },
  ],
  source: {
    entry: {
      'loaders/ignore-css-loader': './src/loaders/ignore-css-loader.ts',
      'loaders/invalid-import-error-loader':
        './src/loaders/invalid-import-error-loader.ts',
      index: './src/index.ts',
    },
    tsconfigPath: './tsconfig.build.json',
  },
  output: {
    externals: [
      '@rsbuild/core',
    ],
  },
  plugins: [
    pluginAreTheTypesWrong({
      // TODO: enable it
      enable: false,
      areTheTypesWrongOptions: {
        ignoreRules: [
          'cjs-resolves-to-esm',
        ],
      },
    }),
    pluginPublint({
      // TODO: enable it
      enable: false,
    }),
  ],
  tools: {
    rspack: {
      plugins: [
        new TypiaRspackPlugin({ log: false }),
      ],
    },
  },
})
