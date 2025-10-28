import { defineConfig } from '@rslib/core'
import { pluginAreTheTypesWrong } from 'rsbuild-plugin-arethetypeswrong'
import { pluginPublint } from 'rsbuild-plugin-publint'
import { TypiaRspackPlugin } from 'typia-rspack-plugin'

export default defineConfig({
  lib: [
    { format: 'esm', syntax: 'es2022', dts: { bundle: true, tsgo: true } },
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
      enable: Boolean(process.env['CI']),
      areTheTypesWrongOptions: {
        ignoreRules: [
          'cjs-resolves-to-esm',
        ],
      },
    }),
    pluginPublint(),
  ],
  tools: {
    rspack: {
      plugins: [
        new TypiaRspackPlugin({ log: false }),
      ],
    },
  },
})
