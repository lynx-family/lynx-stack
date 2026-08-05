// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { existsSync } from 'node:fs';

import type { Browser, LaunchOptions, Page } from 'playwright-core';

import { judgeBenchScreenshot } from './a2ui-bench-judge';
import type {
  BenchJobRequest,
  BenchProtocol,
  BenchScenarioRequest,
} from './a2ui-bench-types';
import type { A2UIMessage } from '../agent/a2ui-validator';

export interface BenchPreviewOptions {
  abortSignal?: AbortSignal;
  messages?: A2UIMessage[];
  onJudgeStart?: () => void;
  protocol: BenchProtocol;
  request: BenchJobRequest;
  runId: string;
  scenario: BenchScenarioRequest;
  source?: string;
}

export interface BenchPreviewResult {
  errors: string[];
  fmpMs: number;
  judgeScore: number;
  judgeSummary?: string;
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

interface CapturedScreenshot {
  bytes: Uint8Array;
  dataUrl: string;
}

export interface BenchPreviewDependencies {
  getBrowser: () => Promise<Browser>;
  judgeScreenshot: typeof judgeBenchScreenshot;
}

const DEFAULT_PLAYGROUND_BASE_URL = 'https://lynx-stack.dev/genui/';
const PREVIEW_WIDTH = 450;
const PREVIEW_HEIGHT = 970;
const IFRAME_WIDTH = 430;
const IFRAME_HEIGHT = 932;
const PREVIEW_TIMEOUT_MS = 20_000;

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

function buildA2UIRenderUrl(baseUrl: string, metricId: string): string {
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

function buildOpenUIRenderUrl(
  baseUrl: string,
  metricId: string,
  source: string,
): string {
  const url = new URL('render.html', baseUrl);
  url.searchParams.set('protocol', 'openui');
  url.searchParams.set('demoUrl', './openui.web.js');
  url.searchParams.set('theme', 'light');
  url.searchParams.set('speed', '0');
  url.searchParams.set('instant', '1');
  url.searchParams.set('liveAction', '1');
  url.searchParams.set('previewMetricId', metricId);
  url.searchParams.set('rawText', source);
  return url.toString();
}

function buildLynxXmlRenderUrl(
  baseUrl: string,
  metricId: string,
  sourceUrl: string,
): string {
  const url = new URL('render.html', baseUrl);
  url.searchParams.set('protocol', 'lynx-xml');
  url.searchParams.set('demoUrl', sourceUrl);
  url.searchParams.set('theme', 'light');
  url.searchParams.set('previewMetricId', metricId);
  return url.toString();
}

export function buildBenchPreviewUrls(
  options: Pick<
    BenchPreviewOptions,
    'protocol' | 'request' | 'runId' | 'source'
  >,
): { renderUrl: string; sourceUrl?: string } {
  const baseUrl = resolvePlaygroundBaseUrl(options.request);
  const metricId = `bench-${options.runId}`;
  if (options.protocol === 'openui') {
    return {
      renderUrl: buildOpenUIRenderUrl(
        baseUrl,
        metricId,
        options.source ?? '',
      ),
    };
  }
  if (options.protocol === 'lynx-xml') {
    const sourceUrl = new URL(
      `__bench-lynx-xml/${encodeURIComponent(options.runId)}/artifact.xml`,
      baseUrl,
    ).toString();
    return {
      renderUrl: buildLynxXmlRenderUrl(baseUrl, metricId, sourceUrl),
      sourceUrl,
    };
  }
  return {
    renderUrl: buildA2UIRenderUrl(baseUrl, metricId),
  };
}

function readMetric(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : 0;
}

function readTimeoutMs(request: BenchJobRequest): number {
  const requested = request.settings.timeoutMs;
  if (
    typeof requested === 'number'
    && Number.isSafeInteger(requested)
    && requested > 0
  ) {
    return Math.min(requested, PREVIEW_TIMEOUT_MS);
  }
  return PREVIEW_TIMEOUT_MS;
}

function isServerlessRuntime(): boolean {
  return Boolean(
    process.env.VERCEL
      ?? process.env.AWS_LAMBDA_FUNCTION_NAME
      ?? process.env.AWS_EXECUTION_ENV,
  );
}

function findSystemChromiumExecutable(): string | undefined {
  const candidates = process.platform === 'darwin'
    ? [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ]
    : [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
    ];
  return candidates.find((candidate) => existsSync(candidate));
}

async function resolveChromiumLaunchOptions(): Promise<LaunchOptions> {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ?? process.env.CHROME_EXECUTABLE_PATH
    ?? process.env.CHROMIUM_EXECUTABLE_PATH
    ?? findSystemChromiumExecutable();
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

async function routeBenchSource(
  page: Page,
  sourceUrl: string,
  source: string,
): Promise<void> {
  await page.route(sourceUrl, async (route) => {
    await route.fulfill({
      body: source,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
      status: 200,
      contentType: 'application/xml; charset=utf-8',
    });
  });
}

async function renderResultInPreview(
  options: BenchPreviewOptions,
  dependencies: BenchPreviewDependencies,
): Promise<{
  metrics: PreviewMetricBag;
  page: Page;
}> {
  const browser = await dependencies.getBrowser();
  const page = await browser.newPage({
    deviceScaleFactor: 1,
    viewport: { height: PREVIEW_HEIGHT, width: PREVIEW_WIDTH },
  });
  const { renderUrl, sourceUrl } = buildBenchPreviewUrls(options);
  const timeoutMs = readTimeoutMs(options.request);
  page.setDefaultTimeout(timeoutMs);

  try {
    if (options.protocol !== 'a2ui') {
      if (
        !options.source?.trim()
        || (options.protocol === 'lynx-xml' && !sourceUrl)
      ) {
        const sourceProtocol = options.protocol === 'openui'
          ? 'OpenUI'
          : 'Lynx XML';
        throw new Error(
          `${sourceProtocol} preview requires a non-empty source.`,
        );
      }
      if (sourceUrl) {
        await routeBenchSource(
          page,
          sourceUrl,
          options.source,
        );
      }
    }

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
    <iframe id="preview" title="Bench preview"></iframe>
  </div>
</body>
</html>`,
      { waitUntil: 'load' },
    );

    const metrics = await page.evaluate(
      ({ id, messages, protocol, src, timeout }) => {
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
            if (posted || protocol !== 'a2ui') return;
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
              settleSoon(protocol === 'a2ui' ? 3500 : 1800);
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

          iframe.addEventListener('load', () => {
            if (protocol !== 'a2ui') {
              settleSoon(3000);
            }
          });
          iframe.src = src;
          window.setTimeout(postMessages, 800);
          window.setTimeout(() => resolve(metricBag), timeout);
        });
      },
      {
        id: `bench-${options.runId}`,
        messages: options.messages ?? [],
        protocol: options.protocol,
        src: renderUrl,
        timeout: timeoutMs,
      },
    );

    await page.waitForTimeout(1000);
    return { metrics, page };
  } catch (error) {
    await page.close().catch(noop);
    throw error;
  }
}

async function capturePreviewScreenshot(
  page: Page,
): Promise<CapturedScreenshot> {
  const bytes = await page.screenshot({
    fullPage: false,
    quality: 82,
    type: 'jpeg',
  });
  return {
    bytes,
    dataUrl: `data:image/jpeg;base64,${bytes.toString('base64')}`,
  };
}

const defaultDependencies: BenchPreviewDependencies = {
  getBrowser: getBenchBrowser,
  judgeScreenshot: judgeBenchScreenshot,
};

export async function runBenchPreview(
  options: BenchPreviewOptions,
  dependencies: BenchPreviewDependencies = defaultDependencies,
): Promise<BenchPreviewResult> {
  const shouldRender = options.request.settings.renderMetricsEnabled
    || options.request.settings.judgeEnabled;
  if (!shouldRender) {
    return {
      errors: [],
      fmpMs: 0,
      judgeScore: 0,
      renderMs: 0,
      ttiMs: 0,
    };
  }
  if (
    options.protocol === 'a2ui'
    && (!options.messages || options.messages.length === 0)
  ) {
    return {
      errors: ['A2UI preview requires at least one protocol message.'],
      fmpMs: 0,
      judgeScore: 0,
      renderMs: 0,
      ttiMs: 0,
    };
  }
  if (options.protocol !== 'a2ui' && !options.source?.trim()) {
    const sourceProtocol = options.protocol === 'openui'
      ? 'OpenUI'
      : 'Lynx XML';
    return {
      errors: [`${sourceProtocol} preview requires source text.`],
      fmpMs: 0,
      judgeScore: 0,
      renderMs: 0,
      ttiMs: 0,
    };
  }

  const errors: string[] = [];
  let page: Page | undefined;

  try {
    if (options.abortSignal?.aborted) {
      throw options.abortSignal.reason ?? new Error('Bench preview aborted.');
    }
    const rendered = await renderResultInPreview(options, dependencies);
    page = rendered.page;

    let screenshot: CapturedScreenshot | undefined;
    try {
      screenshot = await capturePreviewScreenshot(page);
    } catch (error) {
      errors.push(`preview screenshot failed: ${toErrorMessage(error)}`);
    }

    let judgeScore = 0;
    let judgeSummary: string | undefined;
    if (options.request.settings.judgeEnabled) {
      options.onJudgeStart?.();
      if (screenshot) {
        try {
          const judged = await dependencies.judgeScreenshot({
            ...(options.abortSignal
              ? { abortSignal: options.abortSignal }
              : {}),
            request: options.request,
            scenario: options.scenario,
            screenshot: screenshot.bytes,
          });
          judgeScore = judged.score;
          judgeSummary = judged.summary;
        } catch (error) {
          errors.push(`ui-judge failed: ${toErrorMessage(error)}`);
        }
      } else {
        errors.push('ui-judge failed: no preview screenshot was captured.');
      }
    }

    const includeMetrics = options.request.settings.renderMetricsEnabled;
    return {
      errors,
      fmpMs: includeMetrics ? readMetric(rendered.metrics.fmp) : 0,
      judgeScore,
      ...(judgeSummary ? { judgeSummary } : {}),
      renderMs: includeMetrics ? readMetric(rendered.metrics.render) : 0,
      ...(screenshot ? { screenshotDataUrl: screenshot.dataUrl } : {}),
      ttiMs: includeMetrics ? readMetric(rendered.metrics.tti) : 0,
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
