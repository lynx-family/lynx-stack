/**
 * Bridge module that makes Vue runtime-dom test patterns work against
 * the Lynx BG→MT→PAPI→jsdom pipeline.
 *
 * Key mechanisms:
 * 1. Lazy shadow mapping — tests create jsdom elements normally via
 *    document.createElement; the bridge creates a ShadowElement on first
 *    patchProp call and maps it to the jsdom element in the MT elements Map.
 * 2. patchProp routing — routes through our real nodeOps.patchProp (which
 *    pushes ops) then sync-flushes: takeOps → applyOps on MT → PAPI → jsdom.
 * 3. Event forwarding — adds plain DOM listeners so tests can use
 *    el.dispatchEvent(new Event('click')) and have handlers fire.
 */

import {
  ShadowElement,
  nodeOps,
  takeOps,
  resetForTesting,
} from '@lynx-js/vue-runtime';
import { isBooleanAttr, includeBooleanAttr } from '@vue/shared';

// ---------------------------------------------------------------------------
// Bridge internals – injected by the setup file
// ---------------------------------------------------------------------------

let _applyOps: (ops: unknown[]) => void;
let _elements: Map<number, unknown>;
let _resetMainThreadState: () => void;

const jsdomToShadow = new WeakMap<Element, ShadowElement>();
const idToShadow = new Map<number, ShadowElement>();

// Track plain DOM event listeners added for forwarding
const domListeners = new WeakMap<
  Element,
  Map<string, EventListenerOrEventListenerObject>
>();

/**
 * Must be called by the setup file after importing the main-thread module.
 */
export function initBridge(deps: {
  applyOps: (ops: unknown[]) => void;
  elements: Map<number, unknown>;
  resetMainThreadState: () => void;
}): void {
  _applyOps = deps.applyOps;
  _elements = deps.elements;
  _resetMainThreadState = deps.resetMainThreadState;
}

// ---------------------------------------------------------------------------
// Sync flush — bypass the callLepusMethod scheduler
// ---------------------------------------------------------------------------

function syncFlush(): void {
  const ops = takeOps();
  if (ops.length === 0) return;

  const env = (globalThis as Record<string, unknown>)['lynxTestingEnv'] as {
    switchToMainThread(): void;
    switchToBackgroundThread(): void;
  };
  env.switchToMainThread();
  _applyOps(ops);
  env.switchToBackgroundThread();
}

// ---------------------------------------------------------------------------
// Lazy shadow mapping
// ---------------------------------------------------------------------------

/**
 * Ensure a ShadowElement exists for the given jsdom element.
 * On first call, creates a ShadowElement and registers the jsdom element
 * in the MT elements Map so applyOps can find it by ID.
 */
function ensureShadow(el: Element): ShadowElement {
  let shadow = jsdomToShadow.get(el);
  if (!shadow) {
    const tag = (el as any).tagName?.toLowerCase() ?? 'div';
    shadow = new ShadowElement(tag);
    idToShadow.set(shadow.id, shadow);
    jsdomToShadow.set(el, shadow);
    // Register existing jsdom element in the MT elements map
    // so applyOps can resolve ops targeting this element ID.
    _elements.set(shadow.id, el);
  }
  return shadow;
}

// ---------------------------------------------------------------------------
// Event key helpers
// ---------------------------------------------------------------------------

/**
 * Extract the raw DOM event name from a Vue on-prefixed key.
 * Returns null if the key is not an event key.
 *
 * Examples:
 *   'onClick'        → 'click'
 *   'onClickCapture' → 'click'
 *   'onClickOnce'    → 'click'
 *   'onUpdate:modelValue' → null (not a DOM event)
 *   'onclick'        → 'click' (native lowercase form)
 */
function parseEventKey(key: string): {
  name: string;
  once: boolean;
  capture: boolean;
} | null {
  // Vue runtime-dom on[A-Z]... pattern
  if (/^on[A-Z]/.test(key)) {
    let raw = key.slice(2);
    // Extract modifiers
    const once = raw.includes('Once');
    const capture = raw.includes('Capture');
    raw = raw.replace(/Once|Capture/g, '');
    const name = raw.charAt(0).toLowerCase() + raw.slice(1);
    return { name, once, capture };
  }
  // Native onclick (lowercase)
  if (/^on[a-z]/.test(key)) {
    return { name: key.slice(2), once: false, capture: false };
  }
  return null;
}

// ---------------------------------------------------------------------------
// patchProp — the main bridge function
// ---------------------------------------------------------------------------

/**
 * Drop-in replacement for Vue runtime-dom's patchProp.
 * Routes through our nodeOps.patchProp + PAPI pipeline, and adds
 * plain DOM event listeners for test compatibility.
 */
