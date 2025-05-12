import { defineConfig, type rsbuild } from '@rslib/core'
import { pluginPublint } from 'rsbuild-plugin-publint'
import { TypiaRspackPlugin } from 'typia-rspack-plugin'

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      dts: { bundle: true },
      plugins: [pluginTypia()],
      performance: {
        profile: !!process.env.RSPEEDY_BUNDLE_ANALYSIS,
      },
    },
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
      '@lynx-js/rspeedy/register',
    ],
  },
  plugins: [pluginPublint()],
  source: {
    tsconfigPath: './tsconfig.build.json',
  },
  tools: {
    rspack: {
      optimization: {
        chunkIds: 'named',
      },
    },
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
