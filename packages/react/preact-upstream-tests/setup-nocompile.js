// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/* global __SetClasses, __SetInlineStyles, __SetID, __SetAttribute, __AddDataset */
/**
 * Preact Upstream Tests — Non-Compiled Mode Setup
 *
 * Adds BSI shims and generic snapshot registration for running upstream Preact
 * tests without the SWC snapshot compiler. In this mode, Preact sees raw props
 * (e.g. { className: 'foo' }) and its diff/props.js calls DOM-like APIs on BSI
 * (style, addEventListener, removeAttribute), which must be shimmed.
 *
 * The string-keyed attributes from BSI are dispatched to Element PAPI via
 * applyViaElementPAPI(), mirroring the updateSpread() logic in the runtime.
 */

import { SnapshotInstance, lynxTestingEnv } from './setup-shared.js';

// --- 1. Shim BSI for DOM property compatibility ---
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

// --- 2. Override SnapshotInstance.setAttribute for generic snapshots ---
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

// --- 3. Wrap background thread hooks to inject BSI shims ---
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
