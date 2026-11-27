// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// The virtual `node_modules` tree of the kit.
//
// Every package the kit bundles or provides gets one place under
// `/node_modules`, laid out the way a package manager that hoists would lay it
// out: a package goes to `/node_modules/<name>` unless another package already
// sits there, and then under the `node_modules` of the package that depends on
// it. The bundled code is told it runs from there (`import.meta.url`,
// `__dirname`), and the mirror puts files there, so `require.resolve`,
// `path.resolve(__dirname, ...)` and `fs.readFileSync` inside the bundled code
// find what they look for.

import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { pathKey, virtualPathOf } from './paths.ts';

/** The fields of a `package.json` that the build reads. */
export interface PackageJson {
  name?: string;
  version?: string;
  type?: string;
  files?: string[];
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}

/** A package placed in the virtual tree. */
export interface PackageInstance {
  name: string;
  version: string;
  realDir: string;
  virtualDir: string;
  json: PackageJson;
}

/** The virtual tree, as `createLayout` returns it. */
export interface Layout {
  /** Dependencies that are neither installed nor optional. */
  missing: string[];
  instances(): PackageInstance[];
  /**
   * The virtual path of a real file, or undefined when its package is not
   * part of the layout.
   */
  toVirtual(realFile: string): string | undefined;
}

function readJson(file: string): PackageJson {
  return JSON.parse(readFileSync(file, 'utf-8')) as PackageJson;
}

/**
 * Finds the directory of a dependency the way Node.js looks up
 * `node_modules`, ignoring `exports`.
 */
function findDependencyDir(fromDir: string, name: string): string | undefined {
  for (let dir = fromDir;; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules', name);
    if (existsSync(path.join(candidate, 'package.json'))) {
      return realpathSync(candidate);
    }
    if (path.dirname(dir) === dir) return undefined;
  }
}

function parentDirOfPackageDir(virtualDir: string): string {
  // `/a/node_modules/@s/n` -> `/a`, `/node_modules/n` -> `/`
  const index = virtualDir.lastIndexOf('/node_modules/');
  return index <= 0 ? '/' : virtualDir.slice(0, index);
}

/** The root of the package a real file belongs to (nearest named package.json). */
export function findPackageRoot(file: string): string | undefined {
  let dir = statSync(file).isDirectory() ? file : path.dirname(file);
  for (;; dir = path.dirname(dir)) {
    const pkg = path.join(dir, 'package.json');
    if (existsSync(pkg)) {
      try {
        if (typeof readJson(pkg).name === 'string') return dir;
      } catch {
        // not a package.json we understand
      }
    }
    if (path.dirname(dir) === dir) return undefined;
  }
}

/** The real directory of package `name`, looked up from the package in `from`. */
export function packageDir(name: string, from: string): string {
  const fromRequire = createRequire(path.join(from, 'package.json'));
  let entry: string;
  try {
    entry = fromRequire.resolve(`${name}/package.json`);
  } catch {
    entry = fromRequire.resolve(name);
  }
  const root = findPackageRoot(entry);
  if (root === undefined) throw new Error(`${entry} is not in a package`);
  return realpathSync(root);
}

/** Builds the layout from root packages, given as real directories. */
export function createLayout(rootDirs: string[]): Layout {
  /** virtual dir -> instance */
  const byVirtualDir = new Map<string, PackageInstance>();
  /** pathKey(real dir) -> first instance */
  const byRealDir = new Map<string, PackageInstance>();
  const missing: string[] = [];

  function place(
    realDir: string,
    name: string,
    parentVirtualDir: string,
  ): { instance: PackageInstance; isNew: boolean } {
    // Node.js looks in `<dependent>/node_modules`, then in the
    // `node_modules` of each package folder above it, then `/node_modules`.
    const candidates: string[] = [];
    for (let dir = parentVirtualDir;; dir = parentDirOfPackageDir(dir)) {
      candidates.push(
        dir === '/' ? `/node_modules/${name}` : `${dir}/node_modules/${name}`,
      );
      if (dir === '/') break;
    }
    // candidates go from nearest to farthest; pick the farthest that is free
    // or already the same package, as long as nothing nearer shadows it.
    let chosen: string | undefined;
    for (const candidate of candidates) {
      const existing = byVirtualDir.get(candidate);
      if (existing) {
        if (existing.realDir === realDir) {
          return { instance: existing, isNew: false };
        }
        break; // shadowed: must go nearer
      }
      chosen = candidate;
    }
    chosen ??= candidates[0]!;
    const json = readJson(path.join(realDir, 'package.json'));
    const instance: PackageInstance = {
      name,
      version: json.version ?? '0.0.0',
      realDir,
      virtualDir: chosen,
      json,
    };
    byVirtualDir.set(chosen, instance);
    const key = pathKey(realDir);
    if (!byRealDir.has(key)) byRealDir.set(key, instance);
    return { instance, isNew: true };
  }

  const queue: [realDir: string, name: string, parent: string][] = [];
  for (const realDir of rootDirs) {
    const json = readJson(path.join(realDir, 'package.json'));
    queue.push([realpathSync(realDir), json.name!, '/']);
  }
  for (let next = queue.shift(); next; next = queue.shift()) {
    const [realDir, name, parent] = next;
    const { instance, isNew } = place(realDir, name, parent);
    if (!isNew) continue;
    const deps = {
      ...instance.json.peerDependencies,
      ...instance.json.optionalDependencies,
      ...instance.json.dependencies,
    };
    for (const depName of Object.keys(deps).sort()) {
      const depDir = findDependencyDir(realDir, depName);
      if (!depDir) {
        if (
          !instance.json.peerDependenciesMeta?.[depName]?.optional
          && !instance.json.optionalDependencies?.[depName]
          && !instance.json.peerDependencies?.[depName]
        ) {
          missing.push(`${depName} (dependency of ${instance.name})`);
        }
        continue;
      }
      queue.push([depDir, depName, instance.virtualDir]);
    }
  }

  return {
    missing,
    instances: () => [...byVirtualDir.values()],
    toVirtual(realFile) {
      // The nearest enclosing package that is in the tree: packages may ship
      // prebundled packages inside them (`@rsbuild/core/compiled/*`).
      const real = realpathSync(realFile);
      for (let dir = path.dirname(real);; dir = path.dirname(dir)) {
        const instance = byRealDir.get(pathKey(dir));
        if (instance) {
          return virtualPathOf(instance.virtualDir, dir, real);
        }
        if (path.dirname(dir) === dir) return undefined;
      }
    },
  };
}

/** Whether Node.js treats `file` as CommonJS (it has `__dirname`). */
export function isCommonJS(file: string): boolean {
  if (file.endsWith('.cjs')) return true;
  if (file.endsWith('.mjs') || file.endsWith('.ts')) return false;
  const pkgRoot = findPackageRoot(file);
  if (!pkgRoot) return true;
  return readJson(path.join(pkgRoot, 'package.json')).type !== 'module';
}
