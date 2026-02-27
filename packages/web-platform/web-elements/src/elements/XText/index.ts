// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export { InlineImage } from './InlineImage.js';
export { InlineText } from './InlineText.js';
export { InlineTruncation } from './InlineTruncation.js';
export { RawText } from './RawText.js';

/**
 * @module elements/XText
 *
 * `x-text` displays text content, supporting truncation and rich text.
 *
 * Attributes:
 * - `text-maxlength`: Max characters to show.
 * - `text-maxline`: Max lines to show (ellipsis).
 * - `tail-color-convert`: 'true' | 'false', whether to apply color to truncation ellipsis.
 *
 * Events:
 * - `layout`: Fired when text layout happens (if enabled). Detail provides line info.
 *
 * CSS Variables:
 * - `--lynx-text-bg-color`: Inherited background color for nested text elements.
 */
export { XText } from './XText.js';
