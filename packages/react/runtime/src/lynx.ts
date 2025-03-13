// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { options } from 'preact';
// to make sure preact's hooks to register earlier than ours
import './hooks/react.js';

import { initProfileHook } from './debug/profile.js';
import { document, setupBackgroundDocument } from './document.js';
import { initDelayUnmount } from './lifecycle/delayUnmount.js';
import { replaceCommitHook, replaceRequestAnimationFrame } from './lifecycle/patch/commit.js';
import { injectUpdateMainThread } from './lifecycle/patch/updateMainThread.js';
import { injectCalledByNative } from './lynx/calledByNative.js';
import { setupLynxEnv } from './lynx/env.js';
import { injectLepusMethods } from './lynx/injectLepusMethods.js';
import { initTimingAPI } from './lynx/performance.js';
import { injectTt } from './lynx/tt.js';

// @ts-expect-error Element implicitly has an 'any' type because type 'typeof globalThis' has no index signature
if (__LEPUS__ && typeof globalThis.processEvalResult === 'undefined') {
  // @ts-expect-error Element implicitly has an 'any' type because type 'typeof globalThis' has no index signature
  globalThis.processEvalResult = <T>(result: ((schema: string) => T) | undefined, schema: string) => {
    return result?.(schema);
  };
}

if (__LEPUS__) {
  injectCalledByNative();
  injectUpdateMainThread();
  if (__DEV__) {
    injectLepusMethods();
  }
}

// TODO: replace this with __PROFILE__
if (__PROFILE__) {
  // We are profiling both main-thread and background.
  initProfileHook();
}

if (__JS__) {
  options.document = document;
  setupBackgroundDocument();
  injectTt();

  if (process.env['NODE_ENV'] === 'test') {}
  else {
    replaceCommitHook();
    replaceRequestAnimationFrame();
    initTimingAPI();
    initDelayUnmount();
  }
}

setupLynxEnv();
