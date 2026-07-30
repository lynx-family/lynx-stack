// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* global __initMTSDefines */

import * as ReactLynx from '@lynx-js/react/internal';

// The snapshot id of the static `fallback` a root-level `<Background>`
// declares in the entry. Recorded by the assembled definitions (a
// `root-fallback` define) and rendered below as the pre-hydration first
// frame. First write wins — an entry has one render root.
let rootMTSFallbackId;

const simplifiedRuntime = {
  __setRootMTSFallback(id) {
    rootMTSFallbackId ??= id;
  },
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

if (typeof __initMTSDefines !== 'undefined') {
  __initMTSDefines(simplifiedRuntime);

  // Business code is not compiled for the main thread in this mode, so the
  // root `<Background>`'s static fallback is rendered here, through the
  // assembled definitions: link an instance under the root before the native
  // `renderPage` call builds the elements (`ensureElements` walks children).
  // The first frame then shows the skeleton instead of an empty page, and the
  // background's first-screen hydration replaces it with the real content
  // (the diff removes the unmatched fallback instance).
  if (
    rootMTSFallbackId !== undefined
    // Guard against a definition that did not make it into the assembly —
    // a missing snapshot must degrade to an empty first frame, not break
    // the whole main-thread bundle.
    && ReactLynx.snapshotCreatorMap[rootMTSFallbackId]
    && ReactLynx.__root.childNodes.length === 0
  ) {
    ReactLynx.__root.insertBefore(
      new ReactLynx.SnapshotInstance(rootMTSFallbackId),
    );
  }
}
