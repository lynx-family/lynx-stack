// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/* global __CreateElement, __CreateRawText,
          __AppendElement, __InsertElementBefore, __RemoveElement,
          __SetAttribute, __SetClasses, __SetInlineStyles, __SetID, __AddDataset,
          __SetCSSId, __AddEvent */
/**
 * Lynx Element PAPI adapter for Preact.
 *
 * Provides a custom `document` object for `options.document` that routes all
 * Preact DOM operations through Lynx's Element PAPI instead of the browser DOM.
 *
 * Architecture:
 *   Preact → LynxDocument.createElement()  → __CreateElement()   → PAPI handle
 *   Preact → LynxElement.appendChild()     → __AppendElement()   → PAPI call
 *   Preact → LynxElement.setAttribute()    → __SetClasses() etc. → PAPI call
 *
 * In the test environment, PAPI functions are shimmed to create/manipulate
 * jsdom elements. In production Lynx, PAPI functions operate on native elements.
 * The renderer code is the same in both environments.
 *
 * Key design choices:
 *   1. LynxElement maintains a `_children` array for Preact's tree traversal
 *      (firstChild, nextSibling). The actual element tree lives in PAPI.
 *   2. `_papiHandle` is what PAPI returned — in tests it is a jsdom element,
 *      in production it is an opaque native handle.
 *   3. `_listeners` is shared between the LynxElement wrapper and the PAPI
 *      handle (via property assignment on the handle). This bridges Preact's
 *      event delegation (stores handlers in dom._listeners) to jsdom event
 *      dispatch (fires handlers via the registered proxyEventHandler).
 */

// ─── Attribute routing ───────────────────────────────────────────────────────

/**
 * Route a Preact prop/attribute through the correct Element PAPI setter.
 * Mirrors the logic in packages/react/preact-upstream-tests/setup-nocompile.js.
 */
function applyViaElementPAPI(handle, key, value) {
  // Style: Preact sets style.cssText or individual properties via the style proxy
  if (key === 'style:cssText' || key === 'style') {
    __SetInlineStyles(handle, value ?? '');
    return;
  }
  if (typeof key === 'string' && key.startsWith('style:')) {
    __SetInlineStyles(handle, { [key.slice(6)]: value ?? '' });
    return;
  }
  // Class
  if (key === 'className' || key === 'class') {
    __SetClasses(handle, value ?? '');
    return;
  }
  // ID
  if (key === 'id') {
    __SetID(handle, value ?? '');
    return;
  }
  // for= (label htmlFor)
  if (key === 'htmlFor') {
    __SetAttribute(handle, 'for', value);
    return;
  }
  // data-* attributes
  if (typeof key === 'string' && key.startsWith('data-')) {
    __AddDataset(handle, key.slice(5), value ?? '');
    return;
  }
  // Skip event handlers, Preact internals, ref/key
  if (typeof key === 'string') {
    if (key.startsWith('on') || key.startsWith('__') || key === '_listeners') {
      return;
    }
    if (key === 'ref' || key === 'key') return;
  }
  // Boolean serialization for translate attribute
  if (key === 'translate') {
    __SetAttribute(handle, key, value ? 'yes' : 'no');
    return;
  }
  // aria-* attributes: false → "false" (not removed), null/undefined → remove
  if (typeof key === 'string' && key.startsWith('aria-')) {
    if (value == null) {
      __SetAttribute(handle, key, null);
    } else {
      __SetAttribute(handle, key, String(value));
    }
    return;
  }
  // Remove attribute for null / false / undefined
  if (value == null || value === false) {
    __SetAttribute(handle, key, null);
    return;
  }
  // All other values — use String() so NaN → 'NaN', numbers → '42', etc.
  __SetAttribute(
    handle,
    key,
    typeof value === 'string' ? value : String(value),
  );
}

// ─── Style proxy factory ─────────────────────────────────────────────────────

function createStyleProxy(handle) {
  const store = {};
  return new Proxy(store, {
    set(target, prop, value) {
      target[prop] = value;
      if (prop === 'cssText') {
        __SetInlineStyles(handle, value ?? '');
      } else {
        __SetInlineStyles(handle, { [String(prop)]: value ?? '' });
      }
      return true;
    },
    get(target, prop) {
      if (prop === 'setProperty') {
        return (k, v) => {
          target[k] = v;
          __SetInlineStyles(handle, { [k]: v ?? '' });
        };
      }
      if (prop === 'removeProperty') {
        return (k) => {
          const old = target[k];
          delete target[k];
          return old;
        };
      }
      if (prop === 'getPropertyValue') return (k) => target[k] ?? '';
      if (prop === 'cssText') return target.cssText ?? '';
      if (prop === 'length') {
        return Object.keys(target).filter(k => k !== 'cssText').length;
      }
      return target[prop] === undefined ? '' : target[prop];
    },
  });
}

