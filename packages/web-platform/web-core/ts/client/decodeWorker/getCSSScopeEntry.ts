// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { PageConfig } from '../../types/index.js';

export function getCSSScopeEntry(
  config: Partial<PageConfig>,
  url: string,
): string | undefined {
  return config.isLazy === 'true' && config.enableRemoveCSSScope !== 'true'
    ? url
    : undefined;
}
