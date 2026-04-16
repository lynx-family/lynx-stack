// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Element } from './element.js';

class PageElement {
  private static pageElement: ElementNode | undefined;

  static get() {
    PageElement.pageElement ??= __GetPageElement();
    return PageElement.pageElement;
  }
}

export function querySelector(cssSelector: string): Element | null {
  const pageElement = PageElement.get();
  if (!pageElement) {
    return null;
  }
  const element = __QuerySelector(pageElement, cssSelector, {});
  return element ? new Element(element) : null;
}

export function querySelectorAll(cssSelector: string): Element[] {
  const pageElement = PageElement.get();
  if (!pageElement) {
    return [];
  }
  return __QuerySelectorAll(pageElement, cssSelector, {}).map(
    (element) => {
      return new Element(element);
    },
  );
}