// ─── Proxy handler for LynxElement ───────────────────────────────────────────
//
// Native DOM elements respond to `'onclick' in element` with true, which Preact
// uses to normalize camelCase event names to lowercase:
//   if (lowerCaseName in dom) name = lowerCaseName.slice(2);  // → 'click'
//   else name = name.slice(2);                                 // → 'Click' (WRONG)
//
// Strategy:
//   1. Delegate to _papiHandle first. In tests (jsdom handles) this gives the
//      correct answer for ALL events: true for standard ones (onclick, onfocus…)
//      and false for non-standard ones (onotherclick), preserving upstream tests.
//   2. In production Lynx, native handles have no on* properties. Fall back to
//      _knownLynxOnEvents — the minimal set of W3C event names that Lynx remaps
//      (e.g. click → tap). Only these need lowercase normalisation; unknown/custom
//      events return false so Preact preserves their camelCase (e.g. 'OtherClick').

// Events that must appear "in dom" on native handles for correct W3C→Lynx mapping.
const _knownLynxOnEvents = new Set([
  'onclick', // click → tap (the key one)
  'onfocus',
  'onblur',
  'oninput',
  'onchange',
  'onscroll',
  'onkeydown',
  'onkeyup',
  'onkeypress',
  'onsubmit',
  'ontouchstart',
  'ontouchend',
  'ontouchmove',
  'ontouchcancel',
]);

const _onEventPattern = /^on[a-z]/;

const lynxElementProxyHandler = {
  has(target, prop) {
    if (typeof prop === 'string' && _onEventPattern.test(prop)) {
      if (target._papiHandle != null && prop in target._papiHandle) return true;
      return _knownLynxOnEvents.has(prop);
    }
    return prop in target;
  },
};

// ─── Main-thread event handling ──────────────────────────────────────────────
//
// Preact is fully main-threaded: ALL event handlers run in the same JS context
// as the renderer. We register each handler as a worklet so __AddEvent can
// invoke it via runWorklet() when native events fire — exactly the same
// mechanism used by @lynx-js/react's `main-thread:onClick` events.
//
// Handler IDs are plain strings (e.g. "preact_0") stored in _workletMap.
// __AddEvent receives { type: 'worklet', value: "preact_0" }, and Lynx native
// calls runWorklet("preact_0", [crossEvent]) when the event fires.
//
// installRunWorklet() must be called from createRoot() — i.e. inside renderPage()
// — so that it runs AFTER Lynx native has initialized its own runWorklet.
// Installing at module-evaluation time would be overwritten by native init.

if (!globalThis.lynxWorkletImpl) {
  globalThis.lynxWorkletImpl = { _workletMap: {} };
} else if (!globalThis.lynxWorkletImpl._workletMap) {
  globalThis.lynxWorkletImpl._workletMap = {};
}

/**
 * Install the Preact worklet dispatcher onto globalThis.runWorklet.
 * Must be called inside renderPage() (i.e. from createRoot()) so it runs
 * after Lynx native has set up its own runWorklet implementation.
 */
export function installRunWorklet() {
  const _prevRunWorklet = globalThis.runWorklet;
  globalThis.runWorklet = function runWorklet(ctx, params) {
    // ctx is the value passed to __AddEvent — a plain string ID for our handlers.
    // Also handle {_wkltId} objects for forward-compatibility.
    const id = typeof ctx === 'string'
      ? ctx
      : (ctx != null && typeof ctx === 'object' ? ctx._wkltId : undefined);
    if (id !== undefined) {
      const fn = globalThis.lynxWorkletImpl?._workletMap?.[id];
      if (typeof fn === 'function') {
        fn.call(null, params && params[0]);
        return;
      }
    }
    if (typeof _prevRunWorklet === 'function') {
      _prevRunWorklet.call(this, ctx, params);
    }
  };
}

// W3C event name → Lynx event name passed to __AddEvent.
// __AddEvent stores by Lynx name and registers the DOM listener under the
// corresponding W3C name (via LynxEventNameToW3cCommon). At dispatch time
// commonHandler converts W3C → Lynx to look up the stored handler.
// Events not in this map have the same name in both systems.
const _w3cToLynxEvent = { click: 'tap' };

let _nextWorkletId = 0;

// ─── Tree traversal helper ───────────────────────────────────────────────────

