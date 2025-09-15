// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { getJSModule } from './jsModule.js';
import { BackgroundSnapshotInstance } from '../../src/backgroundSnapshot.js';
import { setupBackgroundDocument, setupDocument } from '../../src/document.js';
import { deinitGlobalSnapshotPatch } from '../../src/lifecycle/patch/snapshotPatch.js';
import { shouldDelayUiOps } from '../../src/lifecycle/ref/delay.js';
import { clearListGlobal } from '../../src/list.js';
import { globalPipelineOptions, setPipeline } from '../../src/lynx/performance.js';
import { __root, setRoot } from '../../src/root.js';
import { SnapshotInstance, backgroundSnapshotInstanceManager, snapshotInstanceManager } from '../../src/snapshot.js';
import { hydrationMap } from '../../src/snapshotInstanceHydrationMap.js';
import { clearWorkletRefLastIdForTesting } from '../../src/worklet/ref/workletRef.js';

export class EnvManager {
  root: typeof __root | undefined;
  pipelineOptions: any;
  lifecycleEvents: any[] = [];
  constructor(public target?: any) {
    if (typeof target === 'undefined') {
      this.target = globalThis;
    }
  }

  switchToMainThread(): void {
    if (this.target.__BACKGROUND__) {
      const root = __root;
      setRoot(this.root!);
      this.root = root;
      const pipelineOptions = globalPipelineOptions;
      setPipeline(this.pipelineOptions);
      this.pipelineOptions = pipelineOptions;
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
    this.root = undefined;
    this.pipelineOptions = undefined;
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
    getJSModule('GlobalEventEmitter')?.clear();
    this.switchToBackground();
    this.switchToMainThread();
  }
}

export const globalEnvManager: EnvManager = new EnvManager();
