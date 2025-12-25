// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export { XRefreshFooter } from './XRefreshFooter.js';
export { XRefreshHeader } from './XRefreshHeader.js';

/**
 * @module elements/XRefreshView
 *
 * `x-refresh-view` provides pull-to-refresh and load-more functionality.
 *
 * Attributes:
 * - `enable-refresh`: 'true' | 'false'.
 * - `enable-loadmore`: 'true' | 'false'.
 * - `enable-auto-loadmore`: 'true' | 'false'.
 *
 * Events:
 * - `startrefresh`: Fired when refresh triggers. Detail: `{ isManual }`.
 * - `startloadmore`: Fired when load more triggers.
 * - `headerreleased`: Fired when header is released.
 * - `footerreleased`: Fired when footer is released.
 * - `headeroffset` / `headershow`: Fired during pull down. Detail: `{ isDragging, offsetPercent }`.
 * - `footeroffset`: Fired during pull up. Detail: `{ isDragging, offsetPercent }`.
 *
 * Methods:
 * - `finishRefresh()`: Stops refresh animation.
 * - `finishLoadMore()`: Stops load more animation.
 * - `autoStartRefresh()`: Manually triggers refresh.
 */
export { XRefreshView } from './XRefreshView.js';
