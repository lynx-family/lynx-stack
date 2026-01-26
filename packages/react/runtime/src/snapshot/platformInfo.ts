// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { ListUpdateInfoRecording } from '../listUpdateInfo.js';
import { __pendingListUpdates } from '../pendingListUpdates.js';
import { SnapshotInstance } from '../snapshot.js';

const platformInfoVirtualAttributes: Set<string> = /* @__PURE__ */ new Set<string>([
  'reuse-identifier',
  'recyclable',
]);

const platformInfoAttributes: Set<string> = /* @__PURE__ */ new Set<string>([
  'reuse-identifier',
  'full-span',
  'item-key',
  'sticky-top',
  'sticky-bottom',
  'estimated-height',
  'estimated-height-px',
  'estimated-main-axis-size-px',
  'recyclable',
]);

export interface PlatformInfo {
  'reuse-identifier'?: string;
  'full-span'?: boolean;
  'item-key'?: string;
  'sticky-top'?: boolean;
  'sticky-bottom'?: boolean;
  'estimated-height'?: number;
  'estimated-height-px'?: number;
  'estimated-main-axis-size-px'?: number;
  'recyclable'?: boolean;
}

function updateListItemPlatformInfo(
  ctx: SnapshotInstance,
  index: number,
  oldValue: any,
  elementIndex: number,
): void {
  const rawValue = ctx.__values?.[index];
  const newValue = ctx.__listItemPlatformInfo = rawValue && typeof rawValue === 'object'
    ? (rawValue as PlatformInfo)
    : ({} as PlatformInfo);

  if (__pendingListUpdates.values) {
    const list = ctx.parentNode;
    if (list?.__snapshot_def.isListHolder) {
      (__pendingListUpdates.values[list.__id] ??= new ListUpdateInfoRecording(list)).onSetAttribute(
        ctx,
        newValue,
        oldValue,
      );
    }
  }

  // In this updater, unlike `updateSpread`, the shape of the value is guaranteed to be an fixed object.
  // No adding / removing keys.
  if (ctx.__elements) {
    const e = ctx.__elements[elementIndex]!;
    const value = newValue as unknown as Record<string, unknown>;
    for (const k in value) {
      if (platformInfoVirtualAttributes.has(k)) {
        continue;
      }
      __SetAttribute(e, k, value[k]);
    }
  }
}

export { updateListItemPlatformInfo, platformInfoAttributes };
