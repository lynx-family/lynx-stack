// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { applyPendingMainThreadRefAttachments } from '../runtime/template/main-thread-dynamic-attr-state.js';

export function flushElementTemplate(options: FlushOptions = {}): void {
  applyPendingMainThreadRefAttachments();
  __FlushElementTree(undefined, options);
}
