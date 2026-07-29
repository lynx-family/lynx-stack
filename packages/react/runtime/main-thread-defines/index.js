// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* global __lynxMainThreadDefines -- injected into the bundle by `@lynx-js/react-webpack-plugin` */

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
import * as ReactLynx from '@lynx-js/react/internal';

// Getters, not copies: `__pageId` is a live binding assigned by `setupPage`.
const runtime = {
  get __pageId() {
    return ReactLynx.__pageId;
  },
  get createSnapshot() {
    return ReactLynx.createSnapshot;
  },
  get snapshotCreatorMap() {
    return ReactLynx.snapshotCreatorMap;
  },
  get snapshotCreateList() {
    return ReactLynx.snapshotCreateList;
  },
  get updateSpread() {
    return ReactLynx.updateSpread;
  },
  get updateEvent() {
    return ReactLynx.updateEvent;
  },
  get updateRef() {
    return ReactLynx.updateRef;
  },
  get updateWorkletEvent() {
    return ReactLynx.updateWorkletEvent;
  },
  get updateWorkletRef() {
    return ReactLynx.updateWorkletRef;
  },
  get updateGesture() {
    return ReactLynx.updateGesture;
  },
  get updateListItemPlatformInfo() {
    return ReactLynx.updateListItemPlatformInfo;
  },
  get __DynamicPartSlot() {
    return ReactLynx.__DynamicPartSlot;
  },
  get __DynamicPartSlotV2() {
    return ReactLynx.__DynamicPartSlotV2;
  },
  get __DynamicPartSlotV2_0() {
    return ReactLynx.__DynamicPartSlotV2_0;
  },
  get __DynamicPartListSlotV2() {
    return ReactLynx.__DynamicPartListSlotV2;
  },
  get __DynamicPartChildren() {
    return ReactLynx.__DynamicPartChildren;
  },
  get __DynamicPartChildren_0() {
    return ReactLynx.__DynamicPartChildren_0;
  },
  get __DynamicPartListChildren() {
    return ReactLynx.__DynamicPartListChildren;
  },
  get loadWorkletRuntime() {
    return ReactLynx.loadWorkletRuntime;
  },
};

// A lazy bundle's definitions are assembled the same way, but they are
// evaluated after the host card, so they read the host's runtime from here.
// Same channel as `@lynx-js/react/experimental/lazy/import`, which hands the
// host's exports to a lazy bundle the same way. Keep the key in sync with
// `@lynx-js/react-webpack-plugin`.
globalThis[Symbol.for('__REACT_LYNX_MAIN_THREAD_DEFINES_RUNTIME__')] = runtime;

// `__lynxMainThreadDefines` is the whole contract with the bundler: nothing
// here reaches for a bundler internal, so a non-webpack pipeline only has to
// declare this one binding in the bundle scope.
if (typeof __lynxMainThreadDefines !== 'undefined') {
  __lynxMainThreadDefines(runtime, ReactLynx.loadWorkletRuntime, () => runtime);
}
