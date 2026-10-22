// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { useBundledRender } from './bundled.js';

export function McpAppsRender() {
  // mcpAppData travels through globalProps; card actions stay in the renderer.
  return useBundledRender().view;
}
