import { createRsbuild } from '@rsbuild/core';
import { describe, expect, test, vi } from 'vitest';
import { pluginWebPlatform } from '../src/index.js';

describe('Config', () => {
  test('basic config', async () => {
    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        plugins: [
          pluginWebPlatform(),
        ],
      },
    });

    await rsbuild.initConfigs();
    const rsbuildConfig = rsbuild.getRsbuildConfig();

    expect(rsbuildConfig.source?.include).toMatchSnapshot();
    expect(rsbuildConfig.output?.polyfill).toBe('usage');
  });
});
