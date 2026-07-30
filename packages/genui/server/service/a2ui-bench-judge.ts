// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

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
  errors: string[];
  reason?: string;
  score: number;
  status: 'complete' | 'failed';
  summary?: string;
  warnings: string[];
}

interface UiJudgeResponse {
  error?: {
    message?: unknown;
  };
  reason?: unknown;
  score?: unknown;
  summary?: unknown;
}

interface RunBenchUiJudgeOptions {
  messages: A2UIMessage[];
  scenario: BenchScenarioRequest;
  session: BenchUiJudgeSession;
  signal?: AbortSignal;
  timeoutMs?: number;
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
    env?: NodeJS.ProcessEnv;
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

  const configuredBundleUrl = env.UI_JUDGE_BUNDLE_URL?.trim();
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
      warnings: sanitized.warnings,
    };
  }
  const body = {
    globalProps: {
      instant: true,
      messages: sanitized.messages,
      speed: 0,
      theme: 'light',
    },
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
        warnings: sanitized.warnings,
      };
    }
    return {
      errors: [`ui-judge request failed: ${toErrorMessage(error)}`],
      score: 0,
      status: 'failed',
      warnings: sanitized.warnings,
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
      warnings: sanitized.warnings,
    };
  }

  if (!isRecord(payload)) {
    return {
      errors: ['ui-judge returned an invalid JSON response.'],
      score: 0,
      status: 'failed',
      warnings: sanitized.warnings,
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

  const reason = typeof result.reason === 'string' && result.reason.trim()
    ? result.reason.trim()
    : undefined;
  const summary = typeof result.summary === 'string' && result.summary.trim()
    ? result.summary.trim()
    : undefined;

  return {
    errors,
    ...(reason ? { reason } : {}),
    score: errors.length === 0 ? score : 0,
    status: errors.length === 0 ? 'complete' : 'failed',
    ...(summary ? { summary } : {}),
    warnings: sanitized.warnings,
  };
}
