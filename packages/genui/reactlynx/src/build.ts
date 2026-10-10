// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ReactLynxSource } from './source.js';

/** One emitted Web or Native build asset, ready for host-owned publication. */
export interface ReactLynxBuildAsset {
  /** Output-relative asset path with forward slashes. */
  name: string;
  /** Complete emitted asset bytes. */
  data: Buffer;
}

/** Build progress reported while waiting for a slot or running the compiler. */
export type ReactLynxBuildStatus = 'queued' | 'building';

const MAX_BUILD_BYTES = 16 * 1024 * 1024;
const BUILD_TIMEOUT_MS = 120_000;
const pending: Array<() => void> = [];
let active = 0;

async function acquire(signal: AbortSignal) {
  signal.throwIfAborted();
  if (active >= 2) {
    if (pending.length >= 8) {
      throw new Error('ReactLynx build queue is full. Try again later.');
    }
    await new Promise<void>((resolve, reject) => {
      const ready = () => {
        signal.removeEventListener('abort', abort);
        resolve();
      };
      const abort = () => {
        const index = pending.indexOf(ready);
        if (index !== -1) pending.splice(index, 1);
        reject(
          new Error('ReactLynx build cancelled', { cause: signal.reason }),
        );
      };
      pending.push(ready);
      signal.addEventListener('abort', abort, { once: true });
    });
  } else {
    active++;
  }
}

function release() {
  const next = pending.shift();
  if (next) next();
  else active--;
}

async function runWorker(directory: string, signal: AbortSignal) {
  // Do not inherit model/storage credentials or NODE_OPTIONS into the compiler.
  const worker = new URL(
    /* webpackIgnore: true */ './build-worker.js',
    import.meta.url,
  );
  const child = spawn(process.execPath, [
    '--max-old-space-size=1024',
    fileURLToPath(worker),
    directory,
  ], {
    cwd: directory,
    env: {
      PATH: process.env['PATH'],
      SystemRoot: process.env['SystemRoot'],
      NODE_ENV: 'production',
      NO_COLOR: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let diagnostic = '';
  let outputBytes = 0;
  let failure: string | undefined;
  const stop = () => {
    child.kill('SIGKILL');
  };
  const timer = setTimeout(() => {
    failure = 'ReactLynx build timed out';
    stop();
  }, BUILD_TIMEOUT_MS);
  const collect = (chunk: Buffer) => {
    outputBytes += chunk.length;
    diagnostic = (diagnostic + chunk.toString()).slice(-12_000);
    if (outputBytes > 1024 * 1024) {
      failure = 'ReactLynx build produced too many diagnostics';
      stop();
    }
  };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  signal.addEventListener('abort', stop, { once: true });
  if (signal.aborted) stop();
  try {
    await new Promise<void>((resolve, reject) => {
      child.once('error', reject);
      child.once('close', code => {
        if (signal.aborted) {
          reject(
            new Error('ReactLynx build cancelled', { cause: signal.reason }),
          );
        } else if (failure || code !== 0) {
          reject(
            new Error(
              failure
                ?? `ReactLynx build failed:\n${
                  diagnostic.replaceAll(directory, '<project>')
                }`,
            ),
          );
        } else resolve();
      });
    });
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', stop);
  }
}

function resolveBuildNodeModules(): string {
  let directory = path.dirname(fileURLToPath(import.meta.url));
  while (true) {
    const nodeModules = path.join(directory, 'node_modules');
    if (existsSync(path.join(nodeModules, '@lynx-js/react'))) {
      return nodeModules;
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      throw new Error('ReactLynx build dependencies could not be resolved');
    }
    directory = parent;
  }
}

/**
 * Compile generated source into Web and Native assets in an isolated Node.js process.
 *
 * @param source - Complete two-file source validated by {@link parseReactLynxSource}.
 * @param signal - Cancels queued or running compilation.
 * @param onStatus - Receives queue and compiler progress.
 * @returns Every emitted asset, including `main.web.js` and `main.lynx.js`.
 * @remarks Keep this entry external when bundling your server so its adjacent worker remains available.
 */
export async function buildReactLynx(
  source: ReactLynxSource,
  signal: AbortSignal,
  onStatus: (status: ReactLynxBuildStatus) => void,
): Promise<ReactLynxBuildAsset[]> {
  onStatus('queued');
  await acquire(signal);
  let directory: string | undefined;
  try {
    signal.throwIfAborted();
    onStatus('building');
    directory = await mkdtemp(path.join(tmpdir(), 'genui-reactlynx-'));
    for (const [name, content] of Object.entries(source.files)) {
      await writeFile(path.join(directory, name), content);
    }
    await writeFile(
      path.join(directory, 'index.tsx'),
      [
        'import { root } from \'@lynx-js/react\';',
        'import App from \'./App.js\';',
        'import \'./App.css\';',
        'root.render(<App />);',
      ].join('\n'),
    );
    await writeFile(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: { jsx: 'preserve', jsxImportSource: '@lynx-js/react' },
      }),
    );
    await symlink(
      resolveBuildNodeModules(),
      path.join(directory, 'node_modules'),
      'dir',
    );
    await runWorker(directory, signal);
    signal.throwIfAborted();
    const output = path.join(directory, 'dist');
    const files = await readdir(output, {
      recursive: true,
      withFileTypes: true,
    });
    const assets: ReactLynxBuildAsset[] = [];
    let bytes = 0;
    for (const file of files) {
      if (file.isDirectory()) continue;
      if (!file.isFile()) throw new Error('Unexpected build output');
      const absolute = path.join(file.parentPath, file.name);
      const info = await stat(absolute);
      bytes += info.size;
      if (bytes > MAX_BUILD_BYTES || assets.length >= 128) {
        throw new Error('ReactLynx build output exceeds limits');
      }
      assets.push({
        name: path.relative(output, absolute).split(path.sep).join('/'),
        data: await readFile(absolute),
      });
    }
    if (
      !['main.web.js', 'main.lynx.js'].every(name =>
        assets.some(asset => asset.name === name)
      )
    ) {
      throw new Error('ReactLynx build did not emit Web and Native bundles');
    }
    return assets;
  } finally {
    try {
      if (directory) await rm(directory, { recursive: true, force: true });
    } finally {
      release();
    }
  }
}
