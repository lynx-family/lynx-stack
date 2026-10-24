// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@rstest/core';

test(
  'starts the built server and serves metadata without model credentials',
  async () => {
    const child = spawn(process.execPath, [
      resolve(dirname(fileURLToPath(import.meta.url)), '../dist/index.js'),
    ], {
      env: {
        ...process.env,
        GENUI_MODEL_CONFIG_JSON: '{}',
        GENUI_HTTP2: '0',
        LYNX_USE_HOST: '127.0.0.1',
        LYNX_USE_PORT: '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const closed = new Promise<void>(resolve =>
      child.once('close', () => resolve())
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const url = await new Promise<string>((resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Server startup timed out:\n${output}`)),
          10_000,
        );
        child.once('error', reject);
        child.once(
          'exit',
          code => reject(new Error(`Server exited with ${code}:\n${output}`)),
        );
        child.stderr.on('data', (chunk: Buffer) => {
          output += chunk.toString();
        });
        child.stdout.on('data', (chunk: Buffer) => {
          output += chunk.toString();
          const address = /server listening on (http:\/\/127\.0\.0\.1:\d+)/u
            .exec(output)?.[1];
          if (address) {
            resolve(address);
          }
        });
      });
      const response = await fetch(`${url}/mcp-apps/metadata`, {
        signal: AbortSignal.timeout(5_000),
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        protocolVersion: '2025-11-25',
      });
    } finally {
      clearTimeout(timer);
      child.kill('SIGKILL');
      await closed;
    }
  },
  20_000,
);
