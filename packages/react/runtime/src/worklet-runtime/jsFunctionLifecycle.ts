// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { WorkletEvents } from './bindings/events.js';
import type { Worklet } from './bindings/types.js';
import { profile } from './utils/profile.js';
import { isSdkVersionGt } from './utils/version.js';

/**
 * `JsFunctionLifecycleManager` monitors references to JS function handles to be called by `runOnBackground()`.
 * In JS context, functions to be called by `runOnBackground()` is referenced by `JsFnHandle`s and finally by `execId`.
 * When all `JsFnHandle`s in lepus are released, an event will be sent to JS context to de-ref the `execId`,
 * resulting a de-ref to the js function in JS context.
 */
class JsFunctionLifecycleManager {
  private execIdRefCount = new Map<number, number>();
  private execIdSetToFire = new Set<number>();
  private retainedObjects = new WeakSet<object>();
  private willFire = false;
  private active = true;
  private registry: FinalizationRegistry<number>;

  private contexts = new Map<number, WeakRef<Worklet>>();
  private contextIds = new WeakMap<Worklet, number>();
  private nextContextId: number;
  private contextRegistry: FinalizationRegistry<number>;

  constructor(previous?: JsFunctionLifecycleManager) {
    // Native can retain descriptors across a reset; their IDs must not resolve new owners.
    this.nextContextId = previous?.nextContextId ?? 0;
    this.contextRegistry = new FinalizationRegistry(this.contexts.delete.bind(this.contexts));
    this.registry = new FinalizationRegistry<number>(this.removeRef.bind(this));
  }

  addRef(execId: number, objToRef: object): void {
    if (this.retainedObjects.has(objToRef)) {
      return;
    }
    // A failed engine registration must leave the target eligible for a retry.
    this.registry.register(objToRef, execId);
    this.retainedObjects.add(objToRef);
    this.execIdRefCount.set(
      execId,
      (this.execIdRefCount.get(execId) ?? 0) + 1,
    );
  }

  prepareWorkletCtx(ctx: Worklet): void {
    if (!this.contextIds.has(ctx)) {
      const id = ++this.nextContextId;
      this.contextRegistry.register(ctx, id);
      this.contextIds.set(ctx, id);
      ctx._runtimeCtxId = id;
      this.contexts.set(id, new WeakRef(ctx));
    }
  }

  resolveWorkletCtx(ctx: Worklet): Worklet | undefined {
    return ctx._runtimeCtxId === undefined ? ctx : this.contexts.get(ctx._runtimeCtxId)?.deref();
  }

  removeRef(execId: number): void {
    const rc = this.execIdRefCount.get(execId)!;
    if (rc > 1) {
      this.execIdRefCount.set(execId, rc - 1);
      return;
    }
    this.execIdRefCount.delete(execId);
    this.execIdSetToFire.add(execId);
    if (!this.willFire) {
      this.willFire = true;
      void Promise.resolve().then(() => {
        this.fire();
      });
    }
  }

  dispose(): void {
    this.active = false;
    this.contexts.clear();
  }

  fire(): void {
    if (!this.active) return;
    profile('JsFunctionLifecycleManager.fire', () => {
      lynx.getJSContext().dispatchEvent({
        type: WorkletEvents.releaseBackgroundWorkletCtx,
        data: Array.from(this.execIdSetToFire),
      });
      this.execIdSetToFire.clear();
      this.willFire = false;
    });
  }
}

function isRunOnBackgroundEnabled(): boolean {
  return isSdkVersionGt(2, 15);
}

export { JsFunctionLifecycleManager, isRunOnBackgroundEnabled };
