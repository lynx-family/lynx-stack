// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import * as fs from 'node:fs';
import * as net from 'node:net';

import { ensurePrivateDirectory, readJsonFile, safeChild } from './files.js';

interface LockMetadata {
  pid: number;
  port: number;
  socketPath: string;
  instanceId: string;
  startedAt: string;
}

export interface InstanceOwner {
  readonly lockPath: string;
  readonly socketPath: string;
  close(): Promise<void>;
}

export async function claimInstance(
  dataRoot: string,
  port: number,
  issueBootstrapUrl: () => string,
): Promise<{ owner?: InstanceOwner; existingUrl?: string }> {
  ensurePrivateDirectory(dataRoot);
  dataRoot = fs.realpathSync(dataRoot);
  const lockPath = safeChild(dataRoot, 'daemon.lock');
  const socketPath = safeChild(dataRoot, 'control.sock');
  if (fs.existsSync(lockPath)) {
    try {
      const existing = readJsonFile<LockMetadata>(lockPath);
      const url = await requestBootstrap(socketPath);
      if (url) return { existingUrl: url };
      if (isProcessAlive(existing.pid)) {
        throw new ActiveInstanceError(
          `GenUI playground lock is active for PID ${existing.pid}, but its control socket is unavailable`,
        );
      }
    } catch (error) {
      if (error instanceof ActiveInstanceError) throw error;
    }
    fs.rmSync(lockPath, { force: true });
    fs.rmSync(socketPath, { force: true });
  } else if (fs.existsSync(socketPath)) {
    fs.rmSync(socketPath, { force: true });
  }
  const metadata: LockMetadata = {
    pid: process.pid,
    port,
    socketPath,
    instanceId: `${process.pid}-${Date.now()}`,
    startedAt: new Date().toISOString(),
  };
  const lockHandle = fs.openSync(lockPath, 'wx', 0o600);
  try {
    fs.writeFileSync(lockHandle, `${JSON.stringify(metadata, null, 2)}\n`);
    fs.fsyncSync(lockHandle);
  } finally {
    fs.closeSync(lockHandle);
  }

  const server = net.createServer((socket) => {
    socket.setEncoding('utf8');
    let input = '';
    socket.on('data', (chunk: string) => {
      input += chunk;
      if (input.length > 1_024) socket.destroy();
      if (!input.includes('\n')) return;
      if (input.trim() === 'bootstrap') {
        try {
          socket.end(`${JSON.stringify({ url: issueBootstrapUrl() })}\n`);
        } catch {
          socket.end('not-ready\n');
        }
      } else socket.end('error\n');
    });
  });
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(socketPath, () => {
        server.off('error', reject);
        resolve();
      });
    });
  } catch (error) {
    removeOwnedLock(lockPath, metadata.instanceId);
    throw error;
  }
  fs.chmodSync(socketPath, 0o600);
  return {
    owner: {
      lockPath,
      socketPath,
      async close() {
        await new Promise<void>((resolve) => server.close(() => resolve()));
        fs.rmSync(socketPath, { force: true });
        removeOwnedLock(lockPath, metadata.instanceId);
      },
    },
  };
}

async function requestBootstrap(
  socketPath: string,
): Promise<string | undefined> {
  if (!fs.existsSync(socketPath)) return undefined;
  return await new Promise((resolve) => {
    const socket = net.createConnection(socketPath);
    let input = '';
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(undefined);
    }, 1_000);
    socket.setEncoding('utf8');
    socket.once('connect', () => socket.write('bootstrap\n'));
    socket.on('data', (chunk: string) => input += chunk);
    socket.once('close', () => {
      clearTimeout(timer);
      try {
        const response = JSON.parse(input) as {
          url?: unknown;
        };
        resolve(
          typeof response.url === 'string'
            && response.url.startsWith('http://127.0.0.1:')
            ? response.url
            : undefined,
        );
      } catch {
        resolve(undefined);
      }
    });
    socket.once('error', () => {
      clearTimeout(timer);
      resolve(undefined);
    });
  });
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

class ActiveInstanceError extends Error {}

function removeOwnedLock(lockPath: string, instanceId: string): void {
  try {
    if (readJsonFile<LockMetadata>(lockPath).instanceId === instanceId) {
      fs.rmSync(lockPath, { force: true });
    }
  } catch {
    // Another process may already have recovered or removed this lock.
  }
}
