// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, describe, expect, test } from '@rstest/core';

import { runCli } from '../src/cli.js';

const tempDirs: string[] = [];

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'genui-cli-test-'));
  tempDirs.push(dir);
  // console.info(`[test] temp dir: ${dir}`);
  return dir;
}

void afterAll(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('genui a2ui generate catalog', () => {
  test('shows help with --help flag', async () => {
    const exitCode = await runCli(['a2ui', 'generate', 'catalog', '--help']);
    expect(exitCode).toBe(0);
  });

  test('throws when no source files found', async () => {
    const tmpDir = makeTempDir();
    await expect(
      runCli(
        ['a2ui', 'generate', 'catalog', '--catalog-dir', 'nonexistent'],
        tmpDir,
      ),
    ).rejects.toThrow(/No TypeScript source files found/);
  });
});

describe('genui a2ui generate prompt', () => {
  test('shows help with --help flag', async () => {
    const exitCode = await runCli(['a2ui', 'generate', 'prompt', '--help']);
    expect(exitCode).toBe(0);
  });

  test('generates prompt to stdout with built-in catalog', async () => {
    const tmpDir = makeTempDir();
    const logs: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array) => {
      logs.push(chunk.toString());
      return true;
    };

    try {
      const exitCode = await runCli(['a2ui', 'generate', 'prompt'], tmpDir);
      expect(exitCode).toBe(0);
      const output = logs.join('');
      expect(output.length).toBeGreaterThan(0);
      expect(output).toContain('createSurface');
    } finally {
      process.stdout.write = originalWrite;
    }
  });

  test('generates prompt to file with --out', async () => {
    const tmpDir = makeTempDir();
    const outFile = path.join(tmpDir, 'prompt.txt');

    const exitCode = await runCli(
      ['a2ui', 'generate', 'prompt', '--out', outFile],
      tmpDir,
    );

    expect(exitCode).toBe(0);
    expect(fs.existsSync(outFile)).toBe(true);
    const content = fs.readFileSync(outFile, 'utf-8');
    expect(content.length).toBeGreaterThan(0);
    expect(content).toContain('createSurface');
  });

  test('accepts --appendix option', async () => {
    const tmpDir = makeTempDir();
    const outFile = path.join(tmpDir, 'prompt.txt');
    const appendix = 'CUSTOM_APPENDIX_TEXT';

    const exitCode = await runCli(
      ['a2ui', 'generate', 'prompt', '--out', outFile, '--appendix', appendix],
      tmpDir,
    );

    expect(exitCode).toBe(0);
    const content = fs.readFileSync(outFile, 'utf-8');
    expect(content).toContain(appendix);
  });

  test('throws with empty catalog directory', async () => {
    const tmpDir = makeTempDir();
    const emptyCatalogDir = path.join(tmpDir, 'empty-catalog');
    fs.mkdirSync(emptyCatalogDir);

    await expect(
      runCli(
        ['a2ui', 'generate', 'prompt', '--catalog-dir', emptyCatalogDir],
        tmpDir,
      ),
    ).rejects.toThrow(/empty|catalog/i);
  });
});
