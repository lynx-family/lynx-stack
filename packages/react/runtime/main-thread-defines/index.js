// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* global __lynxMainThreadDefines, __webpack_require__ -- injected into the bundle by `@lynx-js/react-webpack-plugin` and webpack */

/**
 * The main-thread entry of `enableMTSRendering: false`.
 *
 * The main thread renders no business code in this mode: it boots the runtime
 * and registers the snapshot and worklet definitions that the background
 * collected while compiling the real module graph. Those definitions are
 * generated into the bundle runtime as `__lynxMainThreadDefines` by
 * `@lynx-js/react-webpack-plugin`, which happens after the module graph is
 * sealed, so every runtime member they call has to be referenced from here to
 * survive tree shaking.
 */

// The public specifier, not a relative path: the main-thread bundle has to
// share the runtime instance with the background, including when the runtime is
// aliased (lazy) or externalized (`pluginExternalBundle`).
//
// `@lynx-js/react/internal/main-thread`, not `@lynx-js/react/internal`: the
// barrel re-exports `preact/compat`, whose module-level side effects cannot be
// tree shaken out of a bundle that never renders a vnode.
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
  updateEvent,
  updateGesture,
  updateListItemPlatformInfo,
  updateRef,
  updateSpread,
  updateWorkletEvent,
  updateWorkletRef,
} from '@lynx-js/react/internal/main-thread';

// Getters, not copies: `__pageId` is a live binding assigned by `setupPage`.
const runtime = {
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
    return __DynamicPartSlot;
  },
  get __DynamicPartSlotV2() {
    return __DynamicPartSlotV2;
  },
  get __DynamicPartSlotV2_0() {
    return __DynamicPartSlotV2_0;
  },
  get __DynamicPartListSlotV2() {
    return __DynamicPartListSlotV2;
  },
  get __DynamicPartChildren() {
    return __DynamicPartChildren;
  },
  get __DynamicPartChildren_0() {
    return __DynamicPartChildren_0;
  },
  get __DynamicPartListChildren() {
    return __DynamicPartListChildren;
  },
  get loadWorkletRuntime() {
    return loadWorkletRuntime;
  },
};

// A lazy bundle's definitions are assembled the same way, but they are
// evaluated as a chunk installed into this bundle's runtime, so they read the
// runtime from here. Keep the property name in sync with
// `@lynx-js/react-webpack-plugin`.
if (typeof __webpack_require__ !== 'undefined') {
  __webpack_require__['mtDefinesRuntime'] = runtime;
}

if (typeof __lynxMainThreadDefines !== 'undefined') {
  __lynxMainThreadDefines(runtime, loadWorkletRuntime, () => runtime);
}
