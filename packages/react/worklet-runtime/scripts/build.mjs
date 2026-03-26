// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { execFile } from 'node:child_process';
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(__dirname, '..');
const runtimeDir = path.resolve(packageDir, '../runtime');
const runtimeBuildDir = path.resolve(runtimeDir, 'lib/worklet-runtime');
const workletRuntimeLibDir = path.resolve(packageDir, 'lib');
const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

async function rewriteCopiedSourceMaps(dir) {
  const entries = await readdir(dir);

  await Promise.all(entries.map(async entry => {
    const filePath = path.join(dir, entry);
    const fileStat = await stat(filePath);

    if (fileStat.isDirectory()) {
      await rewriteCopiedSourceMaps(filePath);
      return;
    }

    if (!filePath.endsWith('.js.map')) {
      return;
    }

    const sourceMap = JSON.parse(await readFile(filePath, 'utf8'));
    sourceMap.sources = sourceMap.sources.map(source =>
      source.replace(
        /^((?:\.\.\/)+)src\/worklet-runtime\//,
        '$1runtime/src/worklet-runtime/',
      )
    );
    await writeFile(filePath, JSON.stringify(sourceMap));
  }));
}

async function copyDirectory(sourceDir, targetDir) {
  await mkdir(targetDir, { recursive: true });
  const entries = await readdir(sourceDir);

  await Promise.all(entries.map(async entry => {
    const sourcePath = path.join(sourceDir, entry);
    const targetPath = path.join(targetDir, entry);
    const sourceStat = await stat(sourcePath);

    if (sourceStat.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
      return;
    }

    await copyFile(sourcePath, targetPath);
  }));
}

await execFileAsync(pnpmCmd, ['run', 'build'], {
  cwd: runtimeDir,
  env: {
    ...process.env,
    CI: process.env.CI ?? 'true',
  },
});

await rm(workletRuntimeLibDir, { recursive: true, force: true });
await mkdir(packageDir, { recursive: true });
await copyDirectory(runtimeBuildDir, workletRuntimeLibDir);
await rewriteCopiedSourceMaps(workletRuntimeLibDir);

await execFileAsync(pnpmCmd, ['exec', 'rslib', 'build'], {
  cwd: packageDir,
  env: {
    ...process.env,
    CI: process.env.CI ?? 'true',
  },
});
