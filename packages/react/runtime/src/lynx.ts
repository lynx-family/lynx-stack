// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { options } from 'preact';
import type { VNode } from 'preact';
// to make sure preact's hooks to register earlier than ours
import './hooks/react.js';

import { initProfileHook } from './debug/profile.js';
import { document, setupBackgroundDocument } from './document.js';
import { initDelayUnmount } from './lifecycle/delayUnmount.js';
import { injectUpdatePatch, replaceCommitHook, replaceRequestAnimationFrame } from './lifecycle/patch/patchUpdate.js';
import { injectCalledByNative } from './lynx/calledByNative.js';
import { setupLynxEnv } from './lynx/env.js';
import { injectLepusMethods } from './lynx/injectLepusMethods.js';
import { initTimingAPI } from './lynx/performance.js';
import { injectTt } from './lynx/tt.js';
import { COMPONENT, DIFF, DIFFED, FORCE } from './renderToOpcodes/constants.js';

// @ts-expect-error Element implicitly has an 'any' type because type 'typeof globalThis' has no index signature
if (__LEPUS__ && typeof globalThis.processEvalResult === 'undefined') {
  // @ts-expect-error Element implicitly has an 'any' type because type 'typeof globalThis' has no index signature
  globalThis.processEvalResult = <T>(result: (schema: string) => T, schema: string) => {
    return result(schema);
  };
}

export function runWithForce(cb: () => void): void {
  // save vnode and its `_component` in WeakMap
  const m = new WeakMap<VNode, any>();

  const oldDiff = options[DIFF];

  options[DIFF] = (vnode: VNode) => {
    if (oldDiff) {
      oldDiff(vnode);
    }

    // when `options[DIFF]` is called, a newVnode is passed in
    // so its `vnode[COMPONENT]` should be null,
    // but it will be set later
    Object.defineProperty(vnode, COMPONENT, {
      configurable: true,
      set(c) {
        m.set(vnode, c);
        if (c) {
          c[FORCE] = true;
        }
      },
      get() {
        return m.get(vnode);
      },
    });
  };

  const oldDiffed = options[DIFFED];

  options[DIFFED] = (vnode: VNode) => {
    if (oldDiffed) {
      oldDiffed(vnode);
    }

    // delete is a reverse operation of previous `Object.defineProperty`
    delete vnode[COMPONENT];
    // restore
    vnode[COMPONENT] = m.get(vnode);
  };

  try {
    cb();
  } finally {
    options[DIFF] = oldDiff as (vnode: VNode) => void;
    options[DIFFED] = oldDiffed as (vnode: VNode) => void;
  }
}

if (__LEPUS__) {
  injectCalledByNative();
  injectUpdatePatch();
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
