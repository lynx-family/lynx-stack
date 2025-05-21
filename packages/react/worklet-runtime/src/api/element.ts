// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export class Element {
  private static willFlush = false;

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
    __SetAttribute(this.element, name, value);
    this.flushElementTree();
  }

  public setStyleProperty(name: string, value: string): void {
    __AddInlineStyle(this.element, name, value);
    this.flushElementTree();
  }

  public setStyleProperties(styles: Record<string, string>): void {
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

  public invoke(
    methodName: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
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
    if (Element.willFlush) {
      return;
    }
    Element.willFlush = true;
    void Promise.resolve().then(() => {
      Element.willFlush = false;
      __FlushElementTree();
    });
  }
}
