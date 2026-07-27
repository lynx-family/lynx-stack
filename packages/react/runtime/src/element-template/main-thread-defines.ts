// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The main-thread entry of `enableMainThread: false` with Element Template
 * compilation. The snapshot counterpart is `../main-thread-defines.ts`; see it
 * for how the definitions reach this bundle.
 */

import * as ReactLynxInternal from '@lynx-js/react/element-template/internal';

declare const __lynxMainThreadDefines:
  | ((
    runtime: unknown,
    internalRuntime: unknown,
    loadWorkletRuntime: typeof ReactLynxInternal.loadWorkletRuntime,
    require: () => unknown,
  ) => void)
  | undefined;

const runtime = {
  get __etAttrPlanMap() {
    return ReactLynxInternal.__etAttrPlanMap;
  },
  get adaptEventAttrSlot() {
    return ReactLynxInternal.adaptEventAttrSlot;
  },
  get adaptMTEventAttrSlot() {
    return ReactLynxInternal.adaptMTEventAttrSlot;
  },
  get adaptRefAttrSlot() {
    return ReactLynxInternal.adaptRefAttrSlot;
  },
  get adaptSpreadAttrSlot() {
    return ReactLynxInternal.adaptSpreadAttrSlot;
  },
  get loadWorkletRuntime() {
    return ReactLynxInternal.loadWorkletRuntime;
  },
};

declare const __webpack_require__: Record<string, unknown> | undefined;
if (typeof __webpack_require__ !== 'undefined') {
  __webpack_require__['mtDefinesRuntime'] = runtime;
}

if (typeof __lynxMainThreadDefines !== 'undefined') {
  __lynxMainThreadDefines(
    runtime,
    runtime,
    ReactLynxInternal.loadWorkletRuntime,
    () => runtime,
  );
}
