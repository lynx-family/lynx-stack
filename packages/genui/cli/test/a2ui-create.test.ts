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
  console.info(`[test] temp dir: ${dir}`);
  return dir;
}

void afterAll(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('genui a2ui create', () => {
  test('creates a project with default template', async () => {
    const tmpDir = makeTempDir();
    const projectName = 'my-app';
    const exitCode = await runCli(
      ['a2ui', 'create', projectName],
      tmpDir,
    );

    expect(exitCode).toBe(0);

    const projectDir = path.join(tmpDir, projectName);
    expect(fs.existsSync(projectDir)).toBe(true);

    // Verify package.json exists and has correct name
    const pkgJson = JSON.parse(
      fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8'),
    ) as Record<string, unknown>;
    expect(pkgJson['name']).toBe(projectName);
    expect((pkgJson['scripts'] as Record<string, string>)?.['dev']).toBe(
      'rspeedy dev',
    );

    // Verify workspace: versions are resolved
    for (const field of ['dependencies', 'devDependencies']) {
      const deps = pkgJson[field];
      if (!deps) continue;
      for (const version of Object.values(deps)) {
        expect(version).not.toContain('workspace:');
      }
    }

    // Verify key source files exist
    expect(fs.existsSync(path.join(projectDir, 'src/App.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'src/index.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'lynx.config.ts'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'tsconfig.json'))).toBe(true);
  });

  test('fails when target directory is not empty', async () => {
    const tmpDir = makeTempDir();
    const projectName = 'existing-project';
    const projectDir = path.join(tmpDir, projectName);
    fs.mkdirSync(projectDir);
    fs.writeFileSync(path.join(projectDir, 'file.txt'), 'content');

    await expect(
      runCli(['a2ui', 'create', projectName], tmpDir),
    ).rejects.toThrow(/not empty/);
  });

  test('uses custom project name in package.json', async () => {
    const tmpDir = makeTempDir();
    const projectName = 'custom-name';
    await runCli(['a2ui', 'create', projectName], tmpDir);

    const pkgJson = JSON.parse(
      fs.readFileSync(path.join(tmpDir, projectName, 'package.json'), 'utf-8'),
    ) as Record<string, unknown>;
    expect(pkgJson['name']).toBe(projectName);
  });

  test('shows help with --help flag', async () => {
    const exitCode = await runCli(['a2ui', 'create', '--help']);
    expect(exitCode).toBe(0);
  });

  test('rejects unknown template', async () => {
    const tmpDir = makeTempDir();
    await expect(
      runCli(['a2ui', 'create', 'my-app', '--template', 'nonexistent'], tmpDir),
    ).rejects.toThrow(/Unknown template/);
  });
});