export function patchProp(
  el: Element,
  key: string,
  prevValue: unknown,
  nextValue: unknown,
  _namespace?: string,
  _parentComponent?: unknown,
): void {
  const shadow = ensureShadow(el);

  // Pre-process: handle null for class/id (our pipeline sets literal 'null')
  if (key === 'class' && nextValue == null) {
    // Clear class by setting empty string directly via PAPI
    el.className = '';
    // Still push through pipeline for consistency tracking
    nodeOps.patchProp(shadow, key, prevValue, '');
    syncFlush();
    // Override: PAPI's __SetClasses would set '' which is correct
    return;
  }
  if (key === 'id' && nextValue == null) {
    // Vue runtime-dom resets id to '' and removes the attribute.
    // Our pipeline's __SetID(el, '') would re-create the attribute,
    // so we handle this case directly and drain any ops.
    el.removeAttribute('id');
    takeOps(); // drain any pending ops
    return;
  }

  // Pre-process: handle null/undefined style (clear all styles)
  if (key === 'style' && nextValue == null) {
    if (typeof (el as any).removeAttribute === 'function') {
      (el as HTMLElement).removeAttribute('style');
    }
    takeOps(); // drain any pending ops
    return;
  }

  // Pre-process: handle string style (set cssText directly)
  if (key === 'style' && typeof nextValue === 'string') {
    (el as HTMLElement).style.cssText = nextValue;
    // Also route through pipeline for tracking
    nodeOps.patchProp(shadow, key, prevValue, {});
    syncFlush();
    return;
  }

  // Pre-process: for style objects, filter out undefined/null values
  // to prevent jsdom's CSS parser from throwing, and clear old styles
  // since Object.assign is additive (won't remove stale properties).
  if (key === 'style' && nextValue != null && typeof nextValue === 'object') {
    // Clear all existing inline styles first so stale properties don't persist
    if (typeof (el as any).removeAttribute === 'function') {
      (el as HTMLElement).removeAttribute('style');
    }

    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(nextValue as Record<string, unknown>)) {
      if (v != null) {
        cleaned[k] = v;
      }
    }
    nodeOps.patchProp(shadow, key, prevValue, cleaned);
    syncFlush();
    return;
  }

  // Pre-process: boolean attributes (readonly, disabled, etc.)
  // Truthy → setAttribute(key, ''), falsy → removeAttribute(key)
  if (
    key !== 'style' && key !== 'class' && key !== 'id' && !key.startsWith('on')
    && isBooleanAttr(key)
  ) {
    const val = includeBooleanAttr(nextValue) ? '' : null;
    nodeOps.patchProp(shadow, key, prevValue, val);
    syncFlush();
    return;
  }

  // Route through our real nodeOps.patchProp (pushes ops)
  nodeOps.patchProp(shadow, key, prevValue, nextValue);

  // Sync-flush to apply ops via PAPI on the MT thread
  syncFlush();

  // For events: also add a plain DOM listener so tests can use
  // el.dispatchEvent(new Event('click')) to trigger handlers.
  const eventInfo = parseEventKey(key);
  if (eventInfo) {
    const listeners = domListeners.get(el) ?? new Map();
    domListeners.set(el, listeners);

    // Remove previous listener for this key
    const prevListener = listeners.get(key);
    if (prevListener) {
      el.removeEventListener(eventInfo.name, prevListener, {
        capture: eventInfo.capture,
      });
      listeners.delete(key);
    }

    if (nextValue != null) {
      const handler = nextValue;
      const listener = ((evt: Event) => {
        if (typeof handler === 'function') {
          handler(evt);
        } else if (Array.isArray(handler)) {
          for (const fn of handler) {
            if (evt.cancelBubble) break;
            if (typeof fn === 'function') fn(evt);
          }
        }
      }) as EventListener;

      el.addEventListener(eventInfo.name, listener, {
        once: eventInfo.once,
        capture: eventInfo.capture,
      });
      listeners.set(key, listener);
    }
  }
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

export function resetBridge(): void {
  idToShadow.clear();
  // domListeners is a WeakMap — self-cleans when elements are GC'd
  resetForTesting();
  _resetMainThreadState();
}

// ---------------------------------------------------------------------------
// Stub exports for runtime-dom internal imports
// ---------------------------------------------------------------------------

/** SVG namespace — tests using this are skipped (Lynx has no SVG). */
export const svgNS = 'http://www.w3.org/2000/svg';

/** Transition class key — not supported in Lynx. */
export const vtcKey: unique symbol = Symbol('__vTransitionClasses') as any;

/** ElementWithTransition type stub. */
export type ElementWithTransition = Element & {
  [key: symbol]: Set<string>;
};

/** XLink namespace — not supported in Lynx. */
export const xlinkNS = 'http://www.w3.org/1999/xlink';

// ---------------------------------------------------------------------------
// Re-exports from Vue core (for tests importing from '../src')
// ---------------------------------------------------------------------------

export {
  h,
  nextTick,
  ref,
  withDirectives,
  computed,
  reactive,
  watchEffect,
  defineComponent,
  onMounted,
  onUnmounted,
  onBeforeUpdate,
  onUpdated,
  Fragment,
  createApp,
} from '@vue/runtime-core';

export {
  vShow,
  vModelText,
  vModelCheckbox,
  vModelSelect,
  vModelRadio,
  withModifiers,
  withKeys,
} from '@lynx-js/vue-runtime';

/**
 * Stub render() — Vue runtime-dom tests that call render(h(...), container)
 * need the full component rendering pipeline. Those tests are skipped.
 */
export function render(): void {
  throw new Error(
    '[bridge] render() is not supported in runtime-dom bridge tests. '
      + 'Tests using render() should be added to the skiplist.',
  );
}
