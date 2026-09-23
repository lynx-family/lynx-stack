// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { sExportsReactInternal, target } from './target.js';

const ReactInternal = target[sExportsReactInternal];

// Use the host implementation while registering the standalone bundle's
// backend and build-time runtime version. Older hosts may not export them.
ReactInternal.registerRuntimeBackend?.(ReactInternal.RUNTIME_BACKEND_SNAPSHOT);
ReactInternal.registerRuntimeVersion?.(
  typeof __RUNTIME_VERSION__ === 'undefined' ? undefined : __RUNTIME_VERSION__,
);

export const {
  BackgroundSnapshotInstance,
  CHILDREN,
  COMPONENT,
  Component,
  BITS,
  COMPONENT_DIRTY,
  DIFF,
  DOM,
  FLAGS,
  INDEX,
  PARENT,
  RUNTIME_BACKEND_ELEMENT_TEMPLATE,
  RUNTIME_BACKEND_SNAPSHOT,
  __ComponentIsPolyfill,
  __DynamicPartChildren,
  __DynamicPartChildren_0,
  __DynamicPartListChildren,
  __DynamicPartListSlotV2,
  __DynamicPartSlot,
  __DynamicPartSlotV2,
  __DynamicPartSlotV2_0,
  __DynamicPartMultiChildren,
  __dynamicImport,
  __page,
  __pageId,
  __root,
  createSnapshot,
  getRuntimeVersion,
  loadDynamicJS,
  loadLazyBundle,
  loadWorkletRuntime,
  options,
  preactCloneElement,
  process,
  registerRuntimeBackend,
  registerRuntimeVersion,
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
} = ReactInternal;

/* v8 ignore start */
if (__DEV__ && !snapshotCreatorMap) {
  throw new Error(
    'This lazy bundle requires `snapshotCreatorMap` to be exported by the ReactLynx runtime. Please upgrade the ReactLynx version of the consumer to the latest version (or the lowest version that is greater than or equal to the lazy bundle). More info at: https://github.com/lynx-family/lynx-stack/pull/1899',
  );
}
/* v8 ignore stop */
