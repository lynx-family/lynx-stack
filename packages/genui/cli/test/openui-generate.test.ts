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
  return dir;
}

void afterAll(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('genui openui generate prompt', () => {
  test('shows namespace help with --help flag', async () => {
    const exitCode = await runCli(['openui', '--help']);
    expect(exitCode).toBe(0);
  });

  test('shows prompt help with --help flag', async () => {
    const exitCode = await runCli(['openui', 'generate', 'prompt', '--help']);
    expect(exitCode).toBe(0);
  });

  test('generates prompt to stdout', async () => {
    const tmpDir = makeTempDir();
    const logs: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array) => {
      logs.push(chunk.toString());
      return true;
    };

    try {
      const exitCode = await runCli(['openui', 'generate', 'prompt'], tmpDir);
      expect(exitCode).toBe(0);
      const output = logs.join('');
      expect(output.length).toBeGreaterThan(0);
      expect(output).toContain('OpenUI');
      expect(output).toContain('Stack');
    } finally {
      process.stdout.write = originalWrite;
    }
  });

  test('generates prompt to file with --out', async () => {
    const tmpDir = makeTempDir();
    const outFile = path.join(tmpDir, 'openui-prompt.txt');

    const exitCode = await runCli(
      ['openui', 'generate', 'prompt', '--out', outFile],
      tmpDir,
    );

    expect(exitCode).toBe(0);
    expect(fs.existsSync(outFile)).toBe(true);
    const content = fs.readFileSync(outFile, 'utf-8');
    expect(content.length).toBeGreaterThan(0);
    expect(content).toContain('OpenUI');
    expect(content).toContain('Stack');
  });

  test('accepts --appendix option', async () => {
    const tmpDir = makeTempDir();
    const outFile = path.join(tmpDir, 'openui-prompt.txt');
    const appendix = 'CUSTOM_OPENUI_APPENDIX';

    const exitCode = await runCli(
      [
        'openui',
        'generate',
        'prompt',
        '--out',
        outFile,
        '--appendix',
        appendix,
      ],
      tmpDir,
    );

    expect(exitCode).toBe(0);
    const content = fs.readFileSync(outFile, 'utf-8');
    expect(content).toContain(appendix);
  });

  test('rejects unknown prompt option', async () => {
    await expect(
      runCli(['openui', 'generate', 'prompt', '--catalog-dir', 'dist']),
    ).rejects.toThrow(/Unknown option/);
  });
});
