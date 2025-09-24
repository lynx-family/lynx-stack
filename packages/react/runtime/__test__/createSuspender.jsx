// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const defaultChildren = <text>it works</text>;

// `createSuspender()` is forked from `preact` unit test
export function createSuspender() {
  const deferred = Promise.withResolvers();
  let resolved;

  deferred.promise.then(() => (resolved = true));

  function Suspender({ children = defaultChildren }) {
    if (!resolved) {
      throw deferred.promise;
    }

    return children;
  }

  return {
    suspended: deferred,
    Suspender,
  };
}
