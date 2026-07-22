// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { bootstrappedRoot, setBootstrappedRoot } from './page-root-ref.js';
import { ReactLynxRoot } from './root-instance.js';
import type { CreateRootOptions } from './root-instance.js';

/**
 * @internal
 */
export function __experimentalBootstrapPage(options?: CreateRootOptions): ReactLynxRoot | undefined {
  /* v8 ignore next */
  if (typeof __MULTI_PAGE__ !== 'undefined' && __MULTI_PAGE__) {
    /* v8 ignore next */
    if (typeof __BACKGROUND__ !== 'undefined' && __BACKGROUND__) {
      setBootstrappedRoot(options ? new ReactLynxRoot(options) : undefined);
    }
    return bootstrappedRoot;
    /* v8 ignore start */
  } else {
    if (__DEV__ && options) {
      console.error(
        '[ReactLynx] __experimentalBootstrapPage called but the runtime was built without `__MULTI_PAGE__`; falling back to the classic singleton root.',
      );
    }
    return undefined;
  }
  /* v8 ignore stop */
}
