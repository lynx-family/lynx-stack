// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The runtime surface of a main thread that renders no business code
 * (`enableMTSRendering: false`).
 *
 * It is a deliberately narrow alternative to `internal.ts`: it boots the main
 * thread and exports exactly the members the collected snapshot and worklet
 * definitions call. Nothing here may reach `preact` — see `lynx-main-thread.ts`.
 */

import './runtime-backend-marker.js';

import { bootstrapMainThread } from './lynx-main-thread.js';
import { setupLynxEnv } from './snapshot/lynx/env.js';

export { __page, __pageId, createSnapshot } from './snapshot/snapshot/definition.js';
export { snapshotCreatorMap } from './snapshot/snapshot/snapshot.js';
export { snapshotCreateList } from './snapshot/snapshot/list.js';
export { updateSpread } from './snapshot/snapshot/spread.js';
export { updateEvent } from './snapshot/snapshot/event.js';
export { updateRef } from './snapshot/snapshot/ref.js';
export { updateWorkletEvent } from './snapshot/snapshot/workletEvent.js';
export { updateWorkletRef } from './snapshot/snapshot/workletRef.js';
export { updateGesture } from './snapshot/snapshot/gesture.js';
export { updateListItemPlatformInfo } from './snapshot/snapshot/platformInfo.js';
export {
  __DynamicPartChildren,
  __DynamicPartChildren_0,
  __DynamicPartListChildren,
  __DynamicPartListSlotV2,
  __DynamicPartSlot,
  __DynamicPartSlotV2,
  __DynamicPartSlotV2_0,
} from './snapshot/snapshot/dynamicPartType.js';
export { loadWorkletRuntime } from '@lynx-js/react/worklet-runtime/bindings';

bootstrapMainThread();

setupLynxEnv();
