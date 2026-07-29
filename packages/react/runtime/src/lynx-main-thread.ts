// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The part of the runtime bootstrap the main thread needs on its own.
 *
 * `enableMTSRendering: false` loads only this half, so nothing reachable from
 * here may import `preact`: that main thread renders no business code, and the
 * reconciler's module-level side effects would be pure dead weight.
 */

import { injectUpdateMainThread } from './snapshot/lifecycle/patch/updateMainThread.js';
import { injectCalledByNative } from './snapshot/lynx/calledByNative.js';
import { injectLepusMethods } from './snapshot/lynx/injectLepusMethods.js';
import { injectPrepareLazyBundleMTS } from './snapshot/lynx/prepareLazyBundleMTS.js';
import { injectUpdateMTRefInitValue } from './snapshot/worklet/ref/updateInitValue.js';

function bootstrapMainThread(): void {
  // @ts-expect-error Element implicitly has an 'any' type because type 'typeof globalThis' has no index signature
  if (typeof globalThis.processEvalResult === 'undefined') {
    // @ts-expect-error Element implicitly has an 'any' type because type 'typeof globalThis' has no index signature
    globalThis.processEvalResult = <T>(result: ((schema: string) => T) | undefined, schema: string) => {
      return result?.(schema);
    };
  }

  injectCalledByNative();
  injectUpdateMainThread();
  injectUpdateMTRefInitValue();
  if (
    typeof __LAZY_BUNDLE_FETCHER__ !== 'undefined'
    && __LAZY_BUNDLE_FETCHER__ === 'FetchBundle'
  ) {
    injectPrepareLazyBundleMTS();
  }
  // `injectLepusMethods` exposes the snapshot <-> element mapping that preact
  // devtools relies on, so it must also run when devtools is enabled in
  // production via `REACT_DEVTOOL=true`.
  if (__DEV__ || (typeof __REACT_DEVTOOL__ !== 'undefined' && __REACT_DEVTOOL__)) {
    injectLepusMethods();
  }
}

export { bootstrapMainThread };
