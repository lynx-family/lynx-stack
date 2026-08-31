// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export function ensurePrivateDirectory(directory: string): void {
  const absolute = path.resolve(directory);
  const parsed = path.parse(absolute);
  let current = parsed.root;
  for (const segment of absolute.slice(parsed.root.length).split(path.sep)) {
    if (!segment) continue;
    current = path.join(current, segment);
    try {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) {
        throw new Error(
          `Refusing symbolic link in playground data directory ancestry: ${current}`,
        );
      }
      if (!stat.isDirectory()) {
        throw new Error(
          `Playground data directory component is not a directory: ${current}`,
        );
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      try {
        fs.mkdirSync(current, { mode: 0o700 });
      } catch (mkdirError) {
        if ((mkdirError as NodeJS.ErrnoException).code !== 'EEXIST') {
          throw mkdirError;
        }
        const stat = fs.lstatSync(current);
        if (stat.isSymbolicLink() || !stat.isDirectory()) {
          throw new Error(
            `Refusing unsafe playground data directory component: ${current}`,
          );
        }
      }
    }
  }
  if (fs.realpathSync(absolute) !== absolute) {
    throw new Error(
      `Refusing non-canonical playground data directory: ${absolute}`,
    );
  }
  fs.chmodSync(absolute, 0o700);
}

export function atomicWriteFile(file: string, contents: string): void {
  ensurePrivateDirectory(path.dirname(file));
  if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink()) {
    throw new Error('Refusing symbolic-link data file: ' + file);
  }
  const temporary = `${file}.${process.pid}.${
    randomBytes(6).toString('hex')
  }.tmp`;
  const handle = fs.openSync(temporary, 'wx', 0o600);
  try {
    fs.writeFileSync(handle, contents, 'utf8');
    fs.fsyncSync(handle);
  } finally {
    fs.closeSync(handle);
  }
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
  syncDirectory(path.dirname(file));
}

export function atomicWriteJson(file: string, value: unknown): void {
  atomicWriteFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function appendPrivateLine(file: string, value: unknown): void {
  ensurePrivateDirectory(path.dirname(file));
  if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink()) {
    throw new Error(`Refusing symbolic-link data file: ${file}`);
  }
  const handle = fs.openSync(
    file,
    fs.constants.O_APPEND | fs.constants.O_CREAT | fs.constants.O_WRONLY
      | fs.constants.O_NOFOLLOW,
    0o600,
  );
  try {
    fs.writeFileSync(handle, `${JSON.stringify(value)}\n`, 'utf8');
    fs.fsyncSync(handle);
  } finally {
    fs.closeSync(handle);
  }
  fs.chmodSync(file, 0o600);
  syncDirectory(path.dirname(file));
}

function syncDirectory(directory: string): void {
  try {
    const handle = fs.openSync(directory, 'r');
    try {
      fs.fsyncSync(handle);
    } finally {
      fs.closeSync(handle);
    }
  } catch {
    // Some filesystems do not support fsync on directories.
  }
}

export function readJsonFile<T>(file: string): T {
  return JSON.parse(readPrivateFile(file)) as T;
}

export function readPrivateFile(file: string): string {
  if (fs.lstatSync(file).isSymbolicLink()) {
    throw new Error(`Refusing symbolic-link data file: ${file}`);
  }
  const handle = fs.openSync(
    file,
    fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW,
  );
  try {
    return fs.readFileSync(handle, 'utf8');
  } finally {
    fs.closeSync(handle);
  }
}

export function safeChild(root: string, ...segments: string[]): string {
  const resolvedRoot = path.resolve(root);
  const candidate = path.resolve(resolvedRoot, ...segments);
  if (
    candidate !== resolvedRoot
    && !candidate.startsWith(`${resolvedRoot}${path.sep}`)
  ) {
    throw new Error('Path escapes the playground data directory');
  }
  assertExistingPathComponentsAreSafe(resolvedRoot, candidate);
  return candidate;
}

function assertExistingPathComponentsAreSafe(
  root: string,
  candidate: string,
): void {
  if (!fs.existsSync(root)) {
    throw new Error(`Playground data root does not exist: ${root}`);
  }
  if (fs.lstatSync(root).isSymbolicLink()) {
    throw new Error(`Refusing symbolic-link data root: ${root}`);
  }
  const canonicalRoot = fs.realpathSync(root);
  const relative = path.relative(root, candidate);
  let current = root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (!fs.existsSync(current)) break;
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) {
      throw new Error(`Refusing symbolic link in playground path: ${current}`);
    }
    const canonical = fs.realpathSync(current);
    if (
      canonical !== canonicalRoot
      && !canonical.startsWith(`${canonicalRoot}${path.sep}`)
    ) {
      throw new Error(`Playground path escapes its data root: ${current}`);
    }
  }
}
