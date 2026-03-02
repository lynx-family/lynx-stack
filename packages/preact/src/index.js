// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/* global __CreatePage */

import { options, render } from 'preact';
import 'preact/hooks';
import {
  LynxDocument,
  LynxElement,
  installRunWorklet,
} from './lynx-document.js';

// Redirect Preact's DOM operations to Lynx's Element PAPI.
// Standard preact reads the global `document`; LynxDocument implements
// the subset of the DOM API that Preact's reconciler needs.
globalThis.document = new LynxDocument();

// Preact's default scheduling uses `Promise.resolve().then(process)` to defer
// re-renders to a microtask. In Lepus's main thread, the JS engine (JSC) may
// not drain the microtask queue after a worklet callback returns, so queued
// re-renders never execute. Force synchronous re-renders instead: when setState
// is called inside an event handler, the component re-renders immediately
// before the handler returns and all PAPI mutations are flushed together.
// After all PAPI mutations are applied, flush the element tree so Lynx repaints.
options.debounceRendering = fn => {
  fn();
  /* global __FlushElementTree */
  if (typeof __FlushElementTree === 'function') __FlushElementTree();
};

export function createRoot() {
  // Install our runWorklet dispatcher here — inside renderPage() — so it runs
  // after Lynx native has initialized its own runWorklet. Installing earlier
  // (at module evaluation time) would be overwritten by the native runtime.
  installRunWorklet();

  const pageHandle = __CreatePage('0', 0);
  const root = new LynxElement(pageHandle, 'page');
  return {
    render(vnode) {
      render(vnode, root);
    },
  };
}
