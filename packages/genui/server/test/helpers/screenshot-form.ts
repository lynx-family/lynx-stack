// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { expect } from '@rstest/core';

export function readScreenshotForm(
  init: RequestInit | undefined,
): Record<string, unknown> {
  expect(init?.body).toBeInstanceOf(FormData);
  expect(new Headers(init?.headers).get('Content-Type')).toBeNull();
  const result: Record<string, unknown> = {};
  for (const [key, value] of (init?.body as FormData).entries()) {
    expect(typeof value).toBe('string');
    if (typeof value !== 'string') {
      throw new Error('Expected a text form field');
    }
    result[key] = key === 'globalProps' || key === 'initData'
      ? JSON.parse(value) as unknown
      : (['width', 'height', 'screenshotSettleMs', 'timeoutMs'].includes(key)
        ? Number(value)
        : value);
  }
  return result;
}
