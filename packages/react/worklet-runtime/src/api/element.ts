// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Animation } from './animation/animation.js';
import { KeyframeEffect } from './animation/effect.js';
import {
  mainThreadFlushLoopMark,
  mainThreadFlushLoopOnFlushMicrotask,
  mainThreadFlushLoopReport,
} from '../utils/mainThreadFlushLoopGuard.js';
import { isSdkVersionGt } from '../utils/version.js';

let willFlush = false;
let shouldFlush = true;

export function setShouldFlush(value: boolean): void {
  shouldFlush = value;
}

export class Element {
  // @ts-expect-error set in constructor
  private readonly element: ElementNode;

  constructor(element: ElementNode) {
    // In Lynx versions prior to and including 2.15,
    // a crash occurs when printing or transferring refCounted across threads.
    // Bypass this problem by hiding the element object.
    Object.defineProperty(this, 'element', {
      get() {
        return element;
      },
    });
  }

  public setAttribute(name: string, value: unknown): void {
    mainThreadFlushLoopMark(`element:setAttribute ${name}`);
    __SetAttribute(this.element, name, value);
    this.flushElementTree();
  }

  public setStyleProperty(name: string, value: string): void {
    mainThreadFlushLoopMark(`element:setStyleProperty ${name}`);
    __AddInlineStyle(this.element, name, value);
    this.flushElementTree();
  }

  public setStyleProperties(styles: Record<string, string>): void {
    mainThreadFlushLoopMark(`element:setStyleProperties keys=${Object.keys(styles).length}`);
    for (const key in styles) {
      __AddInlineStyle(this.element, key, styles[key]!);
    }
    this.flushElementTree();
  }

  public getAttribute(attributeName: string): unknown {
    return __GetAttributeByName(this.element, attributeName);
  }

  public getAttributeNames(): string[] {
    return __GetAttributeNames(this.element);
  }

  public querySelector(selector: string): Element | null {
    const ref = __QuerySelector(this.element, selector, {});
    return ref ? new Element(ref) : null;
  }

  public querySelectorAll(selector: string): Element[] {
    return __QuerySelectorAll(this.element, selector, {}).map((element) => {
      return new Element(element);
    });
  }

  public getComputedStyleProperty(key: string): string {
    if (!isSdkVersionGt(3, 4)) {
      throw new Error(
        'getComputedStyleProperty requires Lynx sdk version 3.5',
      );
    }

    if (!key) {
      throw new Error('getComputedStyleProperty: key is required');
    }
    return __GetComputedStyleByKey(this.element, key);
  }

  public animate(
    keyframes: Record<string, number | string>[],
    options?: number | Record<string, number | string>,
  ): Animation {
    const normalizedOptions = typeof options === 'number' ? { duration: options } : options ?? {};
    return new Animation(new KeyframeEffect(this, keyframes, normalizedOptions));
  }

  public invoke(
    methodName: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    mainThreadFlushLoopMark(`element:invoke ${methodName}`);
    return new Promise((resolve, reject) => {
      __InvokeUIMethod(
        this.element,
        methodName,
        params ?? {},
        (res: { code: number; data: unknown }) => {
          if (res.code === 0) {
            resolve(res.data);
          } else {
            reject(new Error('UI method invoke: ' + JSON.stringify(res)));
          }
        },
      );
      this.flushElementTree();
    });
  }

  private flushElementTree() {
    if (willFlush || !shouldFlush) {
      return;
    }
    willFlush = true;
    void Promise.resolve().then(() => {
      willFlush = false;
      if (__DEV__) {
        mainThreadFlushLoopMark('render');
        const error = mainThreadFlushLoopOnFlushMicrotask();
        if (error) {
          // Stop scheduling further flushes so we can surface the error.
          // This is DEV-only behavior guarded internally by the dev guard.
          shouldFlush = false;
          mainThreadFlushLoopReport(error);
          return;
        }
      }
      __FlushElementTree();
    });
  }
}
