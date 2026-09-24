// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { sExportsReactInternal, target } from './target.js';

const ReactInternal = target[sExportsReactInternal];

// Use the host implementation while registering the standalone bundle's
// backend and build-time runtime version. Older hosts may not export them.
ReactInternal.registerRuntimeBackend?.(
  ReactInternal.RUNTIME_BACKEND_ELEMENT_TEMPLATE,
);
ReactInternal.registerRuntimeVersion?.(
  typeof __RUNTIME_VERSION__ === 'undefined' ? undefined : __RUNTIME_VERSION__,
);

export const {
  Component,
  RUNTIME_BACKEND_ELEMENT_TEMPLATE,
  RUNTIME_BACKEND_SNAPSHOT,
  SnapshotInstance,
  __ElementTemplatePage,
  __dynamicImport,
  __etAttrPlanMap,
  __etHost,
  __root,
  adaptEventAttrSlot,
  adaptMTEventAttrSlot,
  adaptMTRefAttrSlot,
  adaptRefAttrSlot,
  adaptSpreadAttrSlot,
  getRuntimeVersion,
  loadDynamicJS,
  loadLazyBundle,
  loadWorkletRuntime,
  options,
  process,
  registerRuntimeBackend,
  registerRuntimeVersion,
  registerWorkletOnBackground,
  transformToWorklet,
  withInitDataInState,
  wrapWithLynxComponent,
} = ReactInternal;
