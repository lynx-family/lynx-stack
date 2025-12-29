// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRsbuild } from '@rsbuild/core';
import { describe, expect, test } from 'vitest';
import path from 'path';
import { pluginWebPlatform } from '../dist/index.js';

describe('Basic', () => {
  test('basic bundle', async () => {
    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        source: {
          entry: {
            main: path.resolve(__dirname, './fixtures/index.ts'),
          },
        },
        output: {
          distPath: {
            root: path.resolve(__dirname, './dist/basic'),
          },
        },
        plugins: [
          pluginWebPlatform(),
        ],
      },
    });

    await rsbuild.build();
    expect(1).toBe(1);
  });
});
