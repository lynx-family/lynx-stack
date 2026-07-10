import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { defineConfig, type rsbuild } from '@rslib/core'
import { pluginAreTheTypesWrong } from 'rsbuild-plugin-arethetypeswrong'
import { pluginPublint } from 'rsbuild-plugin-publint'

import { BUNDLE_STATS_JSON_OPTIONS } from '../plugin-preset/src/plugins/statsJsonOptions.js'

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      source: {
        entry: {
          index: './src/index.ts',
        },
      },
      dts: {
        bundle: true,
        // There are type-check issues when using tsgo.
        // Excessive stack depth comparing types 'UnionToTuple<ArrayToUnion<[...?]>, LastOf<ArrayToUnion<[...?]>>, [ArrayToUnion<[...?]>] extends [never] ? true : false>' and 'ExtendRuleData<any, string>[]'.ts(2321)
        // See: rsdoctor.plugin.ts
        tsgo: false,
      },
      plugins: [pluginStatsJson()],
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
    },
  ],
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
