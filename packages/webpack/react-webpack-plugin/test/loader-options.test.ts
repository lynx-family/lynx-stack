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

const transformBuiltinAttributeNames = {
  mode: 'dash-case',
  preserve: ['tailColorConvert'],
  rename: {
    textMaxline: 'custom-maxline',
  },
} as const;

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
  it('passes camelCase attribute conversion as a transform option', () => {
    const context = createLoaderContext({
      experimental_transformBuiltinAttributeNames:
        transformBuiltinAttributeNames,
    });

    expect(
      getMainThreadTransformOptions.call(context, undefined)
        .experimental_transformBuiltinAttributeNames,
    ).toBe(transformBuiltinAttributeNames);
    expect(
      getBackgroundTransformOptions.call(context, undefined)
        .experimental_transformBuiltinAttributeNames,
    ).toBe(transformBuiltinAttributeNames);
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

  it('turns on stubbing, in-place recording and scoped collection for the background-only assembly', () => {
    const context = createLoaderContext({
      experimental_backgroundOnlyAssembly: true,
    });

    const mainThreadOptions = getMainThreadTransformOptions.call(
      context,
      undefined,
    );
    const backgroundOptions = getBackgroundTransformOptions.call(
      context,
      undefined,
    );

    expect(mainThreadOptions.stubBackgroundOnlyModules).toBe(true);
    expect(mainThreadOptions.collectMTSInPlaceDefines).toBe(true);
    expect(mainThreadOptions.collectMTSDefines).toBeUndefined();
    expect(backgroundOptions.collectMTSDefinesBackgroundOnly).toBe(true);
    expect(backgroundOptions.collectMTSDefines).toBeUndefined();
  });

  it('keeps the background-only assembly off under HMR, where the main thread compiles MIXED', () => {
    const context = {
      ...createLoaderContext({ experimental_backgroundOnlyAssembly: true }),
      hot: true,
    };

    const mainThreadOptions = getMainThreadTransformOptions.call(
      context,
      undefined,
    );
    const backgroundOptions = getBackgroundTransformOptions.call(
      context,
      undefined,
    );

    expect(mainThreadOptions.stubBackgroundOnlyModules).toBeUndefined();
    expect(mainThreadOptions.collectMTSInPlaceDefines).toBeUndefined();
    expect(backgroundOptions.collectMTSDefinesBackgroundOnly).toBeUndefined();
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
