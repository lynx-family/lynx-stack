// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Suspense, createElement, lazy } from 'preact/compat';
import type { FC } from 'react';

import './lynx.js';

import { __root } from './root.js';
import { factory as factory2 } from './snapshot/compat/componentIs.js';
import { useMemo } from './snapshot/hooks/react.js';
import { loadLazyBundle } from './snapshot/lynx/lazy-bundle.js';
import { BackgroundSnapshotInstance } from './snapshot/snapshot/backgroundSnapshot.js';
import { __page, __pageId, createSnapshot, snapshotManager } from './snapshot/snapshot/definition.js';
import { DynamicPartType } from './snapshot/snapshot/dynamicPartType.js';
import { snapshotCreateList } from './snapshot/snapshot/list.js';
import { SnapshotInstance, snapshotCreatorMap } from './snapshot/snapshot/snapshot.js';

export { CHILDREN, COMPONENT, DIFF, DIRTY, DOM, FLAGS, INDEX, PARENT } from './snapshot/renderToOpcodes/constants.js';

export { __page, __pageId, __root };

export {
  BackgroundSnapshotInstance,
  SnapshotInstance,
  snapshotCreateList,
  createSnapshot,
  snapshotManager,
  snapshotCreatorMap,
};

export const __DynamicPartSlot: DynamicPartType = DynamicPartType.Slot;
export const __DynamicPartMultiChildren: DynamicPartType = DynamicPartType.MultiChildren;
export const __DynamicPartChildren: DynamicPartType = DynamicPartType.Children;
export const __DynamicPartListChildren: DynamicPartType = DynamicPartType.ListChildren;
export { __DynamicPartChildren_0 } from './snapshot/snapshot/dynamicPartType.js';

// v2 slot
export const __DynamicPartSlotV2: DynamicPartType = DynamicPartType.SlotV2;
export const __DynamicPartListSlotV2: DynamicPartType = DynamicPartType.ListSlotV2;
export const __DynamicPartSlotV2_0: [DynamicPartType, number][] = [[DynamicPartType.SlotV2, 0]];

export { updateSpread } from './snapshot/snapshot/spread.js';
export { updateEvent } from './snapshot/snapshot/event.js';
export { updateRef, transformRef } from './snapshot/snapshot/ref.js';
export { updateWorkletEvent } from './snapshot/snapshot/workletEvent.js';
export { updateWorkletRef } from './snapshot/snapshot/workletRef.js';
export { updateGesture } from './snapshot/snapshot/gesture.js';
export { updateListItemPlatformInfo } from './snapshot/snapshot/platformInfo.js';

export {
  options,
  // Component is not an internal API, but refresh needs it from 'react/internal'
  Component,
  process,
} from 'preact';
export type { Options } from 'preact';

export { loadDynamicJS, __dynamicImport } from './snapshot/lynx/dynamic-js.js';

export { withInitDataInState } from './snapshot/compat/initData.js';

export { wrapWithLynxComponent } from './snapshot/compat/lynxComponent.js';

/**
 * @internal a polyfill for <component is=? />
 */
export const __ComponentIsPolyfill: FC<{ is: string }> = /* @__PURE__ */ factory2(
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  { Suspense, lazy, createElement, useMemo } as any,
  loadLazyBundle,
);

export { loadLazyBundle } from './snapshot/lynx/lazy-bundle.js';

export { transformToWorklet } from './snapshot/worklet/call/transformToWorklet.js';
export { registerWorkletOnBackground } from './snapshot/worklet/hmr.js';

export { loadWorkletRuntime } from '@lynx-js/react/worklet-runtime/bindings';
