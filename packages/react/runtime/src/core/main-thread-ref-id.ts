// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { cardLifetime } from './card-lifetime.js';

const lastId = /*#__PURE__*/ cardLifetime('mainThreadRefId', () => ({ bg: 0, mt: 0 }));

/** @internal */
export function allocateMainThreadRefId(): number {
  return __JS__ ? ++lastId.bg : --lastId.mt;
}

/** @internal */
export function clearMainThreadRefIdsForTesting(): void {
  lastId.bg = lastId.mt = 0;
}
