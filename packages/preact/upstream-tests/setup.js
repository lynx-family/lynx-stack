// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/**
 * Preact Upstream Tests — Main Thread Setup (Element PAPI Renderer)
 *
 * Sets up Preact to render directly through Lynx's Element PAPI instead of
 * the browser DOM. No dual-thread pipeline, no BSI, no snapshot machinery.
 *
 * Architecture:
 *   Preact → LynxDocument → Element PAPI shims → jsdom (test env)
 *                                              → native Lynx (production)
 *
 * Test environment shims are defined here. They wrap jsdom operations so the
 * same LynxDocument code that works in tests will work in production Lynx
 * (where only the real PAPI functions exist, no browser DOM at all).
 *
 * Compared to packages/react/preact-upstream-tests (pipeline approach):
 *   - No dual-thread setup, no LynxTestingEnv, no BackgroundSnapshotInstance
 *   - No __pipelineRender wrapper — we use __lynxRender (see vitest.shared.ts)
 *   - refs return LynxElement objects (not jsdom HTMLElements) — expected
 *   - getDomSibling / replaceNode tests excluded (access jsdom-specific Preact internals)
 */

import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { chai, describe, expect } from 'vitest';

// ─── 1. Install Element PAPI shims ──────────────────────────────────────────
//
// These shims back the PAPI functions with jsdom in the test environment.
// In production Lynx, the runtime provides the real implementations.
//
// __CreateElement(tag, pageId) → creates a jsdom element (as the PAPI handle)
// __AppendElement(parent, child) → jsdom parent.appendChild(child)
// etc.
//
// Note: __AppendElement / __InsertElementBefore / __RemoveElement receive the
// _papiHandle fields (raw jsdom elements), NOT the LynxElement wrappers.

globalThis.__CreateElement = (tag, _pageId) => document.createElement(tag);
globalThis.__CreateRawText = (text) => document.createTextNode(text);

globalThis.__AppendElement = (parent, child) => {
  parent.appendChild(child);
};

globalThis.__InsertElementBefore = (parent, child, before) => {
  parent.insertBefore(child, before ?? null);
};

globalThis.__RemoveElement = (parent, child) => {
  if (child.parentNode === parent) parent.removeChild(child);
};

globalThis.__SetAttribute = (el, key, value) => {
  if (value == null) {
    el.removeAttribute(key);
  } else {
    el.setAttribute(key, typeof value === 'string' ? value : String(value));
  }
};

globalThis.__SetClasses = (el, classes) => {
  if (classes) el.setAttribute('class', classes);
  else el.removeAttribute('class');
};

globalThis.__SetID = (el, id) => {
  if (id) el.setAttribute('id', id);
  else el.removeAttribute('id');
};

globalThis.__SetInlineStyles = (el, styles) => {
  if (typeof styles === 'string') {
    el.style.cssText = styles;
  } else if (styles && typeof styles === 'object') {
    Object.assign(el.style, styles);
  }
};

globalThis.__AddDataset = (el, key, value) => {
  if (value == null) el.removeAttribute('data-' + key);
  else el.setAttribute('data-' + key, value);
};

// __SetCSSId is a no-op in tests — we only need it in production Lynx to link
// elements to COMMON_CSS (ID=0) so class selectors are matched by the CSS engine.
globalThis.__SetCSSId = () => {};

// __AddEvent shim: exercise the production worklet registration path.
//
// In production Lynx, LynxElement.addEventListener registers handlers as
// worklets via __AddEvent, and Lynx native later calls runWorklet(value, [e]).
// Without this shim, __AddEvent is undefined and the code falls back to
// _papiHandle.addEventListener — bypassing the entire production code path.
//
// This shim stores the registration AND wires a jsdom listener so that
// dispatchEvent(new Event('click')) still reaches Preact's handlers.
// The wrapper (already in _workletMap) is registered directly on the jsdom
// handle — equivalent to what runWorklet would call in production.
//
// Reverse of the _w3cToLynxEvent map in lynx-document.js.
const _lynxToW3cEvent = { tap: 'click' };

