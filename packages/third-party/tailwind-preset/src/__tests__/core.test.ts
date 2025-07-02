// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it } from 'vitest';

import {
  LYNX_PLUGIN_MAP,
  getReplaceablePlugins,
  isPluginReplaceable,
  toEnabledSet,
} from '../core.js';

describe('core plugin utilities', () => {
  it('toEnabledSet handles boolean', () => {
    const enabled = toEnabledSet(true);
    expect([...enabled] as string[]).toEqual(
      expect.arrayContaining(getReplaceablePlugins() as string[]),
    );
  });

  it('toEnabledSet handles whitelist array', () => {
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
