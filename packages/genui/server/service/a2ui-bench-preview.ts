// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createServer as createHttpServer } from 'node:http';

import type { Browser, LaunchOptions } from 'playwright-core';

import type { BenchJobRequest, BenchScenarioRequest } from './a2ui-bench-types';
import type { A2UIMessage } from '../agent/a2ui-validator';

interface BenchPreviewOptions {
  messages: A2UIMessage[];
  request: BenchJobRequest;
  runId: string;
  scenario: BenchScenarioRequest;
}

interface BenchPreviewResult {
  errors: string[];
  fmpMs: number;
  judgeScore: number;
  renderMs: number;
  screenshotDataUrl?: string;
  ttiMs: number;
}

interface PreviewMetricBag {
  fcp?: unknown;
  fmp?: unknown;
  render?: unknown;
  tti?: unknown;
}

interface JudgeEnv {
  apiKey?: string;
  baseURL?: string;
  model?: string;
}

interface ResolvedJudgeEnv {
  apiKey: string;
  baseURL?: string;
  model?: string;
}

interface JudgeProxy {
  baseUrl: string;
  close: () => Promise<void>;
}

const DEFAULT_PLAYGROUND_BASE_URL = 'https://lynx-stack.dev/a2ui/';
const PREVIEW_WIDTH = 450;
const PREVIEW_HEIGHT = 970;
const IFRAME_WIDTH = 430;
const IFRAME_HEIGHT = 932;

let browserPromise: Promise<Browser> | null = null;

const noop = () => undefined;

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '');
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isDevHost(hostname: string): boolean {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '0.0.0.0'
    || hostname.startsWith('10.')
    || hostname.startsWith('192.168.')
    || /^172\.(?:1[6-9]|2\d|3[01])\./u.test(hostname);
}

function normalizeBaseUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    url.search = '';
    if (!url.pathname.endsWith('/')) {
      url.pathname = `${url.pathname}/`;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function isTrustedPlaygroundBaseUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.username || url.password) return false;
    if (url.origin === 'https://lynx-stack.dev') return true;
    if (process.env.A2UI_BENCH_PLAYGROUND_BASE_URL) {
      const configured = new URL(process.env.A2UI_BENCH_PLAYGROUND_BASE_URL);
      if (url.origin === configured.origin) return true;
    }
    if (process.env.NODE_ENV !== 'production') {
      return url.protocol === 'http:' && isDevHost(url.hostname);
    }
  } catch {
    return false;
  }
  return false;
}

function resolvePlaygroundBaseUrl(request: BenchJobRequest): string {
  const configured = process.env.A2UI_BENCH_PLAYGROUND_BASE_URL;
  if (configured) {
    const normalized = normalizeBaseUrl(configured);
    if (normalized) return normalized;
  }

  const requested = request.playground?.baseUrl;
  if (requested && isTrustedPlaygroundBaseUrl(requested)) {
    const normalized = normalizeBaseUrl(requested);
    if (normalized) return normalized;
  }

  return DEFAULT_PLAYGROUND_BASE_URL;
}

function buildRenderUrl(baseUrl: string, metricId: string): string {
  const url = new URL('render.html', baseUrl);
  url.searchParams.set('protocol', 'a2ui');
  url.searchParams.set('demoUrl', './a2ui.web.js');
  url.searchParams.set('theme', 'light');
  url.searchParams.set('speed', '0');
  url.searchParams.set('instant', '1');
  url.searchParams.set('liveAction', '1');
  url.searchParams.set('previewMetricId', metricId);
  url.searchParams.set('messages', base64UrlEncode(JSON.stringify([])));
  return url.toString();
}

function readMetric(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : 0;
}

function normalizeOpenAIBaseUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.pathname = url.pathname
      .replace(/\/chat\/completions\/?$/u, '')
      .replace(/\/responses\/?$/u, '');
    return url.toString().replace(/\/$/u, '');
  } catch {
    return raw;
  }
}

