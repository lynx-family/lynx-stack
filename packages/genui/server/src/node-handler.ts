// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Http2ServerRequest, Http2ServerResponse } from 'node:http2';
import { Readable } from 'node:stream';

import { routeRequest } from './routes';

export type HttpRequest = (IncomingMessage | Http2ServerRequest) & {
  path: string | null;
  queryStringParameters?: Record<string, unknown>;
  jsonBody?: Record<string, unknown>;
};

export type HttpResponse = ServerResponse | Http2ServerResponse;

interface StreamingRequestInit extends RequestInit {
  duplex: 'half';
}

function firstHeaderValue(
  value: string[] | string | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function requestHeaders(request: HttpRequest): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (name.startsWith(':')) continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }
  return headers;
}

function requestURL(request: HttpRequest, headers: Headers): URL {
  const forwardedProtocol = headers.get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim();
  const protocol = forwardedProtocol
    ?? firstHeaderValue(request.headers[':scheme'])
    ?? 'http';
  const host = headers.get('host')
    ?? firstHeaderValue(request.headers[':authority'])
    ?? 'localhost';
  return new URL(
    request.url ?? request.path ?? '/',
    `${protocol === 'https' ? 'https' : 'http'}://${host}`,
  );
}

function toWebRequest(
  request: HttpRequest,
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
  target: HttpResponse,
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

function waitForDrainOrClose(response: HttpResponse): Promise<void> {
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

function writeResponseChunk(
  response: HttpResponse,
  chunk: Uint8Array,
): boolean {
  if ('stream' in response) return response.write(chunk);
  return response.write(chunk);
}

async function writeWebResponse(
  response: Response,
  target: HttpResponse,
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
      if (!writeResponseChunk(target, Buffer.from(value))) {
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
  incoming: HttpRequest,
  outgoing: HttpResponse,
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
