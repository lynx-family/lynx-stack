// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Reference the build-time define so DefinePlugin inlines it into the
// emitted bundle, where the test can grep for the resolved literal.
globalThis.__lynx_fetcher_probe__ = __LAZY_BUNDLE_FETCHER__;

// A dynamic import so the runtime chunk carries the process-eval-result
// registration, whose host key the tests assert on.
globalThis.__lynx_lazy_probe__ = () => import('./lazy.jsx');

export default function App() {
  return null;
}
