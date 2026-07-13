import { defineConfig, type rsbuild } from '@rslib/core'
import { TypiaRspackPlugin } from 'typia-rspack-plugin'

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      source: {
        entry: {
          index: './src/index.ts',
          // Seam consumed by the `@lynx-js/rspeedy` CLI. See `src/internal.ts`.
          internal: './src/internal.ts',
        },
      },
      dts: { bundle: true },
      plugins: [pluginTypia()],
    },
    {
      format: 'esm',
      syntax: 'es2022',
      source: {
        entry: {
          'register/index': './register/index.js',
          'register/hooks': './register/hooks.js',
        },
      },
      dts: false,
      output: {
        copy: {
          patterns: [
            {
              from: './register/index.d.ts',
              to: './register/index.d.ts',
            },
          ],
        },
        externals: [
          'typescript',
        ],
      },
    },
  ],
  output: {
    externals: [
      '#register',
    ],
  },
  source: {
    tsconfigPath: './tsconfig.build.json',
  },
})

function pluginTypia(): rsbuild.RsbuildPlugin {
  return {
    name: 'rspeedy-plugin-typia',
    setup(api) {
      api.modifyBundlerChain(chain => {
        const { source } = api.getRsbuildConfig()

        chain
          .plugin('typia')
          .use(TypiaRspackPlugin, [
            {
              cache: false,
              include: './src/config/validate.ts',
              tsconfig: source?.tsconfigPath,
              log: false,
            },
          ])
      })
    },
  }
}
