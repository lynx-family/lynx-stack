// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { L1ReadOnlyElement } from './elements.ts';
import { L1ReadOnlyText } from './nodes.ts';
import type { L1ReadOnlyNode } from './nodes.ts';
import type { ElementRef } from './papi-types.ts';

/**
 * Tag returned by `__GetTag` for Lynx raw-text nodes. Used by `wrapPapi` to
 * dispatch into `L1ReadOnlyText` rather than `L1ReadOnlyElement`. See
 * Shim_Design.md §4.2.2.
 */
const RAW_TEXT_TAG = 'raw-text';

/**
 * Wrap an existing PAPI ref into the highest-tier Shim instance currently
 * shipped. See Shim_Design.md §2 "Tier selection at construction".
 *
 * US-401 returns L1 only. As higher tiers ship (US-411..US-441), this factory
 * will return the highest available tier per element (default = L3b once that
 * class lands; see US-475 for opt-in narrowing).
 */
export function wrapPapi(ref: ElementRef): L1ReadOnlyNode {
  const tag = __GetTag(ref);
  if (tag === RAW_TEXT_TAG) {
    return new L1ReadOnlyText(ref);
  }
  return new L1ReadOnlyElement(ref);
}
