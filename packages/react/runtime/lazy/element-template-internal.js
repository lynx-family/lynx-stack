// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  RUNTIME_BACKEND_ELEMENT_TEMPLATE,
  registerLazyRuntimeBackend,
  sExportsReactInternal,
  target,
} from './target.js';

registerLazyRuntimeBackend(RUNTIME_BACKEND_ELEMENT_TEMPLATE);

export const {
  Component,
  SnapshotInstance,
  __ElementTemplatePage,
  __dynamicImport,
  __etAttrPlanMap,
  __root,
  adaptEventAttrSlot,
  adaptMTEventAttrSlot,
  adaptMTRefAttrSlot,
  adaptRefAttrSlot,
  adaptSpreadAttrSlot,
  loadDynamicJS,
  loadLazyBundle,
  loadWorkletRuntime,
  options,
  process,
  registerWorkletOnBackground,
  transformToWorklet,
  withInitDataInState,
  wrapWithLynxComponent,
} = target[sExportsReactInternal];
