// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @module elements/XViewpagerNg
 *
 * `x-viewpager-ng` provides a page container that allows sliding between pages.
 *
 * Attributes:
 * - `select-index`: Index of the currently selected page.
 * - `initial-select-index`: Initial selected index.
 * - `allow-horizontal-gesture`: 'true' | 'false'.
 * - `enable-scroll`: 'true' | 'false'.
 *
 * Events:
 * - `change`: Fired when the selected page changes. Detail: `{ index, isDragged }`.
 * - `offsetchange`: Fired when scroll offset changes. Detail: `{ offset }`.
 *
 * Methods:
 * - `selectTab({ index, smooth })`: Selects a page.
 */
export { XViewpagerNg } from './XViewpagerNg.js';
export { XViewpagerItemNg } from './XViewpagerItemNg.js';
