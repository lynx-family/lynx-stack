// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { spawn } from 'node:child_process';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAgentAdapters } from './adapters.js';
import { PlaygroundEngine } from './engine.js';
import { claimInstance } from './instance.js';
import { startPlaygroundHttp } from './server.js';
import { PlaygroundStore } from './store.js';
import type { PlaygroundEvent } from './types.js';
import { readValue } from '../utils.js';

const DEFAULT_PORT = 58_321;

const usage = `Usage: genui playground [options]

Run the local Lynx XML agent playground.

Options:
  --port <number>   Control port. Preview uses an independent dynamic port.
  --no-open         Print the one-time bootstrap URL without opening it.
  --data-dir <path> Persist conversations under this directory.
  --help            Print this help message.
`;

interface PlaygroundCliOptions {
  port: number;
  open: boolean;
  dataDir: string;
  help: boolean;
}

export async function runPlaygroundCli(
  args: string[],
  cwd: string,
): Promise<number> {
  const options = parseArgs(args, cwd);
  if (options.help) {
    console.info(usage);
    return 0;
  }
  let http: Awaited<ReturnType<typeof startPlaygroundHttp>> | undefined;
  let instance: Awaited<ReturnType<typeof claimInstance>>['owner'];
  let engine: PlaygroundEngine | undefined;

  try {
    // Claim the private control channel before binding TCP ports. A second CLI
    // obtains a one-time URL from the first daemon and exits.
    const nextBootstrap = (): string => {
      if (!http) throw new Error('Playground HTTP server is not ready');
      return http.issueBootstrapUrl();
    };
    const claim = await claimInstance(
      options.dataDir,
      options.port,
      () => nextBootstrap(),
    );
    if (claim.existingUrl) {
      deliverUrl(claim.existingUrl, options.open);
      return 0;
    }
    instance = claim.owner;
    const publisher: {
      publish?: (conversationId: string, event: PlaygroundEvent) => void;
    } = {};
    const store = new PlaygroundStore(options.dataDir, {
      onEvent: (conversationId, event) =>
        publisher.publish?.(
          conversationId,
          event,
        ),
    });
    engine = new PlaygroundEngine(store, createAgentAdapters(cwd), cwd);
    const assetsRoot = fileURLToPath(new URL('./public/', import.meta.url));
    try {
      http = await startPlaygroundHttp({
        port: options.port,
        assetsRoot,
        store,
        engine,
        requireIsolatedPreview:
          process.env['GENUI_REQUIRE_ISOLATED_PREVIEW'] === '1',
      });
    } catch (error) {
      if (
        error instanceof Error && 'code' in error && error.code === 'EADDRINUSE'
      ) {
        throw new Error(
          `Cannot start GenUI playground: port ${options.port} is already in use`,
        );
      }
      throw error;
    }
    publisher.publish = (conversationId, event) =>
      http?.publish(conversationId, event);
    const bootstrapUrl = http.issueBootstrapUrl();
    console.info(`GenUI playground: ${http.controlOrigin}`);
    console.info(`Preview sandbox: ${http.previewOrigin}`);
    console.info(
      http.previewIsolation.isolationCompliant
        ? 'Preview isolation: isolated (localhost, independent dynamic port)'
        : `Preview isolation: DEGRADED/NOT ISOLATED (${
          http.previewIsolation.reason ?? 'unknown reason'
        })`,
    );
    console.info(`Data directory: ${options.dataDir}`);
    deliverUrl(bootstrapUrl, options.open);

    await waitForShutdown();
    return 0;
  } finally {
    await engine?.shutdown();
    await http?.close();
    await instance?.close();
  }
}

function parseArgs(args: string[], cwd: string): PlaygroundCliOptions {
  const options: PlaygroundCliOptions = {
    port: DEFAULT_PORT,
    open: true,
    dataDir: defaultDataRoot(),
    help: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    switch (arg) {
      case '--port': {
        const value = readValue(args, ++index, arg);
        const port = Number(value);
        if (!Number.isInteger(port) || port < 1 || port > 65_535) {
          throw new Error('--port must be an integer between 1 and 65535');
        }
        options.port = port;
        break;
      }
      case '--no-open':
        options.open = false;
        break;
      case '--data-dir':
        options.dataDir = path.resolve(cwd, readValue(args, ++index, arg));
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        throw new Error(`Unknown playground option: ${arg}`);
    }
  }
  return options;
}

function defaultDataRoot(): string {
  if (process.platform === 'darwin') {
    return path.join(
      os.homedir(),
      'Library',
      'Application Support',
      'lynx-genui',
      'playground',
    );
  }
  return path.join(
    process.env['XDG_DATA_HOME'] ?? path.join(os.homedir(), '.local', 'share'),
    'lynx-genui',
    'playground',
  );
}

function deliverUrl(url: string, shouldOpen: boolean): void {
  if (!shouldOpen) {
    console.info(url);
    return;
  }
  const command = process.platform === 'darwin' ? 'open' : 'xdg-open';
  const child = spawn(command, [url], { detached: true, stdio: 'ignore' });
  child.once('error', () => console.info(url));
  child.unref();
}

function waitForShutdown(): Promise<void> {
  return new Promise((resolve) => {
    let handled = false;
    const shutdown = (): void => {
      if (handled) return;
      handled = true;
      process.off('SIGINT', shutdown);
      process.off('SIGTERM', shutdown);
      resolve();
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });
}
