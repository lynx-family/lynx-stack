// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { options } from 'preact';
// to make sure preact's hooks to register earlier than ours
import './hooks/react.js';

import { initElementPAPICallAlog } from './alog/elementPAPICall.js';
import { initAlog } from './alog/index.js';
import { setupComponentStack } from './debug/component-stack.js';
import { isProfiling } from './debug/profile.js';
import { initProfileHook } from './debug/profileHooks.js';
import { document, setupBackgroundDocument } from './document.js';
import { replaceCommitHook } from './lifecycle/patch/commit.js';
import { addCtxNotFoundEventListener } from './lifecycle/patch/error.js';
import { injectUpdateMainThread } from './lifecycle/patch/updateMainThread.js';
import { injectCalledByNative } from './lynx/calledByNative.js';
import { setupLynxEnv } from './lynx/env.js';
import { injectLepusMethods } from './lynx/injectLepusMethods.js';
import { initTimingAPI } from './lynx/performance.js';
import { injectTt } from './lynx/tt.js';
import { lynxQueueMicrotask } from './utils.js';
import { injectUpdateMTRefInitValue } from './worklet/ref/updateInitValue.js';

export { runWithForce } from './lynx/runWithForce.js';

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
    if (isProfiling) {
      initProfileHook();
    }
  }
}

setupLynxEnv();
