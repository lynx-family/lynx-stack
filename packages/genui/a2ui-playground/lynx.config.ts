// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { RsbuildPlugin } from '@rsbuild/core';

import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

// In-memory A2UI payload store. Keeps the dev-bundle / render URLs short
// enough to fit inside a scannable QR code.
interface StoredPayload {
  messages: unknown;
  actionMocks?: unknown;
  createdAt: number;
}
const payloadStore = new Map<string, StoredPayload>();
const PAYLOAD_TTL_MS = 30 * 60 * 1000; // 30 minutes

function gcPayloads(): void {
  const now = Date.now();
  for (const [id, p] of payloadStore) {
    if (now - p.createdAt > PAYLOAD_TTL_MS) {
      payloadStore.delete(id);
    }
  }
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function a2uiPayloadMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
): void {
  const url = req.url ?? '';

  if (
    req.method === 'OPTIONS'
    && (url.startsWith('/__a2ui_payload') || url.startsWith('/__a2ui/'))
  ) {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.end();
    return;
  }

  if (req.method === 'POST' && url.startsWith('/__a2ui_payload')) {
    void (async () => {
      try {
        gcPayloads();
        const body = (await readJsonBody(req)) as {
          messages?: unknown;
          actionMocks?: unknown;
        };
        const id = randomUUID();
        payloadStore.set(id, {
          messages: body.messages,
          actionMocks: body.actionMocks,
          createdAt: Date.now(),
        });
        sendJson(res, 200, {
          id,
          messagesUrl: `/__a2ui/${id}/messages`,
          actionMocksUrl: body.actionMocks === undefined
            ? undefined
            : `/__a2ui/${id}/actionMocks`,
        });
      } catch (e) {
        sendJson(res, 400, {
          error: e instanceof Error ? e.message : 'bad request',
        });
      }
    })();
    return;
  }

  if (req.method === 'GET' && url.startsWith('/__a2ui/')) {
    const m = /^\/__a2ui\/([^/]+)\/(messages|actionMocks)(?:\?|$)/.exec(url);
    if (m) {
      const [, id, field] = m;
      const entry = id ? payloadStore.get(id) : undefined;
      if (entry) {
        const value = field === 'messages'
          ? entry.messages
          : entry.actionMocks;
        sendJson(res, 200, value ?? null);
        return;
      }
    }
    sendJson(res, 404, { error: 'not found' });
    return;
  }

  next();
}

const a2uiPayloadPlugin: RsbuildPlugin = {
  name: 'a2ui-playground:payload-store',
  setup(api) {
    api.onBeforeStartDevServer(({ server }) => {
      server.middlewares.use(a2uiPayloadMiddleware);
    });
  },
};

export default defineConfig({
  plugins: [
    pluginQRCode({
      schema(url) {
        return {
          default: `${url}?fullscreen=true`,
        };
      },
    }),
    pluginReactLynx({
      defaultDisplayLinear: false,
    }),
    a2uiPayloadPlugin,
  ],
  source: {
    entry: {
      main: './lynx-src/index.tsx',
    },
  },
  environments: {
    web: {},
    lynx: {},
  },
  output: {
    distPath: {
      root: 'www',
    },
    filename: '[name].[platform].js',
  },
});
