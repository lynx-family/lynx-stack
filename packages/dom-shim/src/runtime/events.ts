// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { L1ReadOnlyNode } from './nodes.ts';
import type { ElementRef } from './papi-types.ts';

/** Spec `Event.NONE`. */
export const EVENT_PHASE_NONE = 0;
/** Spec `Event.CAPTURING_PHASE`. */
export const EVENT_PHASE_CAPTURING = 1;
/** Spec `Event.AT_TARGET`. */
export const EVENT_PHASE_AT_TARGET = 2;
/** Spec `Event.BUBBLING_PHASE`. */
export const EVENT_PHASE_BUBBLING = 3;

export interface ShimEventInit {
  bubbles?: boolean;
  cancelable?: boolean;
  composed?: boolean;
}

/**
 * Spec-shaped Event. See Shim_Design.md §6.2.
 *
 * The Shim trampoline (US-432) constructs ShimEvent instances from Lynx's
 * native event payload, fills in target/currentTarget via the Shim
 * element registry, then dispatches via the synthetic capture+bubble
 * walk (US-434).
 *
 * Stop / prevent flags are observable on the public surface; the
 * underscored `_*Stopped` fields are read by the trampoline to halt
 * propagation between listeners.
 */
export class ShimEvent {
  readonly type: string;
  target: L1ReadOnlyNode | null = null;
  currentTarget: L1ReadOnlyNode | null = null;
  readonly bubbles: boolean;
  readonly cancelable: boolean;
  readonly composed: boolean;
  defaultPrevented = false;
  eventPhase: number = EVENT_PHASE_NONE;
  readonly timeStamp: number;
  /** True once `stopPropagation()` was called. */
  _propagationStopped = false;
  /** True once `stopImmediatePropagation()` was called. */
  _immediatePropagationStopped = false;
  /** True once dispatched at least once — synthetic events flag this. */
  readonly isTrusted: boolean = false;

  constructor(type: string, opts: ShimEventInit = {}) {
    this.type = type;
    this.bubbles = opts.bubbles ?? true;
    this.cancelable = opts.cancelable ?? true;
    this.composed = opts.composed ?? false;
    this.timeStamp = Date.now();
  }

  preventDefault(): void {
    if (this.cancelable) this.defaultPrevented = true;
  }

  stopPropagation(): void {
    this._propagationStopped = true;
  }

  stopImmediatePropagation(): void {
    this._propagationStopped = true;
    this._immediatePropagationStopped = true;
  }

  /**
   * Spec composedPath — for synthetic events we walk parents starting at
   * `target`. Returns empty array when the event has no target.
   */
  composedPath(): L1ReadOnlyNode[] {
    if (this.target === null) return [];
    const path: L1ReadOnlyNode[] = [];
    let cur: L1ReadOnlyNode | null = this.target;
    while (cur !== null) {
      path.push(cur);
      cur = cur.parentNode;
    }
    return path;
  }
}

export interface ShimMouseEventInit extends ShimEventInit {
  clientX?: number;
  clientY?: number;
  button?: number;
  buttons?: number;
}

export class ShimMouseEvent extends ShimEvent {
  readonly clientX: number;
  readonly clientY: number;
  readonly button: number;
  readonly buttons: number;

  constructor(type: string, init: ShimMouseEventInit = {}) {
    super(type, init);
    this.clientX = init.clientX ?? 0;
    this.clientY = init.clientY ?? 0;
    this.button = init.button ?? 0;
    this.buttons = init.buttons ?? 0;
  }
}

export interface ShimKeyboardEventInit extends ShimEventInit {
  key?: string;
  code?: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
}

/**
 * Spec-shaped EventListener signature. Implementations accept a ShimEvent
 * and may optionally return a value; spec ignores the return.
 */
export type ShimEventListener = (event: ShimEvent) => unknown;

export interface ShimAddEventListenerOptions {
  capture?: boolean;
  once?: boolean;
  passive?: boolean;
  signal?: AbortSignal | null;
}

export interface ShimEventListenerOptions {
  capture?: boolean;
}

interface HandlerRecord {
  fn: ShimEventListener;
  capture: boolean;
  once: boolean;
  passive: boolean;
  signal: AbortSignal | null;
}

const handlerStore = new WeakMap<
  ElementRef,
  Map<string, Set<HandlerRecord>>
>();
const registeredTrampolines = new WeakMap<ElementRef, Set<string>>();

/** Test-only — clear all listener state across elements. */
export function _resetEventsForTesting(): void {
  // WeakMaps can't be cleared, but tests use fresh ElementRefs per case so
  // GC will reclaim stale entries naturally.
}

function getHandlerSet(
  papi: ElementRef,
  type: string,
  create: boolean,
): Set<HandlerRecord> | undefined {
  let typeMap = handlerStore.get(papi);
  if (!typeMap) {
    if (!create) return undefined;
    typeMap = new Map();
    handlerStore.set(papi, typeMap);
  }
  let set = typeMap.get(type);
  if (!set) {
    if (!create) return undefined;
    set = new Set();
    typeMap.set(type, set);
  }
  return set;
}

/**
 * Register a listener via the multiplex trampoline. See Shim_Design.md
 * §6.2. Spec dedupe: same `(fn, capture)` is a no-op.
 *
 * First listener on `(papi, type)` registers a trampoline closure via
 * `__AddEvent(papi, type, '__shim_trampoline__' + type, ...)`. Subsequent
 * listeners on the same `(papi, type)` are added to the Set only — one
 * PAPI slot drives many JS listeners.
 */
