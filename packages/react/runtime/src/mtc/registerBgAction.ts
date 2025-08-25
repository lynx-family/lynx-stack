// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { init as initRunOnBackground } from '../worklet/runOnBackground.js';

export const gBgActions: Map<number, Function> = new Map();

let actionId = 1;

export function registerBgAction(action: Function): number {
  initRunOnBackground();
  gBgActions.set(actionId, action);
  return actionId++;
}
