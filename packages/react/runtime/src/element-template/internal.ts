// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// import { Suspense, createElement, lazy } from 'preact/compat';
// import type { FC } from 'react';

import './native/index.js';

// import { factory as factory2 } from '../compat/componentIs.js';
// import { useMemo } from '../core/hooks/react.js';
// import { loadLazyBundle } from '../lynx/lazy-bundle.js';
import { __root } from './runtime/page/root-instance.js';

/**
 * @internal kept only to fail fast when stale internal imports leak into the
 * Element Template alias surface. This is not a supported ET runtime API.
 */
export class SnapshotInstance {
  constructor(public type: string) {
    throw new Error('SnapshotInstance should not be instantiated when using Element Template.');
  }
}

export { __root };

export {
  options,
  // Component is not an internal API, but refresh needs it from 'react/internal'
  Component,
  process,
} from 'preact';
export type { Options } from 'preact';

// export { loadDynamicJS, __dynamicImport } from '../lynx/dynamic-js.js';

// export { withInitDataInState } from '../compat/initData.js';

// export { wrapWithLynxComponent } from '../compat/lynxComponent.js';

/**
 * @internal a polyfill for <component is=? />
 */
// export const __ComponentIsPolyfill: FC<{ is: string }> = /* @__PURE__ */ factory2(
//   // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
//   { Suspense, lazy, createElement, useMemo } as any,
//   loadLazyBundle,
// );

// export { loadLazyBundle } from '../lynx/lazy-bundle.js';

// TODO: enable when worklet/runtime integration is implemented for ElementTemplate entry.
// export { transformToWorklet } from '../worklet/call/transformToWorklet.js';
// export { registerWorkletOnBackground } from '../worklet/hmr.js';
// export { loadWorkletRuntime } from '@lynx-js/react/worklet-runtime/bindings';
export { __etSlot } from './runtime/components/slot.js';
