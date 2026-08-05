// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import {
  DEFAULT_ROUTE_HASH,
  buildRouteHash,
  getRouteHash,
  parseRouteHash,
} from './appRoute.js';

describe('app route hash', () => {
  test('uses A2UI as the default route hash', () => {
    expect(getRouteHash('')).toBe(DEFAULT_ROUTE_HASH);
    expect(getRouteHash('#')).toBe(DEFAULT_ROUTE_HASH);
    expect(getRouteHash('#/')).toBe(DEFAULT_ROUTE_HASH);
    expect(parseRouteHash('')).toMatchObject({
      protocol: { name: 'a2ui' },
      tab: 'create',
    });
  });

  test('uses protocol roots as canonical create routes', () => {
    expect(buildRouteHash('a2ui', 'create')).toBe('#/a2ui');
    expect(buildRouteHash('openui', 'create')).toBe('#/openui');
    expect(buildRouteHash('mcp-apps', 'create')).toBe('#/mcp-apps');
    expect(buildRouteHash('lynx-xml', 'create')).toBe('#/lynx-xml');
  });

  test('uses a protocol-independent canonical bench route', () => {
    expect(buildRouteHash('a2ui', 'bench')).toBe('#/bench');
    expect(buildRouteHash('lynx-xml', 'bench')).toBe('#/bench');
    expect(parseRouteHash('#/bench')).toMatchObject({
      protocol: { name: 'a2ui' },
      tab: 'bench',
    });
  });

  test('keeps protocol-scoped bench links as compatibility aliases', () => {
    expect(parseRouteHash('#/a2ui/bench')).toMatchObject({ tab: 'bench' });
    expect(parseRouteHash('#/lynx-xml/bench')).toMatchObject({ tab: 'bench' });
  });

  test('recognizes the MCP Apps protocol root', () => {
    expect(parseRouteHash('#/mcp-apps')).toMatchObject({
      protocol: { name: 'mcp-apps', version: '2026-01-26' },
      tab: 'create',
    });
  });

  test('recognizes the Lynx XML protocol root', () => {
    expect(parseRouteHash('#/lynx-xml')).toMatchObject({
      protocol: { name: 'lynx-xml', version: '1.0' },
      tab: 'create',
    });
  });

  test('keeps deep links under the selected protocol', () => {
    expect(buildRouteHash('a2ui', 'examples')).toBe('#/a2ui/examples');
    expect(buildRouteHash('openui', 'catalog')).toBe('#/openui/catalog');
    expect(parseRouteHash('#/openui/catalog/Button')).toMatchObject({
      protocol: { name: 'openui' },
      tab: 'catalog',
      componentName: 'Button',
    });
  });

  test('keeps components links as a catalog compatibility alias', () => {
    expect(parseRouteHash('#/openui/components/Button')).toMatchObject({
      protocol: { name: 'openui' },
      tab: 'catalog',
      componentName: 'Button',
    });
  });
});
