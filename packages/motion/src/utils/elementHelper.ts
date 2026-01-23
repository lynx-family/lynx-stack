// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ElementOrSelector } from 'motion-dom';

import type { MainThread } from '@lynx-js/types';

import {
  isMainThreadElement,
  isMainThreadElementArray,
} from './isMainThreadElement.js';
import { ElementCompt } from '../polyfill/element.js' with { runtime: 'shared' };
import type { ElementOrElements } from '../types/index.js';

export function elementOrSelector2Dom(
  nodesOrSelector: string | MainThread.Element | MainThread.Element[],
): ElementOrSelector | undefined {
  'main thread';
  let domElements: ElementOrSelector | undefined = undefined;

  if (
    typeof nodesOrSelector === 'string'
    || isMainThreadElement(nodesOrSelector)
    || isMainThreadElementArray(nodesOrSelector)
  ) {
    let elementNodes: ElementOrElements;
    if (typeof nodesOrSelector === 'string') {
      elementNodes = lynx.querySelectorAll(nodesOrSelector);
      // Validate that query returned results
      if (
        !elementNodes
        || (Array.isArray(elementNodes) && elementNodes.length === 0)
      ) {
        return undefined;
      }
    } else {
      elementNodes = nodesOrSelector;
    }
    domElements = (Array.isArray(elementNodes)
      ? elementNodes.map(el => new ElementCompt(el))
      : new ElementCompt(
        elementNodes,
      )) as unknown as ElementOrSelector;
  }

  return domElements;
}
