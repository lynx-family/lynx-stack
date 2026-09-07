// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, rstest, test } from '@rstest/core';

import { getA2UIAgentService } from '../service/a2ui-agent.js';
import { probeBenchUiJudge } from '../service/a2ui-bench-judge.js';
import { runBenchJob, summarizeGroup } from '../service/a2ui-bench-runner.js';
import {
  BENCH_SCREENSHOT_DATA_URL_PREFIX,
  MAX_BENCH_SCREENSHOT_DECODED_BYTES,
} from '../service/a2ui-bench-screenshot.js';
import {
  BenchJobStore,
  getBenchJobStore,
} from '../service/a2ui-bench-store.js';
import type {
  BenchGroupRequest,
  BenchJobRequest,
  BenchRunResult,
} from '../service/a2ui-bench-types.js';
import type {
  ProtocolBenchAdapter,
} from '../service/genui-bench/protocol-adapter.js';
import {
  probeGenuiBenchUiJudge,
  runGenuiBenchUiJudge,
} from '../service/genui-bench-judge.js';

rstest.mock('../service/a2ui-bench-judge.js', { mock: true });
rstest.mock('../service/a2ui-agent.js', { mock: true });
rstest.mock('../service/genui-bench-judge.js', { mock: true });

const group: BenchGroupRequest = {
  enabled: true,
  id: 'control',
  name: 'Control',
  role: 'control',
  variable: 'custom',
};

function request(judgeEnabled = true): BenchJobRequest {
  return {
    groups: [group],
    provider: {},
    scenarios: [{
      id: 'scenario',
      name: 'Scenario',
      prompt: 'Build a card',
      type: 'Information',
    }],
    settings: {
      judgeEnabled,
      maxRepairAttempts: 0,
      parallelism: 1,
      renderMetricsEnabled: false,
      repairEnabled: false,
      repeats: 1,
    },
  };
}

function result(
  id: string,
  judgeStatus: BenchRunResult['judgeStatus'],
  judgeScore: number,
): BenchRunResult {
  return {
    agentMs: 10,
    attempts: 1,
    catalog: 'Full Catalog',
    errors: [],
    fmpMs: 0,
    groupId: group.id,
    groupName: group.name,
    id,
    judgeScore,
    judgeStatus,
    messageCount: 1,
    model: 'test-model',
    ok: true,
    outputChars: 10,
    profile: 'native',
    protocol: 'a2ui',
    renderMs: 0,
    repeatIndex: 1,
    role: group.role,
    scenarioId: 'scenario',
    scenarioName: 'Scenario',
    status: 'complete',
    tokens: 10,
    ttiMs: 0,
  };
}

function geqiDimensions(score: number): Array<{
  dimension: string;
  dimensionLabel: string;
  score: number;
  weight: number;
}> {
  return [
    {
      dimension: 'usability-interaction',
      dimensionLabel: 'Usability & Interaction Logic',
      score,
      weight: 30,
    },
    {
      dimension: 'visual-aesthetics',
      dimensionLabel: 'Visual Communication & Aesthetics',
      score,
      weight: 25,
    },
    {
      dimension: 'consistency-standards',
      dimensionLabel: 'Consistency & Standards',
      score,
      weight: 15,
    },
    {
      dimension: 'architecture-writing',
      dimensionLabel: 'Information Architecture & UX Writing',
      score,
      weight: 15,
    },
  ];
}

function screenshotDataUrlForBytes(bytes: number): string {
  const encodedLength = Math.ceil(bytes / 3) * 4;
  const remainder = bytes % 3;
  let padding = '';
  if (remainder === 1) {
    padding = '==';
  } else if (remainder === 2) {
    padding = '=';
  }
  return BENCH_SCREENSHOT_DATA_URL_PREFIX
    + 'A'.repeat(encodedLength - padding.length)
    + padding;
}