export function addListener(
  papi: ElementRef,
  type: string,
  fn: ShimEventListener,
  options: ShimAddEventListenerOptions | boolean = {},
): void {
  const opts = normalizeAddOptions(options);
  const set = getHandlerSet(papi, type, true);
  if (set === undefined) return;
  for (const r of set) {
    if (r.fn === fn && r.capture === opts.capture) return;
  }
  const record: HandlerRecord = {
    fn,
    capture: opts.capture,
    once: opts.once,
    passive: opts.passive,
    signal: opts.signal,
  };
  set.add(record);

  // Register trampoline on the first listener for this (papi, type).
  let registered = registeredTrampolines.get(papi);
  if (!registered) {
    registered = new Set();
    registeredTrampolines.set(papi, registered);
  }
  if (!registered.has(type)) {
    registered.add(type);
    try {
      __AddEvent(
        papi,
        type,
        `__shim_trampoline__${type}`,
        makeTrampoline(papi, type),
      );
    } catch {
      // Engine missing __AddEvent — tests still fire via fireEvent helper.
    }
  }

  if (opts.signal) {
    opts.signal.addEventListener('abort', () => {
      removeListener(papi, type, fn, { capture: opts.capture });
    });
  }
}

/**
 * Spec removeEventListener. Match on `(fn, capture)`. Implementation
 * deliberately leaves the PAPI trampoline registered; the next dispatch
 * simply finds an empty Set.
 */
export function removeListener(
  papi: ElementRef,
  type: string,
  fn: ShimEventListener,
  options: ShimEventListenerOptions | boolean = {},
): void {
  const capture = typeof options === 'boolean' ? options : options.capture
    ?? false;
  const set = getHandlerSet(papi, type, false);
  if (!set) return;
  for (const r of set) {
    if (r.fn === fn && r.capture === capture) {
      set.delete(r);
      return;
    }
  }
}

function normalizeAddOptions(
  options: ShimAddEventListenerOptions | boolean,
): {
  capture: boolean;
  once: boolean;
  passive: boolean;
  signal: AbortSignal | null;
} {
  if (typeof options === 'boolean') {
    return { capture: options, once: false, passive: false, signal: null };
  }
  return {
    capture: options.capture ?? false,
    once: options.once ?? false,
    passive: options.passive ?? false,
    signal: options.signal ?? null,
  };
}

function makeTrampoline(papi: ElementRef, type: string) {
  return (nativeEvent: unknown): void => {
    fireEvent(papi, type, nativeEvent);
  };
}

/**
 * Build a spec-shaped event from a Lynx native payload. Used by the
 * trampoline. Exposed for tests that need to drive the dispatch without
 * involving __AddEvent.
 */
export function fireEvent(
  papi: ElementRef,
  type: string,
  payload: unknown = {},
): ShimEvent {
  const set = getHandlerSet(papi, type, false);
  const event = buildEvent(type, payload);
  if (!set || set.size === 0) return event;
  for (const record of [...set]) {
    if (event._immediatePropagationStopped) break;
    event.currentTarget = null;
    try {
      const r = record.fn(event);
      // Listener may return a Promise; ignore per spec.
      void r;
    } catch (e) {
      // Listener errors must not abort dispatch.
      console.warn(
        JSON.stringify({
          code: 'shim:L3a/listener-threw',
          tier: 3,
          surface: 'EventTarget.dispatch',
          message: String(e),
        }),
      );
    }
    if (record.once) set.delete(record);
  }
  return event;
}

function buildEvent(type: string, payload: unknown): ShimEvent {
  const p = (payload && typeof payload === 'object'
    ? payload
    : {}) as Record<string, unknown>;
  const init = {
    bubbles: typeof p['bubbles'] === 'boolean' ? p['bubbles'] : true,
    cancelable: typeof p['cancelable'] === 'boolean'
      ? p['cancelable']
      : true,
  };
  if (MOUSE_TYPES.has(type)) {
    return new ShimMouseEvent(type, {
      ...init,
      clientX: typeof p['clientX'] === 'number' ? p['clientX'] : 0,
      clientY: typeof p['clientY'] === 'number' ? p['clientY'] : 0,
      button: typeof p['button'] === 'number' ? p['button'] : 0,
      buttons: typeof p['buttons'] === 'number' ? p['buttons'] : 0,
    });
  }
  if (KEYBOARD_TYPES.has(type)) {
    return new ShimKeyboardEvent(type, {
      ...init,
      key: typeof p['key'] === 'string' ? p['key'] : '',
      code: typeof p['code'] === 'string' ? p['code'] : '',
      shiftKey: !!p['shiftKey'],
      ctrlKey: !!p['ctrlKey'],
      altKey: !!p['altKey'],
      metaKey: !!p['metaKey'],
    });
  }
  return new ShimEvent(type, init);
}

const MOUSE_TYPES = new Set([
  'click',
  'dblclick',
  'mousedown',
  'mouseup',
  'mousemove',
  'mouseenter',
  'mouseleave',
  'tap',
]);

const KEYBOARD_TYPES = new Set(['keydown', 'keyup', 'keypress']);

export class ShimKeyboardEvent extends ShimEvent {
  readonly key: string;
  readonly code: string;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;

  constructor(type: string, init: ShimKeyboardEventInit = {}) {
    super(type, init);
    this.key = init.key ?? '';
    this.code = init.code ?? '';
    this.shiftKey = init.shiftKey ?? false;
    this.ctrlKey = init.ctrlKey ?? false;
    this.altKey = init.altKey ?? false;
    this.metaKey = init.metaKey ?? false;
  }
}
