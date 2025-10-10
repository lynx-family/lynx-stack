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
  onResetLynxTestingEnv,
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
    onInjectMainThreadGlobals(target);
  }

  snapshotInstanceManager.clear();
  snapshotInstanceManager.nextId = 0;
  target.__root = new SnapshotInstance('root');

  function setupDocument(document) {
    document.createElement = function(type, slotIndex = 0) {
      const si = new SnapshotInstance(type);
      si.__slotIndex = slotIndex;
      return si;
    };
    document.createElementNS = function(_ns, type, slotIndex = 0) {
      const si = new SnapshotInstance(type);
      si.__slotIndex = slotIndex;
      return si;
    };
    document.createTextNode = function(text, slotIndex = 0) {
      const i = new SnapshotInstance(null);
      i.__slotIndex = slotIndex;
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
    onInjectBackgroundThreadGlobals(target);
  }

  backgroundSnapshotInstanceManager.clear();
  backgroundSnapshotInstanceManager.nextId = 0;
  target.__root = new BackgroundSnapshotInstance('root');

  function setupBackgroundDocument(document) {
    document.createElement = function(type, slotIndex = 0) {
      return new BackgroundSnapshotInstance(type, slotIndex);
    };
    document.createElementNS = function(_ns, type, slotIndex = 0) {
      return new BackgroundSnapshotInstance(type, slotIndex);
    };
    document.createTextNode = function(text, slotIndex = 0) {
      const i = new BackgroundSnapshotInstance(null, slotIndex = 0);
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
  // intercept lynxCoreInject assignments to lynxTestingEnv.backgroundThread.globalThis.lynxCoreInject
  const oldLynxCoreInject = globalThis.lynxCoreInject;
  globalThis.lynxCoreInject = target.lynxCoreInject;
  injectTt();
  globalThis.lynxCoreInject = oldLynxCoreInject;

  target.lynx.requireModuleAsync = async (url, callback) => {
    try {
      callback(null, await __vite_ssr_dynamic_import__(url));
    } catch (err) {
      callback(err, null);
    }
  };

  // re-init global snapshot patch to undefined
  deinitGlobalSnapshotPatch();
  clearCommitTaskId();
};
globalThis.onResetLynxTestingEnv = () => {
  if (onResetLynxTestingEnv) {
    onResetLynxTestingEnv();
  }

  flushDelayedLifecycleEvents();
  destroyWorklet();

  lynxTestingEnv.switchToMainThread();
  initEventListeners();
  lynxTestingEnv.switchToBackgroundThread();
};

globalThis.onSwitchedToMainThread = () => {
  if (onSwitchedToMainThread) {
    onSwitchedToMainThread();
  }

  setRoot(globalThis.__root);
  options.document = globalThis._document;
};
globalThis.onSwitchedToBackgroundThread = () => {
  if (onSwitchedToBackgroundThread) {
    onSwitchedToBackgroundThread();
  }

  setRoot(globalThis.__root);
  options.document = globalThis._document;
};

globalThis.onInjectMainThreadGlobals(
  globalThis.lynxTestingEnv.mainThread.globalThis,
);
globalThis.onInjectBackgroundThreadGlobals(
  globalThis.lynxTestingEnv.backgroundThread.globalThis,
);
