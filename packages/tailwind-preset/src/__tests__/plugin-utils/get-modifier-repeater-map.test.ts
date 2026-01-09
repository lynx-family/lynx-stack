// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it } from 'vitest';

import { getModifierRepeaterMap } from '../../plugin-utils/get-modifier-repeater-map.js';

describe('getModifierRepeaterMap', () => {
  const cssProp = 'transition-duration';
  const themeMap = {
    DEFAULT: ' background-color, border-color, opacity, transform, color',
    colors: 'background-color, border-color, color',
    visual: 'opacity, background-color',
    filter: 'filter',
    empty: '',
  };

  it('includes base utility always (count: 1)', () => {
    const map = getModifierRepeaterMap(cssProp, 'duration', themeMap);
    expect(map['duration']).toBeDefined();
    expect(map['duration']?.('200ms')).toEqual({
      [cssProp]: '200ms',
    });
  });

  it('includes repeatedModifier utility when provided', () => {
    const map = getModifierRepeaterMap(cssProp, 'duration', themeMap, {
      repeatedModifier: 'n',
    });
    expect(map['duration-n']).toBeDefined();
    expect(map['duration-n']?.('150ms')).toEqual({
      [cssProp]: '150ms, 150ms, 150ms, 150ms, 150ms',
    });
  });

  it('omits repeatedModifier utility when not provided', () => {
    const map = getModifierRepeaterMap(cssProp, 'duration', themeMap);
    expect(map).not.toHaveProperty('duration-n');
  });

  it('includes named modifier utilities when repeatable', () => {
    const map = getModifierRepeaterMap(cssProp, 'duration', themeMap);
    expect(map['duration-colors']).toBeDefined();
    expect(map['duration-colors']?.('100ms')).toEqual({
      [cssProp]: '100ms, 100ms, 100ms',
    });
  });

  it(
    'excludes utilities when repeater returns null (e.g. skipIfSingleProperty)',
    () => {
      const map = getModifierRepeaterMap(cssProp, 'duration', themeMap, {
        skipIfSingleProperty: true,
      });

      expect(map['duration-filter']).toBeUndefined(); // only 1 prop, skipped
      expect(map['duration-empty']).toBeUndefined(); // empty string, skipped

      // this is no longer skipped, since it now has 2 properties
      expect(map['duration-visual']).toBeDefined();
      expect(map['duration-visual']?.('120ms')).toEqual({
        [cssProp]: '120ms, 120ms',
      });
    },
  );

  it('passes custom delimiters through to repeater', () => {
    const map = getModifierRepeaterMap(cssProp, 'duration', {
      custom: 'opacity|transform|scale',
    }, {
      splitDelimiter: '|',
      fillDelimiter: ' ',
    });

    expect(map['duration-custom']).toBeDefined();
    expect(map['duration-custom']?.('300ms')).toEqual({
      [cssProp]: '300ms 300ms 300ms',
    });
  });

  it('returns only base utility when modifierMap is undefined', () => {
    const map = getModifierRepeaterMap(
      cssProp,
      'duration',
      undefined,
      {
        repeatedModifier: 'n',
      },
    );
    expect(Object.keys(map)).toEqual(['duration']); // base only
  });

  it('handles empty modifierMap and ensures entries line is covered', () => {
    const map = getModifierRepeaterMap(cssProp, 'duration', {}, {
      repeatedModifier: 'n',
    });
    expect(Object.keys(map)).toEqual(['duration']); // base only
  });
});
