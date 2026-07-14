// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, it } from 'vitest';

import { root } from '@lynx-js/react';

describe('root.hydrate() (element template runtime)', () => {
  it('rejects a held handover in render options', () => {
    expect(() => root.render(null, { hydrate: false })).toThrowErrorMatchingInlineSnapshot(
      `[Error: The element template backend does not support a held handover (\`root.render(jsx, { hydrate: false })\`) yet.]`,
    );
  });

  it('returns a promise on the background thread', () => {
    const g = globalThis as unknown as { __BACKGROUND__: boolean };
    const previous = g.__BACKGROUND__;
    try {
      g.__BACKGROUND__ = true;
      expect(root.hydrate()).toBeInstanceOf(Promise);
    } finally {
      g.__BACKGROUND__ = previous;
    }
  });

  it('throws on the main thread', () => {
    const g = globalThis as unknown as { __BACKGROUND__: boolean };
    const previous = g.__BACKGROUND__;
    try {
      g.__BACKGROUND__ = false;
      expect(() => root.hydrate()).toThrowErrorMatchingInlineSnapshot(
        `[Error: The element template backend supports \`root.hydrate()\` on the background thread only.]`,
      );
    } finally {
      g.__BACKGROUND__ = previous;
    }
  });
});
