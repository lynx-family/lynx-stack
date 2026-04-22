// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/// <reference types="@rspack/test-tools/rstest" />

import { add } from './lib-common.js';

it('should not have `__webpack_require__.lynx_ce`', () => {
  expect(add(1, 2)).toBe(3);
  expect(__webpack_require__['lynx_ce']).toBeFalsy();
});
