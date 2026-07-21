// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { AddressInfo } from 'node:net';

import { describe, expect, test } from '@rstest/core';

import { handler } from '../src/index.js';
import { createGenUIServer, listen } from '../src/node-server.js';
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

describe('Node HTTP adapter', () => {
  test('serves Web API route responses over HTTP', async () => {
    const server = createGenUIServer(handler);
    await listen(server, { host: '127.0.0.1', port: 0 });
    try {
      const address = server.address() as AddressInfo;
      const response = await fetch(
        `http://127.0.0.1:${address.port}/a2ui/health`,
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        provider: 'openai',
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  });
});
