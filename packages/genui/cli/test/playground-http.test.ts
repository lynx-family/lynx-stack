// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import * as fs from 'node:fs';
import { request as httpRequest } from 'node:http';
import type { ServerResponse } from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';

import { rstest } from '@rstest/core';

import {
  publishSseFrame,
  startPlaygroundHttp,
} from '../src/playground/server.js';
import { PlaygroundStore } from '../src/playground/store.js';
import { PlaygroundError } from '../src/playground/types.js';

describe('playground HTTP trust boundary', () => {
  let root: string;
  let assets: string;
  let http: Awaited<ReturnType<typeof startPlaygroundHttp>> | undefined;
  let store: PlaygroundStore;
  let port: number;
  let previewPort: number;
  let engine: {
    descriptors(): Array<{ id: string }>;
    modelCatalog(agentId: string): Promise<unknown>;
    shutdown(): Promise<void>;
  };

  beforeEach(async () => {
    root = fs.mkdtempSync(
      path.join(fs.realpathSync(os.tmpdir()), 'genui-http-'),
    );
    assets = path.join(root, 'assets');
    fs.mkdirSync(assets);
    fs.writeFileSync(
      path.join(assets, 'index.html'),
      '<!doctype html><title>control</title>',
    );
    fs.writeFileSync(
      path.join(assets, 'preview.html'),
      '<!doctype html><title>preview</title>',
    );
    fs.mkdirSync(path.join(assets, 'static', 'js', 'async'), {
      recursive: true,
    });
    fs.mkdirSync(path.join(assets, 'static', 'css', 'async'), {
      recursive: true,
    });
    fs.mkdirSync(path.join(assets, 'static', 'wasm'), { recursive: true });
    fs.writeFileSync(
      path.join(assets, 'static', 'js', 'index.deadbeef.js'),
      'globalThis.control = true;',
    );
    fs.writeFileSync(
      path.join(assets, 'static', 'js', 'preview.deadbeef.js'),
      'globalThis.preview = true;',
    );
    fs.writeFileSync(
      path.join(assets, 'static', 'js', 'async', 'runtime.deadbeef.js'),
      'globalThis.runtime = true;',
    );
    fs.writeFileSync(
      path.join(assets, 'static', 'css', 'index.deadbeef.css'),
      'body { color: black; }',
    );
    fs.writeFileSync(
      path.join(assets, 'static', 'css', 'preview.deadbeef.css'),
      'body { color: white; }',
    );
    fs.writeFileSync(
      path.join(assets, 'static', 'css', 'async', 'runtime.deadbeef.css'),
      'lynx-view { display: block; }',
    );
    fs.writeFileSync(
      path.join(assets, 'static', 'wasm', 'deadbeef.module.wasm'),
      Buffer.from([0, 97, 115, 109]),
    );
    port = 42_000 + Math.floor(Math.random() * 2_000);
    store = new PlaygroundStore(path.join(root, 'data'));
    engine = {
      descriptors: () =>
        ['codex', 'claude', 'cursor', 'trae'].map((id) => ({ id })),
      modelCatalog: async (agentId) =>
        agentId === 'claude'
          ? {
            status: 'unsupported',
            reason: 'agent-does-not-expose-model-list',
            models: [],
          }
          : {
            status: 'ready',
            models: [{ value: `${agentId}-model`, label: `${agentId} model` }],
          },
      shutdown: async () => {
        await Promise.resolve();
      },
    };
    http = await startPlaygroundHttp({
      port,
      assetsRoot: assets,
      store,
      engine: engine as never,
    });
  });

  afterEach(async () => {
    await http?.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('disconnects only a backpressured SSE subscriber', () => {
    const healthy = {
      destroyed: false,
      writableEnded: false,
      write: rstest.fn(() => true),
      destroy: rstest.fn(),
    };
    const slow = {
      destroyed: false,
      writableEnded: false,
      write: rstest.fn(() => false),
      destroy: rstest.fn(() => slow.destroyed = true),
    };
    const targets = new Set<ServerResponse>([
      healthy as unknown as ServerResponse,
      slow as unknown as ServerResponse,
    ]);
    publishSseFrame(targets, 'event: activity\ndata: {}\n\n');
    expect([...targets]).toEqual([healthy]);
    expect(healthy.destroy).not.toHaveBeenCalled();
    expect(slow.destroy).toHaveBeenCalledOnce();
  });

  test('preview has strict CSP, no cookies, and no API surface', async () => {
    expect(http!.previewIsolation).toMatchObject({
      status: 'isolated',
      isolationCompliant: true,
      previewHost: 'localhost',
      previewBoundHost: '127.0.0.1',
      distinctPort: true,
    });
    previewPort = Number(new URL(http!.previewOrigin).port);
    const response = await rawFetch(previewPort, '/', {
      Host: `localhost:${previewPort}`,
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<title>preview</title>');
    expect(response.headers.get('set-cookie')).toBeNull();
    const csp = response.headers.get('content-security-policy')!;
    expect(csp).toContain('connect-src \'self\' blob:');
    expect(csp).toContain(
      'script-src \'self\' \'unsafe-inline\' \'unsafe-eval\' blob:',
    );
    expect(csp).toContain('style-src \'self\' \'unsafe-inline\' blob:');
    expect(csp).not.toMatch(/connect-src[^;]*https?:/u);
    expect(csp).toContain('form-action \'none\'');
    expect(csp).toContain('img-src \'none\'');
    expect(csp).toContain('font-src \'none\'');
    expect(csp).toContain('object-src \'none\'');
    expect(csp).toContain('frame-src \'self\'');
    expect(csp).not.toContain('navigate-to');
    expect(csp).not.toContain('allow-forms');
    expect(csp).not.toContain('allow-popups');
    expect(csp).not.toContain('allow-top-navigation');
    expect(csp).not.toContain('allow-downloads');
    expect(csp).toContain('sandbox allow-scripts allow-same-origin');
    const previewApi = await rawFetch(previewPort, '/api/agents', {
      Host: `localhost:${previewPort}`,
    });
    expect(previewApi.status).toBe(404);
  });

  test('serves disjoint control and Preview static asset allowlists', async () => {
    previewPort = Number(new URL(http!.previewOrigin).port);
    const controlHeaders = { Host: `127.0.0.1:${port}` };
    const previewHeaders = { Host: `localhost:${previewPort}` };

    const controlIndex = await rawFetch(port, '/', controlHeaders);
    expect(await controlIndex.text()).toContain(
      '<title>control</title>',
    );
    expect(
      await rawFetch(
        port,
        '/static/js/index.deadbeef.js',
        controlHeaders,
      ),
    ).toMatchObject({ status: 200 });
    for (
      const route of [
        '/preview.html',
        '/static/js/preview.deadbeef.js',
        '/static/js/async/runtime.deadbeef.js',
        '/static/wasm/deadbeef.module.wasm',
      ]
    ) {
      const response = await rawFetch(port, route, controlHeaders);
      expect(response.status).toBe(404);
    }

    expect(
      await rawFetch(
        previewPort,
        '/static/js/preview.deadbeef.js',
        previewHeaders,
      ),
    ).toMatchObject({ status: 200 });
    expect(
      await rawFetch(
        previewPort,
        '/static/js/async/runtime.deadbeef.js',
        previewHeaders,
      ),
    ).toMatchObject({ status: 200 });
    expect(
      await rawFetch(
        previewPort,
        '/static/wasm/deadbeef.module.wasm',
        previewHeaders,
      ),
    ).toMatchObject({ status: 200 });
    for (
      const route of [
        '/index.html',
        '/static/js/index.deadbeef.js',
        '/static/css/index.deadbeef.css',
      ]
    ) {
      const response = await rawFetch(previewPort, route, previewHeaders);
      expect(response.status).toBe(404);
    }
  });

  test('exposes formal origins and rejects a fixed-port strict preview', async () => {
    const { cookie } = await bootstrap(http!, port);
    const status = await rawFetch(port, '/api/bootstrap', { Cookie: cookie });
    expect(await status.json()).toMatchObject({
      previewIsolation: {
        status: 'isolated',
        isolationCompliant: true,
        controlOrigin: `http://127.0.0.1:${port}`,
        previewOrigin: http!.previewOrigin,
        distinctPort: true,
      },
    });
    await expect(startPlaygroundHttp({
      port: port + 4_000,
      previewPort: port + 6_000,
      requireIsolatedPreview: true,
      assetsRoot: assets,
      store: new PlaygroundStore(path.join(root, 'isolated-data')),
      engine: { descriptors: () => [] } as never,
    })).rejects.toThrow(/independent dynamic port/);
  });

  test('control API rejects unauthenticated, bad host, Origin:null, and missing CSRF', async () => {
    const unauthenticated = await fetch(`http://127.0.0.1:${port}/api/agents`);
    expect(unauthenticated.status).toBe(401);
    const previewOriginAttack = await fetch(
      `http://127.0.0.1:${port}/api/agents`,
      {
        headers: { Origin: http!.previewOrigin },
      },
    );
    expect(previewOriginAttack.status).toBe(401);
    const badHost = await rawFetch(port, '/api/agents', {
      Host: `localhost:${port}`,
    });
    expect(badHost.status).toBe(403);
    const url = http!.issueBootstrapUrl();
    const token = new URL(url).hash.slice('#bootstrap='.length);
    const bootstrap = await fetch(`http://127.0.0.1:${port}/api/bootstrap`, {
      method: 'POST',
      headers: {
        Origin: `http://127.0.0.1:${port}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: decodeURIComponent(token) }),
    });
    const cookie = bootstrap.headers.getSetCookie().map((item) =>
      item.split(';')[0]
    ).join('; ');
    expect(bootstrap.headers.getSetCookie()).toHaveLength(1);
    expect(bootstrap.headers.getSetCookie()[0]).toContain('HttpOnly');
    expect(bootstrap.headers.getSetCookie()[0]).not.toContain('Domain=');
    const existingBootstrap = await rawFetch(port, '/api/bootstrap', {
      Cookie: cookie,
    });
    expect(existingBootstrap.status).toBe(200);
    const nullOrigin = await rawFetch(
      port,
      '/api/conversations/11111111-1111-4111-8111-111111111111',
      { Cookie: cookie, Origin: 'null' },
      'PUT',
      '{}',
    );
    expect(nullOrigin.status).toBe(403);
    const missingCsrf = await rawFetch(
      port,
      '/api/conversations/11111111-1111-4111-8111-111111111111',
      { Cookie: cookie, Origin: `http://127.0.0.1:${port}` },
      'PUT',
      '{}',
    );
    expect(missingCsrf.status).toBe(403);
  });

  test('exposes exactly the four supported Agents', async () => {
    const { cookie } = await bootstrap(http!, port);
    const response = await rawFetch(port, '/api/agents', { Cookie: cookie });
    expect(response.status).toBe(200);
    const body = await response.json() as {
      agents: Array<{ id: string }>;
    };
    expect(body.agents.map((agent) => agent.id)).toEqual([
      'codex',
      'claude',
      'cursor',
      'trae',
    ]);
    expect(Object.keys(body)).toEqual(['agents']);
  });

  test('protects model discovery and returns ready or unsupported catalogs', async () => {
    const unauthenticated = await rawFetch(
      port,
      '/api/agents/codex/models',
      {},
    );
    expect(unauthenticated.status).toBe(401);
    const { cookie } = await bootstrap(http!, port);
    const badHost = await rawFetch(port, '/api/agents/codex/models', {
      Cookie: cookie,
      Host: `localhost:${port}`,
    });
    expect(badHost.status).toBe(403);
    const nullOrigin = await rawFetch(port, '/api/agents/codex/models', {
      Cookie: cookie,
      Origin: 'null',
    });
    expect(nullOrigin.status).toBe(403);
    const ready = await rawFetch(port, '/api/agents/codex/models', {
      Cookie: cookie,
    });
    expect(await ready.json()).toEqual({
      status: 'ready',
      models: [{ value: 'codex-model', label: 'codex model' }],
    });
    const unsupported = await rawFetch(port, '/api/agents/claude/models', {
      Cookie: cookie,
    });
    expect(await unsupported.json()).toEqual({
      status: 'unsupported',
      reason: 'agent-does-not-expose-model-list',
      models: [],
    });
    const unknown = await rawFetch(port, '/api/agents/unknown/models', {
      Cookie: cookie,
    });
    expect(unknown.status).toBe(400);

    engine.modelCatalog = () =>
      Promise.reject(
        new PlaygroundError(
          502,
          'Could not load models',
          'MODEL_DISCOVERY_FAILED',
        ),
      );
    const failed = await rawFetch(port, '/api/agents/codex/models', {
      Cookie: cookie,
    });
    expect(failed.status).toBe(502);
    expect(await failed.json()).toMatchObject({
      error: { code: 'MODEL_DISCOVERY_FAILED' },
    });
  });

  test('rejects conflicting SSE replay cursors', async () => {
    const url = http!.issueBootstrapUrl();
    const token = decodeURIComponent(
      new URL(url).hash.slice('#bootstrap='.length),
    );
    const bootstrap = await fetch(`http://127.0.0.1:${port}/api/bootstrap`, {
      method: 'POST',
      headers: {
        Origin: `http://127.0.0.1:${port}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });
    const cookie = bootstrap.headers.getSetCookie().map((item) =>
      item.split(';')[0]
    ).join('; ');
    const conversation = '11111111-1111-4111-8111-111111111111';
    const boot = await bootstrap.json() as { csrf: string };
    await rawFetch(
      port,
      `/api/conversations/${conversation}`,
      {
        Cookie: cookie,
        Origin: `http://127.0.0.1:${port}`,
        'X-GenUI-CSRF': boot.csrf,
      },
      'PUT',
      '{}',
    );
    const response = await rawFetch(
      port,
      `/api/conversations/${conversation}/events?after=1`,
      { Cookie: cookie, 'Last-Event-ID': '2' },
    );
    expect(response.status).toBe(400);
  });

  test('bootstrap tokens are one-shot and traversal is rejected', async () => {
    const url = http!.issueBootstrapUrl();
    const token = decodeURIComponent(
      new URL(url).hash.slice('#bootstrap='.length),
    );
    const init = {
      method: 'POST',
      headers: {
        Origin: `http://127.0.0.1:${port}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    };
    const first = await fetch(`http://127.0.0.1:${port}/api/bootstrap`, init);
    expect(first.status).toBe(200);
    const second = await fetch(`http://127.0.0.1:${port}/api/bootstrap`, init);
    expect(second.status).toBe(401);
    const traversal = await rawFetch(port, '/%2e%2e/package.json', {});
    expect(traversal.status).not.toBe(200);
  });

  test('rejects non-object JSON request bodies', async () => {
    const url = http!.issueBootstrapUrl();
    const token = decodeURIComponent(
      new URL(url).hash.slice('#bootstrap='.length),
    );
    const response = await fetch(`http://127.0.0.1:${port}/api/bootstrap`, {
      method: 'POST',
      headers: {
        Origin: `http://127.0.0.1:${port}`,
        'Content-Type': 'application/json',
      },
      body: 'null',
    });
    expect(response.status).toBe(400);
    const valid = await fetch(`http://127.0.0.1:${port}/api/bootstrap`, {
      method: 'POST',
      headers: {
        Origin: `http://127.0.0.1:${port}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });
    expect(valid.status).toBe(200);
  });

  test('supports idempotent writes, 409 conflicts, and durable SSE replay', async () => {
    const { cookie, csrf } = await bootstrap(http!, port);
    const headers = {
      Cookie: cookie,
      Origin: `http://127.0.0.1:${port}`,
      'X-GenUI-CSRF': csrf,
      'Content-Type': 'application/json',
    };
    const conversation = '11111111-1111-4111-8111-111111111111';
    const first = await rawFetch(
      port,
      `/api/conversations/${conversation}`,
      headers,
      'PUT',
      JSON.stringify({ title: 'One' }),
    );
    expect(first.status).toBe(201);
    const retry = await rawFetch(
      port,
      `/api/conversations/${conversation}`,
      headers,
      'PUT',
      JSON.stringify({ title: 'One' }),
    );
    expect(retry.status).toBe(200);
    const conflict = await rawFetch(
      port,
      `/api/conversations/${conversation}`,
      headers,
      'PUT',
      JSON.stringify({ title: 'Two' }),
    );
    expect(conflict.status).toBe(409);
    const replay = await rawSse(
      port,
      `/api/conversations/${conversation}/events?after=0`,
      { Cookie: cookie },
    );
    expect(replay).toContain('event: conversation.created');
    expect(replay).toContain(`"conversationId":"${conversation}"`);
  });

  test('rejects unknown Agent session and turn request bodies with 400', async () => {
    const { cookie, csrf } = await bootstrap(http!, port);
    const headers = {
      Cookie: cookie,
      Origin: `http://127.0.0.1:${port}`,
      'X-GenUI-CSRF': csrf,
      'Content-Type': 'application/json',
    };
    const conversation = '11111111-1111-4111-8111-111111111111';
    const session = '22222222-2222-4222-8222-222222222222';
    const turn = '33333333-3333-4333-8333-333333333333';
    await rawFetch(
      port,
      `/api/conversations/${conversation}`,
      headers,
      'PUT',
      '{}',
    );
    const rejectedSession = await rawFetch(
      port,
      `/api/conversations/${conversation}/sessions/${session}`,
      headers,
      'PUT',
      JSON.stringify({ agentId: 'unsupported-agent' }),
    );
    expect(rejectedSession.status).toBe(400);
    expect(await rejectedSession.json()).toMatchObject({
      error: { code: 'PLAYGROUND_ERROR' },
    });
    const rejectedTurn = await rawFetch(
      port,
      `/api/conversations/${conversation}/turns/${turn}`,
      headers,
      'PUT',
      JSON.stringify({
        sessionId: session,
        agentId: 'unsupported-agent',
        prompt: 'Must not run',
      }),
    );
    expect(rejectedTurn.status).toBe(400);
    expect(await rejectedTurn.json()).toMatchObject({
      error: { code: 'PLAYGROUND_ERROR' },
    });
  });

  test('returns an explicit snapshot cursor and replays only after its sequence', async () => {
    const { cookie, csrf } = await bootstrap(http!, port);
    const headers = {
      Cookie: cookie,
      Origin: `http://127.0.0.1:${port}`,
      'X-GenUI-CSRF': csrf,
      'Content-Type': 'application/json',
    };
    const conversation = '11111111-1111-4111-8111-111111111111';
    await rawFetch(
      port,
      `/api/conversations/${conversation}`,
      headers,
      'PUT',
      '{}',
    );
    const snapshotResponse = await rawFetch(
      port,
      `/api/conversations/${conversation}?cursor=0&limit=10`,
      { Cookie: cookie },
    );
    const snapshot = await snapshotResponse.json() as {
      sequence: number;
      pendingApprovals: unknown[];
      pagination: Record<string, unknown>;
    };
    expect(snapshot.sequence).toBeGreaterThan(0);
    expect(snapshot.pendingApprovals).toEqual([]);
    expect(snapshot.pagination).toMatchObject({
      cursor: 0,
      limit: 10,
      nextCursor: null,
      truncated: false,
    });
    const replay = rawSse(
      port,
      `/api/conversations/${conversation}/events?after=${snapshot.sequence}`,
      { Cookie: cookie },
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    // A fresh durable event after the snapshot cursor is the only replayed item.
    const next = store.emit(conversation, 'test.event', {});
    http!.publish(conversation, next);
    expect(await replay).toContain(`id: ${snapshot.sequence + 1}`);
  });

  test('rejects conflicting after and Last-Event-ID replay cursors', async () => {
    const { cookie } = await bootstrap(http!, port);
    const conversation = '11111111-1111-4111-8111-111111111111';
    const response = await rawFetch(
      port,
      `/api/conversations/${conversation}/events?after=1`,
      { Cookie: cookie, 'Last-Event-ID': '2' },
    );
    expect(response.status).toBe(400);
  });

  test('rejects unsafe integer SSE replay cursors', async () => {
    const { cookie } = await bootstrap(http!, port);
    const conversation = '11111111-1111-4111-8111-111111111111';
    const response = await rawFetch(
      port,
      `/api/conversations/${conversation}/events?after=999999999999999999999`,
      { Cookie: cookie },
    );
    expect(response.status).toBe(400);
  });
});

async function bootstrap(
  http: Awaited<ReturnType<typeof startPlaygroundHttp>>,
  port: number,
): Promise<{ cookie: string; csrf: string }> {
  const token = decodeURIComponent(
    new URL(http.issueBootstrapUrl()).hash.slice('#bootstrap='.length),
  );
  const response = await fetch(`http://127.0.0.1:${port}/api/bootstrap`, {
    method: 'POST',
    headers: {
      Origin: `http://127.0.0.1:${port}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  });
  const body = await response.json() as { csrf: string };
  return {
    cookie: response.headers.getSetCookie().map((item) => item.split(';')[0])
      .join('; '),
    csrf: body.csrf,
  };
}

async function rawFetch(
  port: number,
  route: string,
  headers: Record<string, string>,
  method = 'GET',
  body?: string,
): Promise<Response> {
  return await new Promise((resolve, reject) => {
    const request = httpRequest({
      host: '127.0.0.1',
      port,
      path: route,
      method,
      headers,
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => {
        resolve(
          new Response(Buffer.concat(chunks), {
            status: response.statusCode ?? 500,
            headers: response.headers as HeadersInit,
          }),
        );
      });
    });
    request.once('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

async function rawSse(
  port: number,
  route: string,
  headers: Record<string, string>,
): Promise<string> {
  return await new Promise((resolve, reject) => {
    const request = httpRequest({
      host: '127.0.0.1',
      port,
      path: route,
      headers,
    }, (response) => {
      response.setEncoding('utf8');
      let body = '';
      response.on('data', (chunk: string) => {
        body += chunk;
        if (body.includes('\n\n')) {
          request.destroy();
          resolve(body);
        }
      });
    });
    request.once('error', (error) => {
      if ((error as NodeJS.ErrnoException).code !== 'ECONNRESET') reject(error);
    });
    request.end();
  });
}
