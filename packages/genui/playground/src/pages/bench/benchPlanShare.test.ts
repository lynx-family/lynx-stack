// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { expect, test } from '@rstest/core';

import {
  DEFAULT_BENCH_SCENARIOS,
  DEFAULT_BENCH_SETTINGS,
  createBenchPresetGroups,
} from './benchData.js';
import {
  buildBenchPlanShareUrl,
  readBenchPlanShare,
} from './benchPlanShare.js';
import { parseRouteHash } from '../../utils/appRoute.js';
import { decodeBase64Url, encodeBase64Url } from '../../utils/base64url.js';

function fixture() {
  return {
    title: '天气测试 🌤',
    uiJudgeServerUrl: 'https://judge.example.com/capture/',
    groups: createBenchPresetGroups('platform', 'deepseek-flash').map(
      group => ({
        ...group,
        extraInstruction: '保持中文内容完整',
        enableDesignGuidance: false,
        enableHtmlFragment: true,
        ...(group.protocol === 'lynx-xml'
          ? { stylePreset: 'default' as const }
          : {}),
      }),
    ),
    scenarios: DEFAULT_BENCH_SCENARIOS.map(scenario => ({
      ...scenario,
      prompt: '展示天气 & 空气质量 #?=+',
    })),
    settings: {
      ...DEFAULT_BENCH_SETTINGS,
      repeats: 4,
      uiJudgeModel: 'judge-model',
    },
  };
}

test.each([false, 'default'] as const)(
  'round-trips independent options in a deployment-relative Bench link (preset=%s)',
  stylePreset => {
    const initial = fixture();
    const plan = {
      ...initial,
      groups: initial.groups.map(group =>
        group.protocol === 'lynx-xml'
          ? { ...group, enableHtmlFragment: false, stylePreset }
          : group
      ),
    };
    const url = new URL(
      buildBenchPlanShareUrl(
        'https://example.com/genui/?token=secret#/bench/reports',
        plan,
      ),
    );
    expect(url.pathname).toBe('/genui/');
    expect(url.search).toBe('');
    const route = parseRouteHash(url.hash);
    expect(route.tab).toBe('bench');
    expect(route.benchReportId).toBeUndefined();
    expect(readBenchPlanShare(route.benchPlan!)).toEqual({
      version: 1,
      ...plan,
    });
  },
);

test('only shares whitelisted parameters, even when extra fields come from a completed report', () => {
  const plan = fixture();
  const dirty = {
    ...plan,
    report: { results: [{ text: 'private result' }] },
    apiKey: 'secret',
    env: { apiKeyConfigured: true, baseURL: 'http://private.internal' },
    settings: {
      ...plan.settings,
      uiJudgeServerUrl: 'http://localhost:8080',
      apiKey: 'secret',
    },
    groups: plan.groups.map(group => ({
      ...group,
      apiKey: 'secret',
      modelPrices: { input_price: 99 },
    })),
    scenarios: plan.scenarios.map(scenario => ({
      ...scenario,
      screenshotDataUrl: 'private image',
    })),
  };
  const url = new URL(
    buildBenchPlanShareUrl('https://example.com/#/bench', dirty),
  );
  const encoded = parseRouteHash(url.hash).benchPlan!;
  expect(JSON.parse(decodeBase64Url(encoded))).toEqual({ version: 1, ...plan });
  // The receiver also whitelists fields instead of storing injected properties.
  expect(
    readBenchPlanShare(
      encodeBase64Url(JSON.stringify({ ...dirty, version: 1 })),
    ),
  )
    .toEqual({ version: 1, ...plan });
});

test('normalizes the shared screenshot service URL and keeps old links compatible', () => {
  const plan = fixture();
  const url = new URL(buildBenchPlanShareUrl('https://example.com/#/bench', {
    ...plan,
    uiJudgeServerUrl: ' http://localhost:8080/capture?ignored=value#fragment ',
  }));
  expect(
    readBenchPlanShare(parseRouteHash(url.hash).benchPlan!).uiJudgeServerUrl,
  )
    .toBe('http://localhost:8080/capture/');
  const legacy = readBenchPlanShare(encodeBase64Url(JSON.stringify({
    ...plan,
    version: 1,
    uiJudgeServerUrl: undefined,
  })));
  expect(legacy).not.toHaveProperty('uiJudgeServerUrl');
  const empty = readBenchPlanShare(encodeBase64Url(JSON.stringify({
    ...plan,
    version: 1,
    uiJudgeServerUrl: '',
  })));
  expect(empty.uiJudgeServerUrl).toBe('');
});

test('rejects malformed, oversized, unsupported, and ambiguous plans', () => {
  for (const encoded of ['', '%bad', encodeBase64Url('{'), 'a'.repeat(64001)]) {
    expect(() => readBenchPlanShare(encoded)).toThrow('invalid or unsupported');
  }
  const plan = { version: 1, ...fixture() };
  for (
    const invalid of [
      { ...plan, version: 2 },
      { ...plan, settings: { ...plan.settings, repeats: 0 } },
      { ...plan, settings: { ...plan.settings, judgeEnabled: 'true' } },
      { ...plan, uiJudgeServerUrl: 'javascript:alert(1)' },
      { ...plan, uiJudgeServerUrl: 'https://user:secret@judge.example.com/' },
      { ...plan, uiJudgeServerUrl: 123 },
      { ...plan, groups: [plan.groups[0], plan.groups[0]] },
      { ...plan, scenarios: [{ ...plan.scenarios[0], prompt: 123 }] },
      {
        ...plan,
        groups: Array.from(
          { length: 9 },
          (_, i) => ({ ...plan.groups[0], id: `${i}` }),
        ),
      },
    ]
  ) {
    expect(() => readBenchPlanShare(encodeBase64Url(JSON.stringify(invalid))))
      .toThrow('invalid or unsupported');
  }
  expect(() =>
    buildBenchPlanShareUrl('https://example.com', {
      ...plan,
      scenarios: [{ ...plan.scenarios[0]!, prompt: 'x'.repeat(64000) }],
    })
  ).toThrow('too large');
});
