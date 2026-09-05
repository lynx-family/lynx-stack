// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The background-side stand-in for a main-thread `Element`: the API surface
 * of the worklet-runtime Element, implemented as ops. Used when main-thread
 * handlers fall back to background execution (closure-capturing handlers
 * cannot be shipped across threads without a compiler).
 */

import { enqueueOp } from './channel.js';
import type { RemoteElement } from './document.js';
import * as Ops from './ops.js';

let animationCount = 0;

export class BackgroundMainThreadElement {
  private readonly _node: RemoteElement;

  constructor(node: RemoteElement) {
    this._node = node;
  }

  get dataset(): Record<string, unknown> {
    return this._node._dataset;
  }

  get id(): unknown {
    return this._node._attributes.get('id');
  }

  setAttribute(name: string, value: unknown): void {
    this._node._attributes.set(name, value);
    enqueueOp([Ops.SetAttribute, this._node._id, name, value ?? null]);
  }

  getAttribute(name: string): unknown {
    return this._node._attributes.get(name);
  }

  getAttributeNames(): string[] {
    return [...this._node._attributes.keys()] as string[];
  }

  setStyleProperty(name: string, value: string): void {
    enqueueOp([Ops.AddInlineStyle, this._node._id, name, value]);
  }

  setStyleProperties(styles: Record<string, string>): void {
    for (const key in styles) {
      enqueueOp([Ops.AddInlineStyle, this._node._id, key, styles[key]]);
    }
  }

  animate(
    keyframes: Record<string, unknown>[],
    options?: number | Record<string, unknown>,
  ): { cancel(): void; pause(): void; play(): void } {
    const id = `__preact-runtime-bg-animation-${animationCount++}`;
    const normalized = typeof options === 'number'
      ? { duration: options }
      : options ?? {};
    enqueueOp([
      Ops.ElementAnimate,
      this._node._id,
      [0, id, keyframes, normalized],
    ]);
    const operate = (op: number) => {
      enqueueOp([Ops.ElementAnimate, this._node._id, [op, id]]);
    };
    return {
      play: () => operate(1),
      pause: () => operate(2),
      cancel: () => operate(3),
    };
  }

  invoke(): Promise<unknown> {
    return Promise.reject(
      new Error('Element.invoke is not supported on this runtime yet'),
    );
  }
}
