// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ElementRef } from './papi-types.ts';

/**
 * Base node class. See Shim_Design.md §2 and §4.1.
 *
 * US-401: bootstrap-only skeleton. Real traversal lands in US-402..US-403.
 */
export abstract class L1ReadOnlyNode {
  protected readonly papi: ElementRef;

  constructor(papi: ElementRef) {
    this.papi = papi;
  }

  // TODO US-402: nodeType, nodeName, parentNode, firstChild, lastChild,
  // nextSibling, childNodes, hasChildNodes, isConnected, getRootNode,
  // contains, compareDocumentPosition, isEqualNode, isSameNode.

  // TODO US-403: previousSibling (O(n) via parent-children walk).
}

/**
 * Raw text emulation. See Shim_Design.md §4.2.2 and §4.1.
 *
 * Distinct from L1ReadOnlyElement — text nodes have no children and no element
 * surface.
 *
 * US-401: bootstrap-only. Real `nodeValue` lands in US-410.
 */
export class L1ReadOnlyText extends L1ReadOnlyNode {
  // TODO US-410: nodeType === 3, nodeName === '#text', nodeValue.
}
