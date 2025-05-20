// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// TODO: refactor: use rslib
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { rspack } from '@rspack/core';

const { swc } = rspack.experiments;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const swcPluginCompat = path.resolve(__dirname, './swc-plugin-reactlynx-compat/swc_plugin_reactlynx_compat.wasm');
const swcPluginReactLynx = path.resolve(__dirname, './swc-plugin-reactlynx/swc_plugin_reactlynx.wasm');

const transformReactLynx = async (source, options) => {
  const swcPluginReactLynxOptions = {
    filename: options?.filename ?? '',
    mode: options?.mode ?? 'production',
    cssScope: options?.cssScope ?? {
      mode: 'none',
      filename: '',
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

  if (typeof options?.jsx === 'object') {
    swcPluginReactLynxOptions.snapshot = options.jsx;
  }

  const transformOptions = {
    sourceMaps: options?.sourcemap ?? false,
    isModule: options?.isModule ?? true,
    jsc: {
      transform: {
        react: {
          throwIfNamespace: false,
          importSource: '@lynx-js/react',
          runtime: 'automatic',
        },
      },
      target: 'es2022',
      parser: {
        syntax: 'ecmascript',
        jsx: true,
      },
      experimental: {
        plugins: [
          [swcPluginReactLynx, swcPluginReactLynxOptions],
        ],
      },
    },
  };

  if (options?.compat) {
    if (typeof options?.compat === 'object') {
      transformOptions.jsc.experimental.plugins.unshift([swcPluginCompat, options?.compat]);
    } else {
      transformOptions.jsc.experimental.plugins.unshift([swcPluginCompat, {}]);
    }
  }

  if (options?.sourceFileName) {
    transformOptions.sourceFileName = options?.sourceFileName;
  }

  if (options?.inlineSourcesContent) {
    transformOptions.inlineSourcesContent = options?.inlineSourcesContent;
  }

  if (options?.syntaxConfig) {
    transformOptions.jsc.parser = options?.syntaxConfig;
  }

  const result = {
    code: '',
    map: null,
    warnings: [],
    errors: [],
  };

  try {
    const transformResult = await swc.transform(source, transformOptions);
    result.code = transformResult.code;
    result.map = transformResult.map;
    result.warnings = transformResult.diagnostics;
  } catch (e) {
    result.errors.push(e);
  }

  return result;
};

export { transformReactLynx };
