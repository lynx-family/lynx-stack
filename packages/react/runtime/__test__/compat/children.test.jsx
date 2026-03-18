// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, it } from 'vitest';
import { Children, createElement } from '@lynx-js/react';

describe('Children', () => {
  describe('Children.count', () => {
    it('should count children correctly', () => {
      const children = [
        createElement('div', { key: '1' }),
        createElement('span', { key: '2' }),
        createElement('p', { key: '3' }),
      ];
      expect(Children.count(children)).toBe(3);
    });

    it('should count single child', () => {
      const child = createElement('div');
      expect(Children.count(child)).toBe(1);
    });

    it('should count null/undefined as 0', () => {
      expect(Children.count(null)).toBe(0);
      expect(Children.count(undefined)).toBe(0);
    });

    it('should count with mixed null values', () => {
      const children = [
        createElement('div', { key: '1' }),
        null,
        createElement('span', { key: '2' }),
        undefined,
        'text',
      ];
      expect(Children.count(children)).toBe(3);
    });
  });

  describe('Children.only', () => {
    it('should return single child', () => {
      const child = createElement('div');
      expect(Children.only(child)).toBe(child);
    });

    it('should throw for multiple children', () => {
      const children = [
        createElement('div', { key: '1' }),
        createElement('span', { key: '2' }),
      ];
      expect(() => Children.only(children)).toThrow();
    });

    it('should throw for no children', () => {
      expect(() => Children.only([])).toThrow();
      expect(() => Children.only(null)).toThrow();
      expect(() => Children.only(undefined)).toThrow();
    });
  });

  describe('Children.forEach', () => {
    it('should iterate over children', () => {
      const children = [
        createElement('div', { key: '1' }),
        createElement('span', { key: '2' }),
        createElement('p', { key: '3' }),
      ];
      const results = [];
      Children.forEach(children, (child, index) => {
        results.push({ child, index });
      });
      expect(results).toHaveLength(3);
      expect(results[0].index).toBe(0);
      expect(results[1].index).toBe(1);
      expect(results[2].index).toBe(2);
    });

    it('should handle single child', () => {
      const child = createElement('div');
      const results = [];
      Children.forEach(child, (c, index) => {
        results.push({ child: c, index });
      });
      expect(results).toHaveLength(1);
      expect(results[0].index).toBe(0);
    });
  });

  describe('Children.map', () => {
    it('should map over children', () => {
      const children = [
        createElement('div', { key: '1' }),
        createElement('span', { key: '2' }),
        createElement('p', { key: '3' }),
      ];
      const results = Children.map(children, (child, index) => index);
      expect(results).toEqual([0, 1, 2]);
    });

    it('should handle single child', () => {
      const child = createElement('div');
      const results = Children.map(child, (c, index) => index);
      expect(results).toEqual([0]);
    });

    it('should transform children', () => {
      const children = [
        createElement('div', { key: '1' }),
        createElement('span', { key: '2' }),
      ];
      const results = Children.map(children, (child) => {
        return createElement('wrapper', { key: child.key }, child);
      });
      expect(results).toHaveLength(2);
      expect(results[0].type).toBe('wrapper');
      expect(results[1].type).toBe('wrapper');
    });
  });

  describe('Children.toArray', () => {
    it('should convert children to array', () => {
      const children = [
        createElement('div', { key: '1' }),
        createElement('span', { key: '2' }),
        createElement('p', { key: '3' }),
      ];
      const arr = Children.toArray(children);
      expect(Array.isArray(arr)).toBe(true);
      expect(arr).toHaveLength(3);
    });

    it('should convert single child to array', () => {
      const child = createElement('div');
      const arr = Children.toArray(child);
      expect(Array.isArray(arr)).toBe(true);
      expect(arr).toHaveLength(1);
      expect(arr[0]).toBe(child);
    });

    it('should flatten nested children', () => {
      const children = [
        createElement('div', { key: '1' }),
        [
          createElement('span', { key: '2' }),
          createElement('p', { key: '3' }),
        ],
      ];
      const arr = Children.toArray(children);
      expect(Array.isArray(arr)).toBe(true);
      expect(arr).toHaveLength(3);
    });

    it('should filter out null and undefined', () => {
      const children = [
        createElement('div', { key: '1' }),
        null,
        undefined,
        createElement('span', { key: '2' }),
      ];
      const arr = Children.toArray(children);
      expect(Array.isArray(arr)).toBe(true);
      expect(arr).toHaveLength(2);
    });

    describe('dev mode freeze behavior', () => {
      it('should freeze array in dev mode', () => {
        const children = [
          createElement('div', { key: '1' }),
          createElement('span', { key: '2' }),
        ];
        const arr = Children.toArray(children);
        expect(Object.isFrozen(arr)).toBe(true);
      });

      it('should throw when trying to mutate frozen array', () => {
        'use strict';
        const children = [createElement('div', { key: '1' })];
        const arr = Children.toArray(children);

        expect(() => {
          arr.push(createElement('span', { key: '2' }));
        }).toThrow();
      });

      it('should throw when trying to splice frozen array', () => {
        'use strict';
        const children = [createElement('div', { key: '1' })];
        const arr = Children.toArray(children);

        expect(() => {
          arr.splice(0, 1);
        }).toThrow();
      });

      it('should throw when trying to sort frozen array', () => {
        'use strict';
        const children = [
          createElement('div', { key: '2' }),
          createElement('span', { key: '1' }),
        ];
        const arr = Children.toArray(children);

        expect(() => {
          arr.sort();
        }).toThrow();
      });
    });

    describe('non-mutating operations should work', () => {
      it('should allow map operation', () => {
        const children = [
          createElement('div', { key: '1' }),
          createElement('span', { key: '2' }),
        ];
        const arr = Children.toArray(children);

        const mapped = arr.map((child, i) => i);
        expect(mapped).toEqual([0, 1]);
      });

      it('should allow filter operation', () => {
        const children = [
          createElement('div', { key: '1' }),
          createElement('span', { key: '2' }),
          createElement('div', { key: '3' }),
        ];
        const arr = Children.toArray(children);

        const filtered = arr.filter((child) => child.type === 'div');
        expect(filtered).toHaveLength(2);
      });

      it('should allow spread operator', () => {
        const children = [
          createElement('div', { key: '1' }),
          createElement('span', { key: '2' }),
        ];
        const arr = Children.toArray(children);

        const spread = [...arr, createElement('p', { key: '3' })];
        expect(spread).toHaveLength(3);
      });
    });
  });
});
