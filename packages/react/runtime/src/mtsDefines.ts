// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import './lynx.js';

import {
  __DynamicPartChildren,
  __DynamicPartChildren_0,
  __DynamicPartListChildren,
  __DynamicPartListSlotV2,
  __DynamicPartSlot,
  __DynamicPartSlotV2,
  __DynamicPartSlotV2_0,
  __pageId,
  createSnapshot,
  loadWorkletRuntime,
  snapshotCreateList,
  snapshotCreatorMap,
  transformRef,
  updateEvent,
  updateGesture,
  updateListItemPlatformInfo,
  updateRef,
  updateSpread,
  updateWorkletEvent,
  updateWorkletRef,
} from './internal.js';

// @ts-expect-error Element implicitly has an 'any' type because type 'typeof globalThis' has no index signature
globalThis.__lynxMainThreadRuntime = {
  __DynamicPartChildren,
  __DynamicPartChildren_0,
  __DynamicPartListChildren,
  __DynamicPartListSlotV2,
  __DynamicPartSlot,
  __DynamicPartSlotV2,
  __DynamicPartSlotV2_0,
  createSnapshot,
  loadWorkletRuntime,
  snapshotCreateList,
  transformRef,
  updateEvent,
  updateGesture,
  updateListItemPlatformInfo,
  updateRef,
  updateSpread,
  updateWorkletEvent,
  updateWorkletRef,
  get __pageId() {
    return __pageId;
  },
  get snapshotCreatorMap() {
    return snapshotCreatorMap;
  },
};
