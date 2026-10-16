// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @module elements/XFoldViewNg
 *
 * `x-foldview-ng` provides a collapsible view with header, toolbar, and content slots.
 *
 * Components:
 * - `x-foldview-ng`: Main container.
 * - `x-foldview-header-ng`: Header area.
 * - `x-foldview-toolbar-ng`: Toolbar area.
 * - `x-foldview-slot-ng`: Scrollable content area.
 * - `x-foldview-slot-drag-ng`: Area to drag for scrolling.
 *
 * Layout:
 * - Where CSS anchor positioning is supported (`anchor()` and `anchor-scope`),
 *   the slot is absolutely positioned and anchored below the header by
 *   `x-foldview-ng.css` alone. The header has to precede the slot in the
 *   document, and the slot does not take part in the flex layout of
 *   `x-foldview-ng`.
 * - Elsewhere the slot stays in flow and `XFoldviewNg.ts` offsets it by the
 *   measured height of the header and the toolbar.
 *
 * `x-foldview-ng` attributes:
 * - `scroll-enable`: 'true' | 'false'.
 *
 * `x-foldview-ng` methods:
 * - `setFoldExpanded({ offset, smooth })`: Expands/collapses the view.
 */
export { XFoldviewHeaderNg } from './XFoldviewHeaderNg.js';
export { XFoldviewNg } from './XFoldviewNg.js';
export { XFoldviewSlotDragNg } from './XFoldviewSlotDragNg.js';
export { XFoldviewSlotNg } from './XFoldviewSlotNg.js';
export { XFoldviewToolbarNg } from './XFoldviewToolbarNg.js';
