// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it } from 'vitest';

import { lynxTheme } from '../theme.js';

describe('lynxTheme', () => {
  it('is a plain object with expected theme keys', () => {
    expect(typeof lynxTheme).toBe('object');
    expect(lynxTheme).toHaveProperty('boxShadow');
    expect(lynxTheme).toHaveProperty('transitionProperty');
    expect(lynxTheme).toHaveProperty('zIndex');
  });

  it('boxShadow uses rgba() syntax, not modern rgb() with slashes', () => {
    const values = Object.values(lynxTheme.boxShadow ?? {});
    for (const value of values) {
      if (typeof value === 'string') {
        expect(value).not.toMatch(/rgb\(\d+ \d+ \d+ ?\/ ?[\d.]+/);
      }
    }
  });
});

describe('lynxTheme disallowed values per property', () => {
  const disallowedPerProperty: Record<string, Set<string>> = {
    zIndex: new Set(['auto']),
    gridTemplateColumns: new Set(['none', 'subgrid']),
    gridTemplateRows: new Set(['none', 'subgrid']),
    gridAutoColumns: new Set(['min-content']),
    gridAutoRows: new Set(['min-content']),
    aspectRatio: new Set(['auto']),
    transitionProperty: new Set(['fill', 'stroke', 'backdrop-filter']),
  };

  for (const [key, disallowedSet] of Object.entries(disallowedPerProperty)) {
    it(`${key} does not contain disallowed values`, () => {
      const section = (lynxTheme as Record<string, unknown>)[key];
      expect(typeof section).toBe('object');

      for (const [token, value] of Object.entries(section ?? {})) {
        for (const disallowed of disallowedSet) {
          if (typeof value === 'string' && value.includes(disallowed)) {
            throw new Error(
              `Disallowed value "${disallowed}" found in theme.${key}.${token} (value = "${value}")`,
            );
          }
        }
      }
    });
  }
});
