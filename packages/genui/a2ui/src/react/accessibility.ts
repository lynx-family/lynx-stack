// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { coerceBoolean } from '../store/schema.js';

/** Map resolved protocol accessibility fields to Lynx and Web host attributes. */
export function accessibilityProps(
  props: Record<string, unknown>,
): Record<string, unknown> {
  const value = props['@accessibility'];
  if (!value || typeof value !== 'object') return {};
  const fields = value as Record<string, unknown>;
  const label = typeof fields['label'] === 'string'
    ? fields['label']
    : undefined;
  const description = typeof fields['description'] === 'string'
    ? fields['description']
    : undefined;
  return {
    ...(label === undefined ? {} : { 'aria-label': label }),
    ...(description === undefined ? {} : { 'aria-description': description }),
    ...(label === undefined && description === undefined ? {} : {
      'accessibility-element': true,
      'accessibility-label': [label, description].filter(Boolean).join('. '),
    }),
    ...(fields['hidden'] === undefined ? {} : {
      'aria-hidden': coerceBoolean(fields['hidden']),
      'accessibility-elements-hidden': coerceBoolean(fields['hidden']),
    }),
    ...(['off', 'polite', 'assertive'].includes(String(fields['live']))
      ? { 'aria-live': fields['live'] }
      : {}),
  };
}