describe('A2UI Bench UI Judge integration', () => {
  test('does not restore a cancelled job to running after the health probe', async () => {
    let resolveProbe:
      | ((capability: Awaited<ReturnType<typeof probeBenchUiJudge>>) => void)
      | undefined;
    rstest.mocked(probeBenchUiJudge).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveProbe = resolve;
        }),
    );
    const store = getBenchJobStore();
    const benchRequest = request();
    benchRequest.playground = {
      uiJudgeServerUrl: 'http://request-judge.test/',
    };
    const job = store.createJob(benchRequest, 1);

    const running = runBenchJob(job.id);
    store.cancelJob(job.id);
    resolveProbe?.({
      enabled: false,
      reason: 'not ready',
    });
    await running;

    expect(probeBenchUiJudge).toHaveBeenCalledWith({
      serverUrl: 'http://request-judge.test/',
    });
    const completed = store.getJob(job.id);
    expect(completed?.status).toBe('cancelled');
    expect(completed?.report?.status).toBe('cancelled');
    expect(completed?.results).toEqual([]);
  });

  test('uses the planned-run denominator for Judge averages', () => {
    const completed = result('complete', 'complete', 4);
    completed.judgeGeqiScore = 80;
    const summary = summarizeGroup(group, [
      completed,
      result('failed', 'failed', 0),
      result('skipped', 'skipped', 0),
    ]);

    expect(summary.avgJudgeScore).toBe(4 / 3);
    expect(summary.avgJudgeGeqiScore).toBe(80 / 3);
    expect(summary.judgeRunCount).toBe(1);
    expect(summary.plannedRuns).toBe(3);
  });

  test('marks a matched-core run failed when Judge fails', async () => {
    rstest.mocked(probeGenuiBenchUiJudge).mockResolvedValueOnce({
      enabled: true,
      session: {
        bundleUrl: 'https://bundle.example/bench.lynx.js',
        judgeUrl: 'https://judge.example/judge',
      },
    });
    rstest.mocked(runGenuiBenchUiJudge).mockResolvedValueOnce({
      dimensions: geqiDimensions(4),
      errors: ['ui-judge consistency-standards failed'],
      geqiScore: 80,
      reason: 'Partial visual result',
      score: 4,
      status: 'failed',
      summary: 'Partial GEQI result',
      warnings: [],
    });
    const openui: ProtocolBenchAdapter = {
      protocol: 'openui',
      generate() {
        return Promise.resolve({
          attempts: [{
            index: 1,
            durationMs: 1,
            inputTokens: 2,
            outputTokens: 3,
            totalTokens: 5,
            valid: true,
            validationErrors: [],
            outputChars: 10,
          }],
          finalValid: true,
          finalText: 'root = Text("ready")',
          finalErrors: [],
          judgePayload: {
            kind: 'openui-text',
            rawText: 'root = Text("ready")',
          },
        });
      },
    };
    const benchRequest = request();
    benchRequest.groups = [{
      ...group,
      profile: 'matched-core',
      protocol: 'openui',
    }];
    const store = getBenchJobStore();
    const job = store.createJob(benchRequest, 1);

    await runBenchJob(job.id, { adapters: { openui } });

    const report = store.getJob(job.id)?.report;
    expect(report?.results[0]).toMatchObject({
      error: 'ui-judge consistency-standards failed',
      errors: ['ui-judge consistency-standards failed'],
      judgeScore: 0,
      judgeStatus: 'failed',
      ok: false,
      status: 'failed',
    });
    expect(report?.results[0]?.judgeDimensions).toBeUndefined();
    expect(report?.results[0]?.judgeGeqiScore).toBeUndefined();
    expect(report?.results[0]?.judgeReason).toBeUndefined();
    expect(report?.results[0]?.judgeSummary).toBeUndefined();
    expect(report?.summary).toMatchObject({
      failedRuns: 1,
      successRate: 0,
    });
    expect(report?.summaries[0]).toMatchObject({
      avgJudgeScore: 0,
      judgeRunCount: 0,
    });
    expect(report?.summaries[0]?.avgJudgeGeqiScore).toBeUndefined();
  });

  test('runs mixed protocol arms serially and rotates their order per sample', async () => {
    const order: string[] = [];
    const adapter = (
      protocol: 'a2ui' | 'openui',
    ): ProtocolBenchAdapter => ({
      protocol,
      generate(input) {
        order.push(`${input.repeatIndex}:${protocol}`);
        return Promise.resolve({
          attempts: [{
            index: 1,
            durationMs: 1,
            inputTokens: 2,
            outputTokens: 3,
            totalTokens: 5,
            valid: true,
            validationErrors: [],
            outputChars: 10,
          }],
          finalValid: true,
          finalText: `${protocol} output`,
          finalErrors: [],
          judgePayload: protocol === 'a2ui'
            ? { kind: 'a2ui-messages', messages: [] }
            : { kind: 'openui-text', rawText: 'root = Text("ready")' },
        });
      },
    });
    const benchRequest = request(false);
    benchRequest.groups = [
      {
        ...group,
        id: 'a2ui',
        name: 'A2UI',
        protocol: 'a2ui',
        profile: 'matched-core',
        variable: 'protocol',
      },
      {
        ...group,
        id: 'openui',
        name: 'OpenUI',
        protocol: 'openui',
        profile: 'matched-core',
        variable: 'protocol',
      },
    ];
    benchRequest.settings.repeats = 2;
    benchRequest.settings.parallelism = 4;
    const store = getBenchJobStore();
    const job = store.createJob(benchRequest, 4);

    await runBenchJob(job.id, {
      adapters: {
        a2ui: adapter('a2ui'),
        openui: adapter('openui'),
      },
    });

    expect(order).toEqual([
      '1:a2ui',
      '1:openui',
      '2:openui',
      '2:a2ui',
    ]);
    expect(store.getJob(job.id)?.report?.summary).toMatchObject({
      totalRuns: 4,
      completedRuns: 4,
      failedRuns: 0,
    });
  });

  test('uses each group model and stores the Judge scoring frame for both protocols', async () => {
    const screenshotDataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
    rstest.mocked(probeGenuiBenchUiJudge).mockResolvedValue({
      enabled: true,
      session: {
        bundleUrl: 'https://bundle.example/bench.lynx.js',
        judgeUrl: 'https://judge.example/judge',
      },
    });
    rstest.mocked(runGenuiBenchUiJudge).mockResolvedValue({
      dimensions: geqiDimensions(4),
      errors: [],
      geqiScore: 80,
      score: 4,
      screenshotDataUrl,
      status: 'complete',
      warnings: [],
    });
    const models = new Map<string, string | undefined>();
    const adapter = (
      protocol: 'a2ui' | 'openui',
    ): ProtocolBenchAdapter => ({
      protocol,
      generate(input) {
        models.set(protocol, input.provider.model);
        return Promise.resolve({
          attempts: [{
            index: 1,
            durationMs: 1,
            inputTokens: 2,
            outputTokens: 3,
            totalTokens: 5,
            valid: true,
            validationErrors: [],
            outputChars: 10,
          }],
          finalValid: true,
          finalText: `${protocol} output`,
          finalErrors: [],
          judgePayload: protocol === 'a2ui'
            ? { kind: 'a2ui-messages', messages: [] }
            : { kind: 'openui-text', rawText: 'root = Text("ready")' },
        });
      },
    });
    const benchRequest = request();
    benchRequest.provider.model = 'provider-model';
    benchRequest.groups = [
      {
        ...group,
        id: 'a2ui',
        model: 'a2ui-group-model',
        name: 'A2UI',
        protocol: 'a2ui',
        profile: 'matched-core',
        variable: 'catalog',
      },
      {
        ...group,
        id: 'openui',
        model: 'openui-group-model',
        name: 'OpenUI',
        protocol: 'openui',
        profile: 'matched-core',
        variable: 'custom',
      },
    ];
    const store = getBenchJobStore();
    const job = store.createJob(benchRequest, 2);

    await runBenchJob(job.id, {
      adapters: {
        a2ui: adapter('a2ui'),
        openui: adapter('openui'),
      },
    });

    expect(Object.fromEntries(models)).toEqual({
      a2ui: 'a2ui-group-model',
      openui: 'openui-group-model',
    });
    expect(store.getJob(job.id)?.report?.results).toEqual([
      expect.objectContaining({
        judgeDimensions: geqiDimensions(4),
        judgeGeqiScore: 80,
        protocol: 'a2ui',
        screenshotDataUrl,
      }),
      expect.objectContaining({
        judgeDimensions: geqiDimensions(4),
        judgeGeqiScore: 80,
        protocol: 'openui',
        screenshotDataUrl,
      }),
    ]);
  });

  test('maps an OpenUI matched-core result and redacts provider configuration from public output', async () => {
    const secret = 'must-not-appear-in-report';
    const providerUrl = `https://provider.example/v1?key=${secret}`;
    rstest.mocked(probeGenuiBenchUiJudge).mockResolvedValueOnce({
      enabled: true,
      session: {
        bundleUrl: 'https://bundle.example/openui.lynx.js',
        judgeUrl: 'https://judge.example/judge',
      },
    });
    rstest.mocked(runGenuiBenchUiJudge).mockResolvedValueOnce({
      errors: [],
      reason: `looks good ${secret}`,
      score: 4.5,
      screenshotDataUrl:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
      status: 'complete',
      warnings: [],
    });
    let receivedMaxAttempts = 0;
    const openui: ProtocolBenchAdapter = {
      protocol: 'openui',
      generate(input) {
        receivedMaxAttempts = input.maxAttempts;
        return Promise.resolve({
          attempts: [
            {
              index: 1,
              durationMs: 3,
              inputTokens: 7,
              outputTokens: 3,
              totalTokens: 10,
              valid: false,
              validationErrors: ['repair'],
              outputChars: 5,
            },
            {
              index: 2,
              durationMs: 4,
              inputTokens: 11,
              outputTokens: 4,
              totalTokens: 15,
              valid: true,
              validationErrors: [],
              outputChars: 12,
            },
          ],
          finalValid: true,
          finalText: 'root = Text("ready")',
          finalErrors: [],
          judgePayload: {
            kind: 'openui-text',
            rawText: 'root = Text("ready")',
          },
          metadata: { diagnostic: secret },
        });
      },
    };
    const benchRequest = request();
    benchRequest.provider = {
      apiKey: secret,
      baseURL: providerUrl,
      model: 'same-model',
      api: 'chat',
    };
    benchRequest.groups = [{
      ...group,
      protocol: 'openui',
      profile: 'matched-core',
      variable: 'protocol',
    }];
    benchRequest.settings.maxRepairAttempts = 1;
    const store = getBenchJobStore();
    const job = store.createJob(benchRequest, 1);

    await runBenchJob(job.id, { adapters: { openui } });

    const finished = store.getJob(job.id);
    const report = finished?.report;
    expect(receivedMaxAttempts).toBe(2);
    expect(report?.groups[0]).toMatchObject({
      protocol: 'openui',
      profile: 'matched-core',
    });
    expect(report?.results[0]).toMatchObject({
      protocol: 'openui',
      profile: 'matched-core',
      catalog: 'matched-core',
      tokens: 25,
      attempts: 2,
      judgeScore: 4.5,
      judgeStatus: 'complete',
      screenshotDataUrl:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
    });
    expect(report?.summaries[0]).toMatchObject({
      protocol: 'openui',
      profile: 'matched-core',
      plannedRuns: 1,
    });
    const publicOutput = JSON.stringify({
      report,
      snapshot: store.getSnapshot(job.id),
      events: store.subscribe(job.id, () => undefined)?.events,
    });
    expect(publicOutput).not.toContain(secret);
    expect(publicOutput).not.toContain(encodeURIComponent(secret));
    expect(publicOutput).not.toContain('provider.example');
    expect(publicOutput).not.toContain('"baseURL"');
    expect(publicOutput).not.toContain('"apiKey"');
    const runEvent = store.subscribe(job.id, () => undefined)?.events.find(
      (event) => event.event === 'run-complete',
    );
    expect(runEvent).toBeDefined();
    expect(runEvent?.data).not.toHaveProperty(
      'result.screenshotDataUrl',
    );
    expect(report?.results[0]?.screenshotDataUrl).toBe(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
    );
    expect(finished?.request.provider).toEqual({});
  });

  test('finalizes a failed job and clears provider credentials when adapter initialization throws', async () => {
    const benchRequest = request(false);
    benchRequest.provider = {
      apiKey: 'credential-that-must-be-cleared',
      baseURL: 'https://provider.example/v1',
    };
    benchRequest.groups = [{
      ...group,
      protocol: 'openui',
      profile: 'matched-core',
      variable: 'protocol',
    }];
    const adapters = Object.create(null) as Partial<
      Record<'a2ui' | 'openui', ProtocolBenchAdapter>
    >;
    Object.defineProperty(adapters, 'openui', {
      get() {
        throw new Error(
          'adapter setup failed at https://provider.example/v1',
        );
      },
    });
    const store = getBenchJobStore();
    const job = store.createJob(benchRequest, 1);

    await runBenchJob(job.id, { adapters });

    const finished = store.getJob(job.id);
    expect(finished).toMatchObject({
      status: 'failed',
      workerActive: false,
      request: { provider: {} },
      report: { status: 'failed' },
    });
    expect(JSON.stringify({
      report: finished?.report,
      snapshot: store.getSnapshot(job.id),
      events: store.subscribe(job.id, () => undefined)?.events,
    })).not.toContain('provider.example');
  });

  test('rejects admission when the active-job capacity is full', () => {
    const store = new BenchJobStore({ maxActiveJobs: 1 });
    store.createJob(request(false), 1);

    expect(store.tryCreateJob(request(false), 1)).toEqual({
      ok: false,
      activeJobs: 1,
      limit: 1,
    });
  });

  test('keeps report screenshots within the 8 MiB per-job budget', () => {
    const store = new BenchJobStore();
    const job = store.createJob(request(false), 5);
    const screenshotDataUrl = screenshotDataUrlForBytes(
      MAX_BENCH_SCREENSHOT_DECODED_BYTES,
    );

    for (let index = 0; index < 5; index++) {
      store.addResult(job.id, {
        ...result(`run-${index}`, 'complete', 4),
        screenshotDataUrl,
      });
    }

    const stored = store.getJob(job.id);
    expect(
      stored?.results.slice(0, 4).every((item) =>
        item.screenshotDataUrl === screenshotDataUrl
      ),
    ).toBe(true);
    expect(stored?.results[4]?.screenshotDataUrl).toBeUndefined();
    expect(stored?.results[4]?.judgeWarnings).toContain(
      'UI Judge screenshot for run run-4 exceeded the 8 MiB per-job limit and was discarded.',
    );
    expect(stored?.warnings).toContain(
      'UI Judge screenshot for run run-4 exceeded the 8 MiB per-job limit and was discarded.',
    );
  });

  test('aggregates native A2UI repair tokens and keeps its Judge screenshot', async () => {
    rstest.mocked(probeBenchUiJudge).mockResolvedValueOnce({
      enabled: true,
      session: {
        bundleUrl: 'https://bundle.example/a2ui.lynx.js',
        judgeUrl: 'https://judge.example/judge',
      },
    });
    rstest.mocked(runGenuiBenchUiJudge).mockResolvedValueOnce({
      dimensions: geqiDimensions(4),
      errors: [],
      geqiScore: 80,
      score: 4,
      screenshotDataUrl:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
      status: 'complete',
      warnings: [],
    });
    let callCount = 0;
    let receivedEnableWebSearch: boolean | undefined;
    rstest.mocked(getA2UIAgentService).mockReturnValue({
      generateRaw(_messages: unknown, options: {
        catalog?: { id?: string };
        enableWebSearch?: boolean;
      }) {
        callCount += 1;
        receivedEnableWebSearch = options.enableWebSearch;
        if (callCount === 1) {
          return Promise.resolve({
            text: 'invalid',
            usage: { total_tokens: 5 },
            finishReason: 'stop',
          });
        }
        return Promise.resolve({
          text: JSON.stringify([
            {
              version: 'v0.9',
              createSurface: {
                surfaceId: 'main',
                catalogId: options.catalog?.id,
              },
            },
            {
              version: 'v0.9',
              updateComponents: {
                surfaceId: 'main',
                components: [{
                  id: 'root',
                  component: 'Text',
                  text: 'Ready',
                  variant: 'body',
                }],
              },
            },
          ]),
          usage: { total_tokens: 7 },
          finishReason: 'stop',
        });
      },
    } as unknown as ReturnType<typeof getA2UIAgentService>);
    const benchRequest = request();
    benchRequest.settings.maxRepairAttempts = 1;
    const store = getBenchJobStore();
    const job = store.createJob(benchRequest, 1);

    await runBenchJob(job.id);

    expect(receivedEnableWebSearch).toBe(false);
    expect(store.getJob(job.id)?.report?.results[0]).toMatchObject({
      judgeDimensions: geqiDimensions(4),
      judgeGeqiScore: 80,
      protocol: 'a2ui',
      profile: 'native',
      tokens: 12,
      attempts: 2,
      screenshotDataUrl:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
    });
  });

  test('marks a native A2UI run failed when Judge fails', async () => {
    rstest.mocked(probeBenchUiJudge).mockResolvedValueOnce({
      enabled: true,
      session: {
        bundleUrl: 'https://bundle.example/a2ui.lynx.js',
        judgeUrl: 'https://judge.example/judge',
      },
    });
    rstest.mocked(runGenuiBenchUiJudge).mockResolvedValueOnce({
      dimensions: geqiDimensions(4),
      errors: ['ui-judge visual-aesthetics failed'],
      geqiScore: 80,
      score: 4,
      status: 'failed',
      warnings: [],
    });
    rstest.mocked(getA2UIAgentService).mockReturnValueOnce({
      generateRaw(_messages: unknown, options: {
        catalog?: { id?: string };
      }) {
        return Promise.resolve({
          text: JSON.stringify([
            {
              version: 'v0.9',
              createSurface: {
                surfaceId: 'main',
                catalogId: options.catalog?.id,
              },
            },
            {
              version: 'v0.9',
              updateComponents: {
                surfaceId: 'main',
                components: [{
                  id: 'root',
                  component: 'Text',
                  text: 'Ready',
                  variant: 'body',
                }],
              },
            },
          ]),
          usage: { total_tokens: 7 },
          finishReason: 'stop',
        });
      },
    } as unknown as ReturnType<typeof getA2UIAgentService>);
    const store = getBenchJobStore();
    const job = store.createJob(request(), 1);

    await runBenchJob(job.id);

    const report = store.getJob(job.id)?.report;
    expect(report?.results[0]).toMatchObject({
      error: 'ui-judge visual-aesthetics failed',
      errors: ['ui-judge visual-aesthetics failed'],
      judgeScore: 0,
      judgeStatus: 'failed',
      ok: false,
      profile: 'native',
      status: 'failed',
    });
    expect(report?.results[0]?.judgeDimensions).toBeUndefined();
    expect(report?.results[0]?.judgeGeqiScore).toBeUndefined();
    expect(report?.summary).toMatchObject({
      failedRuns: 1,
      successRate: 0,
    });
  });
});
