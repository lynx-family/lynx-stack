// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Registers the assembled main-thread definitions when `<Background>`
 * boundaries are folded while the main thread still renders everything around
 * them (`experimental_backgroundIslands`).
 *
 * `enableMTSRendering: false` has an entry of its own for this
 * (`runtime/mts-rendering-disabled/index.js`, prepended to the main-thread
 * entry) because there the main thread has no app to speak of. Islands cannot
 * use that entry: prepending a second module to an entry that already has the
 * app gives the chunk two entry roots, which disables module concatenation
 * for the whole main-thread bundle — measured at ~45 unconcatenated modules
 * and +9 kB minified on a small app, dwarfing what the fold removes.
 *
 * Registering from inside the runtime keeps the entry at one root. The
 * `__initMTSDefines` binding is emitted into the chunk's runtime by
 * `@lynx-js/react-webpack-plugin`, so it is already defined here.
 *
 * The block is fenced by `__BACKGROUND_ISLANDS__` and `__LEPUS__`, so every
 * other build drops it — and with it the member list below, which exists to
 * keep the assembled definitions' entry points from being shaken out.
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
  typeof __BACKGROUND_ISLANDS__ !== 'undefined'
  && __BACKGROUND_ISLANDS__
  && __LEPUS__
  && typeof __initMTSDefines !== 'undefined'
  && __initMTSDefines
) {
  // The same surface `runtime/mts-rendering-disabled/index.js` hands over.
  // Reading each member through a getter is what keeps a definition that only
  // reaches for it dynamically from finding it shaken away.
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
