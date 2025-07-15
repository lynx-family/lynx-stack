// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { BackgroundSnapshotInstance } from '../backgroundSnapshot.js';
import { SnapshotInstance } from '../snapshot.js';
import { logDebug } from './debug.js';

export function printSnapshotInstance(
  instance: BackgroundSnapshotInstance | SnapshotInstance,
  log?: (...data: any[]) => void,
): void {
  const impl = (
    instance: BackgroundSnapshotInstance | SnapshotInstance,
    level: number,
  ) => {
    let msg = '';
    for (let i = 0; i < level; ++i) {
      msg += '  ';
    }
    msg += `| ${instance.__id}(${instance.type}): ${JSON.stringify(instance.__values)}`;
    (log ?? logDebug)(msg);
    for (const c of instance.childNodes) {
      impl(c, level + 1);
    }
  };

  impl(instance, 0);
}
