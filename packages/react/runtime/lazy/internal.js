// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { sExportsReactInternal, target } from './target.js';

export const {
  Component,
  __ComponentIsPolyfill,
  __DynamicPartChildren,
  __DynamicPartChildren_0,
  __DynamicPartListChildren,
  __DynamicPartSlot,
  __DynamicPartMultiChildren,
  __dynamicImport,
  __page,
  __pageId,
  __root,
  createSnapshot,
  loadDynamicJS,
  loadLazyBundle,
  loadWorkletRuntime,
  options,
  registerWorkletOnBackground,
  snapshotCreateList,
  snapshotManager,
  SnapshotInstance,
  transformRef,
  transformToWorklet,
  updateEvent,
  updateRef,
  updateSpread,
  updateWorkletEvent,
  updateGesture,
  updateListItemPlatformInfo,
  updateWorkletRef,
  withInitDataInState,
  wrapWithLynxComponent,
} = target[sExportsReactInternal];