function nextSiblingOf(node) {
  if (!node.parentNode) return null;
  const siblings = node.parentNode.__kids;
  const idx = siblings.indexOf(node);
  return idx >= 0 ? (siblings[idx + 1] ?? null) : null;
}

// ─── LynxTextNode ─────────────────────────────────────────────────────────────

/**
 * A text node backed by a PAPI text handle.
 *
 * Preact reads/writes `.data` on text nodes. We mirror changes to the PAPI
 * handle so that jsdom text content stays in sync (for test assertions).
 */
export class LynxTextNode {
  constructor(text) {
    this.nodeType = 3;
    this._data = text;
    this._papiHandle = __CreateRawText(text);
    this.parentNode = null;
  }

  get data() {
    return this._data;
  }
  set data(v) {
    this._data = v;
    if (this._papiHandle != null) {
      // In tests __CreateRawText returns a jsdom Text node (nodeType=3), updated via .data.
      // In native Lynx it returns a raw-text element handle, updated via __SetAttribute.
      if (this._papiHandle.nodeType === 3) {
        this._papiHandle.data = v;
      } else {
        __SetAttribute(this._papiHandle, 'text', v ?? '');
      }
    }
  }

  get nextSibling() {
    return nextSiblingOf(this);
  }
}

// ─── LynxElement ─────────────────────────────────────────────────────────────

/**
 * An element node backed by a PAPI element handle.
 *
 * Tree operations (appendChild, insertBefore, removeChild) route through
 * __AppendElement / __InsertElementBefore / __RemoveElement.
 *
 * Attribute/property setting routes through the appropriate PAPI setter
 * (__SetClasses, __SetID, __SetInlineStyles, __SetAttribute, __AddDataset).
 *
 * Event listeners are stored in `_listeners` (Preact's convention) AND
 * registered on the underlying PAPI handle. This lets jsdom tests dispatch
 * events that reach Preact's proxyEventHandler, which reads `_listeners`
 * from the handle (shared via reference assignment in the constructor).
 */
export class LynxElement {
  constructor(papiHandle, tag) {
    this.nodeType = 1;
    this._papiHandle = papiHandle;
    this.localName = tag.toLowerCase();
    this.nodeName = tag.toUpperCase();
    // NOTE: intentionally NOT named `_children` — Preact stores the rendered
    // VNode tree on `parentDom._children` after each render() call. Using a
    // different name avoids overwriting our DOM-child tracking array.
    this.__kids = [];
    this.parentNode = null;
    this._listeners = {};
    this._style = null; // lazy

    // Share _listeners reference with the PAPI handle. Preact sets
    // dom._listeners[eventName] = handler directly as a property, and its
    // proxyEventHandler reads `this._listeners` where `this` is the event
    // target. In jsdom tests, `this` is the PAPI handle (jsdom element).
    // By assigning the same object, both paths see the same handlers.
    if (papiHandle != null && typeof papiHandle === 'object') {
      papiHandle._listeners = this._listeners;
    }

    // Return a Proxy so that `'onclick' in lynxElement` returns true.
    // Preact uses this check to normalize camelCase event names:
    //   if (lowerCaseName in dom) name = lowerCaseName.slice(2);  // → 'click'
    //   else name = name.slice(2);                                 // → 'Click' (WRONG)
    return new Proxy(this, lynxElementProxyHandler);
  }

  // ── Traversal ──

  get firstChild() {
    return this.__kids[0] ?? null;
  }
  get nextSibling() {
    return nextSiblingOf(this);
  }

  /** childNodes backed by __kids (not _children, which Preact uses for VNode storage). */
  get childNodes() {
    return this.__kids;
  }

  // ── DOM property accessors ──
  // Preact's setProperty checks `name in dom` to decide whether to use the DOM
  // property setter path (e.g. dom.value = val) vs setAttribute. By declaring
  // these accessors, we make those properties discoverable via `in` and route
  // their reads/writes through to the PAPI handle (jsdom in tests, native in prod).

  get tagName() {
    return this.nodeName;
  }

  // value / checked / selected — input/select element controlled properties
  // For custom elements (localName contains '-'), these are not IDL attributes,
  // so we use setAttribute so the value is reflected in innerHTML.
  get value() {
    return this._papiHandle?.value ?? '';
  }
  set value(v) {
    if (!this._papiHandle) return;
    if (this.localName.includes('-')) {
      __SetAttribute(this._papiHandle, 'value', v == null ? null : String(v));
    } else {
      this._papiHandle.value = v;
    }
  }

