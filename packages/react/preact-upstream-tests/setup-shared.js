// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/* global __CreateRawText, __CreateElement */
/**
 * Preact Upstream Tests — Shared E2E Pipeline Setup
 *
 * Common setup for both compiled and non-compiled modes. Initializes the
 * dual-thread Lynx testing environment and the pipeline render wrapper.
 *
 * Mode-specific setup is in setup-nocompile.js and setup-compiled.js.
 */

// eslint-disable-next-line import/no-unresolved
import sinon from 'sinon';
// eslint-disable-next-line import/no-unresolved
import sinonChai from 'sinon-chai';
import { chai, describe, expect } from 'vitest';

// eslint-disable-next-line import/no-unresolved
import { LynxTestingEnv } from '@lynx-js/testing-environment';

import { options, render as preactRender } from './preact/src/index.js';

// --- 1. Initialize the dual-thread Lynx testing environment ---

// Use vitest's jsdom environment (the global `window`) so that Element PAPI
// creates nodes in the same document as the test's scratch container.
// LynxTestingEnv expects a JSDOM-like object with `.window`.
const jsdomShim = { window: globalThis.window ?? globalThis };
const lynxTestingEnv = new LynxTestingEnv(jsdomShim);
globalThis.lynxTestingEnv = lynxTestingEnv;

// --- 2. Reuse the standard ReactLynx testing pipeline setup ---
// vitest-global-setup.js handles: runtime imports, injectCalledByNative(),
// injectUpdateMainThread(), replaceCommitHook(), all hook definitions
// (onInjectMainThreadGlobals, onInjectBackgroundThreadGlobals,
// onSwitchedToMainThread/BackgroundThread, onResetLynxTestingEnv),
// and initial hook invocation.
await import('../testing-library/src/vitest-global-setup.js');

// --- 3. Import remaining runtime internals needed for custom logic ---

const { initGlobalSnapshotPatch } = await import('../runtime/lib/lifecycle/patch/snapshotPatch.js');
const { injectTt } = await import('../runtime/lib/lynx/tt.js');
const { addCtxNotFoundEventListener } = await import('../runtime/lib/lifecycle/patch/error.js');
const {
  SnapshotInstance,
  snapshotManager,
  snapshotCreatorMap,
  snapshotInstanceManager,
  setupPage,
} = await import('../runtime/lib/snapshot.js');
const { DynamicPartType } = await import('../runtime/lib/snapshot/dynamicPartType.js');

// --- 4. Register generic snapshots for arbitrary element types ---
// Preact upstream tests use HTML tags (div, span, p, etc.) which don't have
// compiler-generated Snapshot definitions. In compiled mode, the compiler
// generates snapshot hash types whose creators are in snapshotCreatorMap.
// We intercept snapshotManager.values so that:
//   1. Compiler-registered creators (snapshotCreatorMap) are called first
//   2. Unknown types get a generic snapshot as fallback
//
// The __isGeneric marker is used by the non-compiled mode's SI.setAttribute
// override to know when to dispatch string-keyed attrs to Element PAPI.

function createGenericSnapshot(type) {
  const isText = type === null || type === 'null';
  return {
    create(ctx) {
      if (isText) {
        return [__CreateRawText(ctx.__values?.[0] ?? '')];
      }
      return [__CreateElement(ctx.type, 0)];
    },
    update: isText
      ? [
        function updateTextContent(si) {
          const el = si.__elements?.[0];
          if (el) el.data = si.__values?.[0] ?? '';
        },
      ]
      : null,
    slot: [[DynamicPartType.Children, 0]],
    isListHolder: false,
    __isGeneric: true,
  };
}

const _origHas = snapshotManager.values.has.bind(snapshotManager.values);
const _origGet = snapshotManager.values.get.bind(snapshotManager.values);

snapshotManager.values.has = function(type) {
  if (_origHas(type)) return true;
  if (typeof type === 'string' || type === null) {
    if (snapshotCreatorMap[type]) {
      snapshotCreatorMap[type](type);
      return _origHas(type);
    }
    snapshotManager.values.set(type, createGenericSnapshot(type));
    return true;
  }
  return false;
};

snapshotManager.values.get = function(type) {
  const existing = _origGet(type);
  if (existing) return existing;
  if (typeof type === 'string' || type === null) {
    if (snapshotCreatorMap[type]) {
      snapshotCreatorMap[type](type);
      const compiled = _origGet(type);
      if (compiled) return compiled;
    }
    const snapshot = createGenericSnapshot(type);
    snapshotManager.values.set(type, snapshot);
    return snapshot;
  }
  return undefined;
};

