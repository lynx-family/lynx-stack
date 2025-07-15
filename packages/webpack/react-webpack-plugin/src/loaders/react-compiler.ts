// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module';

import type { PluginItem } from '@babel/core';
import type { LoaderContext } from '@rspack/core';

import type { ReactLoaderOptions } from './options.js';

async function reactCompilerLoader(
  this: LoaderContext<ReactLoaderOptions>,
  content: string,
): Promise<void> {
  const callback = this.async();
  const require = createRequire(import.meta.url);
  const { transformPath = '@lynx-js/react/transform' } = this.getOptions();
  const { isReactCompilerRequired } = require(
    transformPath,
  ) as typeof import('@lynx-js/react/transform');
  if (/\.(?:jsx|tsx)$/.test(this.resourcePath)) {
    const isTSX = this.resourcePath.endsWith('.tsx');

    const needReactCompiler = await isReactCompilerRequired(content);
    if (needReactCompiler) {
      try {
        const missingBabelPackages: string[] = [];
        const [
          babelPath,
          babelPluginReactCompilerPath,
          babelPluginSyntaxJsxPath,
          babelPluginSyntaxTypescriptPath,
        ] = [
          '@babel/core',
          'babel-plugin-react-compiler',
          '@babel/plugin-syntax-jsx',
          '@babel/plugin-syntax-typescript',
        ].map((name) => {
          try {
            return require.resolve(name, {
              paths: [this.rootContext],
            });
          } catch {
            missingBabelPackages.push(name);
          }
          return '';
        });
        if (missingBabelPackages.length > 0) {
          throw new Error(
            `With \`experimental_enableReactCompiler\` enabled, you need to install \`${
              missingBabelPackages.join(
                '`, `',
              )
            }\` in your project root to use React Compiler.`,
          );
        }

        const babel = require(babelPath!) as typeof import('@babel/core');

        const result = babel.transformSync(content, {
          plugins: [
            // We use '17' to make `babel-plugin-react-compiler` compiles our code
            // to use `react-compiler-runtime` instead of `react/compiler-runtime`
            // for the `useMemoCache` hook
            [babelPluginReactCompilerPath!, { target: '17' }],
            babelPluginSyntaxJsxPath!,
            isTSX ? [babelPluginSyntaxTypescriptPath, { isTSX: true }] : null,
          ].filter(Boolean) as PluginItem[],
          filename: this.resourcePath,
          ast: false,
          sourceMaps: this.sourceMap,
        });
        if (result?.code != null && result?.map != null) {
          return callback(null, result.code, JSON.stringify(result.map));
        } else {
          return callback(
            new Error(
              `babel-plugin-react-compiler transform failed for ${this.resourcePath}: ${
                result ? 'missing code or map' : 'no result'
              }`,
            ),
          );
        }
      } catch (e) {
        return callback(e as Error);
      }
    }
  }
  return callback(null, content);
}

export default reactCompilerLoader;