function usesQueryAkAuth(endpoint: string): boolean {
  try {
    return /\/crawl\/?$/u.test(new URL(endpoint).pathname);
  } catch {
    return false;
  }
}

function shouldProxyJudgeBaseUrl(raw: string): boolean {
  return usesQueryAkAuth(raw);
}

function resolveJudgeEnv(request: BenchJobRequest): JudgeEnv {
  const apiKey = process.env.A2UI_BENCH_JUDGE_API_KEY
    ?? request.provider.apiKey
    ?? process.env.OPENAI_API_KEY;
  const baseURL = process.env.A2UI_BENCH_JUDGE_BASE_URL
    ?? request.provider.baseURL
    ?? process.env.OPENAI_BASE_URL;
  const model = process.env.A2UI_BENCH_JUDGE_MODEL
    ?? process.env.JUDGE_MODEL
    ?? request.provider.model
    ?? process.env.OPENAI_MODEL;
  return { apiKey, baseURL, model };
}

function getMissingJudgeEnv(env: JudgeEnv): string[] {
  const missing: string[] = [];
  if (!env.apiKey) missing.push('A2UI_BENCH_JUDGE_API_KEY or OPENAI_API_KEY');
  return missing;
}

async function readRequestBody(req: import('node:http').IncomingMessage) {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req as AsyncIterable<Uint8Array | string>) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function startJudgeModelProxy(
  endpoint: string,
  apiKey: string,
): Promise<JudgeProxy> {
  const server = createHttpServer((req, res) => {
    void (async () => {
      if (req.method !== 'POST' || !req.url?.endsWith('/chat/completions')) {
        res.statusCode = 404;
        res.end('not found');
        return;
      }

      const body = await readRequestBody(req);
      const url = new URL(endpoint);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (usesQueryAkAuth(endpoint)) {
        url.searchParams.set('ak', apiKey);
      } else {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      const upstream = await fetch(url, {
        body,
        headers,
        method: 'POST',
      });
      const responseText = await upstream.text();
      res.statusCode = upstream.status;
      res.setHeader(
        'Content-Type',
        upstream.headers.get('content-type') ?? 'application/json',
      );
      res.end(responseText);
    })().catch((error: unknown) => {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: {
          message: toErrorMessage(error),
          type: 'a2ui_bench_judge_proxy_error',
        },
      }));
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw new Error('Failed to allocate a local ui-judge model proxy port.');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}

async function resolveJudgeRuntimeEnv(
  env: JudgeEnv,
): Promise<{ env: ResolvedJudgeEnv; proxy?: JudgeProxy }> {
  const missing = getMissingJudgeEnv(env);
  if (missing.length > 0) {
    throw new Error(
      `ui-judge is enabled but missing judge model config: ${
        missing.join(', ')
      }.`,
    );
  }

  const { apiKey, baseURL, model } = env;
  if (!apiKey) {
    throw new Error('ui-judge model config failed normalization.');
  }

  const resolved: ResolvedJudgeEnv = {
    apiKey,
    ...(baseURL ? { baseURL } : {}),
    ...(model ? { model } : {}),
  };

  if (!resolved.baseURL || !shouldProxyJudgeBaseUrl(resolved.baseURL)) {
    return {
      env: {
        ...resolved,
        ...(resolved.baseURL
          ? { baseURL: normalizeOpenAIBaseUrl(resolved.baseURL) }
          : {}),
      },
    };
  }

  const proxy = await startJudgeModelProxy(resolved.baseURL, resolved.apiKey);
  return {
    env: {
      ...resolved,
      baseURL: proxy.baseUrl,
    },
    proxy,
  };
}

function isServerlessRuntime(): boolean {
  return Boolean(
    process.env.VERCEL
      ?? process.env.AWS_LAMBDA_FUNCTION_NAME
      ?? process.env.AWS_EXECUTION_ENV,
  );
}

async function resolveChromiumLaunchOptions(): Promise<LaunchOptions> {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ?? process.env.CHROME_EXECUTABLE_PATH
    ?? process.env.CHROMIUM_EXECUTABLE_PATH;
  if (executablePath) {
    return {
      args: ['--disable-dev-shm-usage', '--no-sandbox'],
      executablePath,
      headless: true,
    };
  }

  if (!isServerlessRuntime()) {
    return { headless: true };
  }

  const mod = await import('@sparticuz/chromium');
  const chromium = mod.default;
  const serverlessExecutablePath = await chromium.executablePath();
  return {
    args: [...chromium.args, '--disable-dev-shm-usage'],
    executablePath: serverlessExecutablePath,
    headless: true,
  };
}

async function launchBenchBrowser(): Promise<Browser> {
  const { chromium } = await import('playwright-core');
  const launchOptions = await resolveChromiumLaunchOptions();
  return await chromium.launch(launchOptions);
}

async function getBenchBrowser(): Promise<Browser> {
  browserPromise ??= launchBenchBrowser().catch((error: unknown) => {
    browserPromise = null;
    throw error;
  });

  const browser = await browserPromise;
  if (!browser.isConnected()) {
    browserPromise = null;
    return await getBenchBrowser();
  }
  return browser;
}

async function renderMessagesInPreview(
  options: BenchPreviewOptions,
): Promise<{
  metrics: PreviewMetricBag;
  page: Awaited<ReturnType<Browser['newPage']>>;
}> {
  const browser = await getBenchBrowser();
  const page = await browser.newPage({
    deviceScaleFactor: 1,
    viewport: { height: PREVIEW_HEIGHT, width: PREVIEW_WIDTH },
  });
  const renderUrl = buildRenderUrl(
    resolvePlaygroundBaseUrl(options.request),
    `bench-${options.runId}`,
  );

  try {
    await page.setContent(
      `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    html, body { margin: 0; padding: 0; background: #f4f5f7; }
    .shell { width: ${PREVIEW_WIDTH}px; min-height: ${PREVIEW_HEIGHT}px; display: flex; align-items: center; justify-content: center; }
    iframe { width: ${IFRAME_WIDTH}px; height: ${IFRAME_HEIGHT}px; border: 0; background: white; box-shadow: 0 0 0 1px rgba(0,0,0,.08); }
  </style>
</head>
<body>
  <div class="shell">
    <iframe id="preview" title="A2UI preview"></iframe>
  </div>
</body>
</html>`,
      { waitUntil: 'load' },
    );

    const metrics = await page.evaluate(
      ({ id, messages, src }) => {
        return new Promise<PreviewMetricBag>((resolve) => {
          const iframe = document.getElementById(
            'preview',
          ) as HTMLIFrameElement | null;
          const metricBag: PreviewMetricBag = {};
          if (!iframe) {
            resolve(metricBag);
            return;
          }

          let posted = false;
          let settleTimer = 0;

          const settleSoon = (delay = 800) => {
            window.clearTimeout(settleTimer);
            settleTimer = window.setTimeout(() => {
              resolve(metricBag);
            }, delay);
          };

          const postMessages = () => {
            if (posted) return;
            posted = true;
            const targetOrigin = new URL(src).origin;
            const post = () => {
              iframe.contentWindow?.postMessage(
                { messages, type: 'A2UI_LIVE_MESSAGES' },
                targetOrigin,
              );
            };
            post();
            for (const delay of [120, 320, 800]) {
              window.setTimeout(post, delay);
            }
          };

          window.addEventListener('message', (event) => {
            const data = event.data as Record<string, unknown> | null;
            if (!data || typeof data !== 'object') return;
            if (data.type === 'A2UI_RENDER_READY') {
              postMessages();
              settleSoon(3500);
              return;
            }
            if (data.type !== 'A2UI_PREVIEW_METRIC') return;
            if (data.metricId !== id) return;
            const metric = data.metric;
            if (
              metric === 'fcp' || metric === 'fmp' || metric === 'render'
              || metric === 'tti'
            ) {
              metricBag[metric] = data.value;
            }
            if (metric === 'tti') {
              settleSoon(500);
            } else {
              settleSoon(1800);
            }
          });

          iframe.src = src;
          window.setTimeout(postMessages, 800);
          window.setTimeout(() => resolve(metricBag), 12_000);
        });
      },
      {
        id: `bench-${options.runId}`,
        messages: options.messages,
        src: renderUrl,
      },
    );

    await page.waitForTimeout(1000);
    return { metrics, page };
  } catch (error) {
    await page.close().catch(noop);
    throw error;
  }
}

async function runJudge(
  renderedImage: string,
  options: BenchPreviewOptions,
): Promise<number> {
  if (!options.scenario.referenceImage) {
    throw new Error(
      'ui-judge is enabled but scenario.referenceImage is missing.',
    );
  }

  const { runVisualEvaluation } = await import('@lynx-js/ui-judge');
  const runtime = await resolveJudgeRuntimeEnv(
    resolveJudgeEnv(options.request),
  );
  try {
    const result = await runVisualEvaluation(
      {
        referenceImage: options.scenario.referenceImage,
        renderedImage,
      },
      {
        agent: {
          apiKey: runtime.env.apiKey,
          ...(runtime.env.baseURL ? { baseURL: runtime.env.baseURL } : {}),
          ...(runtime.env.model ? { model: runtime.env.model } : {}),
          ...(options.request.provider.api
            ? { api: options.request.provider.api }
            : {}),
          resourceId: options.runId,
        },
      },
    );
    return Math.round((result.score ?? 0) * 5);
  } finally {
    await runtime.proxy?.close().catch(noop);
  }
}

async function capturePreviewScreenshot(
  page: Awaited<ReturnType<Browser['newPage']>>,
): Promise<string> {
  const bytes = await page.screenshot({
    fullPage: false,
    quality: 76,
    type: 'jpeg',
  });
  return `data:image/jpeg;base64,${bytes.toString('base64')}`;
}

export async function runBenchPreview(
  options: BenchPreviewOptions,
): Promise<BenchPreviewResult> {
  const shouldRender = options.request.settings.renderMetricsEnabled
    || options.request.settings.judgeEnabled;
  if (!shouldRender || options.messages.length === 0) {
    return {
      errors: [],
      fmpMs: 0,
      judgeScore: 0,
      renderMs: 0,
      ttiMs: 0,
    };
  }

  const errors: string[] = [];
  let page: Awaited<ReturnType<Browser['newPage']>> | undefined;

  try {
    const rendered = await renderMessagesInPreview(options);
    page = rendered.page;
    let screenshotDataUrl: string | undefined;
    try {
      screenshotDataUrl = await capturePreviewScreenshot(page);
    } catch (error) {
      errors.push(`preview screenshot failed: ${toErrorMessage(error)}`);
    }

    let judgeScore = 0;
    if (options.request.settings.judgeEnabled) {
      try {
        if (!screenshotDataUrl) {
          throw new Error('preview screenshot is unavailable.');
        }
        judgeScore = await runJudge(screenshotDataUrl, options);
      } catch (error) {
        errors.push(`ui-judge failed: ${toErrorMessage(error)}`);
      }
    }

    return {
      errors,
      fmpMs: readMetric(rendered.metrics.fmp),
      judgeScore,
      renderMs: readMetric(rendered.metrics.render),
      ...(screenshotDataUrl ? { screenshotDataUrl } : {}),
      ttiMs: readMetric(rendered.metrics.tti),
    };
  } catch (error) {
    return {
      errors: [`preview render failed: ${toErrorMessage(error)}`],
      fmpMs: 0,
      judgeScore: 0,
      renderMs: 0,
      ttiMs: 0,
    };
  } finally {
    await page?.close().catch(noop);
  }
}
