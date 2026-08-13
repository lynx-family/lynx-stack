// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* global __initMTSDefines */

import * as ReactLynx from '@lynx-js/react/internal';

const simplifiedRuntime = {
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
  get getSharedModule() {
    return ReactLynx.getSharedModule;
  },
};

if (typeof __initMTSDefines !== 'undefined') {
  __initMTSDefines(simplifiedRuntime);
}
