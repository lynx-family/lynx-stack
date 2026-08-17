// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { LoaderContext } from '@rspack/core';
import { describe, expect, it } from '@rstest/core';

import {
  getBackgroundTransformOptions,
  getMainThreadTransformOptions,
} from '../src/loaders/options.js';
import type { ReactLoaderOptions } from '../src/loaders/options.js';

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
    addDependency: () => {
      // No-op for this loader-options unit test.
    },
    getOptions: () => options,
    hot: false,
    resourcePath: path.resolve(__dirname, 'fixture.tsx'),
    rootContext: __dirname,
    sourceMap: false,
  } as unknown as LoaderContext<ReactLoaderOptions>;
}

describe('loader options', () => {
  it('normalizes the legacy event attribute-name transform option', () => {
    for (
      const [compat, expected] of [
        [{}, true],
        [{ transformLegacyEventAttributeNames: false }, false],
      ] as const
    ) {
      const context = createLoaderContext({ compat });

      expect(
        getMainThreadTransformOptions.call(context, '', undefined).compat,
      ).toHaveProperty('transformLegacyEventAttributeNames', expected);
      expect(
        getBackgroundTransformOptions.call(context, '', undefined).compat,
      ).toHaveProperty('transformLegacyEventAttributeNames', expected);
    }
  });

  it('passes camelCase attribute conversion as a transform option', () => {
    const context = createLoaderContext({
      experimental_transformBuiltinAttributeNames:
        transformBuiltinAttributeNames,
    });

    expect(
      getMainThreadTransformOptions.call(context, '', undefined)
        .experimental_transformBuiltinAttributeNames,
    ).toBe(transformBuiltinAttributeNames);
    expect(
      getBackgroundTransformOptions.call(context, '', undefined)
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
      '',
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
      '',
      undefined,
    );
    const backgroundOptions = getBackgroundTransformOptions.call(
      context,
      '',
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
    expect(
      typeof mainThreadOptions.dynamicImport === 'object'
        ? mainThreadOptions.dynamicImport.runtimePkg
        : undefined,
    ).not.toBe(
      '@lynx-js/react/element-template/internal',
    );
    expect(
      typeof backgroundOptions.dynamicImport === 'object'
        ? backgroundOptions.dynamicImport.runtimePkg
        : undefined,
    ).not.toBe(
      '@lynx-js/react/element-template/internal',
    );
  });

  it('passes identical explicit inference declarations to both layers', () => {
    const declarations = {
      protocolVersion: 1 as const,
      modules: [{
        source: 'fake-package',
        package: 'fake-package',
        exports: {
          consume: { args: { 0: true as const } },
        },
      }],
    };
    const context = createLoaderContext({
      directiveInference: { declarations },
    });
    const source = 'import { consume } from "fake-package";';

    expect(
      getMainThreadTransformOptions.call(context, source, undefined)
        .directiveInference,
    ).toEqual(declarations);
    expect(
      getBackgroundTransformOptions.call(context, source, undefined)
        .directiveInference,
    ).toEqual(declarations);
  });
});
