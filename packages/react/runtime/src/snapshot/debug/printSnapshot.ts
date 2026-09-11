// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { logDebug } from './debug.js';
import { BackgroundSnapshotInstance } from '../snapshot/backgroundSnapshot.js';
import { getCompactSnapshotChildren, getCompactSnapshotValues } from '../snapshot/compactSnapshot.js';
import type { CompactSnapshotInstance, CompactSnapshotSerialization } from '../snapshot/compactSnapshot.js';
import { SnapshotInstance } from '../snapshot/snapshot.js';
import type { SerializedSnapshotInstance } from '../snapshot/types.js';

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

export function printSerializedSnapshotInstance(
  instance: SerializedSnapshotInstance,
  log?: (...data: any[]) => void,
): void {
  const impl = (
    instance: SerializedSnapshotInstance,
    level: number,
  ) => {
    let msg = '';
    for (let i = 0; i < level; ++i) {
      msg += '  ';
    }
    msg += `| ${instance.id}(${instance.type}): ${JSON.stringify(instance.values)}`;
    (log ?? logDebug)(msg);
    for (const c of instance.children ?? []) {
      impl(c, level + 1);
    }
  };

  impl(instance, 0);
}

export function printCompactSnapshotSerialization(
  serialization: CompactSnapshotSerialization,
  log?: (...data: any[]) => void,
): void {
  const typeDictionary = serialization[1];
  const impl = (
    instance: CompactSnapshotInstance,
    level: number,
  ) => {
    let msg = '';
    for (let i = 0; i < level; ++i) {
      msg += '  ';
    }
    msg += `| ${instance[0]}(${typeDictionary[instance[1]]}): ${JSON.stringify(getCompactSnapshotValues(instance))}`;
    (log ?? logDebug)(msg);
    for (const child of getCompactSnapshotChildren(instance)) {
      impl(child, level + 1);
    }
  };

  impl(serialization[2], 0);
}

export function printSnapshotInstanceToString(
  instance:
    | SnapshotInstance
    | BackgroundSnapshotInstance
    | SerializedSnapshotInstance
    | CompactSnapshotSerialization,
): string {
  const logArr: string[] = [];
  if (instance instanceof SnapshotInstance || instance instanceof BackgroundSnapshotInstance) {
    printSnapshotInstance(instance, logArr.push.bind(logArr));
  } else if (Array.isArray(instance)) {
    printCompactSnapshotSerialization(instance, logArr.push.bind(logArr));
  } else {
    printSerializedSnapshotInstance(instance, logArr.push.bind(logArr));
  }
  return logArr.join('\n');
}
