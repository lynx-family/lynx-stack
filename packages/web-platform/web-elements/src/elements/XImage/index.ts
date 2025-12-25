// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export { FilterImage } from './FilterImage.js';

/**
 * @module elements/XImage
 *
 * `x-image` displays an image.
 *
 * Attributes:
 * - `src`: Image source URL.
 * - `placeholder`: Placeholder image URL.
 * - `blur-radius`: Blur radius in px.
 * - `crossorigin`: Cross-origin settings.
 * - `referrerpolicy`: Referrer policy.
 *
 * Events:
 * - `load`: Fired when image loads successfully. Detail: `{ width, height }`.
 * - `error`: Fired when image fails to load.
 */
export { XImage } from './XImage.js';
