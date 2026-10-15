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
  private execIdRefCount = new Map<string, number>();
  private execIdSetToFire = new Set<string>();
  private retainedObjects = new WeakSet<object>();
  private willFire = false;
  private registry: FinalizationRegistry<string>;

  constructor() {
    this.registry = new FinalizationRegistry<string>(key => this.removeRef(key));
  }

  addRef(execId: number, objToRef: object, reloadVersion = 0): void {
    const key = `${reloadVersion}:${execId}`;
    if (this.retainedObjects.has(objToRef)) {
      return;
    }
    this.retainedObjects.add(objToRef);
    this.execIdRefCount.set(
      key,
      (this.execIdRefCount.get(key) ?? 0) + 1,
    );
    this.registry.register(objToRef, key);
  }

  removeRef(execId: string): void {
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
        data: Array.from(this.execIdSetToFire, key => {
          const [reloadVersion, execId] = key.split(':').map(Number);
          return { execId, reloadVersion };
        }),
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
