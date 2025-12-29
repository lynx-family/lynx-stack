// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it } from 'vitest';

import {
  LYNX_PLUGIN_MAP,
  ORDERED_LYNX_UI_PLUGIN_NAMES,
  getReplaceablePlugins,
  isPluginReplaceable,
  resolveUIPluginEntries,
  toEnabledSet,
} from '../core.js';
import type { LynxUIPluginsOption } from '../core.js';

const firstUIPlugin = ORDERED_LYNX_UI_PLUGIN_NAMES[0]!;

function resolvePluginEntriesForTest(input: Record<string, unknown>) {
  return resolveUIPluginEntries(input as unknown as LynxUIPluginsOption);
}

describe('core plugin utilities', () => {
  it('toEnabledSet handles true (enables all)', () => {
    const enabled = toEnabledSet(true);
    expect([...enabled] as string[]).toEqual(
      expect.arrayContaining(getReplaceablePlugins() as string[]),
    );
  });
  it('toEnabledSet handles false (disables all)', () => {
    const set = toEnabledSet(false);
    expect(set.size).toBe(0);
    expect([...set]).toEqual([]);
  });

  it('toEnabledSet handles allowed array', () => {
    const set = toEnabledSet(['translate', 'direction']);
    expect([...set] as string[]).toEqual(['translate', 'direction']);
  });

  it('toEnabledSet handles object form (granular)', () => {
    const set = toEnabledSet({ boxShadow: false, inset: true });
    expect([...set] as string[]).toEqual(expect.arrayContaining(['inset']));
    expect([...set]).not.toContain('boxShadow');
  });

  it('getReplaceablePlugins returns all except defaults', () => {
    const plugins = getReplaceablePlugins();
    expect(plugins).not.toContain('defaults');
    expect(plugins).toEqual(
      expect.arrayContaining(
        Object.keys(LYNX_PLUGIN_MAP).filter(k => k !== 'defaults'),
      ),
    );
  });

  it('isPluginReplaceable behaves correctly', () => {
    expect(isPluginReplaceable('rotate')).toBe(true);
    expect(isPluginReplaceable('defaults')).toBe(false);
    expect(isPluginReplaceable('notAPlugin')).toBe(false);
  });

  it('LYNX_PLUGIN_MAP entries are plugin functions', () => {
    for (const plugin of Object.values(LYNX_PLUGIN_MAP)) {
      if (typeof plugin === 'function') continue;
      expect(plugin).toHaveProperty('handler');
      expect(typeof plugin.handler).toBe('function');
    }
  });
});

describe('lynx-ui plugin helpers', () => {
  it('resolveUIPluginEntries handles true', () => {
    const entries = resolveUIPluginEntries(true);
    expect(entries).toEqual(
      ORDERED_LYNX_UI_PLUGIN_NAMES.map((n) => [n, {}]),
    );
  });

  it('resolveUIPluginEntries handles false', () => {
    const entries = resolveUIPluginEntries(false);
    expect(entries).toEqual([]);
  });

  it('resolveUIPluginEntries handles array form', () => {
    const subset = ORDERED_LYNX_UI_PLUGIN_NAMES.slice(0, 2);
    const entries = resolveUIPluginEntries(subset);
    expect(entries).toEqual(subset.map((n) => [n, {}]));
  });

  it.each([
    [{ [firstUIPlugin]: false }, []],
    [{ [firstUIPlugin]: true }, [[firstUIPlugin, {}]]],
    [{ [firstUIPlugin]: { foo: 'bar' } }, [[firstUIPlugin, { foo: 'bar' }]]],
  ])(
    'resolveUIPluginEntries handles object form: %j → %j',
    (input, expected) => {
      const entries = resolvePluginEntriesForTest(input);
      expect(entries).toEqual(expected);
    },
  );
});
