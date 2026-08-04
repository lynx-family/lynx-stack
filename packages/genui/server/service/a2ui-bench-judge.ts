// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { readBenchScreenshotDataUrl } from './a2ui-bench-screenshot';
import type { BenchScenarioRequest } from './a2ui-bench-types';
import type { A2UIMessage } from '../agent/a2ui-validator';

const DEFAULT_A2UI_BUNDLE_URL = 'https://lynx-stack.dev/genui/a2ui.lynx.js';
const HEALTH_TIMEOUT_MS = 3_000;
const DEFAULT_OPERATION_TIMEOUT_MS = 60_000;

type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface BenchUiJudgeSession {
  bundleUrl: string;
  judgeUrl: string;
}

export interface BenchUiJudgeCapability {
  enabled: boolean;
  reason?: string;
  session?: BenchUiJudgeSession;
}

export interface BenchUiJudgeResult {
  dimensions?: BenchUiJudgeDimensionResult[];
  errors: string[];
  geqiScore?: number;
  reason?: string;
  score: number;
  screenshotDataUrl?: string;
  status: 'complete' | 'failed';
  summary?: string;
  warnings: string[];
}

export interface BenchUiJudgeDimensionResult {
  dimension: string;
  dimensionLabel: string;
  error?: string;
  reason?: string;
  score: number;
  summary?: string;
  weight: number;
}

interface UiJudgeResponse {
  dimensions?: unknown;
  error?: {
    message?: unknown;
  };
  geqiScore?: unknown;
  reason?: unknown;
  score?: unknown;
  screenshotDataUrl?: unknown;
  summary?: unknown;
}

export interface BenchUiJudgeScenario
  extends Pick<BenchScenarioRequest, 'judgeSteps' | 'judgeTask' | 'prompt'>
{
  id?: string;
  name?: string;
  type?: string;
}

const GEQI_DIMENSION_WEIGHTS = new Map<string, number>([
  ['usability-interaction', 30],
  ['visual-aesthetics', 25],
  ['consistency-standards', 15],
  ['architecture-writing', 15],
]);

