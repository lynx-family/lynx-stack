// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* global __initMTSDefines */

import * as ReactLynx from '@lynx-js/react/internal';

// The snapshot id of the static `fallback` a root-level `<Background>` (or
// `<MainThread>`) declares in the entry. Recorded by the assembled
// definitions (a `root-fallback` define) and rendered as the pre-hydration
// first frame. First write wins — an entry has one render root.
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

/**
 * Install the definitions the background compilation collected. Returns
 * whether there were any — a runtime paired with a build plugin that does not
 * assemble them keeps working, it just has nothing to paint.
 */
export function initMTSDefines() {
  if (typeof __initMTSDefines === 'undefined') {
    return false;
  }
  __initMTSDefines(simplifiedRuntime);
  return true;
}

/**
 * Link the static fallback under the root, so the first frame shows the
 * skeleton instead of an empty page. The background's first-screen hydration
 * then replaces it with the real content (the diff removes the unmatched
 * fallback instance).
 *
 * Safe both before `renderPage` (no elements yet — `ensureElements` walks the
 * children later) and from inside it (`insertBefore` builds the child's
 * elements when the root already has its own).
 */
export function renderRootMTSFallback() {
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
