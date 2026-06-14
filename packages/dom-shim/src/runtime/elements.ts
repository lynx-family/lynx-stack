// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { L1ReadOnlyNode } from './nodes.ts';

/**
 * Element-tier readonly surface. See Shim_Design.md §4.1.
 *
 * US-401: bootstrap-only skeleton. Real getters land in US-404..US-409.
 */
export class L1ReadOnlyElement extends L1ReadOnlyNode {
  // TODO US-404: id, tagName, localName, className, classList getter.
  // TODO US-405: getAttribute, getAttributeNames, hasAttribute, attributes.
  // TODO US-406: dataset (readonly proxy).
  // TODO US-407: children, firstElementChild, lastElementChild,
  // nextElementSibling, previousElementSibling, childElementCount.
  // TODO US-408: querySelector, querySelectorAll, matches, closest.
  // TODO US-409: getBoundingClientRect (async-cached).
}
