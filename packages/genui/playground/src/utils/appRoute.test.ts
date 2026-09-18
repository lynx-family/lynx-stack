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
    expect(buildRouteHash('html', 'create')).toBe('#/html');
  });

  test('recognizes the HTML protocol root', () => {
    expect(parseRouteHash('#/html')).toMatchObject({
      protocol: { name: 'html', version: '5' },
      tab: 'create',
    });
    expect(parseRouteHash('#/html/create')).toMatchObject({
      protocol: { name: 'html' },
      tab: 'create',
    });
  });

  test('supports Lynx XML create and examples routes', () => {
    expect(buildRouteHash('lynx-xml', 'examples')).toBe(
      '#/lynx-xml/examples',
    );
    expect(parseRouteHash('#/lynx-xml')).toMatchObject({
      protocol: { name: 'lynx-xml', version: '0.1' },
      tab: 'create',
    });
    expect(parseRouteHash('#/lynx-xml/create')).toMatchObject({
      protocol: { name: 'lynx-xml' },
      tab: 'create',
    });
    expect(parseRouteHash('#/lynx-xml/examples/counter')).toMatchObject({
      protocol: { name: 'lynx-xml' },
      tab: 'examples',
      demoId: 'counter',
    });
  });

  test('recognizes the MCP Apps protocol root', () => {
    expect(parseRouteHash('#/mcp-apps')).toMatchObject({
      protocol: { name: 'mcp-apps', version: '2026-01-26' },
      tab: 'create',
    });
    expect(buildRouteHash('mcp-apps', 'examples')).toBe(
      '#/mcp-apps/examples',
    );
    expect(parseRouteHash('#/mcp-apps/examples/weather')).toMatchObject({
      protocol: { name: 'mcp-apps', version: '2026-01-26' },
      tab: 'examples',
      demoId: 'weather',
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

  test('uses one canonical Bench page route', () => {
    expect(buildRouteHash('a2ui', 'bench')).toBe('#/bench');
    expect(buildRouteHash('openui', 'bench')).toBe('#/bench');

    expect(parseRouteHash('#/bench')).toMatchObject({
      protocol: { name: 'a2ui' },
      tab: 'bench',
    });
  });

  test('maps old Bench subpaths onto the same combined page', () => {
    for (
      const hash of [
        '#/bench/runner',
        '#/bench/history',
        '#/bench/phase-1',
        '#/bench/phase-2',
        '#/bench/not-a-report',
        '#/a2ui/bench',
        '#/a2ui/bench/history',
        '#/a2ui/bench/phase-1',
      ]
    ) {
      expect(parseRouteHash(hash)).toMatchObject({
        protocol: { name: 'a2ui' },
        tab: 'bench',
      });
      expect(parseRouteHash(hash)).not.toHaveProperty('benchSlug');
      expect(parseRouteHash(hash)).not.toHaveProperty('benchReportId');
    }
  });

  test('opens published records by ID without treating them as live jobs', () => {
    for (
      const id of [
        '5d8ad40a-b0cf-40b3-9495-bcb628d62e9b',
        '059a758e-4cbf-4053-bbe4-9f8cb47f7444',
      ]
    ) {
      expect(parseRouteHash(`#/bench/reports/${id}`)).toMatchObject({
        tab: 'bench',
        benchReportId: id,
      });
    }
  });

  test('does not select a static report or silently replace an invalid link', () => {
    expect(parseRouteHash('#/bench/phase-2')).not.toHaveProperty(
      'benchReportId',
    );
    expect(parseRouteHash('#/bench/reports')).toMatchObject({
      tab: 'bench',
      benchReportId: '',
    });
    expect(parseRouteHash('#/bench/reports/extra/path')).toMatchObject({
      tab: 'bench',
      benchReportId: '',
    });
  });

  test('uses a fixed local report route without shared-data URL parameters', () => {
    expect(parseRouteHash('#/bench/reports')).toMatchObject({
      tab: 'bench',
      benchReportId: '',
    });
    expect(parseRouteHash('#/bench/reports/shared')).not.toHaveProperty(
      'benchReportUrl',
    );
  });
});
