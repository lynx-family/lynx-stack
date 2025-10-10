// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { SnapshotOperationParams } from '../lifecycle/patch/snapshotPatch.js';
import type { SnapshotPatch } from '../lifecycle/patch/snapshotPatch.js';

export function prettyFormatSnapshotPatch(snapshotPatch: SnapshotPatch | undefined): unknown[] {
  if (!snapshotPatch) {
    return [];
  }
  const result = [];
  for (let i = 0; i < snapshotPatch.length;) {
    const op = snapshotPatch[i] as number;
    const config = SnapshotOperationParams[op];
    if (config) {
      const formattedOp: Record<string, any> = { op: config.name };
      config.params.forEach((param, index) => {
        formattedOp[param] = snapshotPatch[i + 1 + index];
      });
      result.push(formattedOp);
      i += 1 + config.params.length;
    } else {
      console.log('op', op, typeof op, op.toString(), `Unknown snapshot operation: ${op}`);
      throw new Error(`Unknown snapshot operation: ${op}`);
    }
  }
  return result;
}
