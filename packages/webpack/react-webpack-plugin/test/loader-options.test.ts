// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from '@rstest/core';

import {
  getBackgroundTransformOptions,
  getMainThreadTransformOptions,
} from '../src/loaders/options.js';

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
  it('enables camelCase attributes in both transform backends and compilation macros', () => {
    for (const experimental_useElementTemplate of [false, true]) {
      const context = createLoaderContext({
        enableCamelCaseAttributes: true,
        experimental_useElementTemplate,
      });

      for (
        const options of [
          getMainThreadTransformOptions.call(context, undefined),
          getBackgroundTransformOptions.call(context, undefined),
        ]
      ) {
        const transformOptions = experimental_useElementTemplate
          ? options.elementTemplate
          : options.snapshot;
        expect(transformOptions).toMatchObject({
          enableCamelCaseAttributes: true,
        });
        expect(options.defineDCE).toMatchObject({
          define: {
            __ENABLE_CAMEL_CASE_ATTRIBUTES__: 'true',
          },
        });
      }
    }
  });

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

  it('keeps ET dynamic import output on the aliasable internal runtime package', () => {
    const context = createLoaderContext({
      experimental_useElementTemplate: true,
    });

    const mainThreadOptions = getMainThreadTransformOptions.call(
      context,
      undefined,
    );
    const backgroundOptions = getBackgroundTransformOptions.call(
      context,
      undefined,
    );

    expect(mainThreadOptions.dynamicImport).toMatchObject({
      layer: 'react__main-thread',
      runtimePkg: '@lynx-js/react/internal',
    });
    expect(backgroundOptions.dynamicImport).toMatchObject({
      layer: 'react__background',
      runtimePkg: '@lynx-js/react/internal',
    });
    expect(mainThreadOptions.dynamicImport?.runtimePkg).not.toBe(
      '@lynx-js/react/element-template/internal',
    );
    expect(backgroundOptions.dynamicImport?.runtimePkg).not.toBe(
      '@lynx-js/react/element-template/internal',
    );
  });
});