globalThis.__AddEvent = (handle, eventType, eventName, event) => {
  // For mapped events (e.g. Lynx 'tap' → W3C 'click'), use the W3C name.
  // For unmapped events (e.g. 'OtherClick', 'focus'), pass through unchanged —
  // Preact already determined the correct event name when calling addEventListener.
  const w3cName = _lynxToW3cEvent[eventName] ?? eventName;
  const useCapture = eventType === 'capture-bind';
  const slotKey = `__preactEvtShim_${eventType}_${eventName}`;

  // Remove previous jsdom listener registered for this slot.
  if (handle[slotKey]) {
    handle.removeEventListener(w3cName, handle[slotKey], useCapture);
    delete handle[slotKey];
  }

  if (event == null) return;

  if (event.type === 'worklet' && event.value != null) {
    // LynxElement.addEventListener stores the wrapper in _workletMap before
    // calling __AddEvent, so the lookup below always succeeds.
    const fn = globalThis.lynxWorkletImpl?._workletMap?.[event.value];
    if (typeof fn === 'function') {
      handle.addEventListener(w3cName, fn, useCapture);
      handle[slotKey] = fn;
    }
  }
};

// __FlushElementTree shim: no-op in tests (jsdom mutations are synchronous).
globalThis.__FlushElementTree = () => {};

// ─── 2. Set options.document to use Element PAPI ────────────────────────────

// The Lynx fork of Preact uses options.document (not the global document) for
// all element and text node creation. We replace it with our LynxDocument so
// every createElement / createTextNode call goes through Element PAPI.

import { options } from 'preact';
import { LynxDocument, LynxElement } from '../src/lynx-document.js';

options.document = new LynxDocument();

// ─── 3. __lynxRender — wraps scratch container in a LynxElement ─────────────
//
// Test files call render(vnode, scratch) where scratch is a plain jsdom div.
// The vitest.shared.ts lynxRenderPlugin rewrites these to __lynxRender(...)
//
// __lynxRender wraps the jsdom scratch in a LynxElement, using scratch itself
// as the PAPI handle. This means:
//   - LynxElement.appendChild(child) → __AppendElement(scratch, child._papiHandle)
//     → scratch.appendChild(child._papiHandle) → jsdom DOM updated
//   - scratch.innerHTML reflects real DOM content → test assertions pass ✓
//
// The wrapper is cached per scratch so re-renders reuse the same LynxElement
// (preserving Preact's vnode tree structure across renders).

import { render as _preactRender } from 'preact';

const _containerCache = new WeakMap();

globalThis.__lynxRender = function lynxRender(vnode, scratch, replaceNode) {
  // If scratch is already a LynxElement (e.g. ref.current is a LynxProxy), use
  // it directly. Wrapping it again would make _papiHandle = LynxProxy, causing
  // __AppendElement(LynxProxy, ...) → double-proxy recursion and a crash.
  if (scratch != null && typeof scratch._papiHandle !== 'undefined') {
    _preactRender(vnode, scratch, replaceNode);
    return;
  }
  let lynxScratch = _containerCache.get(scratch);
  if (!lynxScratch) {
    lynxScratch = new LynxElement(scratch, scratch.localName || 'div');
    _containerCache.set(scratch, lynxScratch);
  }
  _preactRender(vnode, lynxScratch, replaceNode);
};

// ─── 4. Standard globals expected by upstream test files ────────────────────

chai.use(sinonChai);
globalThis.context = describe;
globalThis.sinon = sinon;

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
}

globalThis.window?.addEventListener?.('error', () => {});

// Custom assertion: compare nodes by identity.
//
// In PAPI rendering, Preact keeps LynxElement wrappers while tests access the
// underlying jsdom elements via scratch.firstChild etc. To support both sides,
// we unwrap _papiHandle when comparing: a LynxElement wrapping jsdom_div equals
// the jsdom_div itself.
expect.extend({
  equalNode(received, expected) {
    if (expected == null) {
      return {
        pass: received == null,
        message: () =>
          `expected node to "== null" but got ${received} instead.`,
      };
    }
    // Unwrap LynxElement to its PAPI handle for comparison so that:
    //   equalNode(LynxElement{_papiHandle: div}, div)  → pass
    //   equalNode(div, div)                             → pass
    const rh = received?._papiHandle ?? received;
    const eh = expected?._papiHandle ?? expected;
    return {
      pass: rh?.tagName === eh?.tagName && rh === eh,
      message: () =>
        `expected node to have tagName ${eh?.tagName} but got ${rh?.tagName} instead.`,
    };
  },
});
