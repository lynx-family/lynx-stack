// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * `@lynx-js/dom-shim/runtime` — main entry for the tiered Shim. See
 * Shim_Design.md §2 for the tier model and Shim_Implementation_PRD.md for
 * the story decomposition.
 */

export { L1ReadOnlyNode, L1ReadOnlyText } from './nodes.ts';
export { L1ReadOnlyElement } from './elements.ts';
export { wrapPapi } from './wrap.ts';
export { document } from './document.ts';
export type { ElementRef } from './papi-types.ts';
