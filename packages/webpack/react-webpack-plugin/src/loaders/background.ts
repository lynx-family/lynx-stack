// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module';

import type { LoaderContext } from '@rspack/core';

import { getBackgroundTransformOptions } from './loader-options.js';
import type { ReactLoaderOptions } from './loader-options.js';

async function backgroundLoader(
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
    getBackgroundTransformOptions.call(this),
  );

  if (result.errors.length > 0) {
    for (const error of result.errors) {
      if (this.experiments?.emitDiagnostic) {
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
  callback(null, result.code, result.map);
}

export default backgroundLoader;
