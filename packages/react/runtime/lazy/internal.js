// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { sExportsReactInternal, target } from './target.js';

export const {
  BackgroundSnapshotInstance,
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
  process,
  registerWorkletOnBackground,
  snapshotCreateList,
  snapshotManager,
  snapshotCreatorMap,
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

/* v8 ignore start */
if (__DEV__ && !snapshotCreatorMap) {
  throw new Error(
    'This lazy bundle requires `snapshotCreatorMap` to be exported by the ReactLynx runtime. Please upgrade the ReactLynx version of the consumer to the latest version (or the lowest version that is greater than or equal to the lazy bundle). More info at: https://github.com/lynx-family/lynx-stack/pull/1899',
  );
}
/* v8 ignore stop */
