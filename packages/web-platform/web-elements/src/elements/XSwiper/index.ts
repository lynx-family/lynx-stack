// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export { SwiperItem } from './SwiperItem.js';

/**
 * @module elements/XSwiper
 *
 * `x-swiper` provides a swipeable container for items.
 *
 * Attributes:
 * - `mode`: 'normal' | 'carousel' | 'flat-coverflow'.
 * - `vertical`: 'true' | 'false', vertical scrolling.
 * - `circular`: 'true' | 'false', circular scrolling.
 * - `current`: Current index.
 * - `autoplay`: 'true' | 'false'.
 * - `interval`: Autoplay interval in ms (default 5000).
 * - `duration`: Animation duration.
 * - `smooth-scroll`: 'true' | 'false'.
 * - `indicator-dots`: 'true' | 'false', show indicator dots.
 * - `indicator-color`: Color of inactive indicator dots.
 * - `indicator-active-color`: Color of active indicator dot.
 *
 * Events:
 * - `change`: Fired when current index changes. Detail: `{ current, isDragged }`.
 * - `scrollstart`: Fired when scrolling starts.
 * - `scrollend` (mapped to `lynxscrollend`): Fired when scrolling ends.
 * - `transition`: Fired during scroll transition (if enabled). Detail: `{ dx, dy }`.
 *
 * Methods:
 * - `scrollTo({ index, smooth })`: Scrolls to index.
 */
export { XSwiper } from './XSwiper.js';
