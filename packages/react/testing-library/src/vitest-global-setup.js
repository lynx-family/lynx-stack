import { options } from 'preact';

import { BackgroundSnapshotInstance } from '../../runtime/lib/backgroundSnapshot.js';
import { clearCommitTaskId, replaceCommitHook } from '../../runtime/lib/lifecycle/patch/commit.js';
import { deinitGlobalSnapshotPatch } from '../../runtime/lib/lifecycle/patch/snapshotPatch.js';
import { injectUpdateMainThread } from '../../runtime/lib/lifecycle/patch/updateMainThread.js';
import { injectCalledByNative } from '../../runtime/lib/lynx/calledByNative.js';
import { flushDelayedLifecycleEvents, injectTt } from '../../runtime/lib/lynx/tt.js';
import { setRoot } from '../../runtime/lib/root.js';
import {
  SnapshotInstance,
  backgroundSnapshotInstanceManager,
  snapshotInstanceManager,
} from '../../runtime/lib/snapshot.js';
import { destroyWorklet } from '../../runtime/lib/worklet/destroy.js';
import { initApiEnv } from '../../worklet-runtime/lib/api/lynxApi.js';
import { initEventListeners } from '../../worklet-runtime/lib/listeners.js';
import { initWorklet } from '../../worklet-runtime/lib/workletRuntime.js';

const {
  onInjectMainThreadGlobals,
  onInjectBackgroundThreadGlobals,
  onResetLynxEnv,
  onSwitchedToMainThread,
  onSwitchedToBackgroundThread,
  onInitWorkletRuntime,
} = globalThis;

injectCalledByNative();
injectUpdateMainThread();
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
  // intercept lynxCoreInject assignments to lynxEnv.backgroundThread.globalThis.lynxCoreInject
  const oldLynxCoreInject = globalThis.lynxCoreInject;
  globalThis.lynxCoreInject = target.lynxCoreInject;
  injectTt();
  globalThis.lynxCoreInject = oldLynxCoreInject;

  // re-init global snapshot patch to undefined
  deinitGlobalSnapshotPatch();
  clearCommitTaskId();
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

  lynxEnv.switchToMainThread();
  initEventListeners();
  lynxEnv.switchToBackgroundThread();
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

globalThis.onInjectMainThreadGlobals(
  globalThis.lynxEnv.mainThread.globalThis,
);
globalThis.onInjectBackgroundThreadGlobals(
  globalThis.lynxEnv.backgroundThread.globalThis,
);
