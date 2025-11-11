// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { runOnBackground } from '../worklet/runOnBackground.js';

export function transformMTCProps(props: unknown): void {
  transformMTCPropsImpl(props);
}

function transformMTCPropsImpl(props: unknown): void {
  if (typeof props !== 'object' || props === null) {
    return;
  }

  for (const key in props) {
    const value = (props as Record<string, unknown>)[key];
    // This cannot be a preact signal; otherwise, it would cause a loop.
    if (typeof value === 'object' && value !== null && (value as any).brand === Symbol.for('preact-signals')) {
      continue;
    }
    if (typeof value === 'object' && value !== null && '__type' in value && value.__type === '$$mtc_ba') {
      (props as Record<string, unknown>)[key] = runOnBackground(value as any);
    } else {
      transformMTCPropsImpl(value);
    }
  }
}
