import { defineConfig } from '@rslib/core'
import { pluginPublint } from 'rsbuild-plugin-publint'
import { TypiaRspackPlugin } from 'typia-rspack-plugin'

export default defineConfig({
  lib: [
    { format: 'esm', syntax: 'es2022', dts: { bundle: true } },
    {
      format: 'esm',
      syntax: 'es2022',
      source: {
        entry: {
          'cli/main': './src/cli/main.ts',
          'cli/start': './src/cli/start.ts',
        },
      },
      dts: false,
    },
  ],
  source: {
    tsconfigPath: './tsconfig.build.json',
  },
  plugins: [pluginPublint()],
  tools: {
    rspack: {
      optimization: {
        chunkIds: 'named',
      },
      plugins: [
        new TypiaRspackPlugin({
          cache: true,
          include: './src/config/validate.ts',
          tsconfig: './tsconfig.build.json',
        }),
      ],
    },
  },
})