// --- 5. Override onResetLynxTestingEnv ---
// Skip worklet cleanup (not needed for upstream tests).
globalThis.onResetLynxTestingEnv = () => {
  lynxTestingEnv.switchToBackgroundThread();
  injectTt();
  addCtxNotFoundEventListener();
};

// Ensure background thread is active and runtime is initialized.
lynxTestingEnv.switchToBackgroundThread();
injectTt();
addCtxNotFoundEventListener();

// --- 6. Pipeline render setup ---
// Upstream tests call render(jsx, scratch). We redirect to the dual-thread pipeline.
//
// Bridge mangled → unmangled option names:
// The ReactLynx-forked Preact uses `options.__c` for commit, but upstream
// Preact uses `options._commit`. replaceCommitHook() hooks `__c`, so we
// alias `_commit` → the hooked `__c` function.

let _lastScratch = null;

Object.defineProperty(options, '_commit', {
  get() {
    return this.__c;
  },
  set(v) {
    this.__c = v;
  },
  configurable: true,
});

// No custom commit hook needed: scratch IS the page root element, so patches
// applied by snapshotPatchApply (via callLepusMethod inside the runtime commit
// hook) operate directly on scratch. No move-back or sync-out required.

globalThis.__pipelineRender = function pipelineRender(vnode, parentDom, replaceNode) {
  // When the scratch container changes (new test), reinitialize the dual-thread
  // roots so Preact starts with a clean vnode tree. Without this, Preact would
  // diff against the previous test's BSI children and produce wrong patches.
  if (parentDom !== _lastScratch) {
    _lastScratch = parentDom;
    lynxTestingEnv.switchToMainThread();
    globalThis.onInjectMainThreadGlobals(lynxTestingEnv.mainThread.globalThis);
    lynxTestingEnv.switchToBackgroundThread();
    globalThis.onInjectBackgroundThreadGlobals(lynxTestingEnv.backgroundThread.globalThis);
    injectTt();
    addCtxNotFoundEventListener();
  }

  // Ensure main thread root SI has elements and is registered under BSI root's ID.
  lynxTestingEnv.switchToMainThread();
  const mtRoot = globalThis.__root;
  const bgRootId = lynxTestingEnv.backgroundThread.globalThis.__root?.__id;

  if (!mtRoot.__elements) {
    // Use scratch itself as the page root element. This avoids __CreatePage
    // (which clears document.body) and eliminates all child-moving between a
    // separate <page> element and scratch.
    //
    // The 'root' snapshot's create() returns [__page] on the main thread, so
    // setupPage(scratch) causes ensureElements() to set:
    //   mtRoot.__elements = [scratch]
    //   mtRoot.__element_root = scratch
    //
    // Subsequent snapshotPatchApply calls (AppendElement, RemoveChild, etc.)
    // operate directly on scratch — tests see the live DOM immediately.
    if (!parentDom.$$uiSign) parentDom.$$uiSign = -1;
    globalThis.elementTree.root = parentDom;
    setupPage(parentDom);
    mtRoot.ensureElements();
  }

  // Always ensure the SI root is findable by BSI root's ID
  if (bgRootId != null && !snapshotInstanceManager.values.has(bgRootId)) {
    snapshotInstanceManager.values.set(bgRootId, mtRoot);
  }

  lynxTestingEnv.switchToBackgroundThread();

  // Initialize the snapshot patch array so BSI operations generate patches
  initGlobalSnapshotPatch();

  // Preact render → BSI → commit hook → callLepusMethod → main thread snapshotPatchApply
  // Patches land directly in scratch. callLepusMethod restores the background thread.
  preactRender(vnode, globalThis.__root, replaceNode);

  lynxTestingEnv.switchToBackgroundThread();
};

// --- 7. Globals expected by upstream tests ---

chai.use(sinonChai);
globalThis.context = describe;
globalThis.sinon = sinon;

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
}

globalThis.window?.addEventListener?.('error', () => {
  // Suppress uncaught errors from reaching the test runner
});

expect.extend({
  equalNode(received, expected) {
    if (expected == null) {
      return {
        pass: received == null,
        message: () => `expected node to "== null" but got ${received} instead.`,
      };
    }
    return {
      pass: received?.tagName === expected.tagName && received === expected,
      message: () => `expected node to have tagName ${expected.tagName} but got ${received?.tagName} instead.`,
    };
  },
});

// --- Exports for mode-specific setup files ---
export {
  lynxTestingEnv,
  SnapshotInstance,
  snapshotManager,
  snapshotCreatorMap,
  DynamicPartType,
  injectTt,
  addCtxNotFoundEventListener,
};
