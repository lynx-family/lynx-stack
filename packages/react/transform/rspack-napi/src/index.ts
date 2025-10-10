// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module';

import { rspack } from '@rspack/core';
import type { SwcLoaderParserConfig } from '@rspack/core';

import type {
  CssScopeVisitorConfig,
  DefineDceVisitorConfig,
  DirectiveDceVisitorConfig,
  DynamicImportVisitorConfig,
  InjectVisitorConfig,
  JsxTransformerConfig,
  ReactLynxTransformOptions,
  ShakeVisitorConfig,
  WorkletVisitorConfig,
} from '@lynx-js/swc-plugin-reactlynx';
import type { CompatVisitorConfig } from '@lynx-js/swc-plugin-reactlynx-compat';

export interface TransformReactLynxOptions {
  /**
   * @internal
   * This is used internally to make sure the test output is consistent.
   */
  mode?: 'production' | 'development' | 'test';
  filename?: string;
  sourceFileName?: string;
  sourcemap: boolean | 'inline';
  sourceMapColumns?: boolean;
  inlineSourcesContent?: boolean;
  /**
   * @public
   * This is swc syntax config in JSON format
   */
  syntaxConfig?: SwcLoaderParserConfig;
  isModule?: boolean | 'unknown';
  cssScope: boolean | CssScopeVisitorConfig;
  snapshot?: boolean | JsxTransformerConfig;
  shake: boolean | ShakeVisitorConfig;
  compat: boolean | CompatVisitorConfig;
  defineDCE: boolean | DefineDceVisitorConfig;
  directiveDCE: boolean | DirectiveDceVisitorConfig;
  worklet: boolean | WorkletVisitorConfig;
  dynamicImport?: boolean | DynamicImportVisitorConfig;
  /** @internal */
  inject?: boolean | InjectVisitorConfig;
}

export interface TransformReactLynxOutput {
  code: string;
  map?: string | undefined;
  errors: string[];
  warnings: string[];
}

type SwcTransformOptions = Parameters<typeof rspack.experiments.swc.transform>[1];

const { swc } = rspack.experiments;
const require = createRequire(import.meta.url);

const transformReactLynx = async (
  source: string,
  options?: TransformReactLynxOptions,
): Promise<TransformReactLynxOutput> => {
  const swcPluginReactLynxOptions: ReactLynxTransformOptions = {
    filename: options?.filename ?? 'test.js',
    mode: options?.mode ?? 'production',
    cssScope: options?.cssScope ?? {
      mode: 'none',
      filename: options?.filename ?? 'test.js',
    },
    shake: options?.shake ?? false,
    defineDCE: options?.defineDCE ?? false,
    directiveDCE: options?.directiveDCE ?? false,
    worklet: options?.worklet ?? false,
    dynamicImport: options?.dynamicImport ?? {
      runtimePkg: '@lynx-js/react/internal',
      layer: '',
    },
    inject: options?.inject ?? false,
  };

  if (typeof options?.snapshot === 'object') {
    swcPluginReactLynxOptions.snapshot = options.snapshot;
  }

  const transformOptions: SwcTransformOptions = {
    filename: options?.filename ?? 'test.js',
    sourceMaps: options?.sourcemap ?? false,
    isModule: options?.isModule ?? true,
    jsc: {
      transform: {
        react: {
          throwIfNamespace: false,
          importSource: (options?.snapshot && typeof options.snapshot === 'object')
            ? options.snapshot.jsxImportSource ?? '@lynx-js/react'
            : '@lynx-js/react',
          runtime: 'automatic',
          development: options?.mode ? options?.mode === 'development' : false,
        },
      },
      target: 'es2022',
      parser: {
        syntax: 'ecmascript',
        jsx: true,
      },
      experimental: {
        plugins: [
          [require.resolve('@lynx-js/swc-plugin-reactlynx'), swcPluginReactLynxOptions],
        ],
      },
    },
  };

  if (options?.compat) {
    if (typeof options?.compat === 'object') {
      transformOptions.jsc!.experimental!.plugins!.unshift([
        require.resolve('@lynx-js/swc-plugin-reactlynx-compat'),
        options?.compat,
      ]);
    } else {
      transformOptions.jsc!.experimental!.plugins!.unshift([
        require.resolve('@lynx-js/swc-plugin-reactlynx-compat'),
        {},
      ]);
    }
  }

  if (options?.sourceFileName) {
    transformOptions.sourceFileName = options?.sourceFileName;
  }

  if (options?.inlineSourcesContent) {
    transformOptions.inlineSourcesContent = options?.inlineSourcesContent;
  }

  if (options?.syntaxConfig) {
    transformOptions.jsc!.parser = options?.syntaxConfig;
  }

  const result: TransformReactLynxOutput = {
    code: '',
    warnings: [],
    errors: [],
  };

  try {
    const transformResult = await swc.transform(source, transformOptions);
    result.code = transformResult.code;
    result.map = transformResult.map;
    result.warnings = transformResult.diagnostics;
  } catch (e) {
    result.errors.push(String(e));
  }

  return result;
};

export { transformReactLynx };
