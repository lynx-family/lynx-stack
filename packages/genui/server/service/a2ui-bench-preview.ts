// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Browser-backed bench previews are being split out of genui-server. Keep the
// complete implementation disabled until a browser-capable service owns it.
/*
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

const DEFAULT_PLAYGROUND_BASE_URL = 'https://lynx-stack.dev/genui/';
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

    if (options.request.settings.judgeEnabled) {
      errors.push(
        'ui-judge failed: UI Judge server integration is temporarily unavailable; use the Rust library API.',
      );
    }

    return {
      errors,
      fmpMs: readMetric(rendered.metrics.fmp),
      judgeScore: 0,
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
*/

export {};
