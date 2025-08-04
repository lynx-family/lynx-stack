// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { LoaderContext } from '@rspack/core';

import { load } from './loader.js';
import type { Dep, LoaderOptions } from './loader.js';

export async function pitch(
  this: LoaderContext<LoaderOptions>,
  request: string,
  /** previousRequest */ _: string,
  data: Record<string, unknown>,
): Promise<void> {
  if (this._compiler?.options?.experiments?.css) {
    this.emitWarning(
      new Error(
        'You can\'t use `experiments.css` (`experiments.futureDefaults` enable built-in CSS support by default) and `@lynx-js/css-extract-webpack-plugin` together, please set `experiments.css` to `false` or set `{ type: "javascript/auto" }` for rules with `@lynx-js/css-extract-webpack-plugin` in your webpack config (now `@lynx-js/css-extract-webpack-plugin` does nothing).',
      ),
    );

    return;
  }

  const callback = this.async();

  // @ts-expect-error compatible with rspack < 1.4.9
  // See: https://github.com/web-infra-dev/rspack/pull/7878
  const parseMeta = this.__internal__parseMeta as Record<string, string>;

  try {
    // Rspack does not return error in `importModule`.
    // So the `load` function may crash.
    // We make an temporary try-catch here.
    // See: https://github.com/web-infra-dev/rspack/issues/8536
    const resultSource = await load.call(
      // @ts-expect-error webpack & rspack loaderContext
      this,
      request,
      addDependencies.bind(this),
    );

    callback(
      null,
      resultSource,
      undefined,
      data,
    );
  } catch (error) {
    callback(error as Error);
  }

  function addDependencies(
    this: LoaderContext<LoaderOptions>,
    dependencies: Dep[],
  ) {
    const deps = JSON.stringify(dependencies.map(dep => ({
      ...dep,
      content: dep.content.toString('utf-8'),
      sourceMap: dep.sourceMap?.toString('utf-8'),
    })));

    // `this.__internal__setParseMeta` has been added in rspack 1.4.9
    // See: https://github.com/web-infra-dev/rspack/pull/11083
    if (typeof this.__internal__setParseMeta === 'function') {
      this.__internal__setParseMeta(
        this._compiler.webpack.CssExtractRspackPlugin.pluginName,
        deps,
      );
    } else {
      parseMeta[
        this._compiler.webpack.CssExtractRspackPlugin.pluginName
      ] = deps;
    }
  }
}

export default function loader(
  this: LoaderContext<LoaderOptions>,
  content: string,
): string | undefined {
  if (this._compiler?.options?.experiments?.css) {
    return content;
  }

  return;
}
