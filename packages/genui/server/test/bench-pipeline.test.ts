// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  rstest,
  test,
} from '@rstest/core';

import type { ScreenshotEvaluation } from '../agent/common/ui-judge-agent.js';
import { evaluateScreenshot } from '../agent/common/ui-judge-agent.js';
import * as actualJudge from '../agent/common/ui-judge-agent.js' with {
  rstest: 'importActual',
};
import { getA2UIAgentService } from '../service/a2ui/a2ui-agent.js';
import { BenchTaskPool } from '../service/common/bench/concurrency.js';
import type {
  ProtocolBenchAdapter,
  ProtocolBenchRunArtifact,
} from '../service/common/bench/protocol-adapter.js';
import { runBenchJob } from '../service/common/bench/runner.js';
import { getBenchJobStore } from '../service/common/bench/store.js';
import type {
  BenchJobRequest,
  BenchProfile,
  BenchProtocol,
} from '../service/common/bench/types.js';

rstest.mock('../agent/common/ui-judge-agent.js', () => ({
  ...actualJudge,
  evaluateScreenshot: rstest.fn(),
}));
rstest.mock('../service/a2ui/a2ui-agent.js', { mock: true });

const BMP = Buffer.from(
  'Qk2KAAAAAAAAAHoAAABsAAAAAgAAAP7///8BACAAAwAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AAD/AAD/AAAAAAAA/0JHUnMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP//AP8AgP8AAAA8KBT/',
  'base64',
);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function score(value: number): ScreenshotEvaluation {
  return {
    score: value,
    geqiScore: value * 20,
    reason: 'Measured',
    summary: 'Measured',
    dimensions: actualJudge.JUDGE_DIMENSIONS.slice(1).map((dimension) => ({
      dimension: dimension.id,
      dimensionLabel: dimension.title,
      weight: dimension.weight,
      score: value,
      reason: 'Measured',
      summary: 'Measured',
    })),
  };
}

function request(
  protocol: BenchProtocol,
  profile: BenchProfile,
  groups = 2,
): BenchJobRequest {
  return {
    groups: Array.from({ length: groups }, (_, index) => ({
      id: `group-${index}`,
      name: `Group ${index}`,
      enabled: true,
      role: index === 0 ? 'control' : 'experiment',
      variable: 'model',
      protocol,
      profile,
      model: `model-${index}`,
    })),
    provider: {},
    scenarios: [{
      id: 'card',
      name: 'Card',
      prompt: 'Build a card',
      type: 'Information',
    }],
    settings: {
      judgeEnabled: true,
      maxRepairAttempts: 0,
      renderMetricsEnabled: false,
      repairEnabled: false,
      repeats: 1,
    },
  };
}

function artifact(protocol: BenchProtocol): ProtocolBenchRunArtifact {
  const judgePayloads = {
    a2ui: { kind: 'a2ui-messages', messages: [] },
    openui: { kind: 'openui-text', rawText: 'root = Text("Ready")' },
    'lynx-xml': {
      kind: 'lynx-xml-source',
      rawText: '<!doctype lynx><lynx><script thread="main"></script></lynx>',
    },
    html: {
      kind: 'html-source',
      rawText: '<!doctype html><html><body>Ready</body></html>',
    },
  } satisfies Record<BenchProtocol, ProtocolBenchRunArtifact['judgePayload']>;
  return {
    attempts: [{
      index: 1,
      durationMs: 10,
      inputTokens: 2,
      outputTokens: 3,
      totalTokens: 5,
      valid: true,
      validationErrors: [],
      outputChars: 10,
    }],
    finalValid: true,
    finalText: 'Generated source',
    finalErrors: [],
    judgePayload: judgePayloads[protocol],
  };
}

function uploadNext(jobId: string): void {
  const store = getBenchJobStore();
  const captureId = store.getJob(jobId)?.screenshots.keys().next().value;
  expect(captureId).toBeDefined();
  store.startScreenshot(jobId, captureId!);
  expect(store.submitScreenshot(
    jobId,
    captureId!,
    new Response(BMP, {
      headers: { 'content-type': 'image/bmp' },
    }),
  )).toBe(true);
}

