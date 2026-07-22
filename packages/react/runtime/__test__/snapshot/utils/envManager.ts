// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { getJSModule } from './jsModule.js';
import {
  BackgroundSnapshotInstance,
  backgroundSnapshotInstanceManager,
} from '../../../src/snapshot/snapshot/backgroundSnapshot.js';
import { setupBackgroundDocument, setupDocument } from '../../../src/document.js';
import { resetFirstScreenSyncState } from '../../../src/snapshot/lifecycle/event/firstScreenSync.js';
import { deinitGlobalSnapshotPatch } from '../../../src/snapshot/lifecycle/patch/snapshotPatch.js';
import { shouldDelayUiOps } from '../../../src/snapshot/lifecycle/ref/delay.js';
import { clearListGlobal } from '../../../src/snapshot/list/list.js';
import { globalPipelineOptions, setPipeline } from '../../../src/core/performance.js';
import { __root, setRoot } from '../../../src/root.js';
import { defaultRootContext, switchRootContext } from '../../../src/root-context.js';
import { SnapshotInstance, snapshotInstanceManager } from '../../../src/snapshot/snapshot/snapshot.js';
import { hydrationMap } from '../../../src/snapshot/snapshot/snapshotInstanceHydrationMap.js';
import { clearWorkletRefLastIdForTesting } from '../../../src/snapshot/worklet/ref/workletRef.js';
import { snapshotManager } from '../../../src/snapshot/snapshot/definition.js';

export class EnvManager {
  root: typeof __root | undefined;
  pipelineOptions: any;
  snapshotValues: typeof snapshotManager.values | undefined;
  lifecycleEvents: any[] = [];
  constructor(public target?: any) {
    if (typeof target === 'undefined') {
      this.target = globalThis;
    }
  }

  private switchSnapshotManagerValues(): void {
    const snapshotValues = snapshotManager.values;
    snapshotManager.values = this.snapshotValues ?? new Map(snapshotValues);
    this.snapshotValues = snapshotValues;
  }

  switchToMainThread(): void {
    if (this.target.__BACKGROUND__) {
      const root = __root;
      setRoot(this.root!);
      this.root = root;
      const pipelineOptions = globalPipelineOptions;
      setPipeline(this.pipelineOptions);
      this.pipelineOptions = pipelineOptions;
      this.switchSnapshotManagerValues();
    }
    if (!(__root instanceof SnapshotInstance)) {
      setRoot(new SnapshotInstance('root'));
    }
    this.target.__LEPUS__ = true;
    this.target.__JS__ = false;
    this.target.__MAIN_THREAD__ = true;
    this.target.__BACKGROUND__ = false;
    setupDocument();
  }

  switchToBackground(): void {
    if (this.target.__MAIN_THREAD__) {
      const root = __root;
      setRoot(this.root!);
      this.root = root;
      const pipelineOptions = globalPipelineOptions;
      setPipeline(this.pipelineOptions);
      this.pipelineOptions = pipelineOptions;
      this.switchSnapshotManagerValues();
    }
    if (!(__root instanceof BackgroundSnapshotInstance)) {
      setRoot(new BackgroundSnapshotInstance('root'));
    }
    this.target.__LEPUS__ = false;
    this.target.__JS__ = true;
    this.target.__MAIN_THREAD__ = false;
    this.target.__BACKGROUND__ = true;
    setupBackgroundDocument();
  }

  resetEnv(): void {
    switchRootContext(defaultRootContext);
    if (this.target.__BACKGROUND__) {
      this.switchToMainThread();
    }
    this.root = undefined;
    this.pipelineOptions = undefined;
    this.snapshotValues = undefined;
    this.lifecycleEvents = [];
    // @ts-ignore
    setRoot(undefined);
    setPipeline(undefined);
    backgroundSnapshotInstanceManager.clear();
    backgroundSnapshotInstanceManager.nextId = 0;
    snapshotInstanceManager.clear();
    snapshotInstanceManager.nextId = 0;
    hydrationMap.clear();
    shouldDelayUiOps.value = true;
    clearListGlobal();
    deinitGlobalSnapshotPatch();
    clearWorkletRefLastIdForTesting();
    // `renderPage` no longer resets the first-screen state (it is initialized once
    // at module load), so reset it here for test isolation across tests.
    resetFirstScreenSyncState();
    getJSModule('GlobalEventEmitter')?.clear();
    this.switchToBackground();
    this.switchToMainThread();
  }
}

export const globalEnvManager: EnvManager = new EnvManager();
