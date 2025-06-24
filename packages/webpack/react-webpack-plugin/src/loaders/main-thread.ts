// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module';

import type { LoaderContext } from '@rspack/core';

import { getMainThreadTransformOptions } from './loader-options.js';
import type { ReactLoaderOptions } from './loader-options.js';

async function mainThreadLoader(
  this: LoaderContext<ReactLoaderOptions>,
  content: string,
): Promise<void> {
  const callback = this.async();
  const require = createRequire(import.meta.url);
  const { transformReactLynx } = require(
    '@lynx-js/react-transform',
  ) as typeof import('@lynx-js/react-transform');

  const result = await transformReactLynx(
    content,
    getMainThreadTransformOptions.call(this),
  );

  if (result.errors.length > 0) {
    for (const error of result.errors) {
      if (this.experiments?.emitDiagnostic) {
        // Rspack with `emitDiagnostic` API
        try {
          this.experiments.emitDiagnostic({
            message: error,
            sourceCode: content,
            severity: 'error',
          });
        } catch {
          // Rspack may throw on invalid line & column when containing UTF-8.
          // We catch it up here.
          this.emitError(new Error(error));
        }
      } else {
        // Webpack or legacy Rspack
        this.emitError(new Error(error));
      }
    }
    callback(new Error('react-transform failed'));

    return;
  }

  for (const warning of result.warnings) {
    if (this.experiments?.emitDiagnostic) {
      // Rspack with `emitDiagnostic` API
      try {
        this.experiments.emitDiagnostic({
          message: warning,
          sourceCode: content,
          severity: 'warning',
        });
      } catch {
        // Rspack may throw on invalid line & column when containing UTF-8.
        // We catch it up here.
        this.emitWarning(new Error(warning));
      }
    } else {
      // Webpack or legacy Rspack
      this.emitWarning(new Error(warning));
    }
  }

  callback(
    null,
    result.code + (
      this.hot
        // TODO: temporary fix LEPUS error `$RefreshReg$ is not defined`
        // should make react-refresh transform in `react-transform`.
        ? `\
  // noop fns to prevent runtime errors during initialization
  if (typeof globalThis !== "undefined") {
    globalThis.$RefreshReg$ = function () {};
    globalThis.$RefreshSig$ = function () {
      return function(type) {
        return type;
      };
    };
  }
`
        : ''
    ),
    result.map,
  );
}

export default mainThreadLoader;
