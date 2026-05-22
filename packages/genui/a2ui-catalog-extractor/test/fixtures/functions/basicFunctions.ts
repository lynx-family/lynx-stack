// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Returns true when the value is not empty.
 *
 * @a2uiFunction required
 */
export function required(args: {
  /** The value to check. */
  value: string;
}): boolean {
  return args.value.length > 0;
}

/**
 * Interpolates `${path}` placeholders against the data model.
 *
 * @a2uiFunction formatString
 */
export function formatString(args: {
  /** Template literal with `${path}` placeholders. */
  value: string;
}): string {
  return args.value;
}

/**
 * Helper that is not marked with `@a2uiFunction`; should be ignored.
 */
export function notExported(args: { value: string }): string {
  return args.value;
}
