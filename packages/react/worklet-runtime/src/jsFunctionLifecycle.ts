// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { WorkletEvents } from './bindings/events.js';
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
  private willFire = false;
  private registry?: FinalizationRegistry<number> = undefined;

  constructor() {
    this.registry = new FinalizationRegistry<number>(this.removeRef.bind(this));
  }

  addRef(execId: number, objToRef: object): void {
    this.execIdRefCount.set(
      execId,
      (this.execIdRefCount.get(execId) ?? 0) + 1,
    );
    this.registry!.register(objToRef, execId);
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

  fire(): void {
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
