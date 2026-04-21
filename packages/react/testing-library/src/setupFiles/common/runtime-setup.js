import { options } from 'preact';

import { clearCommitTaskId, replaceCommitHook } from '../../../../runtime/lib/snapshot/lifecycle/patch/commit.js';
import { deinitGlobalSnapshotPatch } from '../../../../runtime/lib/snapshot/lifecycle/patch/snapshotPatch.js';
import { injectUpdateMainThread } from '../../../../runtime/lib/snapshot/lifecycle/patch/updateMainThread.js';
import { injectUpdateMTRefInitValue } from '../../../../runtime/lib/snapshot/worklet/ref/updateInitValue.js';
import { injectCalledByNative } from '../../../../runtime/lib/snapshot/lynx/calledByNative.js';
import { flushDelayedLifecycleEvents, injectTt } from '../../../../runtime/lib/snapshot/lynx/tt.js';
import { initElementPAPICallAlog } from '../../../../runtime/lib/snapshot/alog/elementPAPICall.js';
import { addCtxNotFoundEventListener } from '../../../../runtime/lib/snapshot/lifecycle/patch/error.js';
import { setRoot } from '../../../../runtime/lib/root.js';
import {
  SnapshotInstance,
  BackgroundSnapshotInstance,
  backgroundSnapshotInstanceManager,
  snapshotInstanceManager,
} from '../../../../runtime/lib/snapshot/index.js';
import { destroyWorklet } from '../../../../runtime/lib/snapshot/worklet/destroy.js';
import { initApiEnv } from '../../../../runtime/lib/worklet-runtime/api/lynxApi.js';
import { initEventListeners } from '../../../../runtime/lib/worklet-runtime/listeners.js';
import { initWorklet } from '../../../../runtime/lib/worklet-runtime/workletRuntime.js';
import { setupDocument, setupBackgroundDocument } from '../../../../runtime/lib/document.js';

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
injectUpdateMTRefInitValue();
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

  target._document = {};
  setupDocument(target._document);

  target.globalPipelineOptions = undefined;

  if (
    typeof target.__ALOG_ELEMENT_API__ !== 'undefined' && target.__ALOG_ELEMENT_API__
    && !target.__initElementPAPICallAlogInjected
  ) {
    initElementPAPICallAlog(target);
    target.__initElementPAPICallAlogInjected = true;
  }
};
globalThis.onInjectBackgroundThreadGlobals = (target) => {
  if (onInjectBackgroundThreadGlobals) {
    onInjectBackgroundThreadGlobals(target);
  }

  backgroundSnapshotInstanceManager.clear();
  backgroundSnapshotInstanceManager.nextId = 0;
  target.__root = new BackgroundSnapshotInstance('root');

  target._document = {};
  setupBackgroundDocument(target._document);
  target.globalPipelineOptions = undefined;

  // TODO: can we only inject to target(mainThread.globalThis) instead of globalThis?
  // packages/react/runtime/src/lynx.ts
  // intercept lynxCoreInject assignments to lynxTestingEnv.backgroundThread.globalThis.lynxCoreInject
  const oldLynxCoreInject = globalThis.lynxCoreInject;
  globalThis.lynxCoreInject = target.lynxCoreInject;
  try {
    injectTt();
  } finally {
    globalThis.lynxCoreInject = oldLynxCoreInject;
  }

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
  injectTt();
  addCtxNotFoundEventListener();
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
