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
  });

  test('recognizes the MCP Apps protocol root', () => {
    expect(parseRouteHash('#/mcp-apps')).toMatchObject({
      protocol: { name: 'mcp-apps', version: '2026-01-26' },
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
