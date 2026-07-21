// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { describe, expect, test } from '@rstest/core';

import { handler } from '../src/index.js';
import { routeRequest } from '../src/routes.js';

describe('routeRequest', () => {
  test('dispatches static routes and preserves CORS headers', async () => {
    const response = await routeRequest(
      new Request('http://server.test/a2ui/health', {
        headers: { Origin: 'http://localhost:3000' },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'http://localhost:3000',
    );
    await expect(response.json()).resolves.toMatchObject({
      provider: 'openai',
    });
  });

  test('reports unsupported methods and available handlers', async () => {
    const response = await routeRequest(
      new Request('http://server.test/a2ui/health', { method: 'POST' }),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET, OPTIONS');
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'method not allowed',
    });
  });

  test('passes dynamic route parameters to bench handlers', async () => {
    const response = await routeRequest(
      new Request('http://server.test/a2ui/bench/jobs/missing'),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'bench job not found',
    });
  });
});

describe('Node handler', () => {
  test('writes Web API route responses to ServerResponse', async () => {
    const request = Object.assign(new EventEmitter(), {
      headers: { host: 'server.test' },
      method: 'GET',
      url: '/a2ui/health',
    }) as unknown as IncomingMessage;
    const chunks: Uint8Array[] = [];
    const headers = new Map<string, number | readonly string[] | string>();
    const response = Object.assign(new EventEmitter(), {
      destroyed: false,
      headersSent: false,
      statusCode: 0,
      statusMessage: '',
      writableFinished: false,
      destroy() {
        this.destroyed = true;
      },
      end(value?: Uint8Array | string) {
        if (value !== undefined) chunks.push(Buffer.from(value));
        this.writableFinished = true;
      },
      setHeader(name: string, value: number | readonly string[] | string) {
        headers.set(name, value);
      },
      write(value: Uint8Array | string) {
        chunks.push(Buffer.from(value));
        return true;
      },
    }) as unknown as ServerResponse;

    await handler(request, response);

    expect(response.statusCode).toBe(200);
    expect(headers.get('content-type')).toBe('application/json');
    expect(JSON.parse(Buffer.concat(chunks).toString('utf8'))).toMatchObject({
      provider: 'openai',
    });
  });
});
