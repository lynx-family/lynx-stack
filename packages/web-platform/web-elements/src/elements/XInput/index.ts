// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @module elements/XInput
 *
 * `x-input` provides a single-line input field.
 *
 * Attributes:
 * - `value`: Input value.
 * - `disabled`: 'true' | 'false'.
 * - `readonly`: 'true' | 'false'.
 * - `placeholder`: Placeholder text.
 * - `maxlength`: Max character length (default 140).
 * - `type`: 'text' | 'number' | 'digit' | 'password' | 'tel' | 'email'.
 * - `confirm-type`: 'send' | 'search' | 'next' | 'go' | 'done'.
 * - `input-filter`: Regex pattern to filter input.
 * - `send-composing-input`: 'true' | 'false', send input event during composition.
 * - `placeholder-color`: Color of the placeholder text.
 * - `placeholder-font-weight`: Font weight of the placeholder.
 * - `placeholder-font-size`: Font size of the placeholder.
 * - `placeholder-font-family`: Font family of the placeholder.
 *
 * Events:
 * - `input` (mapped to `lynxinput`): Fired on input.
 * - `focus`: Fired on focus.
 * - `blur`: Fired on blur.
 * - `confirm` (submit): Fired on enter key.
 *
 * Methods:
 * - `setValue({ value, index })`: Sets value and cursor.
 * - `getValue()`: Returns value and selection.
 * - `blur()`: Removes focus.
 * - `focus()`: Sets focus.
 * - `setSelectionRange({ selectionStart, selectionEnd })`: Sets selection.
 */
export { XInput } from './XInput.js';
