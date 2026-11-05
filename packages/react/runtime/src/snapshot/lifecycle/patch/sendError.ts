// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { sendMessage } from '@lynx-js/lynx-runtime/mts';

import { ctxNotFoundType } from '../constant.js';
import type { CtxNotFoundData, CtxNotFoundOptions } from '../constant.js';

const errorMsg = 'snapshotPatchApply failed: ctx not found';

export function sendCtxNotFoundEventToBackground(id: number, options: CtxNotFoundOptions): void {
  if (!lynx.getJSContext) {
    throw new Error(errorMsg);
  }
  sendMessage<CtxNotFoundData>(ctxNotFoundType, { id, options });
}
