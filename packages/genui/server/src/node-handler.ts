// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';

import { routeRequest } from './routes';

interface StreamingRequestInit extends RequestInit {
  duplex: 'half';
}

function requestHeaders(request: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }
  return headers;
}

function requestURL(request: IncomingMessage, headers: Headers): URL {
  const forwardedProtocol = headers.get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim();
  const protocol = forwardedProtocol === 'https' ? 'https' : 'http';
  const host = headers.get('host') ?? 'localhost';
  return new URL(request.url ?? '/', `${protocol}://${host}`);
}

function toWebRequest(
  request: IncomingMessage,
  signal: AbortSignal,
): Request {
  const headers = requestHeaders(request);
  const method = request.method?.toUpperCase() ?? 'GET';
  const bodyAllowed = method !== 'GET' && method !== 'HEAD';
  if (!bodyAllowed) request.resume();
  const init: StreamingRequestInit = {
    method,
    headers,
    signal,
    duplex: 'half',
    ...(bodyAllowed
      ? {
        body: Readable.toWeb(request) as ReadableStream<Uint8Array>,
      }
      : {}),
  };
  return new Request(requestURL(request, headers), init);
}

function applyResponseHeaders(
  response: Response,
  target: ServerResponse,
): void {
  const getSetCookie = (
    response.headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie;
  const setCookies = getSetCookie?.call(response.headers) ?? [];
  response.headers.forEach((value, name) => {
    if (name !== 'set-cookie') target.setHeader(name, value);
  });
  if (setCookies.length > 0) target.setHeader('set-cookie', setCookies);
}

function waitForDrainOrClose(response: ServerResponse): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      response.off('close', finish);
      response.off('drain', finish);
      resolve();
    };
    response.once('close', finish);
    response.once('drain', finish);
  });
}

async function writeWebResponse(
  response: Response,
  target: ServerResponse,
): Promise<void> {
  target.statusCode = response.status;
  if (response.statusText) target.statusMessage = response.statusText;
  applyResponseHeaders(response, target);

  if (!response.body) {
    target.end();
    return;
  }

  const reader = response.body.getReader();
  const cancelReader = () => {
    void reader.cancel('client disconnected');
  };
  target.once('close', cancelReader);
  try {
    while (!target.destroyed) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!target.write(Buffer.from(value))) {
        await waitForDrainOrClose(target);
      }
    }
    if (!target.destroyed) target.end();
  } finally {
    target.off('close', cancelReader);
    reader.releaseLock();
  }
}

export async function handleNodeRequest(
  incoming: IncomingMessage,
  outgoing: ServerResponse,
): Promise<void> {
  const abortController = new AbortController();
  const abort = () => {
    if (!abortController.signal.aborted) {
      abortController.abort(new Error('client disconnected'));
    }
  };
  incoming.once('aborted', abort);
  outgoing.once('close', () => {
    if (!outgoing.writableFinished) abort();
  });

  try {
    const request = toWebRequest(incoming, abortController.signal);
    const response = await routeRequest(request);
    await writeWebResponse(response, outgoing);
  } catch (error) {
    if (outgoing.headersSent) {
      outgoing.destroy(error instanceof Error ? error : undefined);
      return;
    }
    await writeWebResponse(
      Response.json(
        { ok: false, error: 'internal server error' },
        { status: 500 },
      ),
      outgoing,
    );
  } finally {
    incoming.off('aborted', abort);
  }
}
