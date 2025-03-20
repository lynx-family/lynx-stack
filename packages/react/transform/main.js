// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { transformSync } from '@swc/core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const swcPluginCompat = path.resolve(__dirname, './swc-plugin-compat/swc_plugin_compat.wasm');
const swcPluginReactLynx = path.resolve(__dirname, './swc-plugin-react-lynx/swc_plugin_react_lynx.wasm');

function transformReactLynx(input, plugins, reactConfig, parserConfig, swcConfig) {
  const result = transformSync(input, {
    sourceMaps: true,
    isModule: true,
    jsc: {
      transform: {
        react: {
          throwIfNamespace: false,
          importSource: '@lynx-js/react',
          ...reactConfig,
        },
      },
      target: 'es2022',
      parser: {
        syntax: 'ecmascript',
        jsx: true,
        ...parserConfig,
      },
      experimental: {
        plugins,
      },
    },
    ...swcConfig,
  });

  return result;
}

export { transformReactLynx, swcPluginCompat, swcPluginReactLynx };
