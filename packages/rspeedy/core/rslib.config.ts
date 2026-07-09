import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig, type rsbuild } from '@rslib/core'
import { pluginAreTheTypesWrong } from 'rsbuild-plugin-arethetypeswrong'
import { pluginPublint } from 'rsbuild-plugin-publint'

import { BUNDLE_STATS_JSON_OPTIONS } from './src/plugins/statsJsonOptions.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      dts: {
        bundle: true,
      },
      plugins: [pluginTypia(), pluginStatsJson()],
    },
    {
      format: 'esm',
      syntax: 'es2022',
      source: {
        entry: {
          'cli/main': './src/cli/main.ts',
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
      '#register',
    ],
  },
  plugins: [
    pluginAreTheTypesWrong({
      areTheTypesWrongOptions: {
        ignoreRules: [
          'cjs-resolves-to-esm',
        ],
      },
    }),
    pluginPublint(),
  ],
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
  const project = path.join(dirname, 'tsconfig.build.json')
  const source = path.join(dirname, 'src/config/validate.ts')

  return {
    name: 'rspeedy-plugin-typia',
    setup(api) {
      api.modifyBundlerChain(chain => {
        chain
          .module
          .rule('ttsc-typia')
          .test(/\.[cm]?tsx?$/)
          .include
          .add(source)
          .end()
          .enforce('pre')
          .use('ttsc')
          .loader('@ttsc/unplugin/turbopack')
          .options(
            {
              project,
            },
          )
      })
    },
  }
}

// https://rsbuild.rs/guide/upgrade/v1-to-v2#remove-performanceprofile
function pluginStatsJson(): rsbuild.RsbuildPlugin {
  return {
    name: 'rspeedy:stats-json',
    setup(api) {
      if (!process.env.RSPEEDY_BUNDLE_ANALYSIS) {
        return
      }

      api.onAfterBuild(({ stats }) => {
        if (!stats) {
          return
        }

        mkdirSync(api.context.distPath, { recursive: true })
        writeFileSync(
          path.join(api.context.distPath, 'stats.json'),
          JSON.stringify(stats.toJson(BUNDLE_STATS_JSON_OPTIONS), null, 2),
        )
      })
    },
  }
}
