// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Registers the assembled main-thread definitions when the background-only
 * assembly is active.
 *
 * `__initMTSDefines` is emitted into the main-thread chunk's runtime by
 * `@lynx-js/react-webpack-plugin`, so it is already defined when this module
 * initializes. Calling it from inside the runtime — instead of from an extra
 * entry import — keeps the main-thread chunk down to a single entry root, so
 * module concatenation (scope hoisting) stays intact.
 *
 * The whole block is fenced by the `__BACKGROUND_ONLY_ASSEMBLY__` define:
 * builds without the feature drop it — and the export pinning below — at
 * minification time.
 *
 * The member list mirrors `runtime/mts-rendering-disabled/index.js`: the
 * simplified runtime surface assembled definitions may reach for. Reading
 * every member through a getter keeps the bundler from shaking exports the
 * definitions only reference dynamically.
 */

import { loadWorkletRuntime } from '@lynx-js/react/worklet-runtime/bindings';

import { __pageId, createSnapshot } from './snapshot/snapshot/definition.js';
import {
  DynamicPartType,
  __DynamicPartChildren_0,
  __DynamicPartSlotV2_0,
} from './snapshot/snapshot/dynamicPartType.js';
import { updateEvent } from './snapshot/snapshot/event.js';
import { updateGesture } from './snapshot/snapshot/gesture.js';
import { snapshotCreateList } from './snapshot/snapshot/list.js';
import { updateListItemPlatformInfo } from './snapshot/snapshot/platformInfo.js';
import { updateRef } from './snapshot/snapshot/ref.js';
import { snapshotCreatorMap } from './snapshot/snapshot/snapshot.js';
import { updateSpread } from './snapshot/snapshot/spread.js';
import { updateWorkletEvent } from './snapshot/snapshot/workletEvent.js';
import { updateWorkletRef } from './snapshot/snapshot/workletRef.js';

if (
  typeof __BACKGROUND_ONLY_ASSEMBLY__ !== 'undefined'
  && __BACKGROUND_ONLY_ASSEMBLY__
  // Only the main-thread build carries the assembled definitions; without
  // this fence the background bundle would retain the runtime surface below
  // for nothing.
  && __LEPUS__
  && typeof __initMTSDefines !== 'undefined'
  && __initMTSDefines
) {
  __initMTSDefines({
    get __pageId() {
      return __pageId;
    },
    get createSnapshot() {
      return createSnapshot;
    },
    get snapshotCreatorMap() {
      return snapshotCreatorMap;
    },
    get snapshotCreateList() {
      return snapshotCreateList;
    },
    get updateSpread() {
      return updateSpread;
    },
    get updateEvent() {
      return updateEvent;
    },
    get updateRef() {
      return updateRef;
    },
    get updateWorkletEvent() {
      return updateWorkletEvent;
    },
    get updateWorkletRef() {
      return updateWorkletRef;
    },
    get updateGesture() {
      return updateGesture;
    },
    get updateListItemPlatformInfo() {
      return updateListItemPlatformInfo;
    },
    get __DynamicPartSlot() {
      return DynamicPartType.Slot;
    },
    get __DynamicPartSlotV2() {
      return DynamicPartType.SlotV2;
    },
    get __DynamicPartSlotV2_0() {
      return __DynamicPartSlotV2_0;
    },
    get __DynamicPartListSlotV2() {
      return DynamicPartType.ListSlotV2;
    },
    get __DynamicPartChildren() {
      return DynamicPartType.Children;
    },
    get __DynamicPartChildren_0() {
      return __DynamicPartChildren_0;
    },
    get __DynamicPartListChildren() {
      return DynamicPartType.ListChildren;
    },
    get loadWorkletRuntime() {
      return loadWorkletRuntime;
    },
  });
}
