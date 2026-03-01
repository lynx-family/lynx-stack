// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/* global __CreateRawText, __CreateElement, __SetClasses, __SetInlineStyles, __SetID, __SetAttribute, __AddDataset */
/**
 * Preact Upstream Tests — E2E Pipeline Setup
 *
 * This setup runs Preact upstream tests through the real Lynx dual-thread pipeline:
 *
 *   Preact diff → BackgroundSnapshotInstance → snapshot patches
 *     → (IPC) → SnapshotInstance → Element PAPI → jsdom
 *
 * Instead of Preact operating directly on jsdom (which never happens in production),
 * every DOM mutation goes through the same BSI→patch→ElementPAPI path that
 * @lynx-js/react uses on a real Lynx runtime.
 */

import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { chai, describe, expect } from 'vitest';

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

// --- 4. Register generic snapshots for arbitrary HTML element types ---
// Preact upstream tests use HTML tags (div, span, p, etc.) which don't have
// compiler-generated Snapshot definitions. We intercept the snapshotManager.values
// Map so that any unknown type gets a generic snapshot automatically.

function createGenericSnapshot(type) {
  const isText = type === null || type === 'null';
  return {
    create(ctx) {
      if (isText) {
        return [__CreateRawText(ctx.__values?.[0] ?? '')];
      }
      return [__CreateElement(ctx.type, 0)];
    },
    // For text nodes, index 0 updates the text content.
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

// Monkey-patch Map.prototype.has on the snapshotManager.values instance
// so that any type is treated as registered (auto-registering on first access).
const _origHas = snapshotManager.values.has.bind(snapshotManager.values);
const _origGet = snapshotManager.values.get.bind(snapshotManager.values);

snapshotManager.values.has = function(type) {
  if (_origHas(type)) return true;
  if (typeof type === 'string' || type === null) {
    // If the compiler registered a creator for this type, let it register
    // the real snapshot definition (with correct element tags) instead of
    // falling back to a generic snapshot that uses the snapshot type name.
    if (snapshotCreatorMap[type]) {
      snapshotCreatorMap[type](type);
      return _origHas(type);
    }
    // No compiler definition — auto-register a generic snapshot
    snapshotManager.values.set(type, createGenericSnapshot(type));
    return true;
  }
  return false;
};

snapshotManager.values.get = function(type) {
  const existing = _origGet(type);
  if (existing) return existing;
  if (typeof type === 'string' || type === null) {
    // Try compiler-registered creator first
    if (snapshotCreatorMap[type]) {
      snapshotCreatorMap[type](type);
      const compiled = _origGet(type);
      if (compiled) return compiled;
    }
    // Fallback to generic snapshot
    const snapshot = createGenericSnapshot(type);
    snapshotManager.values.set(type, snapshot);
    return snapshot;
  }
  return undefined;
};

// --- 5. Shim BSI for DOM property compatibility ---
// Preact's diff/props.js sets properties via:
//   1. style: dom.style.cssText = v → needs .style proxy
//   2. events: dom._listeners + addEventListener → needs stubs
//   3. dom.removeAttribute(name) → needs stub
//   4. other: dom[name] = v → 'name' in bsi === false → falls to bsi.setAttribute()

function shimBSI(bsi) {
  // Style proxy
  const styleStore = {};
  bsi.style = new Proxy(styleStore, {
    set(target, prop, value) {
      target[prop] = value;
      if (prop === 'cssText') {
        bsi.setAttribute('style:cssText', value);
      }
      return true;
    },
    get(target, prop) {
      if (prop === 'setProperty') {
        return (k, v) => {
          target[k] = v;
          bsi.setAttribute('style:' + k, v);
        };
      }
      if (prop === 'removeProperty') {
        return (k) => {
          const old = target[k];
          delete target[k];
          return old;
        };
      }
      if (prop === 'getPropertyValue') {
        return (k) => target[k] || '';
      }
      if (prop === 'cssText') return target.cssText || '';
      if (prop === 'length') return Object.keys(target).filter(k => k !== 'cssText').length;
      return target[prop] === undefined ? '' : target[prop];
    },
  });

  // Event listener stubs
  bsi._listeners = {};
  bsi.addEventListener = function(type, handler) {
    (this._listeners[type] || (this._listeners[type] = [])).push(handler);
  };
  bsi.removeEventListener = function(type, handler) {
    const list = this._listeners[type];
    if (list) this._listeners[type] = list.filter(h => h !== handler);
  };
  bsi.dispatchEvent = function(event) {
    const list = this._listeners[event.type];
    if (list) list.forEach(h => typeof h === 'function' ? h(event) : h.handleEvent(event));
    return true;
  };

  // removeAttribute — Preact calls this to clear falsy attrs
  bsi.removeAttribute = function(key) {
    bsi.setAttribute(key, null);
  };

  return bsi;
}

// --- 6. Override SnapshotInstance.setAttribute for generic snapshots ---
// Forward string-keyed attributes to the actual jsdom element via Element PAPI.

const _origSISetAttribute = SnapshotInstance.prototype.setAttribute;
SnapshotInstance.prototype.setAttribute = function(key, value) {
  _origSISetAttribute.call(this, key, value);

  if (
    typeof key === 'string'
    && key !== 'values'
    && this.__snapshot_def?.__isGeneric
    && this.__elements?.[0]
  ) {
    applyViaElementPAPI(this.__elements[0], key, value);
  }
};

// After ensureElements() creates jsdom elements, apply any pending __extraProps
// that were set before the element was materialized.
const _origEnsureElements = SnapshotInstance.prototype.ensureElements;
SnapshotInstance.prototype.ensureElements = function() {
  _origEnsureElements.call(this);
  if (this.__snapshot_def?.__isGeneric && this.__extraProps && this.__elements?.[0]) {
    const el = this.__elements[0];
    for (const [key, value] of Object.entries(this.__extraProps)) {
      applyViaElementPAPI(el, key, value);
    }
  }
};

// Dispatch string-keyed attributes to Element PAPI methods (mirrors updateSpread logic).
// This ensures the test exercises the real SI → Element PAPI → jsdom path.
function applyViaElementPAPI(el, key, value) {
  // Style: shimBSI generates 'style:cssText' and 'style:<prop>' keys
  if (key === 'style:cssText' || key === 'style') {
    __SetInlineStyles(el, value ?? '');
    return;
  }
  if (key.startsWith('style:')) {
    const prop = key.slice(6);
    // __AddInlineStyle takes a numeric key, not a CSS property name.
    // Use __SetInlineStyles with an object for individual properties.
    __SetInlineStyles(el, { [prop]: value ?? '' });
    return;
  }
  if (key === 'className' || key === 'class') {
    __SetClasses(el, value ?? '');
    return;
  }
  if (key === 'id') {
    __SetID(el, value ?? '');
    return;
  }
  if (key === 'htmlFor') {
    __SetAttribute(el, 'for', value);
    return;
  }
  if (key.startsWith('data-')) {
    __AddDataset(el, key.slice(5), value ?? '');
    return;
  }
  // Skip event/internal/ref keys — events are handled by BSI shim,
  // and these are forbidden by __SetAttribute.
  if (key.startsWith('on') || key.startsWith('__') || key === '_listeners') return;
  if (key === 'ref' || key === 'key') return;
  // Boolean → string conversion before __SetAttribute
  // (Preact sets translate={false}; DOM expects "yes"/"no")
  if (key === 'translate') {
    __SetAttribute(el, key, value ? 'yes' : 'no');
    return;
  }
  if (value === true) {
    __SetAttribute(el, key, '');
    return;
  }
  if (value == null || value === false) {
    __SetAttribute(el, key, null);
    return;
  }
  // __SetAttribute handles string values directly; non-strings get JSON.stringify'd
  __SetAttribute(el, key, typeof value === 'string' ? value : String(value));
}

// --- 7. Customize pipeline hooks for upstream Preact compatibility ---

// Wrap onInjectBackgroundThreadGlobals: add BSI shims to _document factories.
// vitest-global-setup.js creates _document.createElement that returns plain BSI;
// upstream Preact's setProperty needs .style, .addEventListener, .removeAttribute.
const _origOnInjectBG = globalThis.onInjectBackgroundThreadGlobals;
globalThis.onInjectBackgroundThreadGlobals = (target) => {
  _origOnInjectBG(target);
  wrapBgDocumentWithShims(target._document);
};
// Also patch the already-initialized background thread _document:
wrapBgDocumentWithShims(lynxTestingEnv.backgroundThread.globalThis._document);

function wrapBgDocumentWithShims(doc) {
  const origCE = doc.createElement;
  const origCENS = doc.createElementNS;
  const origCTN = doc.createTextNode;
  doc.createElement = function(type) {
    return shimBSI(origCE(type));
  };
  doc.createElementNS = function(_ns, type) {
    return shimBSI(origCENS(_ns, type));
  };
  doc.createTextNode = function(text) {
    const i = origCTN(text);
    shimBSI(i);
    return i;
  };
}

// Override onResetLynxTestingEnv: skip worklet cleanup (not needed for upstream tests).
globalThis.onResetLynxTestingEnv = () => {
  lynxTestingEnv.switchToBackgroundThread();
  injectTt();
  addCtxNotFoundEventListener();
};

// Ensure background thread is active and runtime is initialized.
lynxTestingEnv.switchToBackgroundThread();
injectTt();
addCtxNotFoundEventListener();

// --- 8. Pipeline render + commit hook wrapping ---
// Upstream tests call render(jsx, scratch). We redirect to the dual-thread pipeline
// then sync the jsdom output into the scratch container.
//
// Bridge mangled → unmangled option names:
// The ReactLynx-forked Preact uses `options.__c` for commit, but upstream
// Preact uses `options._commit`. replaceCommitHook() hooks `__c`, so we
// alias `_commit` → the hooked `__c` function.

let _lastScratch = null;
let _currentMtRoot = null;
let _insidePipelineRender = false;

// Wrap the _commit hook to auto-sync the scratch after every commit.
// For re-renders triggered by setState/forceUpdate (which don't go through
// __pipelineRender), this ensures the scratch container reflects the latest state.
Object.defineProperty(options, '_commit', {
  get() {
    return this.__c;
  },
  set(v) {
    this.__c = v;
  },
  configurable: true,
});
// We need to wrap after replaceCommitHook has installed its hook on __c.
// The defineProperty above makes _commit an alias for __c, so wrapping __c works.
const _runtimeCommitHook = options.__c;
options.__c = function(vnode, commitQueue) {
  // Before the runtime commit hook applies patches, restore children from
  // the scratch container back into the <page> element so that DOM operations
  // (RemoveChild, InsertBefore) can find the correct elements.
  if (_lastScratch && _currentMtRoot) {
    lynxTestingEnv.switchToMainThread();
    const rootEl = _currentMtRoot.__element_root || _currentMtRoot.__elements?.[0];
    if (rootEl) {
      while (_lastScratch.firstChild) rootEl.appendChild(_lastScratch.firstChild);
    }
    lynxTestingEnv.switchToBackgroundThread();
  }

  _runtimeCommitHook?.call(this, vnode, commitQueue);

  // After the commit hook has sent patches and they've been applied,
  // sync the scratch — but only if we're NOT inside __pipelineRender
  // (which does its own sync at the end).
  if (!_insidePipelineRender && _lastScratch && _currentMtRoot) {
    lynxTestingEnv.switchToMainThread();
    syncSnapshotToScratch(_currentMtRoot, _lastScratch);
    lynxTestingEnv.switchToBackgroundThread();
  }
};

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
  const mtRoot = _currentMtRoot = globalThis.__root;
  const bgRootId = lynxTestingEnv.backgroundThread.globalThis.__root?.__id;

  // Move children back from the scratch container into the <page> element.
  // syncSnapshotToScratch moves them out for the test to inspect; we need to
  // restore them so the next snapshotPatchApply can find them for removal/reorder.
  const rootEl = mtRoot.__element_root || mtRoot.__elements?.[0];
  if (rootEl && parentDom) {
    while (parentDom.firstChild) rootEl.appendChild(parentDom.firstChild);
  }
  if (!mtRoot.__elements) {
    // Create a page element without clearing document.body (which __CreatePage
    // does). The scratch container lives in the same document.body, so clearing
    // it would detach the scratch element from the DOM.
    const page = __CreateElement('page', 0);
    globalThis.elementTree.root = page;
    setupPage(page);
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
  _insidePipelineRender = true;
  preactRender(vnode, globalThis.__root, replaceNode);
  _insidePipelineRender = false;

  // Sync main thread's jsdom elements into the test's scratch container
  lynxTestingEnv.switchToMainThread();
  syncSnapshotToScratch(mtRoot, parentDom);
  lynxTestingEnv.switchToBackgroundThread();
};

function syncSnapshotToScratch(si, scratch) {
  while (scratch.firstChild) scratch.removeChild(scratch.firstChild);
  if (!si?.__elements) return;
  const rootEl = si.__element_root || si.__elements[0];
  if (!rootEl) return;
  // Move children from the Element PAPI root into the scratch container.
  // Both are in the same jsdom document (vitest's), so direct DOM moves work.
  while (rootEl.firstChild) scratch.appendChild(rootEl.firstChild);
}

// --- 9. Globals expected by upstream tests ---

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
