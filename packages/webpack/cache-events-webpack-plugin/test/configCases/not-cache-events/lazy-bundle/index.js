// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/// <reference types="@rspack/test-tools/rstest" />

it('should load lazy component without unhandled rejection', async () => {
  const mod = await import('./lazy-component.js');

  expect(mod.default()).toBeNull();
  expect(__webpack_require__['lynx_ce']).toBeFalsy();
});