beforeEach(() => {
  rstest.resetAllMocks();
});
afterEach(() => {
  rstest.restoreAllMocks();
});

describe('Bench generation, capture and scoring pipeline', () => {
  test('one group keeps generating and announcing screenshot tasks until its in-flight limit is reached', async () => {
    const benchRequest = request('lynx-xml', 'native', 1);
    benchRequest.settings.repeats = 6;
    const generate = rstest.fn(() => Promise.resolve(artifact('lynx-xml')));
    rstest.mocked(evaluateScreenshot).mockResolvedValue(score(4));
    const store = getBenchJobStore();
    const job = store.createJob(benchRequest, 6);
    const running = runBenchJob(job.id, {
      adapters: { 'lynx-xml': { protocol: 'lynx-xml', generate } },
    });
    try {
      await rstest.waitUntil(() => job.screenshots.size === 4);
      expect(generate).toHaveBeenCalledTimes(4);
      expect(evaluateScreenshot).not.toHaveBeenCalled();
      expect(job.progress.runs?.map(run => run.phase)).toEqual([
        'screenshot-queued',
        'screenshot-queued',
        'screenshot-queued',
        'screenshot-queued',
        'queued',
        'queued',
      ]);
      expect(
        job.events.filter((event) => event.event === 'screenshot-requested'),
      ).toHaveLength(4);
      for (let index = 0; index < 6; index++) {
        await rstest.waitUntil(() => job.screenshots.size > 0);
        uploadNext(job.id);
      }
      await running;
      expect(job.report?.summary).toMatchObject({
        completedRuns: 6,
        failedRuns: 0,
      });
      expect(
        job.events.filter((event) => event.event === 'screenshot-requested'),
      ).toHaveLength(6);
    } finally {
      store.cancelJob(job.id);
      await running;
    }
  });

  test.each(
    [
      ['a2ui', 'native'],
      ['a2ui', 'matched-core'],
      ['openui', 'matched-core'],
      ['lynx-xml', 'native'],
      ['html', 'native'],
    ] as const,
  )(
    'overlaps stages and waits for all scores for %s/%s',
    async (protocol, profile) => {
      let now = 0;
      let generations = 0;
      const generationGate = deferred<void>();
      rstest.spyOn(performance, 'now').mockImplementation(() => now);
      const generate = rstest.fn(async () => {
        generations++;
        await generationGate.promise;
        return artifact(protocol);
      });
      rstest.mocked(getA2UIAgentService).mockReturnValue({
        async generateRaw(
          _messages: unknown,
          options: { catalog?: { id?: string } },
        ) {
          generations++;
          await generationGate.promise;
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
                  components: [
                    {
                      id: 'root',
                      component: 'Text',
                      text: 'Ready',
                      variant: 'body',
                    },
                  ],
                },
              },
            ]),
            usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 },
            finishReason: 'stop',
          });
        },
      } as unknown as ReturnType<typeof getA2UIAgentService>);
      const scores = [
        deferred<ScreenshotEvaluation>(),
        deferred<ScreenshotEvaluation>(),
      ];
      rstest.mocked(evaluateScreenshot)
        .mockImplementationOnce(() => scores[0]!.promise)
        .mockImplementationOnce(() => scores[1]!.promise);
      const store = getBenchJobStore();
      const job = store.createJob(request(protocol, profile), 2);
      const running = runBenchJob(job.id, {
        adapters: { [protocol]: { protocol, generate } },
      });

      await rstest.waitUntil(() => generations === 2);
      expect(job.progress.runs?.map(run => run.generation)).toEqual([
        'running',
        'running',
      ]);
      now = 10;
      generationGate.resolve();
      await rstest.waitUntil(() =>
        generations === 2 && job.screenshots.size === 2
      );
      // Both completed generations are announced before either browser upload.
      expect(job.results).toHaveLength(0);
      expect(job.report).toBeUndefined();
      expect(
        job.events.filter((event) => event.event === 'screenshot-requested'),
      ).toHaveLength(2);
      now = 10_000;
      expect(store.getSnapshot(job.id)).toMatchObject({
        startedAt: job.createdAt,
        durationMs: 10_000,
      });
      uploadNext(job.id);
      await rstest.waitUntil(() =>
        rstest.mocked(evaluateScreenshot).mock.calls.length === 1
        && job.screenshots.size === 1
      );
      expect(job.workerActive).toBe(true);
      expect(job.progress.runs).toMatchObject([
        {
          groupId: 'group-0',
          generation: 'complete',
          screenshot: 'complete',
          judge: 'running',
        },
        {
          groupId: 'group-1',
          generation: 'complete',
          screenshot: 'queued',
          judge: 'pending',
        },
      ]);
      uploadNext(job.id);
      await rstest.waitUntil(() =>
        rstest.mocked(evaluateScreenshot).mock.calls.length === 2
      );
      scores[0]!.resolve(score(4));
      await rstest.waitUntil(() => job.results.length === 1);
      expect(job.report).toBeUndefined();
      scores[1]!.resolve(score(3));
      await running;

      expect(job.report?.status).toBe('complete');
      expect(job.report?.runProgress).toMatchObject([
        {
          groupId: 'group-0',
          phase: 'complete',
          generation: 'complete',
          screenshot: 'complete',
          judge: 'complete',
        },
        {
          groupId: 'group-1',
          phase: 'complete',
          generation: 'complete',
          screenshot: 'complete',
          judge: 'complete',
        },
      ]);
      expect(job.workerActive).toBe(false);
      expect(job.report).toMatchObject({
        startedAt: job.createdAt,
        completedAt: job.updatedAt,
        durationMs: 10_000,
      });
      now = 20_000;
      expect(store.getSnapshot(job.id)).toMatchObject({
        completedAt: job.report?.completedAt,
        durationMs: 10_000,
      });
      expect(job.events.find((event) => event.event === 'report')?.data)
        .toMatchObject({ startedAt: job.createdAt, durationMs: 10_000 });
      expect(
        job.report?.results.map((result) => ({
          model: result.model,
          score: result.judgeScore,
          tokens: result.tokens,
          agentMs: result.agentMs,
        })),
      ).toEqual([
        { model: 'model-0', score: 4, tokens: 5, agentMs: 10 },
        { model: 'model-1', score: 3, tokens: 5, agentMs: 10 },
      ]);
      expect(
        job.report?.results.every((result) =>
          result.screenshotDataUrl?.startsWith('data:image/png;base64,')
        ),
      ).toBe(true);
      expect(job.events.filter((event) => event.event === 'report'))
        .toHaveLength(1);
      expect(job.events.filter((event) => event.event === 'run-complete'))
        .toHaveLength(2);
    },
  );

  test('bounds generation and retained work, cancels queued stages, and drains active scoring', async () => {
    let now = 0;
    rstest.spyOn(performance, 'now').mockImplementation(() => now);
    const benchRequest = request('openui', 'matched-core');
    benchRequest.settings.repeats = 4;
    const generationGate = deferred<void>();
    let activeGeneration = 0;
    let maxGeneration = 0;
    const generate = rstest.fn(async () => {
      maxGeneration = Math.max(maxGeneration, ++activeGeneration);
      await generationGate.promise;
      activeGeneration--;
      return artifact('openui');
    });
    const scoreGate = deferred<ScreenshotEvaluation>();
    const scoreSignals: AbortSignal[] = [];
    rstest.mocked(evaluateScreenshot).mockImplementation((input) => {
      scoreSignals.push(input.signal!);
      return scoreGate.promise;
    });
    const store = getBenchJobStore();
    const job = store.createJob(benchRequest, 8);
    const running = runBenchJob(job.id, {
      adapters: { openui: { protocol: 'openui', generate } },
    });
    await rstest.waitUntil(() => generate.mock.calls.length === 2);
    expect(maxGeneration).toBe(2);
    generationGate.resolve();
    await rstest.waitUntil(() =>
      generate.mock.calls.length === 5 && job.screenshots.size === 5
    );
    uploadNext(job.id);
    await rstest.waitUntil(() =>
      scoreSignals.length === 1 && job.screenshots.size === 4
    );
    uploadNext(job.id);
    await rstest.waitUntil(() =>
      scoreSignals.length === 2 && job.screenshots.size === 3
    );
    uploadNext(job.id);
    await rstest.waitUntil(() => job.screenshots.size === 2);
    expect(generate).toHaveBeenCalledTimes(5);
    expect(evaluateScreenshot).toHaveBeenCalledTimes(2);

    now = 10_000;
    store.cancelJob(job.id);
    expect(scoreSignals.every((signal) => signal.aborted)).toBe(true);
    expect(job.screenshots.size).toBe(0);
    expect(job.report).toBeUndefined();
    expect(job.workerActive).toBe(true);
    now = 12_000;
    expect(store.getSnapshot(job.id)?.durationMs).toBe(12_000);
    scoreGate.resolve(score(4));
    await running;
    expect(generate).toHaveBeenCalledTimes(5);
    expect(evaluateScreenshot).toHaveBeenCalledTimes(2);
    expect(job.report?.status).toBe('cancelled');
    expect(job.report?.runProgress?.every(run => run.phase === 'cancelled'))
      .toBe(true);
    expect(job.report?.runProgress?.some(run => run.generation === 'cancelled'))
      .toBe(true);
    expect(job.report?.durationMs).toBe(12_000);
    expect(job.report?.results).toEqual([]);
    expect(job.workerActive).toBe(false);
    expect(job.events.filter((event) => event.event === 'screenshot-requested'))
      .toHaveLength(5);
    expect(job.events.filter((event) => event.event === 'report')).toHaveLength(
      1,
    );
    expect(
      job.events.some((event) =>
        event.event === 'run-complete' || event.event === 'run-error'
      ),
    ).toBe(false);
  });
  test('drains sibling generation before reporting an unexpected pipeline failure', async () => {
    let now = 0;
    rstest.spyOn(performance, 'now').mockImplementation(() => now);
    const generationGate = deferred<void>();
    let siblingSignal: AbortSignal | undefined;
    const generate = rstest.fn<ProtocolBenchAdapter['generate']>(
      async (input, signal) => {
        if (input.provider.model === 'model-1') {
          siblingSignal = signal;
          await generationGate.promise;
        }
        return artifact('openui');
      },
    );
    rstest.mocked(evaluateScreenshot).mockResolvedValue(score(4));
    const store = getBenchJobStore();
    const job = store.createJob(request('openui', 'matched-core'), 2);
    const running = runBenchJob(job.id, {
      adapters: { openui: { protocol: 'openui', generate } },
    });
    await rstest.waitUntil(() =>
      siblingSignal !== undefined && job.screenshots.size === 1
    );
    rstest.spyOn(store, 'addResult').mockImplementationOnce(() => {
      throw new Error('Result storage failed');
    });
    uploadNext(job.id);
    await rstest.waitUntil(() => siblingSignal?.aborted);
    expect(job.report).toBeUndefined();
    expect(job.workerActive).toBe(true);
    now = 9000;
    generationGate.resolve();
    await running;
    expect(job.report?.status).toBe('failed');
    expect(job.report?.durationMs).toBe(9000);
    expect(job.workerActive).toBe(false);
    expect(job.request.provider).toEqual({});
    expect(job.events.filter((event) => event.event === 'report')).toHaveLength(
      1,
    );
  });

  test('shares eight generation slots across jobs and removes cancelled group workers from the queue', async () => {
    const generationGate = deferred<void>();
    const firstGenerate = rstest.fn(async () => {
      await generationGate.promise;
      return artifact('openui');
    });
    const nextGenerate = rstest.fn(async () => {
      await generationGate.promise;
      return artifact('openui');
    });
    const firstRequest = request('openui', 'matched-core', 8);
    firstRequest.settings.judgeEnabled = false;
    const nextRequest = request('openui', 'matched-core', 8);
    nextRequest.settings.judgeEnabled = false;
    const store = getBenchJobStore();
    const first = store.createJob(firstRequest, 8);
    const firstRun = runBenchJob(first.id, {
      adapters: { openui: { protocol: 'openui', generate: firstGenerate } },
    });
    let nextRun: Promise<void> | undefined;
    try {
      await rstest.waitUntil(() => firstGenerate.mock.calls.length === 8);
      const next = store.createJob(nextRequest, 8);
      nextRun = runBenchJob(next.id, {
        adapters: { openui: { protocol: 'openui', generate: nextGenerate } },
      });
      // All admission microtasks settle while the first job holds the slots.
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(nextGenerate).not.toHaveBeenCalled();
      store.cancelJob(next.id);
      await nextRun;
      expect(next.report?.status).toBe('cancelled');
      expect(first.abortController.signal.aborted).toBe(false);
    } finally {
      generationGate.resolve();
      await Promise.all([firstRun, nextRun]);
    }
    expect(nextGenerate).not.toHaveBeenCalled();
    expect(first.report?.summary).toMatchObject({
      completedRuns: 8,
      failedRuns: 0,
    });
  });

  test('shares two scoring slots across jobs and retains slots until aborted scoring settles', async () => {
    const scoreGates = Array.from(
      { length: 3 },
      () => deferred<ScreenshotEvaluation>(),
    );
    const scoreSignals: AbortSignal[] = [];
    rstest.mocked(evaluateScreenshot).mockImplementation((input) => {
      const gate = scoreGates[scoreSignals.length]!;
      scoreSignals.push(input.signal!);
      return gate.promise;
    });
    const store = getBenchJobStore();
    const jobs = Array.from(
      { length: 3 },
      () => store.createJob(request('openui', 'matched-core', 1), 1),
    );
    const runs = jobs.map((job) =>
      runBenchJob(job.id, {
        adapters: {
          openui: {
            protocol: 'openui',
            generate: () => Promise.resolve(artifact('openui')),
          },
        },
      })
    );
    try {
      for (let index = 0; index < jobs.length; index++) {
        const job = jobs[index]!;
        await rstest.waitUntil(() => job.screenshots.size === 1);
        uploadNext(job.id);
        if (index < 2) {
          await rstest.waitUntil(() => scoreSignals.length === index + 1);
        }
      }
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(scoreSignals).toHaveLength(2);
      store.cancelJob(jobs[0]!.id);
      expect(scoreSignals[0]?.aborted).toBe(true);
      expect(scoreSignals[1]?.aborted).toBe(false);
      expect(jobs[0]?.report).toBeUndefined();
      expect(scoreSignals).toHaveLength(2);
      scoreGates[0]!.resolve(score(4));
      await rstest.waitUntil(() => scoreSignals.length === 3);
    } finally {
      scoreGates.forEach((gate) => gate.resolve(score(4)));
      await Promise.all(runs);
    }
    expect(jobs.map((job) => job.report?.status)).toEqual([
      'cancelled',
      'complete',
      'complete',
    ]);
  });
});

test('pool removes cancelled waiters and retains active slots until work settles', async () => {
  const pool = new BenchTaskPool(1);
  const active = deferred<void>();
  const started = deferred<void>();
  const controller = new AbortController();
  const task = rstest.fn(() => Promise.resolve());
  const first = pool.run(() => {
    started.resolve();
    return active.promise;
  }, controller.signal);
  const second = pool.run(task, controller.signal).catch((error: unknown) =>
    error
  );
  await started.promise;
  controller.abort();
  await second;
  const third = pool.run(task);
  await Promise.resolve();
  expect(task).not.toHaveBeenCalled();
  active.resolve();
  await Promise.all([first, third]);
  expect(task).toHaveBeenCalledTimes(1);
});
