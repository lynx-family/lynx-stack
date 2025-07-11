// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module';

import babel from '@babel/core';
import type { LoaderContext } from '@rspack/core';
import BabelPluginReactCompiler from 'babel-plugin-react-compiler';

import type { ReactLoaderOptions } from './options.js';

function reactCompilerLoader(
  this: LoaderContext<ReactLoaderOptions>,
  content: string,
): void {
  const require = createRequire(import.meta.url);
  const { transformPath = '@lynx-js/react/transform' } = this.getOptions();
  const { isReactCompilerRequiredSync } = require(
    transformPath,
  ) as typeof import('@lynx-js/react/transform');
  if (/\.(?:jsx|tsx)$/.test(this.resourcePath)) {
    const isReactCompilerRequired = isReactCompilerRequiredSync(content);
    if (isReactCompilerRequired) {
      const result = babel.transformSync(content, {
        plugins: [
          [BabelPluginReactCompiler, { target: '17' }],
          '@babel/plugin-syntax-jsx',
        ],
        filename: this.resourcePath,
        ast: false,
        sourceMaps: true,
      });
      if (result?.code && result?.map) {
        this.callback(null, result.code, JSON.stringify(result.map));
        return;
      } else {
        this.callback(
          new Error('babel-plugin-react-compiler transform failed'),
        );
        return;
      }
    }
  }
  this.callback(null, content);
}

export default reactCompilerLoader;
