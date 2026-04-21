// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { options } from 'preact';
// to make sure preact's hooks to register earlier than ours
import './snapshot/hooks/react.js';

import { document, setupBackgroundDocument } from './document.js';
import { initElementPAPICallAlog } from './snapshot/alog/elementPAPICall.js';
import { initAlog } from './snapshot/alog/index.js';
import { setupComponentStack } from './snapshot/debug/component-stack.js';
import { isProfiling } from './snapshot/debug/profile.js';
import { initProfileHook } from './snapshot/debug/profileHooks.js';
import { setupVNodeSourceHook } from './snapshot/debug/vnodeSource.js';
import { replaceCommitHook } from './snapshot/lifecycle/patch/commit.js';
import { addCtxNotFoundEventListener } from './snapshot/lifecycle/patch/error.js';
import { injectUpdateMainThread } from './snapshot/lifecycle/patch/updateMainThread.js';
import { injectCalledByNative } from './snapshot/lynx/calledByNative.js';
import { setupLynxEnv } from './snapshot/lynx/env.js';
import { injectLepusMethods } from './snapshot/lynx/injectLepusMethods.js';
import { initTimingAPI } from './snapshot/lynx/performance.js';
import { injectTt } from './snapshot/lynx/tt.js';
import { injectUpdateMTRefInitValue } from './snapshot/worklet/ref/updateInitValue.js';
import { lynxQueueMicrotask } from './utils.js';

export { runWithForce } from './snapshot/lynx/runWithForce.js';

// @ts-expect-error Element implicitly has an 'any' type because type 'typeof globalThis' has no index signature
if (typeof __MAIN_THREAD__ !== 'undefined' && __MAIN_THREAD__ && typeof globalThis.processEvalResult === 'undefined') {
  // @ts-expect-error Element implicitly has an 'any' type because type 'typeof globalThis' has no index signature
  globalThis.processEvalResult = <T>(result: ((schema: string) => T) | undefined, schema: string) => {
    return result?.(schema);
  };
}

if (typeof __MAIN_THREAD__ !== 'undefined' && __MAIN_THREAD__) {
  injectCalledByNative();
  injectUpdateMainThread();
  injectUpdateMTRefInitValue();
  if (__DEV__) {
    injectLepusMethods();
  }
}

if (__DEV__) {
  setupComponentStack();
}

// We are profiling both main-thread and background.
if (typeof __MAIN_THREAD__ !== 'undefined' && __MAIN_THREAD__ && typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
  initProfileHook();
}

if (typeof __ALOG__ !== 'undefined' && __ALOG__) {
  // We are logging both main-thread and background.
  initAlog();
}
if (typeof __ALOG_ELEMENT_API__ !== 'undefined' && __ALOG_ELEMENT_API__) {
  initElementPAPICallAlog();
}

if (typeof __BACKGROUND__ !== 'undefined' && __BACKGROUND__) {
  // Trick Preact and TypeScript to accept our custom document adapter.
  options.document = document as unknown as Document;
  options.requestAnimationFrame = lynxQueueMicrotask;
  setupBackgroundDocument();
  injectTt();
  addCtxNotFoundEventListener();

  if (process.env['NODE_ENV'] === 'test') {}
  else {
    replaceCommitHook();
    initTimingAPI();
    if (__DEV__ && isProfiling) {
      setupVNodeSourceHook();
    }
    if (isProfiling) {
      initProfileHook();
    }
  }
}

setupLynxEnv();
