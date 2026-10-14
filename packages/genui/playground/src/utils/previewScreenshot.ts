// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* eslint-disable n/no-unsupported-features/node-builtins -- Screenshot requests run in the browser. */

import type { PreviewImageSettings } from '../components/PreviewImage.js';
import type { PreviewPanelSource } from '../components/PreviewPanel.js';

export interface NativeScreenshotSource {
  route: 'template' | 'lynxml';
  entry: string;
  url?: string;
  source?: string;
  globalProps?: Record<string, unknown>;
}

interface ScreenshotReply {
  url?: unknown;
  error?: { message?: unknown };
}

const MAX_FORM_BYTES = 10 * 1024 * 1024;
const MAX_SCREENSHOT_PIXELS = MAX_FORM_BYTES / 4;
const MAX_RESPONSE_CHARS = 150_000;

function httpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:')
        && !url.username && !url.password
      ? url
      : null;
  } catch {
    return null;
  }
}

function nativeTemplateUrl(value: string): URL | null {
  const url = httpUrl(value);
  return url?.pathname.endsWith('.lynx.js') ? url : null;
}

function hasContent(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null;
}

/** Keep capture inputs separate from browser render URLs and live bridges. */
export function buildPreviewScreenshotSource(
  previewSource: PreviewPanelSource | undefined,
  nativeBundleUrl: string,
): NativeScreenshotSource | null {
  if (!previewSource) return null;
  if (previewSource.kind === 'lynx-xml') {
    return previewSource.source.trim()
      ? {
        route: 'lynxml',
        entry: 'index.lynxml',
        source: previewSource.source,
      }
      : null;
  }
  if (previewSource.kind === 'reactlynx') {
    const url = nativeTemplateUrl(previewSource.nativeUrl);
    return url
      ? { route: 'template', entry: 'main.lynx.js', url: url.href }
      : null;
  }
  if (
    previewSource.kind === 'html' || previewSource.kind === 'reactweb'
    || previewSource.kind === 'placeholder'
  ) return null;

  const base = nativeTemplateUrl(nativeBundleUrl);
  if (!base) return null;
  const entry = `${previewSource.kind}.lynx.js`;
  const url = new URL(entry, base).href;
  let globalProps: Record<string, unknown>;
  if (previewSource.kind === 'a2ui') {
    if (!hasContent(previewSource.messages)) return null;
    globalProps = {
      messages: previewSource.messages,
      ...(previewSource.actionMocks
        ? { actionMocks: previewSource.actionMocks }
        : {}),
      theme: previewSource.theme,
      instant: true,
    };
  } else if (previewSource.kind === 'openui') {
    if (!previewSource.rawText.trim()) return null;
    globalProps = {
      rawText: previewSource.rawText,
      inlineMode: previewSource.inlineMode ?? false,
      theme: previewSource.theme ?? 'light',
      instant: true,
    };
  } else {
    if (!hasContent(previewSource.mcpAppData)) return null;
    globalProps = {
      mcpAppData: previewSource.mcpAppData,
      theme: previewSource.theme ?? 'light',
    };
  }
  return { route: 'template', entry, url, globalProps };
}

function captureEndpoint(settings: PreviewImageSettings, route: string): URL {
  const endpoint = httpUrl(settings.endpoint.trim());
  if (!endpoint || endpoint.search || endpoint.hash) {
    throw new Error(
      'Enter an HTTP(S) screenshot service URL without credentials, query parameters, or a fragment.',
    );
  }
  if (!endpoint.pathname.endsWith('/')) endpoint.pathname += '/';
  if (
    !Number.isSafeInteger(settings.width) || settings.width <= 0
    || settings.width > 8192
    || !Number.isSafeInteger(settings.height) || settings.height <= 0
    || settings.height > 8192
    || settings.width * settings.height > MAX_SCREENSHOT_PIXELS
  ) {
    throw new Error(
      'Screen dimensions must be whole pixels from 1 to 8192, with at most 2,621,440 pixels in total.',
    );
  }
  if (
    !Number.isSafeInteger(settings.timeoutMs) || settings.timeoutMs <= 0
    || settings.timeoutMs > 300_000
  ) {
    throw new Error('Timeout must be a whole number from 1 to 300,000 ms.');
  }
  if (
    !Number.isSafeInteger(settings.screenshotSettleMs)
    || settings.screenshotSettleMs < 0
    || settings.screenshotSettleMs >= settings.timeoutMs
  ) {
    throw new Error(
      'Capture delay must be a whole number of milliseconds below the timeout.',
    );
  }
  return new URL(`screenshot/${route}`, endpoint);
}

/** Capture the selected native artifact and return UI Judge's stored BMP URL. */
export async function capturePreviewScreenshot(
  source: NativeScreenshotSource,
  settings: PreviewImageSettings,
  signal: AbortSignal,
): Promise<string> {
  signal.throwIfAborted();
  const endpoint = captureEndpoint(settings, source.route);
  const fields: Record<string, string> = {
    entry: source.entry,
    width: String(settings.width),
    height: String(settings.height),
    screenshotSettleMs: String(settings.screenshotSettleMs),
    timeoutMs: String(settings.timeoutMs),
  };
  if (source.route === 'lynxml') {
    if (!source.source?.trim()) {
      throw new Error('No Lynx XML source to capture.');
    }
    fields.source = source.source;
  } else {
    const templateUrl = source.url && nativeTemplateUrl(source.url);
    if (!templateUrl) throw new Error('No native Lynx template to capture.');
    fields.url = templateUrl.href;
    if (source.globalProps) {
      fields.globalProps = JSON.stringify(source.globalProps);
    }
  }
  const form = new FormData();
  let bytes = 0;
  for (const [name, value] of Object.entries(fields)) {
    bytes += new TextEncoder().encode(value).byteLength;
    form.set(name, value);
  }
  if (bytes > MAX_FORM_BYTES) {
    throw new Error(
      'The preview exceeds the screenshot service’s 10 MiB limit.',
    );
  }
  // Include a small transport allowance around the server's render deadline.
  const timeout = AbortSignal.timeout(settings.timeoutMs + 15_000);
  const requestSignal = AbortSignal.any([signal, timeout]);
  try {
    const response = await fetch(endpoint.href, {
      method: 'POST',
      body: form,
      credentials: 'omit',
      redirect: 'error',
      signal: requestSignal,
    });
    const text = await response.text();
    requestSignal.throwIfAborted();
    let result: ScreenshotReply | null = null;
    if (text.length <= MAX_RESPONSE_CHARS) {
      try {
        result = JSON.parse(text) as ScreenshotReply | null;
      } catch {
        // Report an invalid response below without displaying upstream HTML.
      }
    }
    if (!response.ok) {
      const detail = typeof result?.error?.message === 'string'
        ? ` ${result.error.message.slice(0, 500)}`
        : '';
      throw new Error(
        `Screenshot service returned HTTP ${response.status}.${detail}`,
      );
    }
    const url = typeof result?.url === 'string' && httpUrl(result.url);
    if (!url) {
      throw new Error('Screenshot service returned an invalid image URL.');
    }
    return url.href;
  } catch (error) {
    signal.throwIfAborted();
    if (timeout.aborted) {
      throw new Error(
        'Screenshot timed out. Increase the timeout and try again.',
      );
    }
    if (error instanceof TypeError) {
      throw new Error(
        'Could not reach the screenshot service. Check the endpoint, HTTPS, CORS, and network access.',
      );
    }
    throw error;
  }
}
