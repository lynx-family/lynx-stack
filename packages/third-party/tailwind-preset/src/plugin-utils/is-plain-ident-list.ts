// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Determines whether a given string is a plain list of CSS identifiers,
 * delimited by `splitDelimiter` (defaulting to a comma).
 *
 * This is used to decide whether a value like `opacity, transform` should be
 * treated as a repeatable list of properties, allowing transition-timing values
 * (e.g., `transition-delay`) to be expanded accordingly.
 *
 * A "plain identifier list" is defined as:
 * - A delimited list of simple, unescaped, ASCII-only CSS identifiers.
 * - No functions (e.g., `calc(...)`, `var(...)`, `url(...)`).
 * - No custom properties (e.g., `--tw-*`).
 * - No non-ASCII, escaped, or Unicode characters.
 *
 * This intentionally trades strict CSS compliance for simplicity and predictability
 * in the context of Tailwind-style theming, where authors control the theme config
 * and expect utility class generation to behave consistently.
 *
 * @example
 * Examples that are considered valid:
 * - "opacity, transform"
 * - "color"
 * - "background-color, border-color"
 * @example
 * Examples that are considered invalid:
 * - "var(--tw-bg)"
 * - "calc(100% - 1rem)"
 * - "--tw-shadow-color"
 * - "opacity, var(--tw-bg)"
 * - "\\31px"  (escaped identifier)
 *
 * @param value - The raw string value to test (typically from theme config).
 * @param splitDelimiter - The delimiter used to split items (default: ',').
 * @returns True if the value is a plain ident list, false otherwise.
 */

export function isPlainIdentList(
  value: string,
  splitDelimiter: string = ',',
): boolean {
  const identPattern = /^[a-z_-][\w-]*$/i;

  return value
    .split(splitDelimiter)
    .map((v) => v.trim())
    .filter(Boolean)
    .every((segment) => identPattern.test(segment));
}
