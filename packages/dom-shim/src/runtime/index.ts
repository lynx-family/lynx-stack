// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * `@lynx-js/dom-shim/runtime` — main entry for the tiered Shim. See
 * Shim_Design.md §2 for the tier model and Shim_Implementation_PRD.md for
 * the story decomposition.
 */

export {
  DOCUMENT_POSITION_CONTAINED_BY,
  DOCUMENT_POSITION_CONTAINS,
  DOCUMENT_POSITION_DISCONNECTED,
  DOCUMENT_POSITION_FOLLOWING,
  DOCUMENT_POSITION_PRECEDING,
  L1ReadOnlyElement,
  L1ReadOnlyNode,
  L1ReadOnlyText,
  L2SafeWritableElement,
  L3aEventfulElement,
  NODE_TYPE_ELEMENT,
  NODE_TYPE_TEXT,
  ShimDocumentFragment,
  createDocumentFragment,
  getTextValue,
  recordTextValue,
  wrapPapi,
} from './nodes.ts';
export {
  EVENT_PHASE_AT_TARGET,
  EVENT_PHASE_BUBBLING,
  EVENT_PHASE_CAPTURING,
  EVENT_PHASE_NONE,
  ShimEvent,
  ShimKeyboardEvent,
  ShimMouseEvent,
  fireEvent,
} from './events.ts';
export {
  flush,
  isAutoFlushEnabled,
  scheduleFlush,
  setAutoFlush,
} from './scheduler.ts';
export { document, setBody } from './document.ts';
export {
  DOMShimDivergenceWarning,
  DOMShimInvariantError,
  DOMShimUnsupportedError,
} from './errors.ts';
export { GEOMETRY_STALE_CODE, invalidateGeometry } from './geometry.ts';
export type { DOMRectReadOnly } from './geometry.ts';
export type { ElementRef } from './papi-types.ts';
