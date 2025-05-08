import { createRsbuild } from '@rsbuild/core';
import { describe, expect, test, vi } from 'vitest';
import { pluginWebPlatform } from '../dist/index.js';
import path from 'path';
import type { Stats, NormalModule } from '@rspack/core';

describe('Bundle Build', () => {
  test('native-modules bundle', async () => {
    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        source: {
          entry: {
            main: path.resolve(__dirname, './fixtures/index.ts'),
          },
        },
        output: {
          distPath: {
            root: path.resolve(__dirname, './dist/native-modules-bundle'),
          },
        },
        plugins: [
          pluginWebPlatform({
            nativeModulesPath: path.resolve(
              __dirname,
              './fixtures/index.native-modules.ts',
            ),
          }),
        ],
        performance: {
          chunkSplit: {
            strategy: 'all-in-one',
          },
        },
      },
    });

    let asyncChunkImportCount = 0;
    let syncChunkImportCount = 0;
    await rsbuild.initConfigs();
    const buildInfo = await rsbuild.build();
    for (
      const i of (buildInfo.stats as Stats).compilation.chunks.values() || []
    ) {
      const modules = (buildInfo.stats as Stats).compilation.chunkGraph
        .getChunkModules(i) as NormalModule[];

      for (const m of modules) {
        if (
          m.type === 'javascript/auto'
          && m.userRequest.includes('tests/fixtures/index.native-modules.ts')
        ) {
          if (!i.isOnlyInitial()) {
            asyncChunkImportCount++;
          } else {
            syncChunkImportCount++;
          }
        }
      }
    }
    expect(asyncChunkImportCount).toBe(1);
    expect(syncChunkImportCount).toBe(0);
  });
});
