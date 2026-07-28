// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { destroyTasks, setDestroyTasks } from './core/runtime-destroy.js';
import { delayedRunOnMainThreadData, setDelayedRunOnMainThreadData } from './core/thread-function-call/main-thread.js';
import { registerContextSlot } from './root-context.js';
import { __root, setRoot } from './root.js';
import { delayedEvents, setDelayedEvents } from './snapshot/lifecycle/event/delayEvents.js';
import { delayedLifecycleEvents, setDelayedLifecycleEvents } from './snapshot/lifecycle/event/delayLifecycleEvents.js';
import {
  globalCommitTaskMap,
  globalPatchOptions,
  setGlobalCommitTaskMap,
  setGlobalPatchOptions,
} from './snapshot/lifecycle/patch/commit.js';
import type { GlobalPatchOptions } from './snapshot/lifecycle/patch/commit.js';
import {
  globalBackgroundSnapshotInstancesToRemove,
  setGlobalBackgroundSnapshotInstancesToRemove,
} from './snapshot/lifecycle/patch/globalState.js';
import { __globalSnapshotPatch, setGlobalSnapshotPatch } from './snapshot/lifecycle/patch/snapshotPatch.js';
import type { SnapshotPatch } from './snapshot/lifecycle/patch/snapshotPatch.js';
import { backgroundSnapshotInstanceManager } from './snapshot/snapshot/backgroundSnapshot.js';
import type { BackgroundSnapshotInstance } from './snapshot/snapshot/backgroundSnapshot.js';
import type { RunWorkletCtxData } from './worklet-runtime/bindings/events.js';

if (typeof __MULTI_ROOT_RENDER_CONTEXT__ !== 'undefined' && __MULTI_ROOT_RENDER_CONTEXT__) {
  registerContextSlot<typeof __root | undefined>({
    id: 'root',
    init: () => undefined,
    save: () => __root,
    load: (value) => setRoot(value!),
  });

  registerContextSlot<SnapshotPatch | undefined>({
    id: 'snapshotPatch',
    init: () => undefined,
    save: () => __globalSnapshotPatch,
    load: setGlobalSnapshotPatch,
  });

  registerContextSlot<Map<number, () => void>>({
    id: 'commitTaskMap',
    init: () => new Map(),
    save: () => globalCommitTaskMap,
    load: setGlobalCommitTaskMap,
  });

  registerContextSlot<GlobalPatchOptions>({
    id: 'patchOptions',
    init: () => ({}),
    save: () => globalPatchOptions,
    load: setGlobalPatchOptions,
  });

  registerContextSlot<number[]>({
    id: 'bgInstancesToRemove',
    init: () => [],
    save: () => globalBackgroundSnapshotInstancesToRemove,
    load: setGlobalBackgroundSnapshotInstancesToRemove,
  });

  registerContextSlot<Map<number, BackgroundSnapshotInstance>>({
    id: 'bsiValues',
    init: () => new Map(),
    save: () => backgroundSnapshotInstanceManager.values,
    load: (value) => {
      backgroundSnapshotInstanceManager.values = value;
    },
  });

  registerContextSlot<typeof delayedEvents>({
    id: 'delayedEvents',
    init: () => undefined,
    save: () => delayedEvents,
    load: setDelayedEvents,
  });

  registerContextSlot<typeof delayedLifecycleEvents>({
    id: 'delayedLifecycleEvents',
    init: () => [],
    save: () => delayedLifecycleEvents,
    load: setDelayedLifecycleEvents,
  });

  registerContextSlot<Set<() => void>>({
    id: 'destroyTasks',
    init: () => new Set(),
    save: () => destroyTasks,
    load: setDestroyTasks,
  });

  registerContextSlot<RunWorkletCtxData[]>({
    id: 'delayedRunOnMainThreadData',
    init: () => [],
    save: () => delayedRunOnMainThreadData,
    load: setDelayedRunOnMainThreadData,
  });
}
