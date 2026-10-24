// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, test } from '@rstest/core';

import {
  BENCH_PROTOCOL_OPTIONS,
  DEFAULT_BENCH_SCENARIOS,
  DEFAULT_BENCH_SETTINGS,
  createDefaultBenchGroups,
  getBenchProtocolLabel,
  usesBrowserBenchCapture,
  usesCatalog,
  withBenchProtocol,
} from './benchData.js';
import { createBenchGroupsFromReport } from './benchHistory.js';
import {
  buildBenchPlanShareUrl,
  readBenchPlanShare,
} from './benchPlanShare.js';
import { parseRouteHash } from '../../utils/appRoute.js';

test('ReactWeb selection uses native profile, no catalog, and browser capture', () => {
  const baseline = createDefaultBenchGroups('test-model')[0]!;
  const group = withBenchProtocol(
    withBenchProtocol(baseline, 'openui'),
    'reactweb',
  );
  expect(BENCH_PROTOCOL_OPTIONS.some(option => option.value === 'reactweb'))
    .toBe(true);
  expect(getBenchProtocolLabel(group.protocol)).toBe('ReactWeb');
  expect(group).toMatchObject({
    protocol: 'reactweb',
    profile: 'native',
    catalog: 'none',
  });
  expect(usesCatalog(group)).toBe(false);
  expect(usesBrowserBenchCapture(group.protocol)).toBe(true);
  expect(usesBrowserBenchCapture('html')).toBe(true);
  expect(usesBrowserBenchCapture('lynx-xml')).toBe(false);
  expect(withBenchProtocol(group, 'a2ui')).toMatchObject({
    protocol: 'a2ui',
    profile: 'native',
    catalog: 'Full Catalog',
  });
});

test('ReactWeb survives report restoration and shared plan round trips', () => {
  const group = withBenchProtocol(
    createDefaultBenchGroups('test-model')[0]!,
    'reactweb',
  );
  const groups = createBenchGroupsFromReport({
    groups: [group],
    env: { model: 'test-model' },
  });
  expect(groups).toEqual([group]);
  const plan = {
    title: 'ReactWeb comparison',
    groups,
    scenarios: [...DEFAULT_BENCH_SCENARIOS],
    settings: DEFAULT_BENCH_SETTINGS,
  };
  const url = new URL(
    buildBenchPlanShareUrl('https://example.com/#/bench', plan),
  );
  const route = parseRouteHash(url.hash);
  expect(readBenchPlanShare(route.benchPlan!)).toEqual({ version: 1, ...plan });
});
