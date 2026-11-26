// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { FileChange, FileContent, FileMap } from './types.js';

/** The part of a Node.js-style `fs` the kit uses for project files. */
export interface ProjectFs {
  existsSync(path: string): boolean;
  statSync(path: string): { isDirectory(): boolean; isFile(): boolean };
  readdirSync(path: string): string[];
  readFileSync(path: string): Uint8Array;
  writeFileSync(path: string, content: string | Uint8Array): void;
  mkdirSync(path: string, options: { recursive: true }): unknown;
  rmSync(path: string, options: { recursive: true; force: true }): void;
  renameSync(from: string, to: string): void;
}

/**
 * Checks a project-relative path and returns why it is invalid, or
 * `undefined` when it is valid.
 */
export function checkPath(path: unknown): string | undefined {
  if (typeof path !== 'string') return 'a path must be a string';
  if (path === '') return 'a path must not be empty';
  if (path.startsWith('/')) return `"${path}" must not start with "/"`;
  if (path.includes('\\')) return `"${path}" must use "/" as the separator`;
  if (path.includes('\0')) return `"${path}" must not contain NUL`;
  for (const segment of path.split('/')) {
    if (segment === '') return `"${path}" must not have empty segments`;
    if (segment === '.' || segment === '..') {
      return `"${path}" must not have "." or ".." segments`;
    }
  }
  return undefined;
}

/** Throws a `TypeError` when a project-relative path is invalid. */
export function assertPath(path: unknown): asserts path is string {
  const problem = checkPath(path);
  if (problem !== undefined) throw new TypeError(`Invalid path: ${problem}`);
}

function assertContent(
  path: string,
  content: unknown,
): asserts content is FileContent {
  if (typeof content !== 'string' && !(content instanceof Uint8Array)) {
    throw new TypeError(
      `Invalid content of "${path}": expected a string or a Uint8Array`,
    );
  }
}

/** Checks every change before any of them is applied. */
export function assertChanges(
  changes: unknown,
): asserts changes is FileChange[] {
  if (!Array.isArray(changes)) throw new TypeError('changes must be an array');
  for (const change of changes as unknown[]) {
    const c = change as Partial<Record<string, unknown>> | null;
    switch (c?.['type']) {
      case 'write':
        assertPath(c['path']);
        assertContent(c['path'], c['content']);
        break;
      case 'delete':
        assertPath(c['path']);
        break;
      case 'rename':
        assertPath(c['from']);
        assertPath(c['to']);
        break;
      default:
        throw new TypeError(
          `Invalid change: ${
            JSON.stringify(change)
          }; type must be write, delete or rename`,
        );
    }
  }
}

/** Every file under `dir`, as absolute paths. */
function filesUnder(fs: ProjectFs, dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  if (!fs.statSync(dir).isDirectory()) return [dir];
  const out: string[] = [];
  for (const name of fs.readdirSync(dir)) {
    out.push(...filesUnder(fs, `${dir}/${name}`));
  }
  return out;
}

const parentOf = (path: string): string =>
  path.slice(0, path.lastIndexOf('/')) || '/';

/** What changed on disk; what a watcher needs to know. */
export interface AppliedChanges {
  /** Absolute paths of files written or created. */
  changed: Set<string>;
  /** Absolute paths of files removed. */
  removed: Set<string>;
}

/**
 * Applies changes, in order, to the project at `root`. Paths must have been
 * checked with {@link assertChanges}.
 */
export function applyChanges(
  fs: ProjectFs,
  root: string,
  changes: FileChange[],
): AppliedChanges {
  const changed = new Set<string>();
  const removed = new Set<string>();
  const touch = (path: string) => {
    removed.delete(path);
    changed.add(path);
  };
  const drop = (path: string) => {
    changed.delete(path);
    removed.add(path);
  };
  for (const change of changes) {
    switch (change.type) {
      case 'write': {
        const path = `${root}/${change.path}`;
        if (fs.existsSync(path) && fs.statSync(path).isDirectory()) {
          for (const file of filesUnder(fs, path)) drop(file);
          fs.rmSync(path, { recursive: true, force: true });
        }
        fs.mkdirSync(parentOf(path), { recursive: true });
        fs.writeFileSync(path, change.content);
        touch(path);
        break;
      }
      case 'delete': {
        const path = `${root}/${change.path}`;
        for (const file of filesUnder(fs, path)) drop(file);
        fs.rmSync(path, { recursive: true, force: true });
        break;
      }
      case 'rename': {
        const from = `${root}/${change.from}`;
        const to = `${root}/${change.to}`;
        if (from === to) break;
        if (!fs.existsSync(from)) {
          throw new Error(`Cannot rename "${change.from}": it does not exist`);
        }
        if (to.startsWith(`${from}/`)) {
          throw new Error(`Cannot rename "${change.from}" into itself`);
        }
        const moved = filesUnder(fs, from);
        for (const file of filesUnder(fs, to)) drop(file);
        fs.rmSync(to, { recursive: true, force: true });
        fs.mkdirSync(parentOf(to), { recursive: true });
        fs.renameSync(from, to);
        for (const file of moved) {
          drop(file);
          touch(to + file.slice(from.length));
        }
        break;
      }
    }
  }
  return { changed, removed };
}

/** Writes the initial files of a project. */
export function writeFiles(fs: ProjectFs, root: string, files: FileMap): void {
  const changes: FileChange[] = Object.entries(files).map((
    [path, content],
  ) => ({
    type: 'write',
    path,
    content,
  }));
  assertChanges(changes);
  applyChanges(fs, root, changes);
}

/** The project's files as sorted project-relative paths. */
export function listFiles(fs: ProjectFs, root: string): string[] {
  return filesUnder(fs, root)
    .map((file) => file.slice(root.length + 1))
    .sort();
}

/** Reads a project file, or `undefined` when it is not a file. */
export function readFile(
  fs: ProjectFs,
  root: string,
  path: string,
): Uint8Array | undefined {
  assertPath(path);
  const absolute = `${root}/${path}`;
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    return undefined;
  }
  const content = fs.readFileSync(absolute);
  return new Uint8Array(content.buffer, content.byteOffset, content.byteLength)
    .slice();
}
