// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* eslint-disable n/no-unsupported-features/node-builtins -- Browser screenshot transport uses Web APIs. */

const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024 + 1024;
const CAPTURE_ID = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/iu;

interface ScreenshotRequest {
  path: 'screenshot/template' | 'screenshot/lynxml';
  fields: Record<string, string>;
  timeoutMs: number;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function checkBenchScreenshotService(
  serverUrl: string,
  signal: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (!serverUrl) {
    throw new Error(
      'Enter the screenshot service URL before enabling UI Judge.',
    );
  }
  let response: Response;
  try {
    response = await fetchImpl(new URL('health', serverUrl), {
      credentials: 'omit',
      redirect: 'error',
      signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
    });
  } catch (error) {
    signal.throwIfAborted();
    throw new Error(
      `Browser could not reach the screenshot service. Check its address, HTTPS, CORS, and browser local-network permission. ${
        message(error)
      }`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `Screenshot service health check returned HTTP ${response.status}.`,
    );
  }
  const health = await response.json() as { status?: unknown };
  if (health.status !== 'ok') {
    throw new Error('Screenshot service is not ready.');
  }
}

async function screenshotBlob(
  response: Response,
  signal: AbortSignal,
): Promise<Blob> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Screenshot service returned no image.');
  const chunks: BlobPart[] = [];
  let size = 0;
  const cancel = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    if (Number(response.headers.get('content-length')) > MAX_SCREENSHOT_BYTES) {
      throw new Error('Screenshot exceeds the upload size limit.');
    }
    while (true) {
      signal.throwIfAborted();
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > MAX_SCREENSHOT_BYTES) {
        throw new Error('Screenshot exceeds the upload size limit.');
      }
      chunks.push(new Uint8Array(chunk.value));
    }
    signal.throwIfAborted();
    return new Blob(chunks, { type: 'image/bmp' });
  } finally {
    signal.removeEventListener('abort', cancel);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** One browser-owned capture worker per live Bench, safe across SSE replay. */
export function createBenchScreenshotRelay(options: {
  jobUrl: string;
  serverUrl: string;
  signal: AbortSignal;
  onError: (error: string) => void;
  fetch?: typeof fetch;
}) {
  const fetchImpl = options.fetch ?? fetch;
  const handled = new Set<string>();
  const execute = async (captureId: string) => {
    const endpoint = `${options.jobUrl}/screenshots/${
      encodeURIComponent(captureId)
    }`;
    const requestResponse = await fetchImpl(endpoint, {
      credentials: 'omit',
      redirect: 'error',
      signal: AbortSignal.any([options.signal, AbortSignal.timeout(10_000)]),
    });
    if (requestResponse.status === 404) return; // Completed or expired replay.
    if (!requestResponse.ok) {
      throw new Error(
        `Could not load screenshot task: HTTP ${requestResponse.status}.`,
      );
    }
    const request = await requestResponse.json() as ScreenshotRequest;
    let body: Blob | string;
    let contentType: string;
    try {
      if (
        !['screenshot/template', 'screenshot/lynxml'].includes(request.path)
        || !request.fields || typeof request.fields !== 'object'
        || !Number.isFinite(request.timeoutMs) || request.timeoutMs <= 0
      ) {
        throw new Error('Invalid screenshot task.');
      }
      const form = new FormData();
      for (const [name, value] of Object.entries(request.fields)) {
        if (typeof value !== 'string') {
          throw new Error('Invalid screenshot parameter.');
        }
        form.set(name, value);
      }
      const signal = AbortSignal.any([
        options.signal,
        AbortSignal.timeout(Math.min(1_200_000, request.timeoutMs)),
      ]);
      const screenshot = await fetchImpl(
        new URL(request.path, options.serverUrl),
        {
          method: 'POST',
          body: form,
          credentials: 'omit',
          redirect: 'error',
          signal,
        },
      );
      if (!screenshot.ok) {
        const detail = await screenshot.text();
        throw new Error(
          `Screenshot service returned HTTP ${screenshot.status}: ${
            detail.slice(0, 1000)
          }`,
        );
      }
      if (
        screenshot.headers.get('content-type')?.split(';')[0]?.trim()
          !== 'image/bmp'
      ) {
        await screenshot.body?.cancel().catch(() => undefined);
        throw new Error('Screenshot service did not return a BMP image.');
      }
      body = await screenshotBlob(screenshot, signal);
      contentType = 'image/bmp';
    } catch (error) {
      options.signal.throwIfAborted();
      body = JSON.stringify({
        error: `Browser screenshot failed: ${message(error).slice(0, 1500)}`,
      });
      contentType = 'application/json';
    }
    // Retrying an upload never starts another capture or another model request.
    let uploadError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      options.signal.throwIfAborted();
      try {
        const uploaded = await fetchImpl(endpoint, {
          method: 'POST',
          body,
          headers: { 'Content-Type': contentType },
          credentials: 'omit',
          redirect: 'error',
          signal: AbortSignal.any([
            options.signal,
            AbortSignal.timeout(30_000),
          ]),
        });
        if (uploaded.ok || uploaded.status === 409) return;
        throw new Error(`Screenshot upload returned HTTP ${uploaded.status}.`);
      } catch (error) {
        uploadError = error;
      }
    }
    throw uploadError;
  };
  return (captureId: unknown): void => {
    if (
      typeof captureId !== 'string' || !CAPTURE_ID.test(captureId)
      || handled.has(captureId) || options.signal.aborted
    ) return;
    handled.add(captureId);
    void execute(captureId).catch((error: unknown) => {
      if (!options.signal.aborted) {
        handled.delete(captureId);
        options.onError(message(error));
      }
    });
  };
}
