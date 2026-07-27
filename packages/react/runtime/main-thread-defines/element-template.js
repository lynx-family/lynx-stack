// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* global __lynxMainThreadDefines, __webpack_require__ -- injected into the bundle by `@lynx-js/react-webpack-plugin` and webpack */

/**
 * The main-thread entry of `enableMainThread: false` with Element Template
 * compilation. The snapshot counterpart is `./index.js`; see it for how the
 * definitions reach this bundle.
 */

import * as ReactLynxInternal from '@lynx-js/react/element-template/internal';

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
