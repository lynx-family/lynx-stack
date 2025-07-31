// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import { uiVariants } from '../../../plugins/lynx-ui/uiVariants.js';
import { runPlugin } from '../../utils/run-plugin.js';

type VariantFunction = (
  value: unknown,
  context?: { modifier?: string | null },
) => string;

export function extractVariants(
  matchVariant: MockInstance<VariantFunction>,
): Record<string, VariantFunction> {
  return Object.fromEntries(
    matchVariant.mock.calls.map(([key, fn]) => [
      key as string,
      fn as VariantFunction,
    ]),
  );
}

describe('uiVariants plugin', () => {
  it('registers variants with default prefix ui', () => {
    const plugin = uiVariants({});
    const { api } = runPlugin(plugin);
    const variants = extractVariants(vi.mocked(api.matchVariant));

    expect(Object.keys(variants)).toEqual(['ui']);

    const ui = variants['ui'];
    expect(ui?.('checked', {})).toBe('&.ui-checked');
    expect(ui?.('active', {})).toBe('&.ui-active');
    expect(ui?.('disabled', {})).toBe('&.ui-disabled');
    expect(ui?.('readonly', {})).toBe('&.ui-readonly');
  });

  it('registers variants from array of known prefixes', () => {
    const plugin = uiVariants({ prefixes: ['ui', 'ui-side'] });
    const { api } = runPlugin(plugin);
    const variants = extractVariants(vi.mocked(api.matchVariant));

    expect(Object.keys(variants)).toEqual(['ui', 'ui-side']);

    expect(variants['ui']?.('open', {})).toBe('&.ui-open');
    expect(variants['ui-side']?.('left', {})).toBe('&.ui-side-left');
  });

  it('ignores unknown prefix when using array syntax', () => {
    const plugin = uiVariants({ prefixes: ['unknown'] });
    const { api } = runPlugin(plugin);
    const variants = extractVariants(vi.mocked(api.matchVariant));

    expect(Object.keys(variants)).toEqual(['unknown']);

    const unknown = variants['unknown'];
    expect(unknown?.('whatever')).toBe('');
    expect(unknown?.('open')).toBe('');
  });

  it('allows function-based prefixes config with default inheritance', () => {
    const plugin = uiVariants({
      prefixes: (defaults) => ({
        custom: [...defaults.ui, 'custom-state'],
        'custom-side': ['left', 'right'],
      }),
    });

    const { api } = runPlugin(plugin);
    const variants = extractVariants(vi.mocked(api.matchVariant));

    expect(Object.keys(variants)).toEqual(['custom', 'custom-side']);

    expect(variants['custom']?.('open', {})).toBe('&.custom-open');
    expect(variants['custom']?.('custom-state', {})).toBe(
      '&.custom-custom-state',
    );
    expect(variants['custom-side']?.('left', {})).toBe('&.custom-side-left');
  });

  it('ignores non-string values', () => {
    const plugin = uiVariants({});
    const { api } = runPlugin(plugin);
    const variants = extractVariants(vi.mocked(api.matchVariant));

    const ui = variants['ui'];
    expect(ui?.(123, {})).toBe('');
    expect(ui?.(null, {})).toBe('');
    expect(ui?.({ foo: 'bar' }, {})).toBe('');
  });

  it('supports modifier syntax', () => {
    const { api } = runPlugin(uiVariants);
    const variants = extractVariants(vi.mocked(api.matchVariant));

    const ui = variants['ui'];
    expect(ui?.('selected', { modifier: 'some-id' })).toBe(
      '&.ui-selected\\/some-id',
    );
  });

  it('registers variants from object prefixes with array/string map', () => {
    const plugin = uiVariants({
      prefixes: {
        x: ['one', 'two'],
        y: { 3: 'three', 4: 'four' },
      },
    });

    const { api } = runPlugin(plugin);
    const variants = extractVariants(vi.mocked(api.matchVariant));

    expect(Object.keys(variants)).toEqual(['x', 'y']);

    expect(variants['x']?.('one', {})).toBe('&.x-one');
    expect(variants['x']?.('two', {})).toBe('&.x-two');
    expect(variants['y']?.('3', {})).toBe('&.y-three');
    expect(variants['y']?.('4', {})).toBe('&.y-four');
  });

  it('uses default options when options are undefined', () => {
    const plugin = uiVariants();
    const { api } = runPlugin(plugin);
    const variants = extractVariants(vi.mocked(api.matchVariant));

    expect(variants).toHaveProperty('ui');
  });

  it('ignores non-string mapped values in value map', () => {
    const unsafeMap = {
      a: 'valid',
      b: 123,
      c: true,
      d: null,
      e: {},
    };

    const plugin = uiVariants({
      prefixes: {
        test: unsafeMap as unknown as Record<string, string>, // intentional unsafe
      },
    });

    const { api } = runPlugin(plugin);
    const variants = extractVariants(vi.mocked(api.matchVariant));

    const test = variants['test'];
    expect(test?.('a', {})).toBe('&.test-valid');
    expect(test?.('b', {})).toBe('');
    expect(test?.('c', {})).toBe('');
    expect(test?.('d', {})).toBe('');
    expect(test?.('e', {})).toBe('');
  });

  it('returns empty string when mapped value is undefined', () => {
    const plugin = uiVariants({
      prefixes: {
        z: {
          a: 'alpha',
          // deliberately skip 'missing'
        },
      },
    });

    const { api } = runPlugin(plugin);
    const variants = extractVariants(vi.mocked(api.matchVariant));

    const z = variants['z'];
    expect(z?.('a', {})).toBe('&.z-alpha');
    expect(z?.('missing', {})).toBe('');
  });
});
