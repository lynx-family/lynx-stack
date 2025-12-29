// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export { ListItem } from './ListItem.js';

/**
 * @module elements/XList
 *
 * `x-list` provides a scalable list container, supporting waterflow layout.
 *
 * Attributes:
 * - `list-type`: 'single' | 'flow' | 'waterfall'.
 * - `span-count` / `column-count`: Columns in waterfall/flow.
 * - `sticky-offset`: Top offset for sticky items.
 * - `scroll-orientation`: 'vertical' | 'horizontal'.
 * - `upper-threshold-item-count`: Items from top to trigger `scrolltoupper`.
 * - `lower-threshold-item-count`: Items from bottom to trigger `scrolltolower`.
 * - `initial-scroll-index`: Initial scroll index.
 *
 * Events:
 * - `scrolltoupper`: Reached top threshold.
 * - `scrolltolower`: Reached bottom threshold.
 * - `scroll`: Fired on scroll.
 * - `scrollend`: Fired when scrolling stops.
 * - `snap`: Fired on scroll snap.
 *
 * Methods:
 * - `scrollToPosition({ position, offset, smooth })`: Scrolls to index.
 * - `autoScroll({ rate, start, autoStop })`: Auto-scrolling.
 *
 * CSS:
 * - `list-type="flow"` uses `display: grid`.
 * - `list-type="waterfall"` uses `display: flex` (column) / `display: row` with absolute positioning for items.
 * - `sticky` items use `position: sticky`.
 */
export { XList } from './XList.js';
