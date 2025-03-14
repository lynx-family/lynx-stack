import { vi } from 'vitest';
import { options } from 'preact';
import { SnapshotInstance } from '@lynx-js/react/runtime/lib/snapshot.js';
import { snapshotInstanceManager } from '@lynx-js/react/runtime/lib/snapshot.js';
import { BackgroundSnapshotInstance } from '@lynx-js/react/runtime/lib/backgroundSnapshot.js';
import { backgroundSnapshotInstanceManager } from '@lynx-js/react/runtime/lib/snapshot.js';
import { injectCalledByNative } from '@lynx-js/react/runtime/lib/lynx/calledByNative.js';
import {
  injectUpdatePatch,
  replaceCommitHook,
} from '@lynx-js/react/runtime/lib/lifecycle/patch/patchUpdate.js';
import { injectTt } from '@lynx-js/react/runtime/lib/lynx/tt.js';
import { setRoot } from '@lynx-js/react/runtime/lib/root.js';
import { deinitGlobalSnapshotPatch } from '@lynx-js/react/runtime/lib/lifecycle/patch/snapshotPatch.js';
import { initApiEnv } from '@lynx-js/react/worklet-runtime/lib/api/lynxApi.js';
import { initEventListeners } from '@lynx-js/react/worklet-runtime/lib/listeners.js';
import { initWorklet } from '@lynx-js/react/worklet-runtime/lib/workletRuntime.js';
import { destroyWorklet } from '@lynx-js/react/runtime/lib/worklet/destroy.js';
import { flushDelayedLifecycleEvents } from '@lynx-js/react/runtime/lib/lynx/tt.js';

globalThis.jest = vi;

const {
  onInjectMainThreadGlobals,
  onInjectBackgroundThreadGlobals,
  onResetLynxEnv,
  onSwitchedToMainThread,
  onSwitchedToBackgroundThread,
  onInitWorkletRuntime,
} = globalThis;

injectCalledByNative();
injectUpdatePatch();
replaceCommitHook();

globalThis.onInitWorkletRuntime = () => {
  if (onInitWorkletRuntime) {
    onInitWorkletRuntime();
  }

  if (process.env.DEBUG) {
    console.log('initWorkletRuntime');
  }
  lynx.setTimeout = setTimeout;
  lynx.setInterval = setInterval;
  lynx.clearTimeout = clearTimeout;
  lynx.clearInterval = clearInterval;

  initWorklet();
  initApiEnv();
  initEventListeners();

  return true;
};

globalThis.onInjectMainThreadGlobals = (target) => {
  if (onInjectMainThreadGlobals) {
    onInjectMainThreadGlobals();
  }
  if (process.env.DEBUG) {
    console.log('onInjectMainThreadGlobals');
  }

  snapshotInstanceManager.clear();
  snapshotInstanceManager.nextId = 0;
  target.__root = new SnapshotInstance('root');

  function setupDocument(document) {
    document.createElement = function(type) {
      return new SnapshotInstance(type);
    };
    document.createElementNS = function(_ns, type) {
      return new SnapshotInstance(type);
    };
    document.createTextNode = function(text) {
      const i = new SnapshotInstance(null);
      i.setAttribute(0, text);
      Object.defineProperty(i, 'data', {
        set(v) {
          i.setAttribute(0, v);
        },
      });
      return i;
    };
    return document;
  }

  target._document = setupDocument({});

  target.globalPipelineOptions = undefined;
};
globalThis.onInjectBackgroundThreadGlobals = (target) => {
  if (onInjectBackgroundThreadGlobals) {
    onInjectBackgroundThreadGlobals();
  }
  if (process.env.DEBUG) {
    console.log('onInjectBackgroundThreadGlobals');
  }

  backgroundSnapshotInstanceManager.clear();
  backgroundSnapshotInstanceManager.nextId = 0;
  target.__root = new BackgroundSnapshotInstance('root');

  function setupBackgroundDocument(document) {
    document.createElement = function(type) {
      return new BackgroundSnapshotInstance(type);
    };
    document.createElementNS = function(_ns, type) {
      return new BackgroundSnapshotInstance(type);
    };
    document.createTextNode = function(text) {
      const i = new BackgroundSnapshotInstance(null);
      i.setAttribute(0, text);
      Object.defineProperty(i, 'data', {
        set(v) {
          i.setAttribute(0, v);
        },
      });
      return i;
    };
    return document;
  }

  target._document = setupBackgroundDocument({});
  target.globalPipelineOptions = undefined;

  // TODO: can we only inject to target(mainThread.globalThis) instead of globalThis?
  // packages/react/runtime/src/lynx.ts
  // intercept lynxCoreInject assignments to lynxDOM.backgroundThread.globalThis.lynxCoreInject
  const oldLynxCoreInject = globalThis.lynxCoreInject;
  globalThis.lynxCoreInject = target.lynxCoreInject;
  injectTt();
  globalThis.lynxCoreInject = oldLynxCoreInject;

  // re-init global snapshot patch to undefined
  deinitGlobalSnapshotPatch();
};
globalThis.onResetLynxEnv = () => {
  if (onResetLynxEnv) {
    onResetLynxEnv();
  }
  if (process.env.DEBUG) {
    console.log('onResetLynxEnv');
  }

  flushDelayedLifecycleEvents();
  destroyWorklet();

  lynxDOM.switchToMainThread();
  initEventListeners();
  lynxDOM.switchToBackgroundThread();
};

globalThis.onSwitchedToMainThread = () => {
  if (onSwitchedToMainThread) {
    onSwitchedToMainThread();
  }
  if (process.env.DEBUG) {
    console.log('onSwitchedToMainThread');
  }

  setRoot(globalThis.__root);
  options.document = globalThis._document;
};
globalThis.onSwitchedToBackgroundThread = () => {
  if (onSwitchedToBackgroundThread) {
    onSwitchedToBackgroundThread();
  }
  if (process.env.DEBUG) {
    console.log('onSwitchedToBackgroundThread');
  }

  setRoot(globalThis.__root);
  options.document = globalThis._document;
};

globalThis.onInjectMainThreadGlobals(globalThis.lynxDOM.mainThread.globalThis);
globalThis.onInjectBackgroundThreadGlobals(
  globalThis.lynxDOM.backgroundThread.globalThis,
);
