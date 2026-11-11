// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { spawn } from 'node:child_process';
import {
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseReactWebSource } from './source.js';
import type { ReactWebSource } from './source.js';

/** The build stage reported before and after acquiring a compiler slot. */
export type ReactWebBuildStatus = 'queued' | 'building';

const MAX_BUILD_BYTES = 16 * 1024 * 1024;
const pending: Array<() => void> = [];
let active = 0;

async function acquire(signal: AbortSignal) {
  signal.throwIfAborted();
  if (active < 2) {
    active++;
    return;
  }
  if (pending.length >= 8) {
    throw new Error('ReactWeb build queue is full. Try again later.');
  }
  await new Promise<void>((resolve, reject) => {
    const ready = () => {
      signal.removeEventListener('abort', abort);
      resolve();
    };
    const abort = () => {
      const index = pending.indexOf(ready);
      if (index !== -1) pending.splice(index, 1);
      reject(new Error('ReactWeb build cancelled', { cause: signal.reason }));
    };
    pending.push(ready);
    signal.addEventListener('abort', abort, { once: true });
  });
}

async function runWorker(directory: string, signal: AbortSignal) {
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
    // Compiler processes must not inherit model or storage credentials.
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
    failure = 'ReactWeb build timed out';
    stop();
  }, 120_000);
  const collect = (chunk: Buffer) => {
    outputBytes += chunk.length;
    diagnostic = (diagnostic + chunk.toString()).slice(-12_000);
    if (outputBytes > 1024 * 1024) {
      failure = 'ReactWeb build produced too many diagnostics';
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
            new Error('ReactWeb build cancelled', { cause: signal.reason }),
          );
        } else if (failure || code !== 0) {
          reject(
            new Error(
              failure
                ?? `ReactWeb build failed:\n${
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

/** Compile React DOM source to self-contained HTML without executing it. */
export async function buildReactWeb(
  source: ReactWebSource,
  signal: AbortSignal,
  onStatus: (status: ReactWebBuildStatus) => void,
): Promise<string> {
  // Validate again at the filesystem boundary, including callers outside HTTP.
  const { files } = parseReactWebSource(JSON.stringify(source));
  onStatus('queued');
  await acquire(signal);
  let directory: string | undefined;
  try {
    signal.throwIfAborted();
    onStatus('building');
    directory = await mkdtemp(path.join(tmpdir(), 'genui-reactweb-'));
    for (const [name, content] of Object.entries(files)) {
      await writeFile(path.join(directory, name), content);
    }
    await writeFile(
      path.join(directory, 'index.tsx'),
      [
        'import { createRoot } from \'react-dom/client\';',
        'import App from \'./App.js\';',
        'import \'./App.css\';',
        'createRoot(document.getElementById(\'root\')!).render(<App />);',
      ].join('\n'),
    );
    await writeFile(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: { jsx: 'react-jsx', jsxImportSource: 'react' },
      }),
    );
    await symlink(
      fileURLToPath(
        new URL(
          /* webpackIgnore: true */ '../node_modules',
          import.meta.url,
        ),
      ),
      path.join(directory, 'node_modules'),
      'dir',
    );
    await runWorker(directory, signal);
    signal.throwIfAborted();
    const output = path.join(directory, 'dist/index.html');
    const outputStat = await stat(output);
    if (outputStat.size > MAX_BUILD_BYTES) {
      throw new Error('ReactWeb build output exceeds the 16 MB limit');
    }
    return await readFile(output, 'utf8');
  } finally {
    try {
      if (directory) await rm(directory, { recursive: true, force: true });
    } finally {
      const next = pending.shift();
      if (next) next();
      else active--;
    }
  }
}
