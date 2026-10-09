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

test('ReactLynx selection uses native profile, no catalog, and native capture', () => {
  const baseline = createDefaultBenchGroups('test-model')[0]!;
  const group = withBenchProtocol(
    withBenchProtocol(baseline, 'openui'),
    'reactlynx',
  );
  expect(BENCH_PROTOCOL_OPTIONS.some(option => option.value === 'reactlynx'))
    .toBe(true);
  expect(getBenchProtocolLabel(group.protocol)).toBe('ReactLynx');
  expect(group).toMatchObject({
    protocol: 'reactlynx',
    profile: 'native',
    catalog: 'none',
  });
  expect(usesCatalog(group)).toBe(false);
  expect(usesBrowserBenchCapture(group.protocol)).toBe(false);
  expect(usesBrowserBenchCapture('html')).toBe(true);
  expect(usesBrowserBenchCapture('lynx-xml')).toBe(false);
  expect(withBenchProtocol(group, 'a2ui')).toMatchObject({
    protocol: 'a2ui',
    profile: 'native',
    catalog: 'Full Catalog',
  });
});

test('ReactLynx survives report restoration and shared plan round trips', () => {
  const group = withBenchProtocol(
    createDefaultBenchGroups('test-model')[0]!,
    'reactlynx',
  );
  const groups = createBenchGroupsFromReport({
    groups: [group],
    env: { model: 'test-model' },
  });
  expect(groups).toEqual([group]);
  const plan = {
    title: 'ReactLynx comparison',
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
