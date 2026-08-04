// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module';

import type { LoaderDefinitionFunction } from '@rspack/core';

import { MTS_ISLANDS_BUILD_INFO } from '../MainThreadIslands.js';
import type { MTSIslands } from '../MainThreadIslands.js';
import { MTS_DEFINES_BUILD_INFO } from '../MTSDefinesRuntimeModule.js';
import type { MTSDefine } from '../MTSDefinesRuntimeModule.js';
import { extractRootFallback } from './extractRootFallback.js';
import { getBackgroundTransformOptions } from './options.js';
import type { ReactLoaderOptions } from './options.js';

const backgroundLoader: LoaderDefinitionFunction<ReactLoaderOptions> = function(
  content,
  sourceMap,
): void {
  const require = createRequire(import.meta.url);
  const { transformPath = '@lynx-js/react/transform' } = this.getOptions();
  const { transformReactLynxSync } = require(
    transformPath,
  ) as typeof import('@lynx-js/react/transform');
  let swcInputSourceMap: string | undefined;
  if (this.sourceMap && sourceMap) {
    if (typeof sourceMap === 'string') {
      swcInputSourceMap = sourceMap;
    } else {
      swcInputSourceMap = JSON.stringify(sourceMap);
    }
  }

  const result = transformReactLynxSync(
    content,
    getBackgroundTransformOptions.call(this, swcInputSourceMap),
  );

  if (result.errors.length > 0) {
    for (const error of result.errors) {
      if (this.experiments?.emitDiagnostic) {
        // Rspack with `emitDiagnostic` API
        try {
          this.experiments.emitDiagnostic({
            message: error.text!,
            sourceCode: content,
            location: {
              line: error.location?.line ?? 1,
              column: error.location?.column ?? 0,
              length: error.location?.length ?? 0,
              text: error.text ?? '',
            },
            severity: 'error',
          });
        } catch {
          // Rspack may throw on invalid line & column when containing UTF-8.
          // We catch it up here.
          this.emitError(new Error(error.text));
        }
      } else {
        // Webpack or legacy Rspack
        this.emitError(new Error(error.text));
      }
    }
    this.callback(new Error('react-transform failed'));

    return;
  }

  for (const warning of result.warnings) {
    if (this.experiments?.emitDiagnostic) {
      // Rspack with `emitDiagnostic` API
      try {
        this.experiments.emitDiagnostic({
          message: warning.text!,
          sourceCode: content,
          location: {
            line: warning.location?.line ?? 1,
            column: warning.location?.column ?? 0,
            length: warning.location?.length ?? 0,
            text: warning.text ?? '',
          },
          severity: 'warning',
        });
      } catch {
        // Rspack may throw on invalid line & column when containing UTF-8.
        // We catch it up here.
        this.emitWarning(new Error(warning.text));
      }
    } else {
      // Webpack or legacy Rspack
      this.emitWarning(new Error(warning.text));
    }
  }
  const buildInfo = (this as typeof this & {
    _module?: { buildInfo?: Record<string, unknown> };
  })._module?.buildInfo;
  if (buildInfo && result.mtsDefines) {
    const mtsDefines: MTSDefine[] = [...result.mtsDefines as MTSDefine[]];

    // A module that renders a root-level `<Background>` (the entry) may
    // declare a static `fallback`. Its snapshot definition already travels
    // through the defines above — record its id as an extra `root-fallback`
    // define, so the assembled main-thread bundle can render it as the
    // pre-hydration first frame.
    const fallback = extractRootFallback(result.code);
    if (fallback?.id !== undefined) {
      mtsDefines.push({ kind: 'root-fallback', id: fallback.id, code: '' });
    } else if (fallback?.warning !== undefined) {
      this.emitWarning(new Error(fallback.warning));
    }

    buildInfo[MTS_DEFINES_BUILD_INFO] = mtsDefines;
  }

  if (buildInfo) {
    // The opt-in half: components marked `'main thread component'`, plus the
    // island a root-level `<MainThread>` names. The plugin turns both into
    // extra main-thread entries — the modules that are compiled into the
    // main-thread layer even though the mode compiles no business code there.
    //
    // Written unconditionally (including the empty case) so a rebuild that
    // *removes* the last marker does not leave a stale island behind.
    const islands = result.mainThreadIslands;
    if (islands && (islands.components.length > 0 || islands.rootIsland)) {
      buildInfo[MTS_ISLANDS_BUILD_INFO] = {
        components: islands.components,
        rootIsland: islands.rootIsland,
      } satisfies MTSIslands;
    } else {
      delete buildInfo[MTS_ISLANDS_BUILD_INFO];
    }
    if (islands?.rootIslandWarning !== undefined) {
      this.emitWarning(new Error(islands.rootIslandWarning));
    }
  }

  this.callback(null, result.code, result.map);
};

export default backgroundLoader;
