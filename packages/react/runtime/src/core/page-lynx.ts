// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { contextLynx, hasBoundLynx } from '../render-context.js';

export function hasPageLynx(): boolean {
  return hasBoundLynx();
}

export function getPageLynx(): typeof lynx {
  return contextLynx();
}
