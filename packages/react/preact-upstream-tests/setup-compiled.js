// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/* global Element */
/**
 * Preact Upstream Tests — Compiled Mode Setup
 *
 * In compiled mode, the SWC snapshot compiler transforms JSX into snapshot
 * elements with `values` arrays. Preact sees `{ values: [cls, handler] }`
 * instead of raw props like `{ className: cls, onClick: handler }`.
 *
 * This means:
 * - Preact's diff/props.js never calls setProperty(bsi, 'className', ...)
 *   → no BSI style/event/removeAttribute shims needed
 * - Compiler-generated update[] functions dispatch to Element PAPI directly
 *   → no applyViaElementPAPI() or SI.setAttribute override needed
 *
 * The only addition is a minimal removeAttribute shim on BSI — Preact's
 * setProperty calls dom.removeAttribute() when removing stale props (values,
 * __0, key, etc.), and BSI doesn't have this method natively.
 *
 * Generic snapshot registration is handled by setup-shared.js.
 */

import { lynxTestingEnv } from './setup-shared.js';

// --- Wrapper transparency shim ---
// The compiler wraps text expressions in <wrapper> elements. Upstream Preact
// tests assert on innerHTML and expect bare text. Patch the innerHTML getter
// to strip <wrapper>/<\/wrapper> tags so these tests pass.

const _innerHTMLDesc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
Object.defineProperty(Element.prototype, 'innerHTML', {
  get() {
    return _innerHTMLDesc.get.call(this).replace(/<\/?wrapper>/g, '');
  },
  set(v) {
    _innerHTMLDesc.set.call(this, v);
  },
  configurable: true,
});

// --- Boolean attribute shim ---
// The compiler generates __SetAttribute(el, "translate", false). Element PAPI
// JSON.stringify's booleans, producing translate="false" instead of translate="no".
// Wrap __SetAttribute on the main thread globals to handle boolean semantics.
// Must patch mainThread.globalThis because switchToMainThread() copies these
// onto globalThis, overwriting any direct globalThis patches.

function wrapSetAttribute(target) {
  const orig = target.__SetAttribute;
  if (!orig || orig.__booleanShimmed) return;
  target.__SetAttribute = function(el, key, value) {
    if (key === 'translate') {
      return orig.call(this, el, key, value === true ? 'yes' : (value === false ? 'no' : value));
    }
    if (key === 'popover') {
      if (value === false) return orig.call(this, el, key, null);
      if (value === true) return orig.call(this, el, key, '');
      return orig.call(this, el, key, value);
    }
    return orig.call(this, el, key, value);
  };
  target.__SetAttribute.__booleanShimmed = true;
}

// Patch the current main thread globals:
wrapSetAttribute(lynxTestingEnv.mainThread.globalThis);

// Re-patch whenever main thread globals are re-injected:
const _origOnInjectMT = globalThis.onInjectMainThreadGlobals;
globalThis.onInjectMainThreadGlobals = (target) => {
  _origOnInjectMT(target);
  wrapSetAttribute(target);
};

// --- Minimal BSI shim: removeAttribute only ---
// Preact calls dom.removeAttribute(name) when a prop is removed. BSI doesn't
// have this method. Convert to setAttribute(key, null) which generates a patch.

function addRemoveAttribute(bsi) {
  bsi.removeAttribute = function(key) {
    bsi.setAttribute(key, null);
  };
  return bsi;
}

const _origOnInjectBG = globalThis.onInjectBackgroundThreadGlobals;
globalThis.onInjectBackgroundThreadGlobals = (target) => {
  _origOnInjectBG(target);
  wrapBgDocumentMinimal(target._document);
};
// Also patch the already-initialized background thread _document:
wrapBgDocumentMinimal(lynxTestingEnv.backgroundThread.globalThis._document);

function wrapBgDocumentMinimal(doc) {
  const origCE = doc.createElement;
  const origCENS = doc.createElementNS;
  const origCTN = doc.createTextNode;
  doc.createElement = function(type) {
    return addRemoveAttribute(origCE(type));
  };
  doc.createElementNS = function(_ns, type) {
    return addRemoveAttribute(origCENS(_ns, type));
  };
  doc.createTextNode = function(text) {
    return addRemoveAttribute(origCTN(text));
  };
}