interface RunBenchUiJudgeOptions {
  messages: A2UIMessage[];
  scenario: BenchUiJudgeScenario;
  includeScreenshot?: boolean;
  screenshotSettleMs?: number;
  session: BenchUiJudgeSession;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface RunBenchUiJudgeRequestOptions {
  globalProps: Record<string, unknown>;
  scenario: BenchUiJudgeScenario;
  includeScreenshot?: boolean;
  screenshotSettleMs?: number;
  session: BenchUiJudgeSession;
  signal?: AbortSignal;
  timeoutMs?: number;
  warnings?: string[];
}

const RESOURCE_COMPONENTS = new Set([
  'Image',
  'LazyComponent',
  'LineChart',
  'McpApp',
  'PieChart',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeServerUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:')
      || url.username
      || url.password
    ) {
      return null;
    }
    url.hash = '';
    url.search = '';
    if (!url.pathname.endsWith('/')) url.pathname = `${url.pathname}/`;
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeBundleUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (
      !['file:', 'http:', 'https:'].includes(url.protocol)
      || url.username
      || url.password
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readResponseError(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const error = value.error;
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (!isRecord(error)) return undefined;
  return typeof error.message === 'string' && error.message.trim()
    ? error.message.trim()
    : undefined;
}

function sanitizeMessagesForHeadless(
  messages: A2UIMessage[],
): { error?: string; messages: A2UIMessage[]; warnings: string[] } {
  const replacements = new Map<string, number>();
  const sanitized = messages.map((message): A2UIMessage => {
    if (!('updateComponents' in message) || !message.updateComponents) {
      return message;
    }

    let changed = false;
    const components = message.updateComponents.components.map((component) => {
      if (RESOURCE_COMPONENTS.has(component.component)) {
        changed = true;
        replacements.set(
          component.component,
          (replacements.get(component.component) ?? 0) + 1,
        );
        return {
          component: 'Loading',
          id: component.id,
          variant: 'block',
        };
      }
      if (component.component === 'Text' && component.variant === 'markdown') {
        changed = true;
        replacements.set(
          'markdown Text',
          (replacements.get('markdown Text') ?? 0) + 1,
        );
        return {
          ...component,
          variant: 'body',
        };
      }
      return component;
    });

    return changed
      ? {
        ...message,
        updateComponents: {
          ...message.updateComponents,
          components,
        },
      }
      : message;
  });
  const warnings = [...replacements.entries()].map(
    ([component, count]) =>
      `ui-judge replaced ${count} ${component} component${
        count === 1 ? '' : 's'
      } to prevent untrusted resource loading.`,
  );
  return {
    ...(containsOpenUrlCall(sanitized)
      ? {
        error:
          'ui-judge rejected a model-generated openUrl function call to prevent server-side network access.',
      }
      : {}),
    messages: sanitized,
    warnings,
  };
}

function containsOpenUrlCall(
  value: unknown,
  seen = new WeakSet<object>(),
): boolean {
  if (value === null || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (
    isRecord(value)
    && value.call === 'openUrl'
  ) {
    return true;
  }
  return Object.values(value).some((child) => containsOpenUrlCall(child, seen));
}

export async function probeBenchUiJudge(
  options: {
    bundleUrl?: string;
    env?: NodeJS.ProcessEnv;
    expectedModel?: string;
    fetch?: FetchLike;
  } = {},
): Promise<BenchUiJudgeCapability> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetch ?? fetch;
  const rawServerUrl = env.UI_JUDGE_SERVER_URL?.trim();
  if (!rawServerUrl) {
    return {
      enabled: false,
      reason: 'UI_JUDGE_SERVER_URL is not configured.',
    };
  }

  const serverUrl = normalizeServerUrl(rawServerUrl);
  if (!serverUrl) {
    return {
      enabled: false,
      reason: 'UI_JUDGE_SERVER_URL must be an HTTP(S) URL without credentials.',
    };
  }

  const configuredBundleUrl = options.bundleUrl?.trim()
    ?? env.UI_JUDGE_BUNDLE_URL?.trim();
  const rawBundleUrl = configuredBundleUrl !== undefined
      && configuredBundleUrl.length > 0
    ? configuredBundleUrl
    : DEFAULT_A2UI_BUNDLE_URL;
  const bundleUrl = normalizeBundleUrl(rawBundleUrl);
  if (!bundleUrl) {
    return {
      enabled: false,
      reason:
        'UI_JUDGE_BUNDLE_URL must be a file, HTTP, or HTTPS URL without credentials.',
    };
  }

  const healthUrl = new URL('health', serverUrl);
  try {
    const response = await fetchImpl(healthUrl, {
      headers: { Accept: 'application/json' },
      method: 'GET',
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    if (!response.ok) {
      return {
        enabled: false,
        reason: `UI Judge health check returned HTTP ${response.status}.`,
      };
    }
    const body = await readJson(response);
    if (!isRecord(body) || body.status !== 'ok') {
      return {
        enabled: false,
        reason: 'UI Judge health check returned an invalid response.',
      };
    }
    if (options.expectedModel) {
      const actualModel = typeof body.model === 'string'
        ? body.model.trim()
        : '';
      if (actualModel !== options.expectedModel) {
        return {
          enabled: false,
          reason: actualModel
            ? `UI Judge model mismatch: expected ${options.expectedModel}, received ${actualModel}.`
            : `UI Judge health check did not report the required model ${options.expectedModel}.`,
        };
      }
    }
  } catch (error) {
    return {
      enabled: false,
      reason: `UI Judge health check failed: ${toErrorMessage(error)}`,
    };
  }

  return {
    enabled: true,
    session: {
      bundleUrl,
      judgeUrl: new URL('judge', serverUrl).toString(),
    },
  };
}

export async function runBenchUiJudge(
  options: RunBenchUiJudgeOptions,
  fetchImpl: FetchLike = fetch,
): Promise<BenchUiJudgeResult> {
  const sanitized = sanitizeMessagesForHeadless(options.messages);
  if (sanitized.error) {
    return {
      errors: [sanitized.error],
      score: 0,
      status: 'failed',
      warnings: sanitized.warnings,
    };
  }
  return await runBenchUiJudgeRequest(
    {
      globalProps: {
        benchMode: true,
        instant: true,
        messages: sanitized.messages,
        speed: 0,
        theme: 'light',
      },
      ...(options.includeScreenshot ? { includeScreenshot: true } : {}),
      scenario: options.scenario,
      ...(options.screenshotSettleMs === undefined
        ? {}
        : { screenshotSettleMs: options.screenshotSettleMs }),
      session: options.session,
      ...(options.signal ? { signal: options.signal } : {}),
      ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {}),
      warnings: sanitized.warnings,
    },
    fetchImpl,
  );
}

export async function runBenchUiJudgeRequest(
  options: RunBenchUiJudgeRequestOptions,
  fetchImpl: FetchLike = fetch,
): Promise<BenchUiJudgeResult> {
  const warnings = options.warnings ?? [];
  const operationTimeoutMs = options.timeoutMs
    ?? DEFAULT_OPERATION_TIMEOUT_MS;
  const requestTimeoutMs = operationTimeoutMs
    * ((options.scenario.judgeSteps?.length ?? 0) + 4);
  const timeoutSignal = AbortSignal.timeout(requestTimeoutMs);
  const requestSignal = options.signal
    ? AbortSignal.any([options.signal, timeoutSignal])
    : timeoutSignal;
  if (options.signal?.aborted) {
    return {
      errors: [],
      score: 0,
      status: 'failed',
      warnings,
    };
  }
  const body = {
    globalProps: options.globalProps,
    includeGeqi: true,
    ...(options.includeScreenshot ? { includeScreenshot: true } : {}),
    ...(options.screenshotSettleMs === undefined
      ? {}
      : { screenshotSettleMs: options.screenshotSettleMs }),
    steps: options.scenario.judgeSteps ?? [],
    task: options.scenario.judgeTask ?? options.scenario.prompt,
    ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {}),
    url: options.session.bundleUrl,
  };

  let response: Response;
  try {
    response = await fetchImpl(options.session.judgeUrl, {
      body: JSON.stringify(body),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
      signal: requestSignal,
    });
  } catch (error) {
    if (options.signal?.aborted) {
      return {
        errors: [],
        score: 0,
        status: 'failed',
        warnings,
      };
    }
    return {
      errors: [`ui-judge request failed: ${toErrorMessage(error)}`],
      score: 0,
      status: 'failed',
      warnings,
    };
  }

  const payload = await readJson(response);
  if (!response.ok) {
    const detail = readResponseError(payload);
    return {
      errors: [
        `ui-judge request returned HTTP ${response.status}${
          detail ? `: ${detail}` : ''
        }`,
      ],
      score: 0,
      status: 'failed',
      warnings,
    };
  }

  if (!isRecord(payload)) {
    return {
      errors: ['ui-judge returned an invalid JSON response.'],
      score: 0,
      status: 'failed',
      warnings,
    };
  }
  const result = payload as UiJudgeResponse;
  const errors: string[] = [];
  const responseError = readResponseError(payload);
  if (responseError) errors.push(`ui-judge failed: ${responseError}`);

  const score = typeof result.score === 'number'
      && Number.isInteger(result.score)
      && result.score >= 0
      && result.score <= 5
    ? result.score
    : 0;
  if (
    typeof result.score !== 'number'
    || !Number.isInteger(result.score)
    || result.score < 0
    || result.score > 5
  ) {
    errors.push('ui-judge returned an invalid score.');
  }

  const dimensions = responseError
    ? undefined
    : parseGeqiDimensions(result.dimensions, errors);
  const geqiScore = responseError
    ? undefined
    : parseGeqiScore(result.geqiScore, dimensions, errors);

  const reason = typeof result.reason === 'string' && result.reason.trim()
    ? result.reason.trim()
    : undefined;
  const summary = typeof result.summary === 'string' && result.summary.trim()
    ? result.summary.trim()
    : undefined;
  const screenshotDataUrl = readBenchScreenshotDataUrl(
    result.screenshotDataUrl,
  );
  const resultWarnings = [...warnings];
  if (
    options.includeScreenshot
    && result.screenshotDataUrl !== undefined
    && !screenshotDataUrl
  ) {
    resultWarnings.push(
      'ui-judge returned an invalid screenshotDataUrl; the screenshot was discarded.',
    );
  }

  return {
    ...(dimensions ? { dimensions } : {}),
    errors,
    ...(geqiScore === undefined ? {} : { geqiScore }),
    ...(reason ? { reason } : {}),
    score: responseError ? 0 : score,
    ...(screenshotDataUrl ? { screenshotDataUrl } : {}),
    status: errors.length === 0 ? 'complete' : 'failed',
    ...(summary ? { summary } : {}),
    warnings: resultWarnings,
  };
}

function parseGeqiDimensions(
  value: unknown,
  errors: string[],
): BenchUiJudgeDimensionResult[] | undefined {
  if (!Array.isArray(value)) {
    errors.push('ui-judge returned no GEQI dimensions.');
    return undefined;
  }

  const dimensions: BenchUiJudgeDimensionResult[] = [];
  const seen = new Set<string>();
  for (const rawDimension of value) {
    if (!isRecord(rawDimension)) {
      errors.push('ui-judge returned an invalid GEQI dimension result.');
      continue;
    }
    const dimension = typeof rawDimension.dimension === 'string'
      ? rawDimension.dimension
      : '';
    const expectedWeight = GEQI_DIMENSION_WEIGHTS.get(dimension);
    if (expectedWeight === undefined || seen.has(dimension)) {
      errors.push(
        `ui-judge returned an unknown or duplicate GEQI dimension: ${
          dimension || 'missing'
        }.`,
      );
      continue;
    }
    seen.add(dimension);

    const score = rawDimension.score;
    const weight = rawDimension.weight;
    if (
      typeof score !== 'number'
      || !Number.isInteger(score)
      || score < 0
      || score > 5
      || weight !== expectedWeight
    ) {
      errors.push(`ui-judge returned invalid ${dimension} score metadata.`);
      continue;
    }

    const dimensionError = readResponseError(rawDimension);
    if (dimensionError) {
      errors.push(`ui-judge ${dimension} failed: ${dimensionError}`);
    }
    const dimensionLabel = typeof rawDimension.dimensionLabel === 'string'
        && rawDimension.dimensionLabel.trim()
      ? rawDimension.dimensionLabel.trim()
      : dimension;
    const reason = typeof rawDimension.reason === 'string'
        && rawDimension.reason.trim()
      ? rawDimension.reason.trim()
      : undefined;
    const summary = typeof rawDimension.summary === 'string'
        && rawDimension.summary.trim()
      ? rawDimension.summary.trim()
      : undefined;
    dimensions.push({
      dimension,
      dimensionLabel,
      ...(dimensionError ? { error: dimensionError } : {}),
      ...(reason ? { reason } : {}),
      score,
      ...(summary ? { summary } : {}),
      weight,
    });
  }

  for (const dimension of GEQI_DIMENSION_WEIGHTS.keys()) {
    if (!seen.has(dimension)) {
      errors.push(`ui-judge response is missing GEQI dimension ${dimension}.`);
    }
  }
  return dimensions;
}

function parseGeqiScore(
  value: unknown,
  dimensions: BenchUiJudgeDimensionResult[] | undefined,
  errors: string[],
): number | undefined {
  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
    || value < 0
    || value > 100
  ) {
    errors.push('ui-judge returned an invalid GEQI score.');
    return undefined;
  }
  if (!dimensions || dimensions.length !== GEQI_DIMENSION_WEIGHTS.size) {
    return value;
  }

  const totalWeight = dimensions.reduce(
    (sum, dimension) => sum + dimension.weight,
    0,
  );
  const calculated = dimensions.reduce(
    (sum, dimension) => sum + (dimension.score / 5) * dimension.weight,
    0,
  ) / totalWeight * 100;
  if (Math.abs(calculated - value) > 1e-6) {
    errors.push(
      `ui-judge returned an inconsistent GEQI score: ${value} vs ${calculated}.`,
    );
  }
  return value;
}
