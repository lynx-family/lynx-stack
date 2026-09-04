// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  probeBenchUiJudge,
  runBenchUiJudge,
  runBenchUiJudgeRequest,
} from './a2ui-bench-judge';
import type {
  BenchUiJudgeCapability,
  BenchUiJudgeResult,
} from './a2ui-bench-judge';
import type { BenchScenarioRequest } from './a2ui-bench-types';
import type { A2UIMessage } from '../agent/a2ui-validator';

const DEFAULT_OPENUI_BUNDLE_URL = 'https://lynx-stack.dev/genui/openui.lynx.js';
const DEFAULT_UI_JUDGE_ATTEMPT_COUNT = 2;
const DEFAULT_UI_JUDGE_RETRY_DELAY_MS = 5_000;
const SCREENSHOT_SETTLE_MS = 1_000;
const UNSAFE_OPENUI_RESOURCE_URL =
  /(?:^|[\s("'=])(?:data|file|https?):(?:\/\/)?/iu;
const UNSAFE_OPENUI_HOST_CALL = /\bopenUrl\s*\(/u;

export type GenuiBenchProtocol = 'a2ui' | 'openui';
type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export type GenuiBenchJudgeArtifact =
  | { messages: A2UIMessage[]; protocol: 'a2ui' }
  | { protocol: 'openui'; rawText: string };

export interface RunGenuiBenchUiJudgeOptions {
  artifact: GenuiBenchJudgeArtifact;
  scenario: Pick<
    BenchScenarioRequest,
    'judgeSteps' | 'judgeTask' | 'prompt'
  >;
  session: NonNullable<BenchUiJudgeCapability['session']>;
  signal?: AbortSignal;
  timeoutMs?: number;
  /**
   * Test seam for the bounded sidecar retry. Values are clamped to 1–2.
   */
  attemptCount?: number;
  /**
   * Test seam for the retry backoff. Production callers use the 5s default.
   */
  retryDelayMs?: number;
}

function normalizedAttemptCount(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_UI_JUDGE_ATTEMPT_COUNT;
  }
  return Math.min(
    DEFAULT_UI_JUDGE_ATTEMPT_COUNT,
    Math.max(1, Math.floor(value)),
  );
}

function normalizedRetryDelayMs(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_UI_JUDGE_RETRY_DELAY_MS;
  }
  return Math.min(
    DEFAULT_UI_JUDGE_RETRY_DELAY_MS,
    Math.max(0, Math.floor(value)),
  );
}

async function waitForRetry(
  delayMs: number,
  signal: AbortSignal | undefined,
): Promise<boolean> {
  if (signal?.aborted) return false;
  if (delayMs === 0) return true;

  return await new Promise<boolean>((resolve) => {
    const onAbort = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      resolve(false);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve(true);
    }, delayMs);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function isLocalSafetyRejection(result: BenchUiJudgeResult): boolean {
  return result.errors.some((error) => error.startsWith('ui-judge rejected '));
}

function isSafetyWarning(warning: string): boolean {
  return warning.startsWith('ui-judge replaced ')
    && warning.endsWith(' to prevent untrusted resource loading.');
}

async function runWithBoundedRetry(
  options: Pick<
    RunGenuiBenchUiJudgeOptions,
    'attemptCount' | 'retryDelayMs' | 'signal'
  >,
  run: () => Promise<BenchUiJudgeResult>,
): Promise<BenchUiJudgeResult> {
  const attemptCount = normalizedAttemptCount(options.attemptCount);
  const retryDelayMs = normalizedRetryDelayMs(options.retryDelayMs);
  const safetyWarnings = new Set<string>();
  let result = await run();
  result.warnings.filter((warning) => isSafetyWarning(warning)).forEach((
    warning,
  ) => safetyWarnings.add(warning));

  for (
    let attempt = 1;
    attempt < attemptCount && result.status === 'failed';
    attempt++
  ) {
    if (isLocalSafetyRejection(result)) break;
    if (!await waitForRetry(retryDelayMs, options.signal)) break;

    result = await run();
    result.warnings.filter((warning) => isSafetyWarning(warning)).forEach((
      warning,
    ) => safetyWarnings.add(warning));
  }

  return {
    ...result,
    warnings: [
      ...safetyWarnings,
      ...result.warnings.filter((warning) => !safetyWarnings.has(warning)),
    ],
  };
}

export async function probeGenuiBenchUiJudge(
  protocol: GenuiBenchProtocol,
  options: {
    env?: NodeJS.ProcessEnv;
    fetch?: FetchLike;
    serverUrl?: string;
  } = {},
): Promise<BenchUiJudgeCapability> {
  const env = options.env ?? process.env;
  const bundleUrl = protocol === 'a2ui'
    ? env.UI_JUDGE_A2UI_BUNDLE_URL?.trim()
      ?? env.UI_JUDGE_BUNDLE_URL?.trim()
    : env.UI_JUDGE_OPENUI_BUNDLE_URL?.trim()
      ?? DEFAULT_OPENUI_BUNDLE_URL;
  return await probeBenchUiJudge({
    ...(bundleUrl ? { bundleUrl } : {}),
    env,
    ...(options.fetch ? { fetch: options.fetch } : {}),
    ...(options.serverUrl ? { serverUrl: options.serverUrl } : {}),
  });
}

export async function runGenuiBenchUiJudge(
  options: RunGenuiBenchUiJudgeOptions,
  fetchImpl: FetchLike = fetch,
): Promise<BenchUiJudgeResult> {
  if (options.artifact.protocol === 'a2ui') {
    const messages = options.artifact.messages;
    return await runWithBoundedRetry(
      options,
      () =>
        runBenchUiJudge(
          {
            includeScreenshot: true,
            messages,
            scenario: options.scenario,
            screenshotSettleMs: SCREENSHOT_SETTLE_MS,
            session: options.session,
            ...(options.signal ? { signal: options.signal } : {}),
            ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {}),
          },
          fetchImpl,
        ),
    );
  }

  const rawText = options.artifact.rawText;
  if (
    UNSAFE_OPENUI_RESOURCE_URL.test(rawText)
    || UNSAFE_OPENUI_HOST_CALL.test(rawText)
  ) {
    return {
      errors: [
        'ui-judge rejected OpenUI output containing an external resource URL or openUrl call.',
      ],
      score: 0,
      status: 'failed',
      warnings: [],
    };
  }

  return await runWithBoundedRetry(
    options,
    () =>
      runBenchUiJudgeRequest(
        {
          globalProps: {
            benchMode: true,
            instant: true,
            rawText,
            speed: 0,
            theme: 'light',
          },
          includeScreenshot: true,
          scenario: options.scenario,
          screenshotSettleMs: SCREENSHOT_SETTLE_MS,
          session: options.session,
          ...(options.signal ? { signal: options.signal } : {}),
          ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {}),
        },
        fetchImpl,
      ),
  );
}
