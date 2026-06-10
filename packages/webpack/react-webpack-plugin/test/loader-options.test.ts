// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { getBackgroundTransformOptions } from '../src/loaders/options.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createLoaderContext(options: Record<string, unknown>) {
  return {
    getOptions: () => options,
    hot: false,
    resourcePath: path.resolve(__dirname, 'fixture.tsx'),
    rootContext: __dirname,
    sourceMap: false,
  };
}

describe('loader options', () => {
  it('uses ET backend with all CSS scoped when enableRemoveCSSScope is false', () => {
    const context = createLoaderContext({
      enableRemoveCSSScope: false,
      experimental_useElementTemplate: true,
    });

    const backgroundOptions = getBackgroundTransformOptions.call(
      context,
      undefined,
    );

    expect(backgroundOptions.cssScope).toMatchObject({
      mode: 'all',
      filename: 'fixture.tsx',
    });
    expect(backgroundOptions.snapshot).toBe(false);
    expect(backgroundOptions.elementTemplate).toMatchObject({
      runtimePkg: '@lynx-js/react/element-template',
      target: 'JS',
    });
  });
});
