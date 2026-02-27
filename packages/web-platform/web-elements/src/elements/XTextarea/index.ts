// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @module elements/XTextarea
 *
 * `x-textarea` provides a multi-line input field.
 *
 * Attributes:
 * - `value`: Input value.
 * - `disabled`: 'true' | 'false'.
 * - `placeholder`: Placeholder text.
 * - `maxlength`: Max character length (default 140).
 * - `auto-height`: 'true' | 'false', auto resize height.
 * - `confirm-type`: 'send' | 'search' | 'next' | 'go' | 'done'.
 * - `confirm-enter`: 'true' | 'false', trigger confirm event on enter.
 * - `max-height`: Max height style.
 * - `min-height`: Min height style.
 * - `placeholder-color`: Color of the placeholder text.
 * - `placeholder-font-weight`: Font weight of the placeholder.
 * - `placeholder-font-size`: Font size of the placeholder.
 * - `placeholder-font-family`: Font family of the placeholder.
 *
 * Events:
 * - `input`: Fired on input.
 * - `focus`: Fired on focus.
 * - `blur`: Fired on blur.
 * - `confirm`: Fired on confirm/enter.
 * - `linechange`: Fired when line count changes.
 *
 * Methods:
 * - `addText({ text })`: Inserts text.
 * - `setValue({ value, index })`: Sets value and cursor.
 * - `getValue()`: Returns value and selection.
 * - `select()`: Selects all text.
 * - `setSelectionRange({ selectionStart, selectionEnd })`: Sets selection.
 */
export { XTextarea } from './XTextarea.js';