  get checked() {
    return this._papiHandle?.checked ?? false;
  }
  set checked(v) {
    if (!this._papiHandle) return;
    if (this.localName.includes('-')) {
      __SetAttribute(this._papiHandle, 'checked', v == null ? null : String(v));
    } else {
      this._papiHandle.checked = v;
    }
  }

  get selected() {
    return this._papiHandle?.selected ?? false;
  }
  set selected(v) {
    if (this._papiHandle) this._papiHandle.selected = v;
  }

  // defaultValue / defaultChecked — reflected input attributes for initial values
  get defaultValue() {
    return this._papiHandle?.defaultValue ?? '';
  }
  set defaultValue(v) {
    if (this._papiHandle) this._papiHandle.defaultValue = v;
  }

  get defaultChecked() {
    return this._papiHandle?.defaultChecked ?? false;
  }
  set defaultChecked(v) {
    if (this._papiHandle) this._papiHandle.defaultChecked = v;
  }

  // innerHTML — used by dangerouslySetInnerHTML
  get innerHTML() {
    return this._papiHandle?.innerHTML ?? '';
  }
  set innerHTML(v) {
    if (this._papiHandle) this._papiHandle.innerHTML = v;
  }

  // textContent — some lifecycle / ref tests read it
  get textContent() {
    return this._papiHandle?.textContent ?? '';
  }
  set textContent(v) {
    if (this._papiHandle) this._papiHandle.textContent = v;
  }

  // ── Focus ──

  focus() {
    this._papiHandle?.focus?.();
  }
  blur() {
    this._papiHandle?.blur?.();
  }

  // ── Text selection (input/textarea) ──

  get selectionStart() {
    return this._papiHandle?.selectionStart ?? 0;
  }
  set selectionStart(v) {
    if (this._papiHandle) this._papiHandle.selectionStart = v;
  }

  get selectionEnd() {
    return this._papiHandle?.selectionEnd ?? 0;
  }
  set selectionEnd(v) {
    if (this._papiHandle) this._papiHandle.selectionEnd = v;
  }

  setSelectionRange(start, end, direction) {
    this._papiHandle?.setSelectionRange?.(start, end, direction);
  }

  // ── Contains ──
  // Tests call document.body.contains(ref.current); since ref.current is a
  // LynxElement we need this to work against its papiHandle.
  contains(other) {
    const h = other?._papiHandle ?? other;
    return this._papiHandle?.contains?.(h) ?? false;
  }

  // ── Tree mutation (all routed through PAPI) ──

  appendChild(child) {
    // If already in this container, remove first (handles in-place reordering).
    // Preact relies on native DOM's auto-move behavior; we must replicate it.
    const existingIdx = this.__kids.indexOf(child);
    if (existingIdx !== -1) this.__kids.splice(existingIdx, 1);

    this.__kids.push(child);
    // Only set parentNode on our wrapper objects. jsdom Nodes have a read-only
    // parentNode getter on Node.prototype; setting it on them would throw.
    if (Object.prototype.hasOwnProperty.call(child, 'parentNode')) {
      child.parentNode = this;
    }
    __AppendElement(this._papiHandle, child._papiHandle);
    return child;
  }

  insertBefore(newChild, refChild) {
    if (refChild == null) return this.appendChild(newChild);

    // Remove from current position first (handles reordering within same parent).
    const existingIdx = this.__kids.indexOf(newChild);
    if (existingIdx !== -1) this.__kids.splice(existingIdx, 1);

    const idx = this.__kids.indexOf(refChild);
    if (idx === -1) return this.appendChild(newChild);

    this.__kids.splice(idx, 0, newChild);
    if (Object.prototype.hasOwnProperty.call(newChild, 'parentNode')) {
      newChild.parentNode = this;
    }
    __InsertElementBefore(
      this._papiHandle,
      newChild._papiHandle,
      refChild._papiHandle,
    );
    return newChild;
  }

  removeChild(child) {
    const idx = this.__kids.indexOf(child);
    if (idx !== -1) {
      this.__kids.splice(idx, 1);
      if (Object.prototype.hasOwnProperty.call(child, 'parentNode')) {
        child.parentNode = null;
      }
    }
    __RemoveElement(this._papiHandle, child._papiHandle);
    return child;
  }

  // ── Attributes (all routed through PAPI) ──

  setAttribute(name, value) {
    applyViaElementPAPI(this._papiHandle, name, value);
  }

  removeAttribute(name) {
    applyViaElementPAPI(this._papiHandle, name, null);
  }

  // Empty attributes list — required by Preact's diff/index.js when re-using
  // existing DOM nodes from excessDomChildren (replaceNode / hydration paths).
  get attributes() {
    return [];
  }

