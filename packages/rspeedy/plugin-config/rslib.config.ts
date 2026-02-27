import { defineConfig } from '@rslib/core'
import { TypiaRspackPlugin } from 'typia-rspack-plugin'

export default defineConfig({
  lib: [
    { format: 'esm', syntax: 'es2022', dts: { bundle: true } },
  ],
  source: {
    tsconfigPath: './tsconfig.build.json',
  },
  tools: {
    rspack: {
      plugins: [
        new TypiaRspackPlugin({ log: false }),
      ],
    },
  },
})
