// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @module elements/ScrollView
 *
 * `scroll-view` provides a scrollable container.
 *
 * Attributes:
 * - `scroll-top`: Sets the vertical scroll position.
 * - `scroll-left`: Sets the horizontal scroll position.
 * - `initial-scroll-offset`: Sets the initial scroll position (in px).
 * - `scroll-to-index`: Scrolls to the child element at the specified index.
 * - `initial-scroll-to-index`: Scrolls to the child element at the specified index on init.
 * - `fading-edge-length`: Sets the length of the fading edge effect.
 * - `scroll-orientation`: 'vertical' | 'horizontal' | 'both'.
 * - `scroll-y`: 'true' | 'false' to enable vertical scrolling.
 * - `scroll-x`: 'true' | 'false' to enable horizontal scrolling.
 * - `enable-scroll`: Set to 'false' to disable user scrolling (enabled by default).
 *
 * Events:
 * - `scrolltoupper`: Reached top threshold.
 * - `scrolltolower`: Reached bottom threshold.
 * - `scroll` (mapped to `lynxscroll`): Fired on scroll. Detail: `{ scrollTop, scrollLeft, scrollHeight, scrollWidth, isDragging, deltaX, deltaY }`.
 * - `scrollend` (mapped to `lynxscrollend`): Fired when scrolling ends. Same detail as `scroll`.
 *
 * CSS:
 * - Forces `display: flex` and linear layout behavior.
 * - Hides scrollbars by default (unless enabled via attribute).
 * - Uses `scroll-timeline` for scroll-linked animations.
 *
 * Methods:
 * - `scrollTo(options)`: Scrolls to a specific position or child.
 * - `autoScroll(options)`: Starts or stops auto-scrolling.
 */
export { ScrollView } from './ScrollView.js';