  // ── Style proxy ──

  get style() {
    if (!this._style) this._style = createStyleProxy(this._papiHandle);
    return this._style;
  }

  // ── Events ──
  //
  // Production path (__AddEvent available): register as main-thread worklet.
  //   - __AddEvent(handle, 'bindEvent', lynxName, { type: 'worklet', value: { _wkltId } })
  //   - When native event fires, runWorklet({ _wkltId }, [crossEvent]) is called
  //   - Our wrapper normalizes crossEvent.type (Lynx 'tap' → W3C 'click') so that
  //     Preact's proxyEventHandler can look up _listeners[e.type] correctly
  //
  // Test path (no __AddEvent): PAPI handles are jsdom elements; delegate to
  // papiHandle.addEventListener so sinon spies and DOM dispatch still work.

  addEventListener(type, handler, useCapture) {
    if (typeof __AddEvent !== 'function') {
      if (
        this._papiHandle
        && typeof this._papiHandle.addEventListener === 'function'
      ) {
        this._papiHandle.addEventListener(type, handler, useCapture);
      }
      return;
    }

    const lynxEventName = _w3cToLynxEvent[type] ?? type;
    const eventType = useCapture ? 'capture-bind' : 'bindEvent';

    // One wrapper per (handler function, event type) pair.
    // Preact reuses the same proxyEventHandler reference across re-renders so
    // the wrapper — and its _wkltId — is typically created only once per element.
    const wrapperKey = '_preactEvt_' + type;
    let wrapper = handler[wrapperKey];
    if (!wrapper) {
      const lynxElement = this; // Proxy — needed as 'this' in proxyEventHandler
      const w3cType = type; // W3C name captured for crossEvent normalization
      wrapper = function(crossEvent) {
        let e = crossEvent;
        if (crossEvent != null && crossEvent.type !== w3cType) {
          try {
            e = Object.assign({}, crossEvent, { type: w3cType });
          } catch (_) {
            e = { type: w3cType };
          }
        }
        handler.call(lynxElement, e);
      };
      handler[wrapperKey] = wrapper;
      wrapper._preactWkltId = 'preact_' + (_nextWorkletId++);
    }

    globalThis.lynxWorkletImpl._workletMap[wrapper._preactWkltId] = wrapper;
    // Use a plain string as value — Lynx native calls runWorklet(value, [event])
    // so the value must be something our runWorklet can dispatch on.
    __AddEvent(this._papiHandle, eventType, lynxEventName, {
      type: 'worklet',
      value: wrapper._preactWkltId,
    });
  }

  removeEventListener(type, handler, useCapture) {
    if (typeof __AddEvent !== 'function') {
      if (
        this._papiHandle
        && typeof this._papiHandle.removeEventListener === 'function'
      ) {
        this._papiHandle.removeEventListener(type, handler, useCapture);
      }
      return;
    }

    const lynxEventName = _w3cToLynxEvent[type] ?? type;
    const eventType = useCapture ? 'capture-bind' : 'bindEvent';
    // Clean up worklet map entry to avoid memory leak.
    const wrapper = handler['_preactEvt_' + type];
    if (wrapper?._preactWkltId && globalThis.lynxWorkletImpl) {
      delete globalThis.lynxWorkletImpl._workletMap[wrapper._preactWkltId];
    }
    __AddEvent(this._papiHandle, eventType, lynxEventName, undefined);
  }

  dispatchEvent(event) {
    if (
      this._papiHandle && typeof this._papiHandle.dispatchEvent === 'function'
    ) {
      return this._papiHandle.dispatchEvent(event);
    }
    return true;
  }
}

// ─── LynxDocument ────────────────────────────────────────────────────────────

/**
 * A minimal document object backed by Element PAPI.
 *
 * Assigned to `options.document` so Preact uses this for all element creation.
 * In tests: PAPI shims create jsdom elements.
 * In production Lynx: PAPI creates native elements.
 */
export class LynxDocument {
  createElement(tag) {
    const handle = __CreateElement(tag, 0 /* pageId */);
    // Link element to COMMON_CSS (ID=0) so Lynx's CSS engine can match class
    // selectors. Without this, elements have no l-css-id attribute and class
    // selectors in the common stylesheet don't apply.
    __SetCSSId([handle], 0);
    return new LynxElement(handle, tag);
  }

  createElementNS(_ns, tag) {
    // Lynx doesn't have namespace-aware creation; map all to createElement.
    return this.createElement(tag);
  }

  createTextNode(text) {
    return new LynxTextNode(text);
  }
}
