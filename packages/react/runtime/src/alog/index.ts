// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { initElementPAPICallAlog } from './elementPAPICall.js';
import { initRenderAlog } from './render.js';

export function initAlog(): void {
  initRenderAlog();
  initElementPAPICallAlog();
}
