// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { ElementCompt } from './element.js';

export { ElementCompt as Element, ElementCompt as EventTarget };

// These describe Lynx elements even when the host is a browser iframe.
export const HTMLElement: typeof ElementCompt = ElementCompt;
export class SVGElement {}
export class NodeList {}

export const getComputedStyle = (
  element: ElementCompt,
): Record<string, string> => element.getComputedStyle();

export const window: { getComputedStyle: typeof getComputedStyle } = {
  getComputedStyle,
};

export const document = {
  querySelector: (selector: string): ElementCompt | null => {
    const element = lynx.querySelector(selector);
    return element ? new ElementCompt(element) : null;
  },
  querySelectorAll: (selector: string): ElementCompt[] =>
    lynx.querySelectorAll(selector).map(element => new ElementCompt(element)),
};

const timeOrigin = Date.now();
export const performance = {
  now: (): number => globalThis.performance?.now() ?? Date.now() - timeOrigin,
};
