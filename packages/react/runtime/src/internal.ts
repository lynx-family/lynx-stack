// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Suspense, createElement, lazy } from 'preact/compat';
import type { FC } from 'react';

import './lynx.js';

import { factory as factory2 } from './compat/componentIs.js';
import { useMemo } from './hooks/react.js';
import { snapshotCreateList } from './list.js';
import { loadLazyBundle } from './lynx/lazy-bundle.js';
import { __root } from './root.js';
import { DynamicPartType, SnapshotInstance, __page, __pageId, createSnapshot, snapshotManager } from './snapshot.js';

export { __page, __pageId, __root };

export { SnapshotInstance, snapshotCreateList, createSnapshot, snapshotManager };

export const __DynamicPartSlot: DynamicPartType = DynamicPartType.Slot;
export const __DynamicPartMultiChildren: DynamicPartType = DynamicPartType.MultiChildren;
export const __DynamicPartChildren: DynamicPartType = DynamicPartType.Children;
export const __DynamicPartListChildren: DynamicPartType = DynamicPartType.ListChildren;
export const __DynamicPartChildren_0: [DynamicPartType, number][] = [[DynamicPartType.Children, 0]];

export { updateSpread } from './snapshot/spread.js';
export { updateEvent } from './snapshot/event.js';
export { updateRef, transformRef } from './snapshot/ref.js';
export { updateWorkletEvent } from './snapshot/workletEvent.js';
export { updateWorkletRef } from './snapshot/workletRef.js';
export { updateGesture } from './snapshot/gesture.js';
export { updateListItemPlatformInfo } from './snapshot/platformInfo.js';

export {
  options,
  // Component is not an internal API, but refresh needs it from 'react/internal'
  Component,
} from 'preact';
export type { Options } from 'preact';

export { loadDynamicJS, __dynamicImport } from './lynx/dynamic-js.js';

export { withInitDataInState } from './compat/initData.js';

export { wrapWithLynxComponent } from './compat/lynxComponent.js';

/**
 * @internal a polyfill for <component is=? />
 */
export const __ComponentIsPolyfill: FC<{ is: string }> = /* @__PURE__ */ factory2(
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  { Suspense, lazy, createElement, useMemo } as any,
  loadLazyBundle,
);

export { loadLazyBundle } from './lynx/lazy-bundle.js';

export { transformToWorklet } from './worklet/transformToWorklet.js';
export { registerWorkletOnBackground } from './worklet/hmr.js';

export { loadWorkletRuntime } from '@lynx-js/react/worklet-runtime/bindings';
