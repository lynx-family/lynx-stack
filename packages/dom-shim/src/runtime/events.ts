// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { L1ReadOnlyNode } from './nodes.ts';

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
