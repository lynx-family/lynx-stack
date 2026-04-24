// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile as execFileCallback } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { describe, expect, test } from '@rstest/core';

const execFile = promisify(execFileCallback);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function fixturePath(...segments: string[]): string {
  return path.join(__dirname, 'fixtures', ...segments);
}

function runCli(args: readonly string[]) {
  return execFile(process.execPath, [
    '--experimental-strip-types',
    path.join(__dirname, '..', 'src', 'cli.ts'),
    ...args,
  ], {
    cwd: path.join(__dirname, '..'),
  });
}

async function withTempDir<T>(
  prefix: string,
  callback: (directory: string) => Promise<T>,
): Promise<T> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    return await callback(directory);
  } finally {
    await fs.rm(directory, { force: true, recursive: true });
  }
}

describe('cli', () => {
  test('generate writes catalog shards to disk', async () => {
    await withTempDir('a2ui-catalog-cli-generate-', async (outputDir) => {
      const { stdout } = await runCli([
        'generate',
        '--source',
        fixturePath('tsx', 'catalog'),
        '--out',
        outputDir,
        '--tsconfig',
        fixturePath('tsx', 'tsconfig.json'),
      ]);

      expect(stdout).toContain('wrote');
      const generated = await fs.readFile(
        path.join(outputDir, 'Chip', 'catalog.json'),
        'utf8',
      );
      expect(JSON.parse(generated)).toHaveProperty('Chip');
    });
  });

  test('check exits cleanly when output is current', async () => {
    await withTempDir('a2ui-catalog-cli-check-', async (outputDir) => {
      await runCli([
        'generate',
        '--source',
        fixturePath('tsx', 'catalog'),
        '--out',
        outputDir,
        '--tsconfig',
        fixturePath('tsx', 'tsconfig.json'),
      ]);

      const { stdout } = await runCli([
        'check',
        '--source',
        fixturePath('tsx', 'catalog'),
        '--out',
        outputDir,
        '--tsconfig',
        fixturePath('tsx', 'tsconfig.json'),
      ]);

      expect(stdout).toContain('catalog output is up to date');
    });
  });

  test('check fails when output has drifted', async () => {
    await withTempDir('a2ui-catalog-cli-drift-', async (outputDir) => {
      await runCli([
        'generate',
        '--source',
        fixturePath('tsx', 'catalog'),
        '--out',
        outputDir,
        '--tsconfig',
        fixturePath('tsx', 'tsconfig.json'),
      ]);

      await fs.writeFile(
        path.join(outputDir, 'Chip', 'catalog.json'),
        '{}\n',
        'utf8',
      );

      await expect(runCli([
        'check',
        '--source',
        fixturePath('tsx', 'catalog'),
        '--out',
        outputDir,
        '--tsconfig',
        fixturePath('tsx', 'tsconfig.json'),
      ])).rejects.toMatchObject({
        code: 1,
        stderr: expect.stringContaining('mismatch'),
      });
    });
  });

  test('generate rejects unsupported formats', async () => {
    await withTempDir('a2ui-catalog-cli-format-', async (outputDir) => {
      await expect(runCli([
        'generate',
        '--source',
        fixturePath('tsx', 'catalog'),
        '--out',
        outputDir,
        '--tsconfig',
        fixturePath('tsx', 'tsconfig.json'),
        '--format',
        'bogus',
      ])).rejects.toMatchObject({
        code: 1,
        stderr: expect.stringContaining('Unsupported --format "bogus"'),
      });
    });
  });
});
