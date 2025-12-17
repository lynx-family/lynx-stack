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

    expect(Object.keys(variants)).toEqual(
      expect.arrayContaining(['ui']),
    );

    const ui = variants['ui'];
    expect(ui?.('checked', {})).toBe('&.ui-checked');
    expect(ui?.('active', {})).toBe('&.ui-active');
    expect(ui?.('disabled', {})).toBe('&.ui-disabled');
    expect(ui?.('readonly', {})).toBe('&.ui-readonly');
  });

  it('registers group, peer, and parent variants', () => {
    const plugin = uiVariants({ prefixes: ['ui'] });
    const { api } = runPlugin(plugin);
    const variants = extractVariants(vi.mocked(api.matchVariant));

    expect(Object.keys(variants)).toEqual(
      expect.arrayContaining(['ui', 'group-ui', 'peer-ui', 'parent-ui']),
    );

    const group = variants['group-ui'];
    const peer = variants['peer-ui'];
    const parent = variants['parent-ui'];

    expect(group?.('open')).toBe(':merge(.group).ui-open &');
    expect(peer?.('open')).toBe(':merge(.peer).ui-open ~ &');
    expect(parent?.('open')).toBe('.ui-open > &');
  });

  it('registers variants from array of known prefixes', () => {
    const plugin = uiVariants({ prefixes: ['ui', 'ui-side'] });
    const { api } = runPlugin(plugin);
    const variants = extractVariants(vi.mocked(api.matchVariant));

    expect(Object.keys(variants)).toEqual(
      expect.arrayContaining(
        [
          'ui',
          'group-ui',
          'peer-ui',
          'parent-ui',
          'ui-side',
          'group-ui-side',
          'peer-ui-side',
          'parent-ui-side',
        ],
      ),
    );

    expect(variants['ui']?.('open', {})).toBe('&.ui-open');
    expect(variants['ui-side']?.('left', {})).toBe('&.ui-side-left');
  });

  it('ignores unknown prefix when using array syntax', () => {
    const plugin = uiVariants({ prefixes: ['unknown'] });
    const { api } = runPlugin(plugin);
    const variants = extractVariants(vi.mocked(api.matchVariant));

    expect(Object.keys(variants)).toEqual(
      expect.arrayContaining(
        [
          'unknown',
          'group-unknown',
          'peer-unknown',
          'parent-unknown',
        ],
      ),
    );

    const self = variants['unknown'];
    const group = variants['group-unknown'];
    const peer = variants['peer-unknown'];
    const parent = variants['parent-unknown'];

    expect(self?.('whatever')).toBe('');
    expect(self?.('open')).toBe('');
    expect(group?.('whatever')).toBe('');
    expect(group?.('checked')).toBe('');
    expect(peer?.('whatever')).toBe('');
    expect(peer?.('disabled')).toBe('');
    expect(parent?.('whatever')).toBe('');
    expect(parent?.('active')).toBe('');
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

    expect(Object.keys(variants)).toEqual(
      expect.arrayContaining([
        'custom',
        'group-custom',
        'peer-custom',
        'parent-custom',
        'custom-side',
        'group-custom-side',
        'peer-custom-side',
        'parent-custom-side',
      ]),
    );

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

  // `modifier` is only meaningful for group-* and peer-* variants
  // self and parent do not support it
  it('supports modifier syntax in group- and peer- variants only', () => {
    const { api } = runPlugin(uiVariants({ prefixes: ['ui'] }));
    const variants = extractVariants(vi.mocked(api.matchVariant));

    const group = variants['group-ui'];
    const peer = variants['peer-ui'];
    const self = variants['ui'];
    const parent = variants['parent-ui'];

    expect(group?.('selected', { modifier: 'menu' })).toBe(
      ':merge(.group\\/menu).ui-selected &',
    );
    expect(peer?.('selected', { modifier: 'tab' })).toBe(
      ':merge(.peer\\/tab).ui-selected ~ &',
    );

    // Self & Parent variant should ignore modifier — no escaped suffix
    expect(self?.('selected', { modifier: 'should-not-affect' })).toBe(
      '&.ui-selected',
    );

    expect(parent?.('selected', { modifier: 'should-not-affect' })).toBe(
      '.ui-selected > &',
    );
  });

  it('respects Tailwind prefix in group and peer variants, but not in ui variants themselves', () => {
    const plugin = uiVariants({ prefixes: ['ui'] });
    const { api } = runPlugin(plugin, { config: { prefix: 'tw-' } });

    const variants = extractVariants(vi.mocked(api.matchVariant));
    const self = variants['ui'];
    const group = variants['group-ui'];
    const peer = variants['peer-ui'];
    const parent = variants['parent-ui'];

    // Self
    expect(self?.('open')).toBe('&.ui-open');
    // Group/Peer
    expect(group?.('open')).toBe(':merge(.tw-group).ui-open &');
    expect(peer?.('open')).toBe(':merge(.tw-peer).ui-open ~ &');
    // Parent
    expect(parent?.('open')).toBe('.ui-open > &');
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

    expect(Object.keys(variants)).toEqual(
      expect.arrayContaining(
        [
          'x',
          'group-x',
          'peer-x',
          'parent-x',
          'y',
          'group-y',
          'peer-y',
          'parent-y',
        ].sort(),
      ),
    );

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

    const all = ['test', 'group-test', 'peer-test', 'parent-test'];

    for (const prefix of all) {
      const fn = variants[prefix];
      expect(fn?.('a', {})).toContain('valid');
      expect(fn?.('b', {})).toBe('');
      expect(fn?.('c', {})).toBe('');
      expect(fn?.('d', {})).toBe('');
      expect(fn?.('e', {})).toBe('');
    }
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
