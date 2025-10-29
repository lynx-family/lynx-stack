// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module';

import type { PluginItem } from '@babel/core';
import type { LoaderContext } from '@rspack/core';

import type { ReactLoaderOptions } from './options.js';

const require = createRequire(import.meta.url);

const missingBabelPackages: string[] = [];
const [
  swcReactCompilerPath,
  babelPath,
  babelPluginReactCompilerPath,
  babelPluginSyntaxJsxPath,
  babelPluginSyntaxTypescriptPath,
] = [
  '@swc/react-compiler',
  '@babel/core',
  'babel-plugin-react-compiler',
  '@babel/plugin-syntax-jsx',
  '@babel/plugin-syntax-typescript',
].map((name) => {
  try {
    return require.resolve(name, {
      paths: [process.cwd()],
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

async function reactCompilerLoader(
  this: LoaderContext<ReactLoaderOptions>,
  content: string,
): Promise<void> {
  const callback = this.async();
  const { isReactCompilerRequired } = require(
    swcReactCompilerPath!,
  ) as typeof import('@swc/react-compiler');
  if (/\.(?:jsx|tsx)$/.test(this.resourcePath)) {
    const needReactCompiler = await isReactCompilerRequired(
      Buffer.from(content),
    );
    if (needReactCompiler) {
      try {
        const babel = require(babelPath!) as typeof import('@babel/core');
        const isTSX = this.resourcePath.endsWith('.tsx');

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
        if (result?.code == null) {
          return callback(
            new Error(
              `babel-plugin-react-compiler transform failed for ${this.resourcePath}`,
            ),
          );
        } else {
          return callback(
            null,
            result.code,
            (result?.map && JSON.stringify(result.map)) ?? undefined,
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
