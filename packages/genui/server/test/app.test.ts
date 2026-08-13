// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  connect as connectHttp2,
  createServer as createHttp2Server,
} from 'node:http2';

import { createAdaptorServer } from '@hono/node-server';
import { describe, expect, test } from '@rstest/core';

import { GENUI_MODEL_CONFIG_ENV } from '../service/common/model-config.js';
import app from '../src/app.js';

describe('Hono application', () => {
  test('routes health requests and preserves CORS headers', async () => {
    const response = await app.request('/a2ui/health', {
      headers: { Origin: 'http://localhost:3000' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'http://localhost:3000',
    );
    await expect(response.json()).resolves.toMatchObject({
      provider: 'openai',
    });
  });

  test('returns only public model metadata from discovery endpoints', async () => {
    const previous = process.env[GENUI_MODEL_CONFIG_ENV];
    process.env[GENUI_MODEL_CONFIG_ENV] = JSON.stringify({
      'Doubao Seed': {
        apiKey: 'seed-secret',
        baseURL: 'https://seed.example.com/api/v3',
        model: 'doubao-seed-upstream',
        api: 'chat',
        default: true,
      },
      'Doubao Pro': {
        apiKey: 'pro-secret',
        baseURL: 'https://pro.example.com/api/v3',
        model: 'doubao-pro-upstream',
      },
    });
    try {
      const response = await app.request('/models', {
        headers: { Origin: 'http://localhost:3000' },
      });
      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
        'http://localhost:3000',
      );
      const payload: unknown = await response.json();
      expect(payload).toEqual({
        defaultModel: 'Doubao Seed',
        models: [
          { id: 'Doubao Seed', label: 'Doubao Seed' },
          { id: 'Doubao Pro', label: 'Doubao Pro' },
        ],
      });
      const serializedPayload = JSON.stringify(payload);
      expect(serializedPayload).not.toContain('seed-secret');
      expect(serializedPayload).not.toContain('seed.example.com');
      expect(serializedPayload).not.toContain('doubao-seed-upstream');

      const healthResponse = await app.request('/a2ui/health', {
        headers: { Origin: 'http://localhost:3000' },
      });
      expect(healthResponse.status).toBe(200);
      const healthPayload: unknown = await healthResponse.json();
      expect(healthPayload).toEqual({
        ok: true,
        provider: 'openai',
        hasKey: true,
        modelName: 'Doubao Seed',
      });
      const serializedHealth = JSON.stringify(healthPayload);
      expect(serializedHealth).not.toContain('seed-secret');
      expect(serializedHealth).not.toContain('seed.example.com');
      expect(serializedHealth).not.toContain('doubao-seed-upstream');
      expect(serializedHealth).not.toContain('"api"');
    } finally {
      if (previous === undefined) {
        delete process.env[GENUI_MODEL_CONFIG_ENV];
      } else {
        process.env[GENUI_MODEL_CONFIG_ENV] = previous;
      }
    }
  });

  test('allows IPv6 loopback origins during local development', async () => {
    const response = await app.request('/a2ui/health', {
      headers: { Origin: 'http://[::1]:3000' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'http://[::1]:3000',
    );
  });

  test('extracts dynamic job parameters', async () => {
    const response = await app.request('/a2ui/bench/jobs/missing');

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'bench job not found',
    });
  });

  test('handles CORS preflight on known routes', async () => {
    const response = await app.request('/a2ui/health', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:3000' },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'http://localhost:3000',
    );
  });

  test('returns method-not-allowed and not-found responses', async () => {
    const methodNotAllowed = await app.request('/a2ui/health', {
      method: 'POST',
    });
    expect(methodNotAllowed.status).toBe(405);
    expect(methodNotAllowed.headers.get('Allow')).toBe('GET, OPTIONS');

    const notFound = await app.request('/missing');
    expect(notFound.status).toBe(404);
    await expect(notFound.json()).resolves.toEqual({
      ok: false,
      error: 'not found',
    });
  });

  test('serves requests through the HTTP/2 Node adapter', async () => {
    const server = createAdaptorServer({
      createServer: createHttp2Server,
      fetch: app.fetch,
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        server.off('error', reject);
        resolve();
      });
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('HTTP/2 server did not bind to a TCP address');
    }

    const client = connectHttp2(`http://127.0.0.1:${address.port}`);
    try {
      const result = await new Promise<{
        allowedOrigin: string | undefined;
        body: string;
        status: number | undefined;
      }>((resolve, reject) => {
        const chunks: Buffer[] = [];
        let allowedOrigin: string | undefined;
        let status: number | undefined;
        const request = client.request({
          ':method': 'GET',
          ':path': '/a2ui/health',
          origin: 'http://localhost:3000',
        });
        request.once('error', reject);
        request.once('response', (headers) => {
          const origin = headers['access-control-allow-origin'];
          allowedOrigin = typeof origin === 'string' ? origin : undefined;
          status = headers[':status'];
        });
        request.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        request.once('end', () => {
          resolve({
            allowedOrigin,
            body: Buffer.concat(chunks).toString('utf8'),
            status,
          });
        });
        request.end();
      });

      expect(result.status).toBe(200);
      expect(result.allowedOrigin).toBe('http://localhost:3000');
      expect(JSON.parse(result.body)).toMatchObject({
        provider: 'openai',
      });
    } finally {
      client.destroy();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });
});
