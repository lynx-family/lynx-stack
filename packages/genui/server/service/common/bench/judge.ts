// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { BenchJudgeScheduling } from './concurrency.js';
import type { BenchProtocol } from './protocol-types.js';
import type { BenchScenarioRequest } from './types.js';
import type { A2UIMessage } from '../../../agent/a2ui/a2ui-validator.js';
import {
  resolveBenchUiJudge,
  runBenchUiJudge,
  runBenchUiJudgeRequest,
} from '../../a2ui/a2ui-bench-judge.js';
import type {
  BenchScreenshotCapture,
  BenchUiJudgeCapability,
  BenchUiJudgeResult,
} from '../../a2ui/a2ui-bench-judge.js';

const DEFAULT_OPENUI_ZIP_URL = 'https://lynx-stack.dev/genui/openui.lynx.zip';
const DEFAULT_UI_JUDGE_ATTEMPT_COUNT = 2;
const DEFAULT_UI_JUDGE_RETRY_DELAY_MS = 5_000;
const UNSAFE_OPENUI_RESOURCE_URL =
  /(?:^|[\s("'=])(?:data|file|https?):(?:\/\/)?/iu;
const UNSAFE_OPENUI_HOST_CALL = /\bopenUrl\s*\(/u;

export type GenuiBenchProtocol = BenchProtocol;

export type GenuiBenchJudgeArtifact =
  | { messages: A2UIMessage[]; protocol: 'a2ui' }
  | { protocol: 'openui' | 'lynx-xml' | 'html'; rawText: string };

export interface RunGenuiBenchUiJudgeOptions {
  model?: string;
  artifact: GenuiBenchJudgeArtifact;
  scenario: Pick<
    BenchScenarioRequest,
    'judgeSteps' | 'judgeTask' | 'prompt'
  >;
  session: NonNullable<BenchUiJudgeCapability['session']>;
  signal?: AbortSignal;
  timeoutMs?: number;
  scheduling?: BenchJudgeScheduling;
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

export async function resolveGenuiBenchUiJudge(
  protocol: GenuiBenchProtocol,
  options: {
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<BenchUiJudgeCapability> {
  if (protocol === 'html') {
    return { enabled: true, session: { screenshotPath: 'browser/html' } };
  }
  const env = options.env ?? process.env;
  const zipUrl = protocol === 'a2ui'
    ? env.UI_JUDGE_A2UI_ZIP_URL?.trim()
      ?? env.UI_JUDGE_ZIP_URL?.trim()
    : env.UI_JUDGE_OPENUI_ZIP_URL?.trim()
      ?? DEFAULT_OPENUI_ZIP_URL;
  return await resolveBenchUiJudge({
    ...(protocol === 'lynx-xml' ? { sourceKind: 'lynx-xml' as const } : {}),
    ...(zipUrl ? { zipUrl } : {}),
    env,
  });
}

export async function runGenuiBenchUiJudge(
  options: RunGenuiBenchUiJudgeOptions,
  captureScreenshot: BenchScreenshotCapture,
): Promise<BenchUiJudgeResult> {
  if (options.artifact.protocol === 'a2ui') {
    const messages = options.artifact.messages;
    return await runWithBoundedRetry(
      options,
      () =>
        runBenchUiJudge(
          {
            model: options.model,
            includeScreenshot: true,
            messages,
            scenario: options.scenario,
            session: options.session,
            scheduling: options.scheduling,
            ...(options.signal ? { signal: options.signal } : {}),
            ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {}),
          },
          captureScreenshot,
        ),
    );
  }

  const rawText = options.artifact.rawText;
  if (
    options.artifact.protocol !== 'html'
    && (UNSAFE_OPENUI_RESOURCE_URL.test(rawText)
      || UNSAFE_OPENUI_HOST_CALL.test(rawText))
  ) {
    return {
      errors: [
        `ui-judge rejected ${
          options.artifact.protocol === 'lynx-xml' ? 'Lynx XML' : 'OpenUI'
        } output containing an external resource URL or openUrl call.`,
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
          model: options.model,
          ...(options.artifact.protocol === 'lynx-xml'
            ? { lynxXmlSource: rawText }
            : {}),
          ...(options.artifact.protocol === 'html'
            ? { htmlSource: rawText }
            : {}),
          globalProps: {
            benchMode: true,
            instant: true,
            rawText,
            speed: 0,
            theme: 'light',
          },
          includeScreenshot: true,
          scenario: options.scenario,
          session: options.session,
          scheduling: options.scheduling,
          ...(options.signal ? { signal: options.signal } : {}),
          ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {}),
        },
        captureScreenshot,
      ),
  );
}
