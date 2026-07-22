// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Every per-root state slot, registered in one place. Compiled in only for
 * multi-card builds (`__MULTI_CARD__`); the classic single-root flow never
 * registers or swaps any slot. See {@link ./root-context.ts}.
 */
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

if (typeof __MULTI_CARD__ !== 'undefined' && __MULTI_CARD__) {
  registerContextSlot({
    id: 'root',
    init: () => undefined,
    save(bag) {
      bag['root'] = __root;
    },
    load(bag) {
      setRoot(bag['root'] as typeof __root);
    },
  });

  registerContextSlot({
    id: 'snapshotPatch',
    // `undefined` marks "not hydrated yet"; each new root starts that way.
    init: () => undefined,
    save(bag) {
      bag['snapshotPatch'] = __globalSnapshotPatch;
    },
    load(bag) {
      setGlobalSnapshotPatch(bag['snapshotPatch'] as SnapshotPatch | undefined);
    },
  });

  registerContextSlot({
    id: 'commitTaskMap',
    init: () => new Map<number, () => void>(),
    save(bag) {
      bag['commitTaskMap'] = globalCommitTaskMap;
    },
    load(bag) {
      setGlobalCommitTaskMap(bag['commitTaskMap'] as Map<number, () => void>);
    },
  });

  registerContextSlot({
    id: 'patchOptions',
    init: () => ({}),
    save(bag) {
      bag['patchOptions'] = globalPatchOptions;
    },
    load(bag) {
      setGlobalPatchOptions(bag['patchOptions'] as GlobalPatchOptions);
    },
  });

  registerContextSlot({
    id: 'bgInstancesToRemove',
    init: () => [],
    save(bag) {
      bag['bgInstancesToRemove'] = globalBackgroundSnapshotInstancesToRemove;
    },
    load(bag) {
      setGlobalBackgroundSnapshotInstancesToRemove(bag['bgInstancesToRemove'] as number[]);
    },
  });

  // The instance registry is per-root: hydration rewrites background ids to
  // the main-thread ids of the root's own card, and different cards' ids
  // overlap. (`nextId` stays global on purpose, so pre-hydration ids never
  // collide across roots.)
  registerContextSlot({
    id: 'bsiValues',
    init: () => new Map<number, BackgroundSnapshotInstance>(),
    save(bag) {
      bag['bsiValues'] = backgroundSnapshotInstanceManager.values;
    },
    load(bag) {
      backgroundSnapshotInstanceManager.values = bag['bsiValues'] as Map<number, BackgroundSnapshotInstance>;
    },
  });

  registerContextSlot({
    id: 'delayedEvents',
    init: () => undefined,
    save(bag) {
      bag['delayedEvents'] = delayedEvents;
    },
    load(bag) {
      setDelayedEvents(bag['delayedEvents'] as typeof delayedEvents);
    },
  });

  registerContextSlot({
    id: 'delayedLifecycleEvents',
    init: () => [],
    save(bag) {
      bag['delayedLifecycleEvents'] = delayedLifecycleEvents;
    },
    load(bag) {
      setDelayedLifecycleEvents(bag['delayedLifecycleEvents'] as typeof delayedLifecycleEvents);
    },
  });

  registerContextSlot({
    id: 'destroyTasks',
    init: () => new Set<() => void>(),
    save(bag) {
      bag['destroyTasks'] = destroyTasks;
    },
    load(bag) {
      setDestroyTasks(bag['destroyTasks'] as Set<() => void>);
    },
  });

  registerContextSlot({
    id: 'delayedRunOnMainThreadData',
    init: () => [],
    save(bag) {
      bag['delayedRunOnMainThreadData'] = delayedRunOnMainThreadData;
    },
    load(bag) {
      setDelayedRunOnMainThreadData(bag['delayedRunOnMainThreadData'] as RunWorkletCtxData[]);
    },
  });
}
